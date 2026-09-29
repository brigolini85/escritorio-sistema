begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Produto cadastrado pelo agente a pedido do contato (pedido do dono, 2026-09-29).
insert into public.clientes (id, razao_social, cnpj) values ('10000000-0000-0000-0000-000000000001', 'Indústria X', '11222333000181');
insert into public.contatos (id, nome, telefone) values
  ('40000000-0000-0000-0000-000000000001', 'Luana', '5531999990001'),
  ('40000000-0000-0000-0000-000000000002', 'Sem permissão', '5531999990002');
insert into public.contato_clientes (contato_id, cliente_id, pode_atualizar_preco) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', true),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', false);

select lives_ok($$ select public.cadastrar_produto_agente('10000000-0000-0000-0000-000000000001', ' 30 ', 'Lasanha Bolonhesa', 'pac', array['lasanha'], '40000000-0000-0000-0000-000000000001') $$,
  'contato com "pode mudar preço" cadastra produto pelo agente');
select is((select codigo || '|' || descricao || '|' || unidade || '|' || array_to_string(apelidos, ',') from public.produtos),
  '30|Lasanha Bolonhesa|PAC|lasanha', 'grava código sem espaços e unidade em maiúsculas');
select throws_ok($$ select public.cadastrar_produto_agente('10000000-0000-0000-0000-000000000001', '30', 'Outra', 'UN', '{}', '40000000-0000-0000-0000-000000000001') $$,
  'P0001', 'código já cadastrado', 'não repete código');
select throws_ok($$ select public.cadastrar_produto_agente('10000000-0000-0000-0000-000000000001', '31', 'Rosca', 'UN', '{}', '40000000-0000-0000-0000-000000000002') $$,
  'P0001', 'contato sem permissão para cadastrar produto', 'contato sem a marcação não cadastra');
select is((select count(*)::int from public.produtos), 1, 'só o primeiro produto foi gravado');

set local role authenticated;
select throws_ok($$ select public.cadastrar_produto_agente('10000000-0000-0000-0000-000000000001', '32', 'X', 'UN', '{}', '40000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'navegador não chama a função do agente');

select * from finish();
rollback;
