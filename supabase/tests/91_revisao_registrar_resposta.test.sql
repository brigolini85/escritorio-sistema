-- Revisão geral, área 1, I1: registrar_resposta só aceita arquivo de conversa que a pessoa vê e que existe no
-- compartimento "anexos". Antes, qualquer caminho passava e o trabalhador (chave de serviço) mandava o arquivo pelo WhatsApp.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values ('91000000-0000-0000-0000-00000000000a', 'ana91@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('91000000-0000-0000-0000-00000000000a', 'Ana 91', 'ana91@pgtap.local', 'atendente', '{}');
insert into public.usuario_setores (usuario_id, setor_id) select '91000000-0000-0000-0000-00000000000a', id from public.setores where nome = 'Fiscal';

-- C1 e C3: demandas do Fiscal (Ana vê). C2: demanda do Pessoal (Ana não vê).
insert into public.conversas (id, telefone) values
  ('91100000-0000-0000-0000-000000000001', '5531999999101'),
  ('91100000-0000-0000-0000-000000000002', '5531999999102'),
  ('91100000-0000-0000-0000-000000000003', '5531999999103');
insert into public.chamados (conversa_id, setor_id, titulo) values
  ('91100000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'C1'),
  ('91100000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Pessoal'), 'C2'),
  ('91100000-0000-0000-0000-000000000003', (select id from public.setores where nome = 'Fiscal'), 'C3');
insert into storage.objects (bucket_id, name) values
  ('anexos', 'conversas/91100000-0000-0000-0000-000000000001/1-guia.pdf'),
  ('anexos', 'conversas/91100000-0000-0000-0000-000000000002/1-holerite.pdf'),
  ('anexos', 'conversas/91100000-0000-0000-0000-000000000003/1-extrato.pdf'),
  ('tarefas', '91900000-0000-0000-0000-000000000001/1-planilha.pdf');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1 a 3. Caminhos que valem.
select lives_ok($$ select public.registrar_resposta('91100000-0000-0000-0000-000000000001', 'Segue', null, null, null) $$,
  'só texto continua valendo');
select lives_ok($$ select public.registrar_resposta('91100000-0000-0000-0000-000000000001', null,
  'conversas/91100000-0000-0000-0000-000000000001/1-guia.pdf', 'guia.pdf', 'application/pdf') $$,
  'arquivo enviado à própria conversa');
select lives_ok($$ select public.registrar_resposta('91100000-0000-0000-0000-000000000001', null,
  'conversas/91100000-0000-0000-0000-000000000003/1-extrato.pdf', 'extrato.pdf', 'application/pdf') $$,
  'arquivo de outra conversa que a pessoa também vê');

-- 4 a 8. Caminhos recusados.
select throws_ok($$ select public.registrar_resposta('91100000-0000-0000-0000-000000000001', null,
  'conversas/91100000-0000-0000-0000-000000000002/1-holerite.pdf', 'holerite.pdf', 'application/pdf') $$,
  'P0001', 'Arquivo não encontrado nesta conversa.', 'arquivo de conversa que a pessoa não vê é recusado');
select throws_ok($$ select public.registrar_resposta('91100000-0000-0000-0000-000000000001', null,
  'conversas/91100000-0000-0000-0000-000000000001/nao-existe.pdf', 'x.pdf', 'application/pdf') $$,
  'P0001', 'Arquivo não encontrado nesta conversa.', 'caminho que não existe no compartimento é recusado');
select throws_ok($$ select public.registrar_resposta('91100000-0000-0000-0000-000000000001', null,
  '91900000-0000-0000-0000-000000000001/1-planilha.pdf', 'planilha.pdf', 'application/pdf') $$,
  'P0001', 'Arquivo não encontrado nesta conversa.', 'caminho do compartimento de tarefas é recusado');
select throws_ok($$ select public.registrar_resposta('91100000-0000-0000-0000-000000000001', null,
  'conversas/nao-e-uuid/1-guia.pdf', 'guia.pdf', 'application/pdf') $$,
  'P0001', 'Arquivo não encontrado nesta conversa.', 'caminho fora do formato é recusado');
select throws_ok($$ select public.registrar_resposta('91100000-0000-0000-0000-000000000001', null, '', 'x.pdf', 'application/pdf') $$,
  'P0001', 'Arquivo não encontrado nesta conversa.', 'caminho vazio é recusado');

reset role;
-- 9. Nada foi gravado com caminho recusado.
select is((select count(*)::int from public.mensagens where conversa_id = '91100000-0000-0000-0000-000000000001'), 3,
  'só as três respostas válidas foram gravadas');

select * from finish();
rollback;
