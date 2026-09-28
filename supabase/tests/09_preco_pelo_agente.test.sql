begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Preço consultado e alterado pelo agente a pedido do contato (pedido do dono, 2026-09-28).
insert into public.clientes (id, razao_social, cnpj) values ('10000000-0000-0000-0000-000000000001', 'Indústria X', '11222333000181');
insert into public.parceiros_grupos (id, cliente_id, tipo, nome) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'cliente', 'Supermercado Brasil');
insert into public.produtos (id, cliente_id, codigo, descricao, unidade) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '12', 'Costela com Requeijão', 'PAC');
insert into public.contatos (id, nome, telefone) values
  ('40000000-0000-0000-0000-000000000001', 'Luana', '5531999990001'),
  ('40000000-0000-0000-0000-000000000002', 'Sem permissão', '5531999990002');
insert into public.contato_clientes (contato_id, cliente_id, pode_atualizar_preco) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', true),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', false);

select lives_ok($$ select public.definir_preco_agente('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 9.5, '40000000-0000-0000-0000-000000000001') $$,
  'contato com "pode mudar preço" altera pelo agente');
select lives_ok($$ select public.definir_preco_agente('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 10, '40000000-0000-0000-0000-000000000001') $$,
  'altera de novo');
select is((select origem || ':' || valor from public.precos where vigente_ate is null), 'agente:10.00', 'preço vigente veio do agente');
select is((select alterado_por_contato from public.precos where vigente_ate is null), '40000000-0000-0000-0000-000000000001'::uuid, 'guarda o contato que pediu');
select throws_ok($$ select public.definir_preco_agente('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 11, '40000000-0000-0000-0000-000000000002') $$,
  'P0001', 'contato sem permissão para mudar preço', 'contato sem a marcação não altera');

set local role authenticated;
select throws_ok($$ select public.definir_preco_agente('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 1, '40000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'navegador não chama a função do agente');

select * from finish();
rollback;
