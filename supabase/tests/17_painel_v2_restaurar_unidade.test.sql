-- supabase/tests/17_painel_v2_restaurar_unidade.test.sql
-- Sobra 3 da Parte B: restaurar unidade de rede arquivada pergunta antes e, com o sim, restaura as duas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000017a1', 'bia17@pgtap.local'),
  ('00000000-0000-0000-0000-0000000017a2', 'ana17@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('00000000-0000-0000-0000-0000000017a1', 'Bia', 'bia17@pgtap.local', 'atendente', '{editar_clientes}'),
  ('00000000-0000-0000-0000-0000000017a2', 'Ana', 'ana17@pgtap.local', 'atendente', '{}');
insert into public.clientes (id, razao_social, cnpj) values ('17000000-0000-0000-0000-000000000001', 'Indústria R', '17170000001701');
insert into public.parceiros_grupos (id, cliente_id, tipo, nome, ativo) values
  ('17400000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', 'cliente', 'Rede Arquivada', false),
  ('17400000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000001', 'cliente', 'Rede Ativa', true),
  ('17400000-0000-0000-0000-000000000003', '17000000-0000-0000-0000-000000000001', 'fornecedor', 'Fornecedor Arquivado', false);
insert into public.parceiros_unidades (id, cliente_id, grupo_id, nome_unidade, ativo) values
  ('17500000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '17400000-0000-0000-0000-000000000001', 'Unidade U', false),
  ('17500000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000001', '17400000-0000-0000-0000-000000000002', 'Unidade V', false),
  ('17500000-0000-0000-0000-000000000003', '17000000-0000-0000-0000-000000000001', '17400000-0000-0000-0000-000000000003', 'Unidade G', false);

select ok(not has_function_privilege('anon', 'public.restaurar_unidade(uuid, boolean)', 'execute'), 'visitante não restaura');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000017a2","role":"authenticated"}', true);
select throws_ok($$ select public.restaurar_unidade('17500000-0000-0000-0000-000000000001') $$,
  'P0001', 'Sem permissão para arquivar cadastros.', 'sem editar_clientes não restaura');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000017a1","role":"authenticated"}', true);
select is(public.restaurar_unidade('17500000-0000-0000-0000-000000000001'),
  '{"restaurada":false,"rede_arquivada":{"id":"17400000-0000-0000-0000-000000000001","nome":"Rede Arquivada","tipo":"cliente"}}'::jsonb,
  'rede arquivada: pergunta antes e não muda nada');
select is(public.restaurar_unidade('17500000-0000-0000-0000-000000000003') #>> '{rede_arquivada,tipo}', 'fornecedor',
  'diz se o grupo é rede ou fornecedor');
select is(public.restaurar_unidade('17500000-0000-0000-0000-000000000001', true), '{"restaurada":true,"rede_restaurada":true}'::jsonb,
  'com o sim, restaura a rede e a unidade');
-- A rede já está ativa (outra pessoa restaurou entre a pergunta e o clique): só a unidade volta, sem erro.
select is(public.restaurar_unidade('17500000-0000-0000-0000-000000000002', true), '{"restaurada":true,"rede_restaurada":false}'::jsonb,
  'rede ativa: só a unidade volta');
select throws_ok($$ select public.restaurar_unidade('17500000-0000-0000-0000-0000000000ff') $$,
  'P0001', 'Cadastro não encontrado.', 'unidade inexistente');
reset role;

select ok((select bool_and(ativo) from public.parceiros_unidades where id in ('17500000-0000-0000-0000-000000000001', '17500000-0000-0000-0000-000000000002'))
  and (select ativo from public.parceiros_grupos where id = '17400000-0000-0000-0000-000000000001')
  and not (select ativo from public.parceiros_unidades where id = '17500000-0000-0000-0000-000000000003')
  and not (select ativo from public.parceiros_grupos where id = '17400000-0000-0000-0000-000000000003'),
  'voltou só o que foi confirmado; a pergunta não mexeu no fornecedor');
select is((select count(*)::int from public.auditoria_acessos where acao = 'restaurar' and usuario_id = '00000000-0000-0000-0000-0000000017a1'
    and entidade_id in ('17400000-0000-0000-0000-000000000001', '17500000-0000-0000-0000-000000000001')), 2,
  'auditoria registra as duas restaurações, por quem fez');

select * from finish();
rollback;
