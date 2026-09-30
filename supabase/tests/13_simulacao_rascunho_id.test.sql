begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Treinar o agente: o rascunho do teste pode apontar a orientação salva que ele está editando.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'marcada13@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes, ativo) values
  ('00000000-0000-0000-0000-0000000000c1', 'Marcada', 'marcada13@pgtap.local', 'atendente', '{treinar_agente}', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok($$ select set_config('teste.o1', public.salvar_orientacao(null, 'Cumprimento', 'Cumprimente.', 'jeito', null, null, true)::text, true) $$,
  'cria a orientação salva');

select throws_ok($$ select public.criar_simulacao('oi', null, '{"id":"abc","titulo":"T","texto":"x","tipo":"jeito"}') $$, 'P0001',
  'Rascunho da orientação inválido.', 'id que não é uuid');
select throws_ok($$ select public.criar_simulacao('oi', null, '{"id":"00000000-0000-0000-0000-000000000999","titulo":"T","texto":"x","tipo":"jeito"}') $$, 'P0001',
  'Orientação não encontrada.', 'id de orientação que não existe');
select lives_ok($$ select set_config('teste.s1', public.criar_simulacao('oi', null,
  jsonb_build_object('id', current_setting('teste.o1'), 'titulo', ' Cumprimento novo ', 'texto', 'Deseje boa semana.', 'tipo', 'jeito'))::text, true) $$,
  'rascunho com o id da orientação editada');
select is((select rascunho->>'id' from public.simulacoes_agente where id = current_setting('teste.s1')::uuid), current_setting('teste.o1'),
  'id gravado no rascunho');
reset role;
update public.simulacoes_agente set status = 'pronta' where id = current_setting('teste.s1')::uuid;
set local role authenticated;
select lives_ok($$ select set_config('teste.s2', public.criar_simulacao('oi', null, '{"titulo":"T","texto":"x","tipo":"jeito"}')::text, true) $$,
  'sem id continua valendo');
select is((select rascunho->'id' from public.simulacoes_agente where id = current_setting('teste.s2')::uuid), 'null'::jsonb,
  'sem id, o rascunho grava id nulo');

select * from finish();
rollback;
