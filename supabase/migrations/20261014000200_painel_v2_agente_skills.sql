-- supabase/migrations/20261014000200_painel_v2_agente_skills.sql
-- Painel v2, Parte I1 (spec 7E.3): skills no formato das skills do Claude (SKILL.md com name, description e tipo +
-- arquivos de referência), com versões, liga/desliga e teste. Só o dono grava (D11); o trabalhador lê só as ligadas do
-- próprio agente (skills_do_agente, referencia_da_skill). Nada entra no Realtime (teste 22).

create table public.agente_skills (
  id uuid primary key default gen_random_uuid(),
  agente_id uuid not null references public.agentes (id) on delete cascade,
  nome text not null check (nome ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  tipo text not null check (tipo in ('jeito', 'limites', 'procedimento', 'conhecimento', 'exemplos')),
  ativo boolean not null default false,
  versao_atual int not null default 1 check (versao_atual >= 1),
  arquivada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (agente_id, nome)
);

create table public.agente_skill_versoes (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.agente_skills (id) on delete cascade,
  versao int not null check (versao >= 1),
  titulo text not null check (char_length(titulo) between 1 and 120),
  descricao text not null check (char_length(descricao) between 1 and 1024),
  tipo text not null check (tipo in ('jeito', 'limites', 'procedimento', 'conhecimento', 'exemplos')),
  corpo text not null check (char_length(corpo) between 1 and 20000),
  skill_md text not null check (char_length(skill_md) <= 25000),
  origem text not null default 'subida' check (origem in ('subida', 'restaurada')),
  restaurada_de int,
  autor_id uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default clock_timestamp(),
  unique (skill_id, versao)
);
create index agente_skill_versoes_autor_idx on public.agente_skill_versoes (autor_id);

create table public.agente_skill_arquivos (
  versao_id uuid not null references public.agente_skill_versoes (id) on delete cascade,
  caminho text not null check (char_length(caminho) between 1 and 200 and caminho !~ '(^/|\\|\.\.|[[:cntrl:]])'
                               and caminho ~* '\.(md|txt|csv)$'),
  conteudo text not null check (char_length(conteudo) <= 200000),
  primary key (versao_id, caminho)
);

alter table public.agente_skills enable row level security;
alter table public.agente_skill_versoes enable row level security;
alter table public.agente_skill_arquivos enable row level security;
create policy leitura on public.agente_skills for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.agente_skill_versoes for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.agente_skill_arquivos for select to authenticated using (public.pode_ver_agentes());
revoke all on public.agente_skills, public.agente_skill_versoes, public.agente_skill_arquivos from anon;
revoke insert, update, delete, truncate on public.agente_skills, public.agente_skill_versoes, public.agente_skill_arquivos from authenticated;
-- A chave de serviço também só lê (via skills_do_agente e referencia_da_skill): quem grava são as funções do dono (D11).
revoke insert, update, delete, truncate on public.agente_skills, public.agente_skill_versoes, public.agente_skill_arquivos from service_role;

-- Pacote montado pelo core (montarPacoteSkill); o banco confere tudo de novo (D6–D8). Mensagens vão para a pessoa.
create function interno.validar_pacote_skill(p jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare k text; x jsonb; v_c text; v_caminhos text[] := '{}'; v_total bigint := 0;
begin
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Pacote da skill inválido.'; end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('nome', 'titulo', 'descricao', 'tipo', 'corpo', 'skill_md', 'arquivos') then raise exception 'Pacote da skill inválido.'; end if;
  end loop;
  if coalesce(p ->> 'nome', '') !~ '^[a-z0-9][a-z0-9-]{0,63}$' then
    raise exception 'O "name" usa só letras minúsculas, números e hífen (até 64), como nas skills do Claude.';
  end if;
  if char_length(coalesce(p ->> 'titulo', '')) not between 1 and 120 then raise exception 'O título da skill tem até 120 letras.'; end if;
  if char_length(coalesce(p ->> 'descricao', '')) not between 1 and 1024 then raise exception 'A "description" tem de 1 a 1.024 caracteres.'; end if;
  if coalesce(p ->> 'tipo', '') not in ('jeito', 'limites', 'procedimento', 'conhecimento', 'exemplos') then
    raise exception 'Escolha o tipo da skill.';
  end if;
  if char_length(coalesce(p ->> 'corpo', '')) not between 1 and 20000 then raise exception 'O texto do SKILL.md tem de 1 a 20.000 caracteres.'; end if;
  if char_length(coalesce(p ->> 'skill_md', '')) > 25000 then raise exception 'O SKILL.md passa de 25.000 caracteres.'; end if;
  if jsonb_typeof(coalesce(p -> 'arquivos', '[]')) <> 'array' then raise exception 'Pacote da skill inválido.'; end if;
  if jsonb_array_length(coalesce(p -> 'arquivos', '[]')) > 20 then raise exception 'No máximo 20 arquivos de referência por skill.'; end if;
  for x in select * from jsonb_array_elements(coalesce(p -> 'arquivos', '[]')) loop
    v_c := x ->> 'caminho';
    if v_c is null or char_length(v_c) not between 1 and 200 or v_c ~ '(^/|\\|\.\.|[[:cntrl:]])' or v_c !~* '\.(md|txt|csv)$' then
      raise exception 'Arquivo de referência inválido: %. Use .md, .txt ou .csv.', coalesce(v_c, '(sem nome)');
    end if;
    if v_c = any (v_caminhos) then raise exception 'Arquivo repetido: %.', v_c; end if;
    if char_length(coalesce(x ->> 'conteudo', '')) > 200000 then raise exception 'O arquivo % passa de 200.000 caracteres.', v_c; end if;
    v_caminhos := v_caminhos || v_c;
    v_total := v_total + char_length(coalesce(x ->> 'conteudo', ''));
  end loop;
  if v_total > 1000000 then raise exception 'Os arquivos de referência passam de 1.000.000 de caracteres somados.'; end if;
end $$;

-- Jeito de atuar + Limites ligados entram em toda mensagem: até 10.000 caracteres por agente (D6).
create function interno.conferir_limite_sempre(p_agente uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare v_total int;
begin
  select coalesce(sum(char_length(v.corpo)), 0) into v_total
  from public.agente_skills s join public.agente_skill_versoes v on v.skill_id = s.id and v.versao = s.versao_atual
  where s.agente_id = p_agente and s.ativo and s.arquivada_em is null and s.tipo in ('jeito', 'limites');
  if v_total > 10000 then
    raise exception 'Jeito de atuar e Limites ligados passam de 10.000 caracteres (ficariam %): desligue ou encurte uma skill.', v_total;
  end if;
end $$;
revoke execute on all functions in schema interno from public, anon, authenticated;

create function public.subir_skill(p_slug text, p_pacote jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; s public.agente_skills%rowtype; v_versao int; v_versao_id uuid; v_nova boolean := false;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera as skills.'; end if;
  select * into a from public.agentes where slug = p_slug;
  if not found then raise exception 'Agente não encontrado.'; end if;
  perform interno.validar_pacote_skill(p_pacote);
  select * into s from public.agente_skills where agente_id = a.id and nome = p_pacote ->> 'nome' for update;
  if not found then
    insert into public.agente_skills (agente_id, nome, tipo) values (a.id, p_pacote ->> 'nome', p_pacote ->> 'tipo') returning * into s;
    v_versao := 1; v_nova := true;
  else
    v_versao := s.versao_atual + 1;
    update public.agente_skills set tipo = p_pacote ->> 'tipo', versao_atual = v_versao, arquivada_em = null, atualizado_em = now()
    where id = s.id;
  end if;
  insert into public.agente_skill_versoes (skill_id, versao, titulo, descricao, tipo, corpo, skill_md, autor_id)
  values (s.id, v_versao, p_pacote ->> 'titulo', p_pacote ->> 'descricao', p_pacote ->> 'tipo', p_pacote ->> 'corpo', p_pacote ->> 'skill_md', auth.uid())
  returning id into v_versao_id;
  insert into public.agente_skill_arquivos (versao_id, caminho, conteudo)
  select v_versao_id, x ->> 'caminho', x ->> 'conteudo' from jsonb_array_elements(coalesce(p_pacote -> 'arquivos', '[]')) x;
  -- Nova versão de uma skill ligada vale na hora: confere o limite com o texto novo.
  if s.ativo then perform interno.conferir_limite_sempre(a.id); end if;
  perform public.mudanca_agente(a.id, case when v_nova then format('Skill %s subida (desligada)', p_pacote ->> 'titulo')
                                           else format('Skill %s: versão %s', p_pacote ->> 'titulo', v_versao) end);
  return jsonb_build_object('skill_id', s.id, 'versao', v_versao, 'nova', v_nova);
end $$;

create function public.alternar_skill(p_skill uuid, p_ativo boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare s public.agente_skills%rowtype; v_titulo text;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera as skills.'; end if;
  if p_ativo is null then raise exception 'Informe se a skill fica ligada ou desligada.'; end if;
  select * into s from public.agente_skills where id = p_skill for update;
  if not found or s.arquivada_em is not null then raise exception 'Skill não encontrada.'; end if;
  if s.ativo = p_ativo then return s.ativo; end if;
  update public.agente_skills set ativo = p_ativo, atualizado_em = now() where id = s.id;
  if p_ativo then perform interno.conferir_limite_sempre(s.agente_id); end if;
  select titulo into v_titulo from public.agente_skill_versoes where skill_id = s.id and versao = s.versao_atual;
  perform public.mudanca_agente(s.agente_id, format('Skill %s %s', v_titulo, case when p_ativo then 'ligada' else 'desligada' end));
  return p_ativo;
end $$;

create function public.restaurar_versao_skill(p_versao uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare v public.agente_skill_versoes%rowtype; s public.agente_skills%rowtype; v_nova int; v_id uuid;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera as skills.'; end if;
  select * into v from public.agente_skill_versoes where id = p_versao;
  if not found then raise exception 'Versão não encontrada.'; end if;
  select * into s from public.agente_skills where id = v.skill_id for update;
  v_nova := s.versao_atual + 1;
  insert into public.agente_skill_versoes (skill_id, versao, titulo, descricao, tipo, corpo, skill_md, origem, restaurada_de, autor_id)
  values (s.id, v_nova, v.titulo, v.descricao, v.tipo, v.corpo, v.skill_md, 'restaurada', v.versao, auth.uid()) returning id into v_id;
  insert into public.agente_skill_arquivos (versao_id, caminho, conteudo)
  select v_id, caminho, conteudo from public.agente_skill_arquivos where versao_id = v.id;
  update public.agente_skills set tipo = v.tipo, versao_atual = v_nova, arquivada_em = null, atualizado_em = now() where id = s.id;
  if s.ativo then perform interno.conferir_limite_sempre(s.agente_id); end if;
  perform public.mudanca_agente(s.agente_id, format('Skill %s: versão %s restaurada (vira a %s)', v.titulo, v.versao, v_nova));
  return v_nova;
end $$;

create function public.arquivar_skill(p_skill uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.agente_skills%rowtype; v_titulo text;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera as skills.'; end if;
  select * into s from public.agente_skills where id = p_skill for update;
  if not found or s.arquivada_em is not null then raise exception 'Skill não encontrada.'; end if;
  update public.agente_skills set ativo = false, arquivada_em = now(), atualizado_em = now() where id = s.id;
  select titulo into v_titulo from public.agente_skill_versoes where skill_id = s.id and versao = s.versao_atual;
  perform public.mudanca_agente(s.agente_id, format('Skill %s arquivada', v_titulo));
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.subir_skill(text, jsonb)', 'public.alternar_skill(uuid, boolean)',
                           'public.restaurar_versao_skill(uuid)', 'public.arquivar_skill(uuid)'] loop
    execute format('revoke execute on function %s from public, anon, service_role', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------- O que o trabalhador lê (D5) ----------
-- Ligadas e não arquivadas do próprio agente; `p_incluir`: a skill em teste (mesmo desligada), só se for deste agente.
create function public.skills_do_agente(p_agente uuid, p_incluir uuid default null)
returns table (id uuid, nome text, tipo text, ativo boolean, titulo text, descricao text, corpo text, versao int, arquivos text[])
language sql stable security definer set search_path = '' as $$
  select s.id, s.nome, s.tipo, s.ativo, v.titulo, v.descricao, v.corpo, v.versao,
         array(select a.caminho from public.agente_skill_arquivos a where a.versao_id = v.id order by a.caminho)
  from public.agente_skills s join public.agente_skill_versoes v on v.skill_id = s.id and v.versao = s.versao_atual
  where s.agente_id = p_agente and s.arquivada_em is null and (s.ativo or s.id = p_incluir)
  order by array_position(array['limites', 'jeito', 'procedimento', 'conhecimento', 'exemplos'], s.tipo), s.nome
$$;
create function public.referencia_da_skill(p_agente uuid, p_nome text, p_caminho text, p_incluir uuid default null) returns text
language sql stable security definer set search_path = '' as $$
  select a.conteudo from public.agente_skills s
  join public.agente_skill_versoes v on v.skill_id = s.id and v.versao = s.versao_atual
  join public.agente_skill_arquivos a on a.versao_id = v.id and a.caminho = p_caminho
  where s.agente_id = p_agente and s.nome = p_nome and s.arquivada_em is null and (s.ativo or s.id = p_incluir)
$$;
revoke execute on function public.skills_do_agente(uuid, uuid), public.referencia_da_skill(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.skills_do_agente(uuid, uuid), public.referencia_da_skill(uuid, text, text, uuid) to service_role;

-- ---------- Testar uma skill (D21) ----------
alter table public.simulacoes_agente add column skill_id uuid references public.agente_skills (id) on delete set null;
create index simulacoes_agente_skill_idx on public.simulacoes_agente (skill_id);

-- Mesmas travas de criar_simulacao (20260930000200): uma pendente por pessoa. O texto de "já existe um teste em andamento"
-- segue o de criar_simulacao: o painel o reconhece por ele, então não mude um sem o outro.
create function public.criar_simulacao_skill(p_skill uuid, p_mensagem text, p_cliente_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono testa skills.'; end if;
  if not exists (select 1 from public.agente_skills s join public.agentes a on a.id = s.agente_id
                 where s.id = p_skill and s.arquivada_em is null and a.porta_de_entrada) then
    raise exception 'Nesta etapa só dá para testar skills do Thiago.';
  end if;
  if p_mensagem is null or length(trim(p_mensagem)) = 0 then raise exception 'Escreva a mensagem do cliente para o teste.'; end if;
  if length(trim(p_mensagem)) > 2000 then raise exception 'A mensagem de teste pode ter no máximo 2000 caracteres.'; end if;
  perform interno.validar_empresa(p_cliente_id);
  perform pg_advisory_xact_lock(hashtextextended('simulacoes_agente:' || auth.uid()::text, 0));
  if exists (select 1 from public.simulacoes_agente where usuario_id = auth.uid() and status = 'pendente'
             and criado_em > now() - interval '5 minutes') then
    raise exception 'Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.';
  end if;
  insert into public.simulacoes_agente (usuario_id, mensagem, cliente_id, skill_id)
  values (auth.uid(), trim(p_mensagem), p_cliente_id, p_skill) returning id into v_id;
  return v_id;
end $$;
-- Só o dono, logado, chama (auth.uid() decide); a chave de serviço não tem usuário e não precisa.
revoke execute on function public.criar_simulacao_skill(uuid, text, uuid) from public, anon, service_role;
grant execute on function public.criar_simulacao_skill(uuid, text, uuid) to authenticated;
