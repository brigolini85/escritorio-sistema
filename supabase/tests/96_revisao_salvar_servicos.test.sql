-- Revisão geral (painel I7, lado do banco): os serviços e os responsáveis do contrato (ficha antiga) são trocados numa
-- função só, numa transação. Antes eram dois comandos (apagar tudo e inserir): se o segundo falhasse, a empresa ficava
-- sem nenhum serviço/responsável.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('96000000-0000-0000-0000-00000000000a', 'bia96@pgtap.local'),
  ('96000000-0000-0000-0000-00000000000b', 'ana96@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('96000000-0000-0000-0000-00000000000a', 'Bia 96', 'bia96@pgtap.local', 'atendente', '{editar_clientes}'),
  ('96000000-0000-0000-0000-00000000000b', 'Ana 96', 'ana96@pgtap.local', 'atendente', '{}');
insert into public.clientes (id, razao_social, cnpj) values ('96100000-0000-0000-0000-000000000001', 'Empresa 96', '96960000000101');
insert into public.servicos (id, nome, ativo) values
  ('96200000-0000-0000-0000-000000000001', 'Serviço 96 A', true),
  ('96200000-0000-0000-0000-000000000002', 'Serviço 96 B', true),
  ('96200000-0000-0000-0000-000000000003', 'Serviço 96 C', true),
  ('96200000-0000-0000-0000-000000000004', 'Serviço 96 desativado', false);
insert into public.cliente_servicos (cliente_id, servico_id) values
  ('96100000-0000-0000-0000-000000000001', '96200000-0000-0000-0000-000000000001'),
  ('96100000-0000-0000-0000-000000000001', '96200000-0000-0000-0000-000000000004');
insert into public.cliente_responsaveis (cliente_id, setor_id, usuario_id) values
  ('96100000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), '96000000-0000-0000-0000-00000000000b');

create temp view servicos_96 as
  select coalesce(array_agg(servico_id order by servico_id), '{}') as ids from public.cliente_servicos
   where cliente_id = '96100000-0000-0000-0000-000000000001';
grant select on servicos_96 to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"96000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
-- 1 a 2. Troca o conjunto; o vínculo com serviço desativado (fora do formulário) fica.
select lives_ok($$ select public.salvar_servicos_cliente('96100000-0000-0000-0000-000000000001',
  array['96200000-0000-0000-0000-000000000002', '96200000-0000-0000-0000-000000000003']::uuid[]) $$, 'salva os serviços');
select is((select ids from servicos_96), array['96200000-0000-0000-0000-000000000002', '96200000-0000-0000-0000-000000000003',
  '96200000-0000-0000-0000-000000000004']::uuid[], 'novo conjunto; o serviço desativado continua');
-- 3 a 4. Falha no meio não apaga nada.
select throws_ok($$ select public.salvar_servicos_cliente('96100000-0000-0000-0000-000000000001',
  array['96200000-0000-0000-0000-000000000001', '96200000-0000-0000-0000-0000000000ff']::uuid[]) $$,
  '23503', null, 'serviço que não existe: recusa');
select is((select ids from servicos_96), array['96200000-0000-0000-0000-000000000002', '96200000-0000-0000-0000-000000000003',
  '96200000-0000-0000-0000-000000000004']::uuid[], 'a recusa não apagou os serviços de antes');
-- 5 a 6. Lista vazia limpa os ativos (escolha da pessoa); nulo é recusado.
select throws_ok($$ select public.salvar_servicos_cliente('96100000-0000-0000-0000-000000000001', null) $$,
  'P0001', 'Lista de serviços inválida.', 'lista nula é recusada');
select lives_ok($$ select public.salvar_servicos_cliente('96100000-0000-0000-0000-000000000001', '{}') $$, 'lista vazia limpa');

-- 7 a 9. Responsáveis.
select lives_ok($$ select public.salvar_responsaveis_cliente('96100000-0000-0000-0000-000000000001',
  jsonb_build_object((select id from public.setores where nome = 'Pessoal')::text, '96000000-0000-0000-0000-00000000000a')) $$,
  'salva os responsáveis');
select throws_ok($$ select public.salvar_responsaveis_cliente('96100000-0000-0000-0000-000000000001',
  jsonb_build_object((select id from public.setores where nome = 'Fiscal')::text, '96000000-0000-0000-0000-0000000000ff')) $$,
  '23503', null, 'responsável que não existe: recusa');
select is((select array_agg(usuario_id) from public.cliente_responsaveis where cliente_id = '96100000-0000-0000-0000-000000000001'),
  array['96000000-0000-0000-0000-00000000000a']::uuid[], 'a recusa não apagou os responsáveis de antes');

-- 10 a 11. Sem permissão de editar clientes.
select set_config('request.jwt.claims', '{"sub":"96000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_servicos_cliente('96100000-0000-0000-0000-000000000001', '{}') $$,
  'P0001', 'Você não tem permissão para editar clientes.', 'sem permissão: serviços recusados');
select throws_ok($$ select public.salvar_responsaveis_cliente('96100000-0000-0000-0000-000000000001', '{}') $$,
  'P0001', 'Você não tem permissão para editar clientes.', 'sem permissão: responsáveis recusados');

reset role;
-- 12.
select is((select ids from servicos_96), array['96200000-0000-0000-0000-000000000004']::uuid[], 'só o desativado ficou');

select * from finish();
rollback;
