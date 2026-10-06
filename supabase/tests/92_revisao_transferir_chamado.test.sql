-- Revisão geral, área 1, I2: transferir_chamado segue a regra de definir_responsavel (pessoa ativa do setor) e só aceita
-- setor ativo. Antes, dava para passar a demanda (e com ela a conversa) a uma pessoa arquivada ou de fora do setor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('92000000-0000-0000-0000-00000000000a', 'ana92@pgtap.local'),
  ('92000000-0000-0000-0000-00000000000b', 'beto92@pgtap.local'),
  ('92000000-0000-0000-0000-00000000000c', 'caio92@pgtap.local'),
  ('92000000-0000-0000-0000-00000000000d', 'dora92@pgtap.local'),
  ('92000000-0000-0000-0000-00000000000e', 'adm92@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes, ativo) values
  ('92000000-0000-0000-0000-00000000000a', 'Ana 92', 'ana92@pgtap.local', 'atendente', '{}', true),
  ('92000000-0000-0000-0000-00000000000b', 'Beto 92', 'beto92@pgtap.local', 'atendente', '{}', true),
  ('92000000-0000-0000-0000-00000000000c', 'Caio 92', 'caio92@pgtap.local', 'atendente', '{}', false),
  ('92000000-0000-0000-0000-00000000000d', 'Dora 92', 'dora92@pgtap.local', 'atendente', '{}', true),
  ('92000000-0000-0000-0000-00000000000e', 'Adm 92', 'adm92@pgtap.local', 'admin', '{}', true);
-- Ana no Fiscal; Beto e Caio (arquivado) no Pessoal; Dora no Contábil.
insert into public.usuario_setores (usuario_id, setor_id) values
  ('92000000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Fiscal')),
  ('92000000-0000-0000-0000-00000000000b', (select id from public.setores where nome = 'Pessoal')),
  ('92000000-0000-0000-0000-00000000000c', (select id from public.setores where nome = 'Pessoal')),
  ('92000000-0000-0000-0000-00000000000d', (select id from public.setores where nome = 'Contábil'));
insert into public.setores (id, nome, ativo) values ('92300000-0000-0000-0000-000000000001', 'Setor Desativado 92', false);
insert into public.chamados (id, setor_id, titulo) values
  ('92100000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'Guia 92'),
  ('92100000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Fiscal'), 'Outra 92');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"92000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1 a 4. Recusas.
select throws_ok($$ select public.transferir_chamado('92100000-0000-0000-0000-000000000001',
  (select id from public.setores where nome = 'Pessoal'), '92000000-0000-0000-0000-00000000000c') $$,
  'P0001', 'Escolha uma pessoa ativa do setor da demanda.', 'pessoa arquivada não recebe a demanda');
select throws_ok($$ select public.transferir_chamado('92100000-0000-0000-0000-000000000001',
  (select id from public.setores where nome = 'Pessoal'), '92000000-0000-0000-0000-00000000000d') $$,
  'P0001', 'Escolha uma pessoa ativa do setor da demanda.', 'pessoa de fora do setor não recebe a demanda');
select throws_ok($$ select public.transferir_chamado('92100000-0000-0000-0000-000000000001',
  '92300000-0000-0000-0000-000000000001', null) $$,
  'P0001', 'Escolha um setor ativo.', 'setor desativado não recebe a demanda');
select throws_ok($$ select public.transferir_chamado('92100000-0000-0000-0000-000000000001',
  '92300000-0000-0000-0000-0000000000ff', null) $$,
  'P0001', 'Escolha um setor ativo.', 'setor que não existe é recusado');
-- 5 a 6. Pessoa ativa do setor de destino e administrador passam.
select lives_ok($$ select public.transferir_chamado('92100000-0000-0000-0000-000000000001',
  (select id from public.setores where nome = 'Pessoal'), '92000000-0000-0000-0000-00000000000b') $$,
  'pessoa ativa do setor de destino recebe a demanda');
select lives_ok($$ select public.transferir_chamado('92100000-0000-0000-0000-000000000002',
  (select id from public.setores where nome = 'Contábil'), '92000000-0000-0000-0000-00000000000e') $$,
  'administrador pode ser responsável em qualquer setor');

reset role;
-- 7 a 10.
select ok((select setor_id = (select id from public.setores where nome = 'Pessoal') and responsavel_id = '92000000-0000-0000-0000-00000000000b'
  from public.chamados where id = '92100000-0000-0000-0000-000000000001'), 'transferida para Beto no Pessoal');
select is((select count(*)::int from public.chamado_eventos where chamado_id = '92100000-0000-0000-0000-000000000001' and tipo = 'transferencia'), 1,
  'só a transferência válida gera evento');
select is((select texto from public.chamado_eventos where chamado_id = '92100000-0000-0000-0000-000000000001' and tipo = 'responsavel_alterado'),
  'Beto 92', 'troca de responsável na transferência gera o evento responsavel_alterado');
select is((select count(*)::int from public.chamado_eventos where chamado_id in ('92100000-0000-0000-0000-000000000001', '92100000-0000-0000-0000-000000000002')
  and tipo = 'responsavel_alterado'), 2, 'um evento de responsável por demanda');

select * from finish();
rollback;
