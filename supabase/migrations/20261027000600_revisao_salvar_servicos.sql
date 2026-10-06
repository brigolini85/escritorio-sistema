-- Revisão geral (painel I7, lado do banco): serviços e responsáveis do contrato (ficha antiga) trocados numa função só.
-- Antes o painel mandava dois comandos (apagar tudo e depois inserir), sem transação: se o segundo falhasse, a empresa
-- ficava sem nenhum serviço/responsável. Uma chamada de função é uma transação: ou troca tudo, ou nada muda.
-- security invoker: as políticas de cliente_servicos / cliente_responsaveis (editar_clientes) e a auditoria seguem valendo;
-- a conferência abaixo só dá a mensagem clara. Serviços: mesma regra de salvar_ficha_cliente (o vínculo com serviço
-- desativado não está no formulário e fica).

create function public.salvar_servicos_cliente(p_cliente uuid, p_servicos uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.tem_permissao('editar_clientes') then raise exception 'Você não tem permissão para editar clientes.'; end if;
  if p_servicos is null then raise exception 'Lista de serviços inválida.'; end if;
  delete from public.cliente_servicos where cliente_id = p_cliente and not (servico_id = any (p_servicos))
    and servico_id in (select id from public.servicos where ativo);
  insert into public.cliente_servicos (cliente_id, servico_id)
  select distinct p_cliente, x from unnest(p_servicos) x
  where not exists (select 1 from public.cliente_servicos where cliente_id = p_cliente and servico_id = x);
end $$;

-- p_responsaveis: {"<setor>": "<pessoa>"}; setor sem pessoa (ou fora da lista) fica sem responsável, como o formulário antigo.
create function public.salvar_responsaveis_cliente(p_cliente uuid, p_responsaveis jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.tem_permissao('editar_clientes') then raise exception 'Você não tem permissão para editar clientes.'; end if;
  if jsonb_typeof(p_responsaveis) is distinct from 'object' then raise exception 'Lista de responsáveis inválida.'; end if;
  delete from public.cliente_responsaveis where cliente_id = p_cliente;
  insert into public.cliente_responsaveis (cliente_id, setor_id, usuario_id)
  select p_cliente, key::uuid, value::uuid from jsonb_each_text(p_responsaveis) where nullif(value, '') is not null;
end $$;

revoke execute on function public.salvar_servicos_cliente(uuid, uuid[]), public.salvar_responsaveis_cliente(uuid, jsonb)
  from public, anon, service_role;
grant execute on function public.salvar_servicos_cliente(uuid, uuid[]), public.salvar_responsaveis_cliente(uuid, jsonb)
  to authenticated;
