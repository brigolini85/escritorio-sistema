-- Parte G1, Task 1 (spec 7C.4 e 7C.6): simular_mudanca_prazo só lê; aplicar_prazo_abertas grava a regra e recalcula as
-- abertas que seguem a regra (prazo escolhido à mão fica), com um evento por demanda, sem perder a pausa de "Com o cliente".
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

-- Calendário fixo: seg–sex 08–18, prazos 0/1/2/5, feriado na segunda 12/10/2026 (09/10 é sexta; 10/03/2027, quarta).
update public.configuracoes set dias_uteis = '{1,2,3,4,5}', horario_inicio = '08:00', horario_fim = '18:00',
  prazo_urgente_dias = 0, prazo_alta_dias = 1, prazo_normal_dias = 2, prazo_baixa_dias = 5 where id = 1;
insert into public.feriados (data, descricao) values ('2026-10-12', 'Nossa Senhora Aparecida (G1)')
  on conflict (data) do update set descricao = excluded.descricao;
-- As contagens são do escritório inteiro: só as demandas deste teste ficam abertas.
update public.chamados set status = 'concluido', concluido_em = coalesce(concluido_em, now()) where status <> 'concluido';

insert into auth.users (id, email) values
  ('e1000000-0000-0000-0000-00000000000a', 'admin@g1.local'), ('e1000000-0000-0000-0000-00000000000b', 'conf@g1.local'),
  ('e1000000-0000-0000-0000-00000000000c', 'sem@g1.local'), ('e1000000-0000-0000-0000-00000000000d', 'noite@g1.local');
insert into public.usuarios (id, nome, email, papel) values
  ('e1000000-0000-0000-0000-00000000000a', 'Admin G1', 'admin@g1.local', 'admin'),
  ('e1000000-0000-0000-0000-00000000000b', 'Conf G1', 'conf@g1.local', 'atendente'),
  ('e1000000-0000-0000-0000-00000000000c', 'Sem G1', 'sem@g1.local', 'atendente'),
  ('e1000000-0000-0000-0000-00000000000d', 'Noite G1', 'noite@g1.local', 'atendente');
update public.usuario_permissoes set nivel = 'sim'
where modulo = 'configuracoes' and usuario_id in ('e1000000-0000-0000-0000-00000000000b', 'e1000000-0000-0000-0000-00000000000d');
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'e1000000-0000-0000-0000-00000000000d';
insert into public.setores (id, nome) values ('e1100000-0000-0000-0000-000000000001', 'Setor G1');

-- A: segue a regra · B: prazo escolhido à mão · C: Normal pausada "Com o cliente" · G: vence daqui a 1 hora
-- E: outra prioridade · H: Baixa pausada (regra antiga do gatilho).
insert into public.chamados (id, setor_id, titulo, prioridade, prazo_em) values
  ('e1200000-0000-0000-0000-000000000001', 'e1100000-0000-0000-0000-000000000001', 'G1 A', 'normal', '2027-03-10 18:00-03'),
  ('e1200000-0000-0000-0000-000000000002', 'e1100000-0000-0000-0000-000000000001', 'G1 B', 'normal', '2027-03-10 18:00-03'),
  ('e1200000-0000-0000-0000-000000000004', 'e1100000-0000-0000-0000-000000000001', 'G1 G', 'normal', now() + interval '1 hour'),
  ('e1200000-0000-0000-0000-000000000005', 'e1100000-0000-0000-0000-000000000001', 'G1 E', 'alta', '2027-03-10 18:00-03');
insert into public.chamados (id, setor_id, titulo, prioridade, prazo_em, status, prazo_pausado_desde) values
  ('e1200000-0000-0000-0000-000000000003', 'e1100000-0000-0000-0000-000000000001', 'G1 C', 'normal', '2027-03-10 18:00-03',
   'aguardando_cliente', now() - interval '3 days'),
  ('e1200000-0000-0000-0000-000000000006', 'e1100000-0000-0000-0000-000000000001', 'G1 H', 'baixa', '2027-03-10 18:00-03',
   'aguardando_cliente', now() - interval '3 days');
-- Uma pessoa escolheu o prazo de B na demanda (depois da abertura).
insert into public.chamado_eventos (chamado_id, tipo, usuario_id, texto)
  values ('e1200000-0000-0000-0000-000000000002', 'prazo_alterado', 'e1000000-0000-0000-0000-00000000000a',
          public.texto_prazo('2027-03-10 18:00-03'));
create temp table g1_antes as select id, prazo_em from public.chamados where titulo like 'G1 %';

-- 1–9: estrutura e quem executa
select has_function('public', 'simular_mudanca_prazo', 'simular existe');
select has_function('public', 'aplicar_prazo_abertas', 'aplicar existe');
select has_function('public', 'prazos_resumo', 'resumo existe');
select is((select provolatile::text from pg_proc where oid = 'public.simular_mudanca_prazo(public.prioridade_demanda, integer)'::regprocedure),
  's', 'simular é stable: o Postgres recusa gravação dentro dela');
select is((select provolatile::text from pg_proc where oid = 'public.prazos_resumo(timestamptz)'::regprocedure), 's', 'resumo é stable');
select ok(not has_function_privilege('anon', 'public.simular_mudanca_prazo(public.prioridade_demanda, integer)', 'execute'), 'anon não simula');
select ok(not has_function_privilege('anon', 'public.aplicar_prazo_abertas(public.prioridade_demanda, integer)', 'execute'), 'anon não aplica');
select ok(not has_function_privilege('authenticated', 'public.deslocar_dias_uteis(timestamptz, integer)', 'execute'), 'deslocar: interna');
select ok(not has_function_privilege('authenticated', 'public.prazo_segue_regra(uuid)', 'execute'), 'segue_regra: interna');

-- 10–15: calendário
select is(public.deslocar_dias_uteis('2026-10-09 18:00-03', 1), '2026-10-13 18:00-03'::timestamptz, 'sexta + 1 dia útil = terça (pula fim de semana e feriado)');
select is(public.deslocar_dias_uteis('2026-10-13 18:00-03', -1), '2026-10-09 18:00-03'::timestamptz, 'terça − 1 dia útil = sexta');
select is(public.deslocar_dias_uteis('2026-10-13 15:30-03', 0), '2026-10-13 15:30-03'::timestamptz, 'zero não mexe');
select is(public.deslocar_dias_uteis('2026-10-09 18:00-03', 2), '2026-10-14 18:00-03'::timestamptz, 'sexta + 2 = quarta');
select is(public.calcular_prazo_dias(2, '2026-10-09 10:00-03'), public.calcular_prazo('normal', '2026-10-09 10:00-03'), 'mesma conta do calcular_prazo');
select is(public.calcular_prazo_dias(0, '2026-10-09 19:00-03'), public.calcular_prazo('urgente', '2026-10-09 19:00-03'), 'depois do expediente: próximo dia útil');

-- 16–18: prazo à mão e o tipo novo de evento
select ok(public.prazo_segue_regra('e1200000-0000-0000-0000-000000000001'), 'A segue a regra');
select ok(not public.prazo_segue_regra('e1200000-0000-0000-0000-000000000002'), 'B tem prazo escolhido à mão');
select lives_ok($$ insert into public.chamado_eventos (chamado_id, tipo, texto)
  values ('e1200000-0000-0000-0000-000000000005', 'prazo_recalculado', public.texto_prazo(now())) $$, 'tipo prazo_recalculado aceito');

create temp table g1_snap as
  select (select count(*) from public.chamado_eventos) as eventos, (select prazo_normal_dias from public.configuracoes where id = 1) as normal;

-- 19–22: quem não pode
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.simular_mudanca_prazo('normal', 3) $$, 'P0001', 'Só quem tem acesso às Configurações muda os prazos.', 'sem Configurações: não simula');
select throws_ok($$ select public.aplicar_prazo_abertas('normal', 3) $$, 'P0001', 'Só quem tem acesso às Configurações muda os prazos.', 'sem Configurações: não aplica');
select throws_ok($$ select public.prazos_resumo() $$, 'P0001', 'Só quem tem acesso às Configurações muda os prazos.', 'sem Configurações: não lê o resumo');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select public.simular_mudanca_prazo('normal', 3) $$, 'P0001', 'Só quem tem acesso às Configurações muda os prazos.', 'fora do horário: não simula');

-- 23–30: simular e resumo (Configurações: Sim; administrador)
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.simular_mudanca_prazo('normal', 3) - 'prioridade',
  '{"dias_atuais":2,"dias_novos":3,"abertas":4,"pela_regra":3,"a_mao":1,"sem_prazo":0,"ganham":3,"perdem":0,"pausadas":1,"passam_a_vencidas":0,"ja_vencidas":0}'::jsonb,
  'Normal 2→3: A, C e G ganham 1 dia útil; B fica; C continua pausada');
select is((select array[(s ->> 'perdem')::int, (s ->> 'passam_a_vencidas')::int] from (select public.simular_mudanca_prazo('normal', 0) s) x),
  array[3, 1], 'Normal 2→0: três perdem 2 dias úteis; G passaria a vencida (C pausada não conta)');
select is((select (s ->> 'ganham')::int + (s ->> 'perdem')::int from (select public.simular_mudanca_prazo('normal', 2) s) x), 0, 'mesmo valor: ninguém muda');
select throws_ok($$ select public.simular_mudanca_prazo('normal', 31) $$, 'P0001', 'O prazo precisa ser de 0 a 30 dias úteis.', 'fora de 0 a 30: recusa');
select is(public.prazos_resumo('2026-10-09 10:00-03') -> 'abertas' ->> 'normal', '4', 'abertas por prioridade');
select is(jsonb_array_length(public.prazos_resumo('2026-10-09 10:00-03') -> 'exemplos'), 31, 'exemplos de 0 a 30 dias úteis');
select is((public.prazos_resumo('2026-10-09 10:00-03') -> 'exemplos' ->> 2)::timestamptz, '2026-10-14 18:00-03'::timestamptz,
  'aberta sexta 10:00 com 2 dias úteis: quarta 18:00 (pula o feriado)');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.simular_mudanca_prazo('alta', 2) $$, 'administrador simula');

-- 31: simular e resumo não gravaram nada
reset role;
select ok(
  (select count(*) from public.chamado_eventos) = (select eventos from g1_snap)
  and (select prazo_normal_dias from public.configuracoes where id = 1) = (select normal from g1_snap)
  and not exists (select 1 from g1_antes a join public.chamados c using (id) where c.prazo_em is distinct from a.prazo_em),
  'simular e resumo: eventos, prazos e configuração iguais');

-- 32–40: aplicar Normal 2→3 (Configurações: Sim)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.aplicar_prazo_abertas('normal', 3), 3, 'recalcula as três que seguem a regra');
reset role;
select is((select prazo_normal_dias from public.configuracoes where id = 1), 3, 'a regra nova ficou gravada');
select is((select prazo_em from public.chamados where id = 'e1200000-0000-0000-0000-000000000001'), '2027-03-11 18:00-03'::timestamptz, 'A: quarta → quinta');
select is((select prazo_em from public.chamados where id = 'e1200000-0000-0000-0000-000000000002'), '2027-03-10 18:00-03'::timestamptz, 'B (à mão) não muda');
select results_eq(
  $$ select right(chamado_id::text, 1), usuario_id::text from public.chamado_eventos
     where tipo = 'prazo_recalculado' and chamado_id::text like 'e1200000-%' and chamado_id <> 'e1200000-0000-0000-0000-000000000005' order by 1 $$,
  $$ values ('1', 'e1000000-0000-0000-0000-00000000000b'), ('3', 'e1000000-0000-0000-0000-00000000000b'), ('4', 'e1000000-0000-0000-0000-00000000000b') $$,
  'um evento por demanda recalculada, com a pessoa; a de prazo à mão não ganha evento');
select is((select texto from public.chamado_eventos where tipo = 'prazo_recalculado' and chamado_id = 'e1200000-0000-0000-0000-000000000001'),
  public.texto_prazo('2027-03-11 18:00-03'), 'o evento leva o prazo novo');
select is((select prazo_pausado_desde from public.chamados where id = 'e1200000-0000-0000-0000-000000000003'), now() - interval '3 days',
  'C continua pausada desde a mesma hora');
select is((select prazo_em from public.chamados where id = 'e1200000-0000-0000-0000-000000000005'), '2027-03-10 18:00-03'::timestamptz, 'outra prioridade não muda');
select is(coalesce(current_setting('escritorio.prazo_por_regra', true), ''), '', 'a marca do recálculo é desligada no fim');

-- 41–42: ao sair de "Com o cliente", C anda o tempo parado desde a pausa original; sem a marca, a regra antiga vale
update public.chamados set status = 'em_andamento' where id = 'e1200000-0000-0000-0000-000000000003';
select is((select prazo_em from public.chamados where id = 'e1200000-0000-0000-0000-000000000003'),
  public.somar_tempo_util('2027-03-11 18:00-03', public.tempo_util_entre(now() - interval '3 days', now())),
  'C: prazo recalculado + o tempo útil que ficou com o cliente');
update public.chamados set prazo_em = prazo_em + interval '1 day' where id = 'e1200000-0000-0000-0000-000000000006';
select is((select prazo_pausado_desde from public.chamados where id = 'e1200000-0000-0000-0000-000000000006'), now(),
  'prazo trocado na pausa sem ser recálculo: a pausa recomeça (Parte C)');

-- 43–46: voltar 3→2 desfaz; repetir não muda nada; prioridade nova recomeça a regra
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.aplicar_prazo_abertas('normal', 2), 3, 'recalculadas continuam seguindo a regra');
select is(public.aplicar_prazo_abertas('normal', 2), 0, 'mesmo valor: nada muda, nenhum evento');
reset role;
select is((select prazo_em from public.chamados where id = 'e1200000-0000-0000-0000-000000000001'), '2027-03-10 18:00-03'::timestamptz, 'A voltou para quarta');
insert into public.chamado_eventos (chamado_id, tipo, usuario_id, texto)
  values ('e1200000-0000-0000-0000-000000000002', 'prioridade_alterada', 'e1000000-0000-0000-0000-00000000000a', 'normal');
select ok(public.prazo_segue_regra('e1200000-0000-0000-0000-000000000002'), 'depois de mudar a prioridade, B volta a seguir a regra');

select * from finish();
rollback;
