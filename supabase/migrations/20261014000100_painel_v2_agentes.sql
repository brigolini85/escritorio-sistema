-- supabase/migrations/20261014000100_painel_v2_agentes.sql
-- Painel v2, Parte I1 (spec 7E.1, 7E.3, 7E.8): um motor só, vários perfis. Cada agente é uma linha de `agentes`; o
-- Thiago (porta de entrada) nasce Ligado e igual ao de hoje (D1, D13). Só o dono (usuarios.dono, marcado só por SQL, D11)
-- muda os agentes; orientações seguem "Treinar o agente" do setor do agente (D12). Nada entra no Realtime (teste 22).

-- ---------- Dono (D11) ----------
alter table public.usuarios add column dono boolean not null default false;
-- No máximo um dono. Trocar = desmarcar e marcar na mesma transação (docs/operacao.md).
create unique index usuarios_um_dono on public.usuarios ((true)) where dono;

-- Pela API (PostgREST: qualquer papel, mesmo a chave de serviço e dentro de função security definer) a marcação não muda:
-- o PostgREST sempre preenche request.jwt.claims; migração e editor SQL não preenchem.
create function public.usuarios_dono_so_por_sql() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.dono) or (tg_op = 'UPDATE' and new.dono is distinct from old.dono) then
    if coalesce(current_setting('request.jwt.claims', true), '') <> '' then
      raise exception 'A marcação de dono só muda direto no banco (SQL).';
    end if;
  end if;
  return new;
end $$;
create trigger dono_so_por_sql before insert or update on public.usuarios
  for each row execute function public.usuarios_dono_so_por_sql();

create function public.eh_dono_de(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.usuario_liberado(p_usuario) and exists (select 1 from public.usuarios where id = p_usuario and dono)
$$;
revoke execute on function public.eh_dono_de(uuid) from public, anon, authenticated;
grant execute on function public.eh_dono_de(uuid) to service_role;

create function public.eh_dono() returns boolean
language sql stable security definer set search_path = '' as $$ select public.eh_dono_de(auth.uid()) $$;
revoke execute on function public.eh_dono() from public, anon;
grant execute on function public.eh_dono() to authenticated, service_role;

-- Ninguém é dono: marca o administrador ativo mais antigo e diz quem foi. Devolve o nome (null se não marcou).
create function public.marcar_dono_inicial() returns text
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if exists (select 1 from public.usuarios where dono) then return null; end if;
  select id, nome, email into v from public.usuarios where papel = 'admin' and ativo order by criado_em, id limit 1;
  if not found then
    raise notice 'Nenhum administrador ativo: ninguém foi marcado como dono. Marque com: update public.usuarios set dono = true where email = ''<e-mail>'';';
    return null;
  end if;
  update public.usuarios set dono = true where id = v.id;
  raise notice 'Dono marcado: % (%). Para trocar: update public.usuarios set dono = false where dono; update public.usuarios set dono = true where email = ''<e-mail>'';',
    v.nome, v.email;
  return v.nome;
end $$;
revoke execute on function public.marcar_dono_inicial() from public, anon, authenticated, service_role;
select public.marcar_dono_inicial();

-- ---------- Agentes (spec 7E.1) ----------
create table public.agentes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,39}$'),
  nome text not null check (char_length(trim(nome)) between 2 and 60),
  descricao text not null default '' check (char_length(descricao) <= 120),
  setor_id uuid references public.setores (id) on delete set null,
  tipos text[] not null default '{conversa}' check (tipos <@ array['conversa', 'trabalho'] and cardinality(tipos) between 1 and 2),
  estado text not null default 'desligado' check (estado in ('desligado', 'teste', 'ligado')),
  modelo text check (modelo is null or char_length(modelo) between 3 and 100),
  modo_contato text check (modo_contato in ('por_tras', 'mesma_voz', 'passa_conversa')),
  ferramentas text[] not null default '{}',
  porta_de_entrada boolean not null default false,
  ordem smallint not null default 100,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id) on delete set null
);
-- Uma porta de entrada só (o Thiago): é ela que recebe toda mensagem (spec 7E.3).
create unique index agentes_uma_porta on public.agentes ((true)) where porta_de_entrada;
create index agentes_setor_idx on public.agentes (setor_id);
create index agentes_atualizado_por_idx on public.agentes (atualizado_por);

create table public.agente_contatos_teste (
  agente_id uuid not null references public.agentes (id) on delete cascade,
  contato_id uuid not null references public.contatos (id) on delete cascade,
  incluido_por uuid references public.usuarios (id) on delete set null,
  incluido_em timestamptz not null default now(),
  primary key (agente_id, contato_id)
);
create index agente_contatos_teste_contato_idx on public.agente_contatos_teste (contato_id);
create index agente_contatos_teste_por_idx on public.agente_contatos_teste (incluido_por);

create table public.agente_regras_assunto (
  id uuid primary key default gen_random_uuid(),
  agente_id uuid not null references public.agentes (id) on delete cascade,
  assunto text not null check (char_length(trim(assunto)) between 2 and 80),
  exemplo text not null default '' check (char_length(exemplo) <= 200),
  modo text not null check (modo in ('por_tras', 'mesma_voz', 'passa_conversa')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index agente_regras_agente_idx on public.agente_regras_assunto (agente_id, criado_em);

-- Histórico em frases (D28): "Estado: Desligado → Teste".
create table public.agente_mudancas (
  id uuid primary key default gen_random_uuid(),
  agente_id uuid not null references public.agentes (id) on delete cascade,
  usuario_id uuid references public.usuarios (id) on delete set null,
  descricao text not null check (char_length(descricao) between 1 and 300),
  criado_em timestamptz not null default clock_timestamp()
);
create index agente_mudancas_agente_idx on public.agente_mudancas (agente_id, criado_em desc);
create index agente_mudancas_usuario_idx on public.agente_mudancas (usuario_id);

-- ---------- Catálogo de ferramentas (D15) ----------
-- As 16 do Thiago, na ordem de FERRAMENTAS (apps/trabalhador/src/agente/ferramentas.ts). O core tem a mesma lista
-- (CATALOGO_FERRAMENTAS); packages/db/test/agentes.test.ts confere as duas.
create function public.ferramentas_do_atendimento() returns text[]
language sql immutable set search_path = '' as $$
  select array['selecionar_empresa', 'abrir_chamado', 'consultar_chamados', 'sinalizar_nao_entendido', 'passar_para_pessoa',
    'buscar_parceiros', 'buscar_produtos', 'resumir_pedido_nota', 'abrir_pedido_nota', 'listar_documentos', 'enviar_documento',
    'consultar_cadastro', 'consultar_preco', 'alterar_preco', 'cadastrar_produto', 'responder']::text[]
$$;
-- Na I1 o catálogo é o do Thiago; as ferramentas novas entram aqui com quem as usa.
create function public.ferramentas_do_catalogo() returns text[]
language sql immutable set search_path = '' as $$ select public.ferramentas_do_atendimento() $$;
revoke execute on function public.ferramentas_do_atendimento(), public.ferramentas_do_catalogo() from public, anon;
grant execute on function public.ferramentas_do_atendimento(), public.ferramentas_do_catalogo() to authenticated, service_role;

-- ---------- Os 7 agentes iniciais (D1) ----------
-- Também usada por limparBanco (D24): volta os 7 às sementes e apaga os criados por teste (sem orientação nem teste).
create function public.restaurar_agentes_iniciais() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.agentes a
  where a.slug not in ('atendimento', 'radar', 'fiscal', 'contabil', 'pessoal', 'legalizacao', 'comercial')
    and not exists (select 1 from public.orientacoes_agente o where o.agente_id = a.id)
    and not exists (select 1 from public.simulacoes_agente s where s.agente_id = a.id);
  insert into public.agentes as g (id, slug, nome, descricao, setor_id, tipos, estado, modelo, modo_contato, ferramentas, porta_de_entrada, ordem)
  select coalesce(s.id, gen_random_uuid()), s.slug, s.nome, s.descricao, (select t.id from public.setores t where t.nome = s.setor),
         s.tipos, s.estado, null, s.modo, s.ferramentas, s.porta, s.ordem
  from (values
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'atendimento', 'Thiago', 'porta de entrada no WhatsApp', null::text,
       '{conversa}'::text[], 'ligado', 'mesma_voz'::text, public.ferramentas_do_atendimento(), true, 1),
    (null, 'radar', 'Radar de legislação', 'leis contábeis, fiscais, trabalhistas e societárias', null, '{trabalho}', 'desligado', null, '{}', false, 2),
    (null, 'fiscal', 'Agente Fiscal', 'notas e guias', 'Fiscal', '{conversa,trabalho}', 'desligado', null, '{}', false, 3),
    (null, 'contabil', 'Agente Contábil', 'fechamento e conferências', 'Contábil', '{trabalho}', 'desligado', null, '{}', false, 4),
    (null, 'pessoal', 'Departamento Pessoal', 'folha e admissões', 'Pessoal', '{conversa,trabalho}', 'desligado', null, '{}', false, 5),
    (null, 'legalizacao', 'Agente de Legalização', 'aberturas e alterações', 'Legalização', '{conversa,trabalho}', 'desligado', null, '{}', false, 6),
    (null, 'comercial', 'Agente Comercial', 'orçamentos de novos clientes', 'Comercial', '{conversa}', 'desligado', null, '{}', false, 7)
  ) as s (id, slug, nome, descricao, setor, tipos, estado, modo, ferramentas, porta, ordem)
  on conflict (slug) do update set nome = excluded.nome, descricao = excluded.descricao, setor_id = excluded.setor_id,
    tipos = excluded.tipos, estado = excluded.estado, modelo = null, modo_contato = excluded.modo_contato,
    ferramentas = excluded.ferramentas, porta_de_entrada = excluded.porta_de_entrada, ordem = excluded.ordem,
    atualizado_por = null, atualizado_em = now();
end $$;
revoke execute on function public.restaurar_agentes_iniciais() from public, anon, authenticated, service_role;
-- As linhas nascem no fim desta migração, depois das colunas agente_id de orientações e testes (a função as consulta).

-- ---------- Quem vê e quem treina (D12) ----------
create function public.pode_ver_agentes() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_usuario_ativo() and (public.eh_admin() or public.eh_dono() or public.tem_permissao('treinar', 'sim'))
$$;
-- Thiago (porta de entrada) e agente sem setor: "Treinar o agente", como hoje. Os outros: também ser do setor (ou administrador).
create function public.pode_treinar_agente(p_agente uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_permissao('treinar', 'sim') and exists (
    select 1 from public.agentes a where a.id = p_agente
      and (a.porta_de_entrada or a.setor_id is null or public.eh_admin() or a.setor_id in (select public.meus_setores())))
$$;
revoke execute on function public.pode_ver_agentes(), public.pode_treinar_agente(uuid) from public, anon;
grant execute on function public.pode_ver_agentes(), public.pode_treinar_agente(uuid) to authenticated, service_role;

alter table public.agentes enable row level security;
alter table public.agente_contatos_teste enable row level security;
alter table public.agente_regras_assunto enable row level security;
alter table public.agente_mudancas enable row level security;
create policy leitura on public.agentes for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.agente_contatos_teste for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.agente_regras_assunto for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.agente_mudancas for select to authenticated using (public.pode_ver_agentes());
revoke all on public.agentes, public.agente_contatos_teste, public.agente_regras_assunto, public.agente_mudancas from anon;
revoke insert, update, delete, truncate on public.agentes, public.agente_contatos_teste, public.agente_regras_assunto, public.agente_mudancas
  from authenticated;
-- A chave de serviço também só lê: quem muda os agentes são as funções do dono (D11).
revoke insert, update, delete, truncate on public.agentes, public.agente_contatos_teste, public.agente_regras_assunto, public.agente_mudancas
  from service_role;

-- ---------- Funções do dono (D11, D13, D14, D25, D28, D29) ----------
create function public.rotulo_agente(p_campo text, p_valor text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_valor is null then case p_campo when 'modelo' then 'padrão de Configurações' else 'a definir' end
    when p_campo = 'estado' then case p_valor when 'desligado' then 'Desligado' when 'teste' then 'Teste' when 'ligado' then 'Ligado' else p_valor end
    when p_campo = 'modo' then case p_valor when 'por_tras' then 'Por trás' when 'mesma_voz' then 'Mesma voz'
                                            when 'passa_conversa' then 'Passa a conversa' else p_valor end
    else p_valor end
$$;
revoke execute on function public.rotulo_agente(text, text) from public, anon, authenticated, service_role;

create function public.mudanca_agente(p_agente uuid, p_texto text) returns void
language sql security definer set search_path = '' as $$
  insert into public.agente_mudancas (agente_id, usuario_id, descricao) values (p_agente, auth.uid(), left(p_texto, 300))
$$;
revoke execute on function public.mudanca_agente(uuid, text) from public, anon, authenticated, service_role;

create function public.salvar_agente(p_slug text, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; n public.agentes%rowtype; k text; m text[] := '{}'; v_mais text[]; v_menos text[];
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera os agentes.'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados do agente inválidos.'; end if;
  for k in select jsonb_object_keys(p_dados) loop
    if k not in ('nome', 'descricao', 'setor_id', 'tipos', 'estado', 'modelo', 'modo_contato', 'ferramentas') then
      raise exception 'Dados do agente inválidos.';
    end if;
  end loop;
  select * into a from public.agentes where slug = p_slug for update;
  if not found then raise exception 'Agente não encontrado.'; end if;
  n := a;
  begin
    if p_dados ? 'nome' then n.nome := trim(p_dados ->> 'nome'); end if;
    if p_dados ? 'descricao' then n.descricao := coalesce(trim(p_dados ->> 'descricao'), ''); end if;
    if p_dados ? 'setor_id' then n.setor_id := nullif(p_dados ->> 'setor_id', '')::uuid; end if;
    if p_dados ? 'tipos' then n.tipos := array(select distinct jsonb_array_elements_text(p_dados -> 'tipos') order by 1); end if;
    if p_dados ? 'estado' then n.estado := p_dados ->> 'estado'; end if;
    if p_dados ? 'modelo' then n.modelo := nullif(trim(p_dados ->> 'modelo'), ''); end if;
    if p_dados ? 'modo_contato' then n.modo_contato := nullif(p_dados ->> 'modo_contato', ''); end if;
    if p_dados ? 'ferramentas' then n.ferramentas := array(select distinct jsonb_array_elements_text(p_dados -> 'ferramentas') order by 1); end if;
  exception when invalid_text_representation or invalid_parameter_value then
    raise exception 'Dados do agente inválidos.';
  end;
  if n.nome is null or char_length(n.nome) not between 2 and 60 then raise exception 'O nome do agente tem de 2 a 60 letras.'; end if;
  if char_length(n.descricao) > 120 then raise exception 'A descrição tem até 120 letras.'; end if;
  if n.setor_id is not null and not exists (select 1 from public.setores where id = n.setor_id and ativo) then
    raise exception 'Setor não encontrado ou inativo.';
  end if;
  if cardinality(n.tipos) not between 1 and 2 or not (n.tipos <@ array['conversa', 'trabalho']) then
    raise exception 'Escolha Conversa, Trabalho ou os dois.';
  end if;
  if n.estado is null or n.estado not in ('desligado', 'teste', 'ligado') then raise exception 'Estado inválido.'; end if;
  if n.modo_contato is not null and n.modo_contato not in ('por_tras', 'mesma_voz', 'passa_conversa') then
    raise exception 'Modo de falar com o cliente inválido.';
  end if;
  if not (n.ferramentas <@ public.ferramentas_do_catalogo()) then raise exception 'Ferramenta fora do catálogo.'; end if;
  if n.modelo is not null and not exists (select 1 from public.configuracoes c where c.id = 1 and c.precos_modelos ? n.modelo) then
    raise exception 'Modelo sem preço em Configurações › Teto e modelos de IA.';
  end if;
  if a.porta_de_entrada then
    if n.estado <> 'ligado' then raise exception 'O Thiago fica sempre ligado: para parar o atendimento, use PAUSAR no Início.'; end if;
    if n.modo_contato is distinct from 'mesma_voz' then raise exception 'O Thiago é a voz do escritório: o modo dele não muda.'; end if;
    if n.setor_id is not null then raise exception 'O Thiago atende todos os setores.'; end if;
    if not (public.ferramentas_do_atendimento() <@ n.ferramentas) then raise exception 'As ferramentas do atendimento são fixas nesta etapa.'; end if;
  end if;
  if n.estado = 'teste' and not exists (select 1 from public.agente_contatos_teste where agente_id = a.id) then
    raise exception 'Em teste, escolha pelo menos um contato.';
  end if;

  if n.nome is distinct from a.nome then m := m || format('Nome: %s → %s', a.nome, n.nome); end if;
  if n.descricao is distinct from a.descricao then m := m || 'Descrição alterada'::text; end if;
  if n.setor_id is distinct from a.setor_id then
    m := m || format('Setor: %s → %s', coalesce((select nome from public.setores where id = a.setor_id), 'sem setor'),
                                        coalesce((select nome from public.setores where id = n.setor_id), 'sem setor'));
  end if;
  if n.tipos is distinct from array(select x from unnest(a.tipos) x order by 1) then
    m := m || format('Tipo: %s', replace(replace(array_to_string(n.tipos, ' e '), 'conversa', 'Conversa'), 'trabalho', 'Trabalho'));
  end if;
  if n.estado is distinct from a.estado then
    m := m || format('Estado: %s → %s', public.rotulo_agente('estado', a.estado), public.rotulo_agente('estado', n.estado));
  end if;
  if n.modelo is distinct from a.modelo then
    m := m || format('Modelo: %s → %s', public.rotulo_agente('modelo', a.modelo), public.rotulo_agente('modelo', n.modelo));
  end if;
  if n.modo_contato is distinct from a.modo_contato then
    m := m || format('Fala com o cliente: %s → %s', public.rotulo_agente('modo', a.modo_contato), public.rotulo_agente('modo', n.modo_contato));
  end if;
  v_mais := array(select x from unnest(n.ferramentas) x except select y from unnest(a.ferramentas) y order by 1);
  v_menos := array(select y from unnest(a.ferramentas) y except select x from unnest(n.ferramentas) x order by 1);
  if cardinality(v_mais) + cardinality(v_menos) > 0 then
    m := m || concat_ws(' ', 'Ferramentas:',
      case when cardinality(v_mais) > 0 then '+' || array_to_string(v_mais, ', +') end
        || case when cardinality(v_mais) > 0 and cardinality(v_menos) > 0 then ',' else '' end,
      case when cardinality(v_menos) > 0 then '−' || array_to_string(v_menos, ', −') end);
  end if;
  if cardinality(m) = 0 then return; end if;
  update public.agentes set nome = n.nome, descricao = n.descricao, setor_id = n.setor_id, tipos = n.tipos, estado = n.estado,
    modelo = n.modelo, modo_contato = n.modo_contato, ferramentas = n.ferramentas, atualizado_em = now(), atualizado_por = auth.uid()
  where id = a.id;
  perform public.mudanca_agente(a.id, x) from unnest(m) x;
end $$;

create function public.definir_contatos_teste(p_slug text, p_contatos uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; v uuid[] := array(select distinct x from unnest(coalesce(p_contatos, '{}')) x where x is not null);
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera os agentes.'; end if;
  select * into a from public.agentes where slug = p_slug for update;
  if not found then raise exception 'Agente não encontrado.'; end if;
  if a.porta_de_entrada then raise exception 'O Thiago atende todos os contatos.'; end if;
  if cardinality(v) > 20 then raise exception 'Em teste, no máximo 20 contatos.'; end if;
  if exists (select 1 from unnest(v) x where not exists (select 1 from public.contatos c where c.id = x and c.ativo)) then
    raise exception 'Contato não encontrado ou arquivado.';
  end if;
  if a.estado = 'teste' and cardinality(v) = 0 then raise exception 'Em teste, escolha pelo menos um contato (ou desligue o agente).'; end if;
  if (select count(*) from public.agente_contatos_teste where agente_id = a.id) = cardinality(v)
     and not exists (select 1 from unnest(v) x where not exists (
       select 1 from public.agente_contatos_teste t where t.agente_id = a.id and t.contato_id = x)) then
    return;
  end if;
  delete from public.agente_contatos_teste where agente_id = a.id and contato_id <> all (v);
  insert into public.agente_contatos_teste (agente_id, contato_id, incluido_por)
  select a.id, x, auth.uid() from unnest(v) x on conflict do nothing;
  perform public.mudanca_agente(a.id, format('Contatos em teste: %s', cardinality(v)));
end $$;

create function public.salvar_regra_assunto(p_slug text, p_id uuid, p_assunto text, p_exemplo text, p_modo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; v_id uuid; v_assunto text := trim(coalesce(p_assunto, '')); v_exemplo text := trim(coalesce(p_exemplo, ''));
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera os agentes.'; end if;
  select * into a from public.agentes where slug = p_slug for update;
  if not found then raise exception 'Agente não encontrado.'; end if;
  if a.porta_de_entrada then raise exception 'O Thiago não tem regras por assunto: ele é quem recebe toda mensagem.'; end if;
  if char_length(v_assunto) not between 2 and 80 then raise exception 'O assunto tem de 2 a 80 letras.'; end if;
  if char_length(v_exemplo) > 200 then raise exception 'O exemplo tem até 200 letras.'; end if;
  if p_modo is null or p_modo not in ('por_tras', 'mesma_voz', 'passa_conversa') then
    raise exception 'Escolha como o agente fala com o cliente nesse assunto.';
  end if;
  if p_id is null then
    if (select count(*) from public.agente_regras_assunto where agente_id = a.id) >= 30 then raise exception 'No máximo 30 regras por agente.'; end if;
    insert into public.agente_regras_assunto (agente_id, assunto, exemplo, modo) values (a.id, v_assunto, v_exemplo, p_modo) returning id into v_id;
    perform public.mudanca_agente(a.id, format('Nova regra "%s": %s', v_assunto, public.rotulo_agente('modo', p_modo)));
  else
    update public.agente_regras_assunto set assunto = v_assunto, exemplo = v_exemplo, modo = p_modo, atualizado_em = now()
    where id = p_id and agente_id = a.id returning id into v_id;
    if v_id is null then raise exception 'Regra não encontrada.'; end if;
    perform public.mudanca_agente(a.id, format('Regra "%s": %s', v_assunto, public.rotulo_agente('modo', p_modo)));
  end if;
  return v_id;
end $$;

create function public.excluir_regra_assunto(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.agente_regras_assunto%rowtype;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera os agentes.'; end if;
  delete from public.agente_regras_assunto where id = p_id returning * into r;
  if not found then raise exception 'Regra não encontrada.'; end if;
  perform public.mudanca_agente(r.agente_id, format('Regra "%s" removida', r.assunto));
end $$;

create function public.criar_agente(p_dados jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare v_slug text; v_nome text; v_descricao text; v_setor uuid; v_tipos text[]; v_id uuid;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera os agentes.'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados do agente inválidos.'; end if;
  v_slug := p_dados ->> 'slug'; v_nome := trim(p_dados ->> 'nome'); v_descricao := coalesce(trim(p_dados ->> 'descricao'), '');
  if v_slug is null or v_slug !~ '^[a-z][a-z0-9-]{1,39}$' then raise exception 'Endereço do agente inválido.'; end if;
  if v_nome is null or char_length(v_nome) not between 2 and 60 then raise exception 'O nome do agente tem de 2 a 60 letras.'; end if;
  if char_length(v_descricao) > 120 then raise exception 'A descrição tem até 120 letras.'; end if;
  if exists (select 1 from public.agentes where slug = v_slug) then raise exception 'Já existe um agente com este endereço: mude o nome.'; end if;
  begin
    v_setor := nullif(p_dados ->> 'setor_id', '')::uuid;
    v_tipos := array(select distinct jsonb_array_elements_text(coalesce(p_dados -> 'tipos', '["conversa"]')) order by 1);
  exception when invalid_text_representation or invalid_parameter_value then
    raise exception 'Dados do agente inválidos.';
  end;
  if v_setor is not null and not exists (select 1 from public.setores where id = v_setor and ativo) then
    raise exception 'Setor não encontrado ou inativo.';
  end if;
  if cardinality(v_tipos) not between 1 and 2 or not (v_tipos <@ array['conversa', 'trabalho']) then
    raise exception 'Escolha Conversa, Trabalho ou os dois.';
  end if;
  insert into public.agentes (slug, nome, descricao, setor_id, tipos, ordem, atualizado_por)
  values (v_slug, v_nome, v_descricao, v_setor, v_tipos, (select coalesce(max(ordem), 0) + 1 from public.agentes), auth.uid())
  returning id into v_id;
  perform public.mudanca_agente(v_id, 'Agente criado');
  return v_slug;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.salvar_agente(text, jsonb)', 'public.definir_contatos_teste(text, uuid[])',
    'public.salvar_regra_assunto(text, uuid, text, text, text)', 'public.excluir_regra_assunto(uuid)', 'public.criar_agente(jsonb)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------- Orientações por agente (D12, D21) ----------
-- As de hoje são do Thiago. salvar_orientacao_agente põe o agente pelo padrão da coluna (app.agente_orientacao), sem
-- copiar salvar_orientacao (20260930000100), que continua igual.
alter table public.orientacoes_agente add column agente_id uuid not null
  default coalesce(nullif(current_setting('app.agente_orientacao', true), '')::uuid, 'a0000000-0000-4000-8000-000000000001'::uuid);
create index orientacoes_agente_agente_idx on public.orientacoes_agente (agente_id);

-- Vale para salvar, ligar, desligar e restaurar (as funções de hoje passam por aqui). Sem pessoa (trabalhador, testes): passa.
create function public.orientacoes_do_agente_certo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.agente_id is distinct from old.agente_id then raise exception 'A orientação não muda de agente.'; end if;
  if auth.uid() is not null and not public.pode_treinar_agente(new.agente_id) then
    raise exception 'Você não tem permissão para as orientações deste agente.';
  end if;
  return new;
end $$;
create trigger agente_certo before insert or update on public.orientacoes_agente
  for each row execute function public.orientacoes_do_agente_certo();

create function public.salvar_orientacao_agente(p_slug text, p_id uuid, p_titulo text, p_texto text, p_tipo text,
  p_cliente_id uuid default null, p_setor_id uuid default null, p_ativo boolean default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; v_id uuid;
begin
  select * into a from public.agentes where slug = p_slug;
  if not found then raise exception 'Agente não encontrado.'; end if;
  if not public.pode_treinar_agente(a.id) then raise exception 'Você não tem permissão para as orientações deste agente.'; end if;
  if p_id is not null and not exists (select 1 from public.orientacoes_agente where id = p_id and agente_id = a.id) then
    raise exception 'Orientação não encontrada.';
  end if;
  perform set_config('app.agente_orientacao', a.id::text, true);
  v_id := public.salvar_orientacao(p_id, p_titulo, p_texto, p_tipo, p_cliente_id, p_setor_id, p_ativo);
  perform set_config('app.agente_orientacao', '', true);
  return v_id;
end $$;
revoke execute on function public.salvar_orientacao_agente(text, uuid, text, text, text, uuid, uuid, boolean) from public, anon;
grant execute on function public.salvar_orientacao_agente(text, uuid, text, text, text, uuid, uuid, boolean) to authenticated, service_role;

-- ---------- Teste e custo por agente (D16) ----------
alter table public.simulacoes_agente add column agente_id uuid not null default 'a0000000-0000-4000-8000-000000000001';
create index simulacoes_agente_agente_idx on public.simulacoes_agente (agente_id);
alter table public.uso_ia add column agente_id uuid references public.agentes (id) on delete set null;
create index uso_ia_agente_idx on public.uso_ia (agente_id, criado_em);

-- ---------- Os 7 agentes (D1) e as chaves estrangeiras que dependem do Thiago ----------
-- Agora: as linhas de hoje de orientações e testes já apontam para o id fixo do Thiago, que nasce aqui.
select public.restaurar_agentes_iniciais();
alter table public.orientacoes_agente add constraint orientacoes_agente_agente_id_fkey foreign key (agente_id) references public.agentes (id);
alter table public.simulacoes_agente add constraint simulacoes_agente_agente_id_fkey foreign key (agente_id) references public.agentes (id);
