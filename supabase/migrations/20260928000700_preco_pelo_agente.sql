-- Preço alterado pelo agente a pedido do contato (pedido do dono, 2026-09-28).
-- O histórico mostra a origem (painel ou agente) e o contato que pediu.
alter table public.precos
  add column origem text not null default 'painel' check (origem in ('painel', 'agente')),
  add column alterado_por_contato uuid references public.contatos (id) on delete set null;

-- Só o trabalhador (chave de serviço) chama: exige que o contato tenha "pode mudar preço" naquela empresa.
create function public.definir_preco_agente(p_grupo uuid, p_produto uuid, p_valor numeric, p_contato uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_cliente uuid; v_tipo tipo_parceiro; v_id uuid;
begin
  if p_valor is null or p_valor <= 0 then raise exception 'valor inválido'; end if;
  select cliente_id, tipo into v_cliente, v_tipo from parceiros_grupos where id = p_grupo;
  if v_cliente is null then raise exception 'rede não encontrada'; end if;
  if v_tipo <> 'cliente' then raise exception 'preço só vale para clientes da empresa'; end if;
  if not exists (select 1 from produtos where id = p_produto and cliente_id = v_cliente) then
    raise exception 'produto não pertence à empresa';
  end if;
  if not exists (select 1 from contato_clientes where contato_id = p_contato and cliente_id = v_cliente and pode_atualizar_preco) then
    raise exception 'contato sem permissão para mudar preço';
  end if;
  update precos set vigente_ate = now() where grupo_id = p_grupo and produto_id = p_produto and vigente_ate is null;
  insert into precos (cliente_id, grupo_id, produto_id, valor, origem, alterado_por_contato)
  values (v_cliente, p_grupo, p_produto, round(p_valor, 2), 'agente', p_contato)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.definir_preco_agente(uuid, uuid, numeric, uuid) from public, anon, authenticated;
