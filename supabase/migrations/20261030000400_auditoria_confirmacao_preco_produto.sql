-- supabase/migrations/20261030000400_auditoria_confirmacao_preco_produto.sql
-- Auditoria 1.2 e 5.4: a "confirmação do cliente" de alterar_preco e cadastrar_produto era um booleano do modelo. Agora a
-- primeira chamada só grava a confirmação e o sistema manda a pergunta com texto fixo; a segunda aplica, uma vez só, se o
-- cliente respondeu depois da pergunta, numa vez seguinte, em até 30 min e (preço) com o mesmo preço vigente da pergunta.
-- Auditoria 1.7 e decisão D1: as funções do agente exigem contato e empresa ativos e perfil diferente de Básico.

create table public.confirmacoes_cliente (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  contato_id uuid not null references public.contatos (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  tipo text not null check (tipo in ('preco', 'produto')),
  -- preço: grupo_id, produto_id, novo_valor, rede, produto; produto: codigo, descricao, unidade, apelidos.
  dados jsonb not null,
  -- Preço vigente quando a pergunta saiu (null = sem preço); o "sim" só vale para ele.
  valor_antigo numeric,
  -- A saída que levou a pergunta ao cliente.
  mensagem_pergunta_id uuid not null references public.mensagens (id) on delete cascade,
  turno text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '30 minutes',
  usado_em timestamptz
);
create index confirmacoes_cliente_conversa_idx on public.confirmacoes_cliente (conversa_id, criado_em desc);

-- Só o trabalhador (service_role) usa a tabela: RLS ligada e nenhuma política para o painel.
alter table public.confirmacoes_cliente enable row level security;
revoke all on table public.confirmacoes_cliente from public, anon, authenticated;
grant select, insert, update on table public.confirmacoes_cliente to service_role;

-- Auditoria 1.7 e D1: além da marcação, contato e empresa ativos e perfil diferente de Básico.
create or replace function public.definir_preco_agente(p_grupo uuid, p_produto uuid, p_valor numeric, p_contato uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid; v_tipo public.tipo_parceiro; v_id uuid;
begin
  if p_valor is null or p_valor <= 0 then raise exception 'valor inválido'; end if;
  select cliente_id, tipo into v_cliente, v_tipo from public.parceiros_grupos where id = p_grupo;
  if v_cliente is null then raise exception 'rede não encontrada'; end if;
  if v_tipo <> 'cliente' then raise exception 'preço só vale para clientes da empresa'; end if;
  if not exists (select 1 from public.produtos where id = p_produto and cliente_id = v_cliente) then
    raise exception 'produto não pertence à empresa';
  end if;
  if not exists (select 1 from public.contato_clientes cc
                   join public.contatos ct on ct.id = cc.contato_id and ct.ativo
                   join public.clientes cl on cl.id = cc.cliente_id and cl.ativo
                  where cc.contato_id = p_contato and cc.cliente_id = v_cliente and cc.pode_atualizar_preco and cc.perfil <> 'basico') then
    raise exception 'contato sem permissão para mudar preço';
  end if;
  update public.precos set vigente_ate = now() where grupo_id = p_grupo and produto_id = p_produto and vigente_ate is null;
  insert into public.precos (cliente_id, grupo_id, produto_id, valor, origem, alterado_por_contato)
  values (v_cliente, p_grupo, p_produto, round(p_valor, 2), 'agente', p_contato)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.definir_preco_agente(uuid, uuid, numeric, uuid) from public, anon, authenticated;
grant execute on function public.definir_preco_agente(uuid, uuid, numeric, uuid) to service_role;

create or replace function public.cadastrar_produto_agente(p_cliente uuid, p_codigo text, p_descricao text, p_unidade text, p_apelidos text[], p_contato uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if coalesce(trim(p_codigo), '') = '' or coalesce(trim(p_descricao), '') = '' then raise exception 'código e descrição são obrigatórios'; end if;
  if not exists (select 1 from public.contato_clientes cc
                   join public.contatos ct on ct.id = cc.contato_id and ct.ativo
                   join public.clientes cl on cl.id = cc.cliente_id and cl.ativo
                  where cc.contato_id = p_contato and cc.cliente_id = p_cliente and cc.pode_atualizar_preco and cc.perfil <> 'basico') then
    raise exception 'contato sem permissão para cadastrar produto';
  end if;
  if exists (select 1 from public.produtos where cliente_id = p_cliente and codigo = trim(p_codigo)) then
    raise exception 'código já cadastrado';
  end if;
  insert into public.produtos (cliente_id, codigo, descricao, unidade, apelidos)
  values (p_cliente, trim(p_codigo), trim(p_descricao), upper(coalesce(nullif(trim(p_unidade), ''), 'UN')), coalesce(p_apelidos, '{}'))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.cadastrar_produto_agente(uuid, text, text, text, text[], uuid) from public, anon, authenticated;
grant execute on function public.cadastrar_produto_agente(uuid, text, text, text, text[], uuid) to service_role;

-- Usa a confirmação uma vez só e aplica na mesma transação: se a aplicação falhar (sem permissão, código repetido), o uso
-- é desfeito junto. Recusa: outra conversa ou contato, já usada, vencida, mesma vez da pergunta, pergunta não enviada,
-- nenhuma entrada do cliente depois de a pergunta ficar enviada e, no preço, vigente diferente do da pergunta.
create or replace function public.usar_confirmacao(p_id uuid, p_conversa uuid, p_contato uuid, p_turno text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  r public.confirmacoes_cliente;
  v_enviada timestamptz;
  v_vigente numeric;
  v_id uuid;
begin
  select c.* into r from public.confirmacoes_cliente c
    join public.conversas cv on cv.id = c.conversa_id and cv.contato_id = c.contato_id
   where c.id = p_id and c.conversa_id = p_conversa and c.contato_id = p_contato;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado'); end if;
  if r.usado_em is not null then return jsonb_build_object('ok', false, 'motivo', 'ja_usado'); end if;
  if r.expira_em <= now() then return jsonb_build_object('ok', false, 'motivo', 'expirado'); end if;
  if p_turno is null or r.turno = p_turno then return jsonb_build_object('ok', false, 'motivo', 'mesmo_turno'); end if;
  select m.criado_em into v_enviada from public.mensagens m
   where m.id = r.mensagem_pergunta_id and m.conversa_id = r.conversa_id and m.direcao = 'saida' and m.status_envio = 'enviada';
  if v_enviada is null then return jsonb_build_object('ok', false, 'motivo', 'sem_envio'); end if;
  -- Como no resumo de nota: só conta a entrada posterior à pergunta enviada e ao registro da confirmação, dentro do prazo.
  if not exists (select 1 from public.mensagens e
                  where e.conversa_id = r.conversa_id and e.direcao = 'entrada'
                    and e.criado_em > greatest(r.criado_em, v_enviada) and e.criado_em <= r.expira_em) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_resposta');
  end if;
  if r.tipo = 'preco' then
    -- Trava o vigente: o painel não troca o preço entre a conferência e a aplicação.
    select p.valor into v_vigente from public.precos p
     where p.grupo_id = (r.dados ->> 'grupo_id')::uuid and p.produto_id = (r.dados ->> 'produto_id')::uuid and p.vigente_ate is null
       for update;
    if v_vigente is distinct from r.valor_antigo then return jsonb_build_object('ok', false, 'motivo', 'preco_mudou'); end if;
  end if;
  update public.confirmacoes_cliente set usado_em = now() where id = p_id and usado_em is null;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'ja_usado'); end if;
  if r.tipo = 'preco' then
    v_id := public.definir_preco_agente((r.dados ->> 'grupo_id')::uuid, (r.dados ->> 'produto_id')::uuid,
      (r.dados ->> 'novo_valor')::numeric, r.contato_id);
    return jsonb_build_object('ok', true, 'tipo', 'preco', 'valor_antigo', r.valor_antigo,
      'valor_novo', (r.dados ->> 'novo_valor')::numeric, 'preco_id', v_id, 'dados', r.dados);
  end if;
  v_id := public.cadastrar_produto_agente(r.cliente_id, r.dados ->> 'codigo', r.dados ->> 'descricao', r.dados ->> 'unidade',
    coalesce(array(select jsonb_array_elements_text(r.dados -> 'apelidos')), '{}'), r.contato_id);
  return jsonb_build_object('ok', true, 'tipo', 'produto', 'produto_id', v_id, 'dados', r.dados);
end $$;

revoke execute on function public.usar_confirmacao(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.usar_confirmacao(uuid, uuid, uuid, text) to service_role;
