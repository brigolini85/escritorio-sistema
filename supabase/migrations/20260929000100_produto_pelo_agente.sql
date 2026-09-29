-- Produto cadastrado pelo agente a pedido do contato (pedido do dono, 2026-09-29).
-- Usa a mesma marcação do preço: quem pode mudar a tabela de preços pode cadastrar produto.

-- Só o trabalhador (chave de serviço) chama: exige "pode mudar preço" do contato naquela empresa.
create function public.cadastrar_produto_agente(p_cliente uuid, p_codigo text, p_descricao text, p_unidade text, p_apelidos text[], p_contato uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(trim(p_codigo), '') = '' or coalesce(trim(p_descricao), '') = '' then raise exception 'código e descrição são obrigatórios'; end if;
  if not exists (select 1 from contato_clientes where contato_id = p_contato and cliente_id = p_cliente and pode_atualizar_preco) then
    raise exception 'contato sem permissão para cadastrar produto';
  end if;
  if exists (select 1 from produtos where cliente_id = p_cliente and codigo = trim(p_codigo)) then
    raise exception 'código já cadastrado';
  end if;
  insert into produtos (cliente_id, codigo, descricao, unidade, apelidos)
  values (p_cliente, trim(p_codigo), trim(p_descricao), upper(coalesce(nullif(trim(p_unidade), ''), 'UN')), coalesce(p_apelidos, '{}'))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.cadastrar_produto_agente(uuid, text, text, text, text[], uuid) from public, anon, authenticated;
