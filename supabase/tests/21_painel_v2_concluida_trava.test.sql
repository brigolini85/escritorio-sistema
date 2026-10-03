-- supabase/tests/21_painel_v2_concluida_trava.test.sql
-- Parte C (revisão final, minor 3): concluir_chamado e transferir_chamado recusam demanda já concluída.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000021a1', 'ana21@pgtap.local'),
  ('00000000-0000-0000-0000-0000000021a2', 'caio21@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values
  ('00000000-0000-0000-0000-0000000021a1', 'Ana', 'ana21@pgtap.local', 'atendente'),
  ('00000000-0000-0000-0000-0000000021a2', 'Caio', 'caio21@pgtap.local', 'atendente');
insert into public.usuario_setores (usuario_id, setor_id)
  select '00000000-0000-0000-0000-0000000021a1', id from public.setores where nome = 'Fiscal';
insert into public.usuario_setores (usuario_id, setor_id)
  select '00000000-0000-0000-0000-0000000021a2', id from public.setores where nome = 'Pessoal';
insert into public.conversas (id, telefone) values ('21200000-0000-0000-0000-000000000001', '5531999992101');
-- K1: da conversa, será concluída e clicada de novo (cartão desatualizado). K2: aberta, transferida.
insert into public.chamados (id, conversa_id, setor_id, titulo)
  select '21300000-0000-0000-0000-000000000001', '21200000-0000-0000-0000-000000000001', id, 'Guia DAS' from public.setores where nome = 'Fiscal';
insert into public.chamados (id, setor_id, titulo)
  select '21300000-0000-0000-0000-000000000002', id, 'Certidão' from public.setores where nome = 'Fiscal';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a1","role":"authenticated"}', true);

-- 1-2: a primeira conclusão continua valendo e devolve a conversa ao agente.
select lives_ok($$ select public.concluir_chamado('21300000-0000-0000-0000-000000000001') $$, 'Ana conclui a demanda aberta');
select is((select estado::text from public.conversas where id = '21200000-0000-0000-0000-000000000001'), 'agente', 'sem demandas abertas, a conversa volta ao agente');

-- Ana retoma a conversa; depois um cartão desatualizado tenta concluir de novo.
select lives_ok($$ select public.assumir_conversa('21200000-0000-0000-0000-000000000001') $$, 'Ana assume a conversa de novo');

-- 4-7: concluir de novo é recusado e nada muda.
select throws_ok($$ select public.concluir_chamado('21300000-0000-0000-0000-000000000001') $$,
  'P0001', 'Esta demanda já está concluída.', 'concluir uma demanda já concluída é recusado');
select is((select count(*) from public.chamado_eventos where chamado_id = '21300000-0000-0000-0000-000000000001' and tipo = 'conclusao'),
  1::bigint, 'um só evento de conclusão');
select is((select estado::text from public.conversas where id = '21200000-0000-0000-0000-000000000001'), 'humano',
  'a conversa que a Ana retomou não volta ao agente');
select is((select atendente_id from public.conversas where id = '21200000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-0000000021a1'::uuid, 'a conversa continua com a Ana');

-- 8-11: transferir uma demanda concluída é recusado e ela continua concluída, no mesmo setor.
select throws_ok($$ select public.transferir_chamado('21300000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Pessoal'), null) $$,
  'P0001', 'Esta demanda está concluída. Reabra antes de mudar.', 'transferir uma demanda concluída é recusado');
select is((select status::text from public.chamados where id = '21300000-0000-0000-0000-000000000001'), 'concluido', 'continua concluída');
select is((select s.nome from public.chamados c join public.setores s on s.id = c.setor_id where c.id = '21300000-0000-0000-0000-000000000001'),
  'Fiscal', 'continua no setor de antes');
select is((select count(*) from public.chamado_eventos where chamado_id = '21300000-0000-0000-0000-000000000001' and tipo = 'transferencia'),
  0::bigint, 'nenhum evento de transferência');

-- 12-13: demanda aberta continua sendo transferida como antes.
select lives_ok($$ select public.transferir_chamado('21300000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Pessoal'), null) $$,
  'transferir uma demanda aberta continua funcionando');
-- Conferido pelo Caio, do Pessoal: a Ana deixa de ver a demanda que mandou para outro setor.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000021a2","role":"authenticated"}', true);
select is((select s.nome from public.chamados c join public.setores s on s.id = c.setor_id where c.id = '21300000-0000-0000-0000-000000000002'),
  'Pessoal', 'a demanda aberta foi para o setor novo');

-- 14: quem não vê a demanda continua recebendo a mensagem de acesso (conferida antes do estado).
select throws_ok($$ select public.concluir_chamado('21300000-0000-0000-0000-000000000001') $$,
  'P0001', 'sem acesso a este chamado', 'outro setor não conclui (nem fica sabendo que está concluída)');

select * from finish();
rollback;
