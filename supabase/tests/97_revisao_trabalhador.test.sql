-- Revisão geral, área 2 (trabalhador), C1 e I1: a trava por chave (uma vez por conversa/pergunta sem bloquear a fila das
-- outras) e a mensagem de cliente parada (o batimento devolve à fila e, depois de 2 devoluções, passa à equipe).
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email) values ('97000000-0000-0000-0000-00000000000a', 'ana97@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values ('97000000-0000-0000-0000-00000000000a', 'Ana 97', 'ana97@pgtap.local', 'admin');
insert into public.conversas (id, telefone) values
  ('97100000-0000-0000-0000-00000000000a', '5531970000001'), ('97100000-0000-0000-0000-00000000000b', '5531970000002'),
  ('97100000-0000-0000-0000-00000000000c', '5531970000003'), ('97100000-0000-0000-0000-00000000000d', '5531970000004');
update public.conversas set estado = 'humano' where id = '97100000-0000-0000-0000-00000000000c';
insert into public.mensagens (conversa_id, direcao, autor, conteudo, criado_em) values
  ('97100000-0000-0000-0000-00000000000a', 'entrada', 'cliente', 'parada há 10 min', now() - interval '10 minutes'),
  ('97100000-0000-0000-0000-00000000000b', 'entrada', 'cliente', 'parada há 1 min', now() - interval '1 minute'),
  ('97100000-0000-0000-0000-00000000000c', 'entrada', 'cliente', 'com a equipe', now() - interval '10 minutes'),
  ('97100000-0000-0000-0000-00000000000d', 'entrada', 'cliente', 'em atendimento agora', now() - interval '10 minutes');

-- 1–3: estrutura
select has_table('public', 'travas_trabalhador', 'tabela travas_trabalhador');
select has_column('public', 'mensagens', 'reenfileirada', 'mensagens.reenfileirada');
select ok(not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'travas_trabalhador'), 'fora do Realtime');

-- 4–9: pegar_trava / soltar_trava
select is(public.pegar_trava('conversa:x', '97900000-0000-0000-0000-000000000001', 60), true, 'primeira vez: pega');
select is(public.pegar_trava('conversa:x', '97900000-0000-0000-0000-000000000002', 60), false, 'outro dono com a trava valendo: não pega');
select is(public.pegar_trava('conversa:x', '97900000-0000-0000-0000-000000000001', 60), true, 'o mesmo dono renova');
select is(public.pegar_trava('conversa:y', '97900000-0000-0000-0000-000000000002', 60), true, 'outra chave: pega (não bloqueia as outras)');
select lives_ok($$ select public.soltar_trava('conversa:x', '97900000-0000-0000-0000-000000000002') $$, 'soltar de outro dono não faz nada');
select is(public.pegar_trava('conversa:x', '97900000-0000-0000-0000-000000000002', 60), false, 'continua com o primeiro dono');
select public.soltar_trava('conversa:x', '97900000-0000-0000-0000-000000000001');
select is(public.pegar_trava('conversa:x', '97900000-0000-0000-0000-000000000002', 60), true, 'solta pelo dono: outro pega');
update public.travas_trabalhador set ate = now() - interval '1 second' where chave = 'conversa:x';
select is(public.pegar_trava('conversa:x', '97900000-0000-0000-0000-000000000003', 60), true, 'vencida: outro pega');

-- 12–17: conversas_com_mensagem_parada / marcar_reenfileirada
select public.pegar_trava('conversa:97100000-0000-0000-0000-00000000000d', '97900000-0000-0000-0000-000000000004', 600);
select results_eq($$ select conversa_id from public.conversas_com_mensagem_parada(3, 1440) $$,
  $$ values ('97100000-0000-0000-0000-00000000000a'::uuid) $$,
  'parada há 10 min entra; há 1 min, com a equipe ou com a vez em andamento, não');
select is((select count(*)::int from public.conversas_com_mensagem_parada(30, 1440)), 0, 'nenhuma acima de 30 min');
select lives_ok($$ select public.marcar_reenfileirada('97100000-0000-0000-0000-00000000000a') $$, 'marca a devolução');
select is((select reenvios from public.conversas_com_mensagem_parada(3, 1440)), 1, 'reenvios = 1');
select isnt((select ultimo_reenvio from public.conversas_com_mensagem_parada(3, 1440)), null, 'com a hora da devolução');
update public.mensagens set processada_em = now() where conversa_id = '97100000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.conversas_com_mensagem_parada(3, 1440)), 0, 'processada sai da lista');

-- 18–22: só a chave de serviço
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"97000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.pegar_trava('a', '97900000-0000-0000-0000-000000000001', 60) $$, '42501', null, 'pessoa não pega trava');
select throws_ok($$ select public.soltar_trava('a', '97900000-0000-0000-0000-000000000001') $$, '42501', null, 'pessoa não solta trava');
select throws_ok($$ select public.conversas_com_mensagem_parada(3, 30) $$, '42501', null, 'pessoa (nem o administrador) lista paradas');
select throws_ok($$ select public.marcar_reenfileirada('97100000-0000-0000-0000-00000000000a') $$, '42501', null, 'pessoa não marca devolução');
select throws_ok($$ select count(*) from public.travas_trabalhador $$, '42501', null, 'pessoa não lê as travas');

select * from finish();
rollback;
