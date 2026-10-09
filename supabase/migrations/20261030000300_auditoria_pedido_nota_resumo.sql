-- supabase/migrations/20261030000300_auditoria_pedido_nota_resumo.sql
-- Auditoria 1.1 e 5.5: a "confirmação" do pedido de nota era um booleano do modelo. Um resumo enviado valia por 24 h,
-- casava com pedidos remontados sem ids (destinatário errado) e podia virar duas demandas. Agora cada resumo tem um id,
-- guarda o pedido resolvido (com preços) e o hash, e só vira demanda uma vez, depois de uma resposta do cliente que
-- chegou depois do envio, numa vez seguinte, com a mesma empresa em foco.

create table public.pedidos_nota_resumo (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  turno text not null,
  -- A saída que levou o resumo ao cliente.
  mensagem_resumo_id uuid not null references public.mensagens (id) on delete cascade,
  -- O pedido como foi resumido: entrada do modelo, destinatário e itens resolvidos, com preços.
  pedido jsonb not null,
  hash text not null,
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  chamado_id uuid references public.chamados (id) on delete set null
);
create index pedidos_nota_resumo_conversa_idx on public.pedidos_nota_resumo (conversa_id, criado_em desc);

-- Só o trabalhador (service_role) usa a tabela: RLS ligada e nenhuma política para o painel.
alter table public.pedidos_nota_resumo enable row level security;
revoke all on table public.pedidos_nota_resumo from public, anon, authenticated;
grant select, insert, update on table public.pedidos_nota_resumo to service_role;

-- Consome o resumo uma vez só, numa única instrução de update (duas aberturas ao mesmo tempo: só uma passa).
-- Recusa: outra conversa ou empresa, já usado (devolve o número da demanda), mais de 24 h, mesma vez do resumo,
-- saída não enviada e nenhuma entrada do cliente depois de o resumo ficar registrado como enviado.
create or replace function public.consumir_resumo_nota(p_id uuid, p_conversa uuid, p_cliente uuid, p_turno text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  r public.pedidos_nota_resumo;
  v_enviada timestamptz;
  v_pedido jsonb;
begin
  select * into r from public.pedidos_nota_resumo where id = p_id and conversa_id = p_conversa;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado'); end if;
  if r.cliente_id is distinct from p_cliente then return jsonb_build_object('ok', false, 'motivo', 'outra_empresa'); end if;
  if r.usado_em is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ja_usado',
      'numero', (select c.numero from public.chamados c where c.id = r.chamado_id));
  end if;
  if r.criado_em <= now() - interval '24 hours' then return jsonb_build_object('ok', false, 'motivo', 'expirado'); end if;
  if p_turno is null or r.turno = p_turno then return jsonb_build_object('ok', false, 'motivo', 'mesmo_turno'); end if;
  select m.criado_em into v_enviada from public.mensagens m
   where m.id = r.mensagem_resumo_id and m.conversa_id = r.conversa_id and m.direcao = 'saida' and m.status_envio = 'enviada';
  if v_enviada is null then return jsonb_build_object('ok', false, 'motivo', 'sem_envio'); end if;
  -- A saída é gravada (pendente) antes do envio e o resumo só depois de ela ficar enviada: conta só a entrada posterior
  -- aos dois (a que chegou no meio do envio não respondeu ao resumo).
  if not exists (select 1 from public.mensagens e
                  where e.conversa_id = r.conversa_id and e.direcao = 'entrada'
                    and e.criado_em > greatest(r.criado_em, v_enviada)) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_resposta');
  end if;
  update public.pedidos_nota_resumo set usado_em = now()
   where id = p_id and conversa_id = p_conversa and cliente_id = p_cliente and usado_em is null
  returning pedido into v_pedido;
  if v_pedido is null then
    return jsonb_build_object('ok', false, 'motivo', 'ja_usado',
      'numero', (select c.numero from public.chamados c join public.pedidos_nota_resumo x on x.chamado_id = c.id where x.id = p_id));
  end if;
  return jsonb_build_object('ok', true, 'pedido', v_pedido);
end $$;

revoke execute on function public.consumir_resumo_nota(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.consumir_resumo_nota(uuid, uuid, uuid, text) to service_role;
