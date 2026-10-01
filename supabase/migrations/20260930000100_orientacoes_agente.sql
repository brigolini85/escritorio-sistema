-- Treinar o agente (pedido do dono, 2026-09-30): orientações escritas pela equipe que o agente de clientes lê
-- antes de cada resposta, com histórico de versões e simulações ("Testar antes de ligar").
-- Spec: docs/superpowers/specs/2026-09-30-treinar-agente-design.md, seção 3.
-- Quem lê e edita: administrador + quem tem a permissão 'treinar_agente'. O trabalhador lê com o cliente de serviço.

create table public.orientacoes_agente (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0 and length(titulo) <= 120),
  texto text not null check (length(trim(texto)) > 0 and length(texto) <= 2000),
  tipo text not null check (tipo in ('jeito', 'regra', 'situacao')),
  cliente_id uuid references public.clientes (id) on delete cascade,   -- vale só para essa empresa
  setor_id uuid references public.setores (id) on delete cascade,      -- vale quando o assunto for desse setor
  ativo boolean not null default false,
  criado_por uuid references public.usuarios (id) on delete set null,
  atualizado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint orientacoes_agente_empresa_ou_setor check (cliente_id is null or setor_id is null)
);
create index orientacoes_agente_ativas_idx on public.orientacoes_agente (atualizado_em desc) where ativo;
create index orientacoes_agente_cliente_idx on public.orientacoes_agente (cliente_id) where cliente_id is not null;
create index orientacoes_agente_setor_idx on public.orientacoes_agente (setor_id) where setor_id is not null;

-- Cada criação, edição, ligar/desligar e restauração grava uma versão (retrato dos campos + quem + quando + ação).
-- Sem chave estrangeira em cliente_id/setor_id: é um retrato; restaurar confere se a empresa/setor ainda existem e estão ativos.
create table public.orientacoes_agente_versoes (
  id uuid primary key default gen_random_uuid(),
  orientacao_id uuid not null references public.orientacoes_agente (id) on delete cascade,
  acao text not null check (acao in ('criar', 'editar', 'ligar', 'desligar', 'restaurar')),
  titulo text not null,
  texto text not null,
  tipo text not null,
  cliente_id uuid,
  setor_id uuid,
  ativo boolean not null,
  usuario_id uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default clock_timestamp()   -- ordem certa mesmo com várias mudanças na mesma transação
);
create index orientacoes_agente_versoes_orientacao_idx on public.orientacoes_agente_versoes (orientacao_id, criado_em desc);

create table public.simulacoes_agente (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  mensagem text not null check (length(trim(mensagem)) > 0 and length(mensagem) <= 2000),
  cliente_id uuid references public.clientes (id) on delete cascade,
  rascunho jsonb,                                  -- {titulo, texto, tipo, cliente_id, setor_id}: orientação ainda não salva
  status text not null default 'pendente' check (status in ('pendente', 'pronta', 'erro')),
  respostas jsonb,                                 -- textos que o agente mandaria + ferramentas que tentaria usar
  erro text,
  criado_em timestamptz not null default now()
);
create index simulacoes_agente_usuario_idx on public.simulacoes_agente (usuario_id, criado_em desc);
create index simulacoes_agente_criado_idx on public.simulacoes_agente (criado_em);

-- RLS: o navegador só lê; gravações passam pelas funções abaixo.
alter table public.orientacoes_agente enable row level security;
alter table public.orientacoes_agente_versoes enable row level security;
alter table public.simulacoes_agente enable row level security;

create policy leitura on public.orientacoes_agente for select to authenticated
  using (tem_permissao('treinar_agente'));
create policy leitura on public.orientacoes_agente_versoes for select to authenticated
  using (tem_permissao('treinar_agente'));
create policy leitura on public.simulacoes_agente for select to authenticated
  using (usuario_id = auth.uid() and tem_permissao('treinar_agente'));

revoke all on public.orientacoes_agente, public.orientacoes_agente_versoes, public.simulacoes_agente from anon;
revoke insert, update, delete, truncate on public.orientacoes_agente, public.orientacoes_agente_versoes, public.simulacoes_agente
  from authenticated;

alter publication supabase_realtime add table public.simulacoes_agente;

-- Auditoria (mesmo gatilho dos outros cadastros): quem criou, editou, ligou, desligou ou restaurou.
create trigger auditoria after insert or update or delete on public.orientacoes_agente
  for each row execute function public.registrar_auditoria();

-- Funções internas num esquema fora da API (não aparecem no PostgREST nem nos tipos gerados).
create schema interno;
revoke all on schema interno from public, anon, authenticated;

create function interno.validar_empresa(p_cliente_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_cliente_id is null then return; end if;
  if not exists (select 1 from clientes where id = p_cliente_id) then raise exception 'Empresa não encontrada.'; end if;
  if not exists (select 1 from clientes where id = p_cliente_id and ativo) then
    raise exception 'Esta empresa está inativa. Escolha outra empresa ou reative o cadastro.';
  end if;
end $$;

-- Validação comum de salvar, ligar, restaurar e do rascunho da simulação. Mensagens aparecem para a pessoa no painel.
create function interno.validar_orientacao(p_titulo text, p_texto text, p_tipo text, p_cliente_id uuid, p_setor_id uuid)
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_titulo is null or length(trim(p_titulo)) = 0 then raise exception 'Informe o título da orientação.'; end if;
  if length(trim(p_titulo)) > 120 then raise exception 'O título pode ter no máximo 120 caracteres.'; end if;
  if p_texto is null or length(trim(p_texto)) = 0 then raise exception 'Escreva o texto da orientação.'; end if;
  if length(trim(p_texto)) > 2000 then raise exception 'O texto pode ter no máximo 2000 caracteres.'; end if;
  if p_tipo is null or p_tipo not in ('jeito', 'regra', 'situacao') then raise exception 'Escolha o tipo da orientação.'; end if;
  if p_cliente_id is not null and p_setor_id is not null then
    raise exception 'A orientação vale para uma empresa ou para um setor, não para os dois.';
  end if;
  perform interno.validar_empresa(p_cliente_id);
  if p_setor_id is not null then
    if not exists (select 1 from setores where id = p_setor_id) then raise exception 'Setor não encontrado.'; end if;
    if not exists (select 1 from setores where id = p_setor_id and ativo) then
      raise exception 'Este setor está inativo. Escolha outro setor ou reative o setor.';
    end if;
  end if;
end $$;

create function interno.gravar_versao_orientacao(p_id uuid, p_acao text) returns void
language sql security definer set search_path = public as $$
  insert into orientacoes_agente_versoes (orientacao_id, acao, titulo, texto, tipo, cliente_id, setor_id, ativo, usuario_id)
  select id, p_acao, titulo, texto, tipo, cliente_id, setor_id, ativo, auth.uid() from orientacoes_agente where id = p_id
$$;

revoke execute on all functions in schema interno from public, anon, authenticated;

-- Cria (p_id nulo) ou edita uma orientação. Devolve o id. Empresa, setor e ativo têm padrão nulo para os tipos gerados
-- deixarem omitir (ativo nulo: false ao criar, mantém ao editar). Editar sem mudar nada não mexe em nada (sem versão,
-- sem auditoria, sem atualizado_em) e devolve o id.
create function public.salvar_orientacao(p_id uuid, p_titulo text, p_texto text, p_tipo text,
  p_cliente_id uuid default null, p_setor_id uuid default null, p_ativo boolean default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; o orientacoes_agente%rowtype;
begin
  if not tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
  if p_id is not null then
    select * into o from orientacoes_agente where id = p_id for update;
    if not found then raise exception 'Orientação não encontrada.'; end if;
    if o.titulo = trim(p_titulo) and o.texto = trim(p_texto) and o.tipo = p_tipo
       and o.cliente_id is not distinct from p_cliente_id and o.setor_id is not distinct from p_setor_id
       and o.ativo = coalesce(p_ativo, o.ativo) then
      return o.id;
    end if;
  end if;
  perform interno.validar_orientacao(p_titulo, p_texto, p_tipo, p_cliente_id, p_setor_id);
  if p_id is null then
    insert into orientacoes_agente (titulo, texto, tipo, cliente_id, setor_id, ativo, criado_por, atualizado_por)
    values (trim(p_titulo), trim(p_texto), p_tipo, p_cliente_id, p_setor_id, coalesce(p_ativo, false), auth.uid(), auth.uid())
    returning id into v_id;
    perform interno.gravar_versao_orientacao(v_id, 'criar');
  else
    update orientacoes_agente set titulo = trim(p_titulo), texto = trim(p_texto), tipo = p_tipo, cliente_id = p_cliente_id,
      setor_id = p_setor_id, ativo = coalesce(p_ativo, ativo), atualizado_por = auth.uid(), atualizado_em = now()
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Orientação não encontrada.'; end if;
    perform interno.gravar_versao_orientacao(v_id, 'editar');
  end if;
  return v_id;
end $$;

-- Liga ou desliga. Se já estava assim, não mexe em nada (sem versão, sem auditoria). Devolve o estado atual.
-- Ligar confere se a empresa/setor ainda estão ativos.
create function public.alternar_orientacao(p_id uuid, p_ativo boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orientacoes_agente%rowtype;
begin
  if not tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
  if p_ativo is null then raise exception 'Informe se a orientação fica ligada ou desligada.'; end if;
  select * into o from orientacoes_agente where id = p_id for update;
  if o.id is null then raise exception 'Orientação não encontrada.'; end if;
  if o.ativo = p_ativo then return o.ativo; end if;
  if p_ativo then perform interno.validar_orientacao(o.titulo, o.texto, o.tipo, o.cliente_id, o.setor_id); end if;
  update orientacoes_agente set ativo = p_ativo, atualizado_por = auth.uid(), atualizado_em = now() where id = p_id;
  perform interno.gravar_versao_orientacao(p_id, case when p_ativo then 'ligar' else 'desligar' end);
  return p_ativo;
end $$;

-- Grava o conteúdo de uma versão antiga como atual (nova versão 'restaurar'). Ligada/desligada continua como está:
-- restaurar o texto não liga nem desliga a orientação sem a pessoa pedir. Devolve o id da orientação.
create function public.restaurar_orientacao(p_versao_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v orientacoes_agente_versoes%rowtype;
begin
  if not tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
  select * into v from orientacoes_agente_versoes where id = p_versao_id;
  if v.id is null then raise exception 'Versão não encontrada.'; end if;
  perform interno.validar_orientacao(v.titulo, v.texto, v.tipo, v.cliente_id, v.setor_id);
  update orientacoes_agente set titulo = v.titulo, texto = v.texto, tipo = v.tipo, cliente_id = v.cliente_id,
    setor_id = v.setor_id, atualizado_por = auth.uid(), atualizado_em = now()
  where id = v.orientacao_id;
  perform interno.gravar_versao_orientacao(v.orientacao_id, 'restaurar');
  return v.orientacao_id;
end $$;

-- Pede um teste do agente. Uma simulação pendente por pessoa; pendente há mais de 5 minutos conta como abandonada.
-- O rascunho (orientação ainda não salva) é conferido com as mesmas regras de salvar_orientacao e guardado limpo.
create function public.criar_simulacao(p_mensagem text, p_cliente_id uuid default null, p_rascunho jsonb default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_rascunho jsonb; v_cliente uuid; v_setor uuid;
begin
  if not tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
  if p_mensagem is null or length(trim(p_mensagem)) = 0 then raise exception 'Escreva a mensagem do cliente para o teste.'; end if;
  if length(trim(p_mensagem)) > 2000 then raise exception 'A mensagem de teste pode ter no máximo 2000 caracteres.'; end if;
  perform interno.validar_empresa(p_cliente_id);

  if p_rascunho is not null and jsonb_typeof(p_rascunho) <> 'null' then
    if jsonb_typeof(p_rascunho) <> 'object' then raise exception 'Rascunho da orientação inválido.'; end if;
    if exists (select 1 from jsonb_object_keys(p_rascunho) k where k not in ('titulo', 'texto', 'tipo', 'cliente_id', 'setor_id'))
       or exists (select 1 from jsonb_each(p_rascunho) e where jsonb_typeof(e.value) not in ('string', 'null')) then
      raise exception 'Rascunho da orientação inválido.';
    end if;
    begin
      v_cliente := nullif(p_rascunho->>'cliente_id', '')::uuid;
      v_setor := nullif(p_rascunho->>'setor_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Rascunho da orientação inválido.';
    end;
    perform interno.validar_orientacao(p_rascunho->>'titulo', p_rascunho->>'texto', p_rascunho->>'tipo', v_cliente, v_setor);
    v_rascunho := jsonb_build_object('titulo', trim(p_rascunho->>'titulo'), 'texto', trim(p_rascunho->>'texto'),
      'tipo', p_rascunho->>'tipo', 'cliente_id', v_cliente, 'setor_id', v_setor);
  end if;

  -- Serializa os pedidos da mesma pessoa para dois cliques seguidos não criarem duas pendentes.
  perform pg_advisory_xact_lock(hashtextextended('simulacoes_agente:' || auth.uid()::text, 0));
  if exists (select 1 from simulacoes_agente where usuario_id = auth.uid() and status = 'pendente'
             and criado_em > now() - interval '5 minutes') then
    raise exception 'Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.';
  end if;
  insert into simulacoes_agente (usuario_id, mensagem, cliente_id, rascunho)
  values (auth.uid(), trim(p_mensagem), p_cliente_id, v_rascunho)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.salvar_orientacao(uuid, text, text, text, uuid, uuid, boolean) from public, anon;
revoke execute on function public.alternar_orientacao(uuid, boolean) from public, anon;
revoke execute on function public.restaurar_orientacao(uuid) from public, anon;
revoke execute on function public.criar_simulacao(text, uuid, jsonb) from public, anon;
grant execute on function public.salvar_orientacao(uuid, text, text, text, uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.alternar_orientacao(uuid, boolean) to authenticated, service_role;
grant execute on function public.restaurar_orientacao(uuid) to authenticated, service_role;
grant execute on function public.criar_simulacao(text, uuid, jsonb) to authenticated, service_role;
