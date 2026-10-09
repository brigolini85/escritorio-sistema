-- Auditoria 4.1 e 4.4: retomada da vez interrompida sem repetir resposta nem demanda; trava renovada e solta no desligamento.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into public.conversas (id, telefone) values ('e1250000-0000-0000-0000-0000000000c1', '5531999991251');
-- m1 e m2: lote do turno t1 (que agiu); m3: lote do turno t2 (que não fez nada); m4: chegou no meio (sem turno).
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, turno_agente_entrada) values
  ('e1250000-0000-0000-0000-0000000000a1', 'e1250000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'texto', 'oi', 'e1250000-0000-0000-0000-0000000000f1'),
  ('e1250000-0000-0000-0000-0000000000a2', 'e1250000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'texto', 'preciso da guia', 'e1250000-0000-0000-0000-0000000000f1'),
  ('e1250000-0000-0000-0000-0000000000a3', 'e1250000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'texto', 'e o boleto', 'e1250000-0000-0000-0000-0000000000f2'),
  ('e1250000-0000-0000-0000-0000000000a4', 'e1250000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'texto', 'alô', null);

-- 1–3: a coluna e as permissões
select has_column('public', 'mensagens', 'turno_agente_entrada', 'mensagens guardam o turno que pegou o lote');
select ok(not has_function_privilege('authenticated', 'public.pegar_lote_do_turno(uuid, uuid[], text)', 'execute'), 'o painel não pega lote');
select ok(not has_function_privilege('anon', 'public.pegar_lote_do_turno(uuid, uuid[], text)', 'execute'), 'visitante não pega lote');

-- 4–7: turno sem ação (nem t1 nem t2 agiram): tudo fica com o turno novo, nada interrompido
select is(public.pegar_lote_do_turno('e1250000-0000-0000-0000-0000000000c1',
  array['e1250000-0000-0000-0000-0000000000a3', 'e1250000-0000-0000-0000-0000000000a4']::uuid[], 'e1250000-0000-0000-0000-0000000000f3'),
  '{"interrompidas": [], "respondeu": false}'::jsonb, 'turno que não fez nada: roda normalmente');
select is((select turno_agente_entrada from public.mensagens where id = 'e1250000-0000-0000-0000-0000000000a3'), 'e1250000-0000-0000-0000-0000000000f3',
  'mensagem de turno que não fez nada passa ao turno novo');
select is((select turno_agente_entrada from public.mensagens where id = 'e1250000-0000-0000-0000-0000000000a4'), 'e1250000-0000-0000-0000-0000000000f3',
  'mensagem sem turno ganha o turno novo');
select is((select turno_agente_entrada from public.mensagens where id = 'e1250000-0000-0000-0000-0000000000a1'), 'e1250000-0000-0000-0000-0000000000f1',
  'mensagem fora do lote não muda');

-- 8–11: t1 abriu demanda (decisão): m1 e m2 voltam interrompidas, sem resposta; m4 (sem turno) fica com o turno novo
update public.mensagens set turno_agente_entrada = null where id = 'e1250000-0000-0000-0000-0000000000a4';
insert into public.decisoes_agente (conversa_id, etapa, entrada, saida, turno) values
  ('e1250000-0000-0000-0000-0000000000c1', 'abrir_chamado', '{}', '{"ok": true}', 'e1250000-0000-0000-0000-0000000000f1');
select is(public.pegar_lote_do_turno('e1250000-0000-0000-0000-0000000000c1',
  array['e1250000-0000-0000-0000-0000000000a1', 'e1250000-0000-0000-0000-0000000000a2', 'e1250000-0000-0000-0000-0000000000a4']::uuid[],
  'e1250000-0000-0000-0000-0000000000f4') -> 'respondeu', 'false'::jsonb, 'turno que só abriu demanda: nenhuma resposta saiu');
select is((select turno_agente_entrada from public.mensagens where id = 'e1250000-0000-0000-0000-0000000000a1'), 'e1250000-0000-0000-0000-0000000000f1',
  'mensagem do turno que agiu não ganha o turno novo');
select is((select turno_agente_entrada from public.mensagens where id = 'e1250000-0000-0000-0000-0000000000a4'), 'e1250000-0000-0000-0000-0000000000f4',
  'mensagem que chegou no meio fica para o turno novo');
select is((select jsonb_array_length(public.pegar_lote_do_turno('e1250000-0000-0000-0000-0000000000c1',
  array['e1250000-0000-0000-0000-0000000000a1', 'e1250000-0000-0000-0000-0000000000a2']::uuid[], 'e1250000-0000-0000-0000-0000000000f5') -> 'interrompidas')),
  2, 'as duas mensagens do turno que agiu voltam interrompidas');

-- 12: saída do turno conta como ação e como resposta
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, turno_agente) values
  ('e1250000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', 'Olá!', 'e1250000-0000-0000-0000-0000000000f4');
select is(public.pegar_lote_do_turno('e1250000-0000-0000-0000-0000000000c1',
  array['e1250000-0000-0000-0000-0000000000a4']::uuid[], 'e1250000-0000-0000-0000-0000000000f6'),
  '{"interrompidas": ["e1250000-0000-0000-0000-0000000000a4"], "respondeu": true}'::jsonb, 'turno que respondeu: interrompida e respondeu');

-- 13: a decisão "orientacoes_cortadas" não é ação do agente (como contarDecisoesDesde)
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, turno_agente_entrada) values
  ('e1250000-0000-0000-0000-0000000000a5', 'e1250000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'texto', 'oi', 'e1250000-0000-0000-0000-0000000000f7');
insert into public.decisoes_agente (conversa_id, etapa, entrada, saida, turno) values
  ('e1250000-0000-0000-0000-0000000000c1', 'orientacoes_cortadas', '{}', '{}', 'e1250000-0000-0000-0000-0000000000f7');
select is(public.pegar_lote_do_turno('e1250000-0000-0000-0000-0000000000c1',
  array['e1250000-0000-0000-0000-0000000000a5']::uuid[], 'e1250000-0000-0000-0000-0000000000f8') -> 'interrompidas', '[]'::jsonb,
  'orientações cortadas não contam como ação');

-- 14–17: renovar_trava só renova a trava do mesmo dono
select ok(public.pegar_trava('conversa:t125', 'e1250000-0000-0000-0000-0000000000d1', 2), 'pega a trava por 2 s');
select ok(public.renovar_trava('conversa:t125', 'e1250000-0000-0000-0000-0000000000d1', 600), 'o dono renova');
select ok((select ate > now() + interval '9 minutes' from public.travas_trabalhador where chave = 'conversa:t125'), 'a validade foi estendida');
select ok(not public.renovar_trava('conversa:t125', 'e1250000-0000-0000-0000-0000000000d2', 600), 'outro dono não renova');

-- 18–20: soltar_travas_do_dono solta só as travas dos donos pedidos
select ok(public.pegar_trava('conversa:t125b', 'e1250000-0000-0000-0000-0000000000d2', 600), 'outra trava, outro dono');
select is(public.soltar_travas_do_dono(array['e1250000-0000-0000-0000-0000000000d1']::uuid[]), 1, 'solta a trava do dono pedido');
select is((select array_agg(chave) from public.travas_trabalhador where chave like 'conversa:t125%'), array['conversa:t125b'], 'a trava do outro dono fica');

-- 21–26 (revisão): a queda entre o insert da demanda e o registro da decisão. A demanda do agente (ou a Triagem que ele
-- complementou) depois que o turno pegou a mensagem conta como ação; demanda de antes, ou do sistema, não conta.
insert into public.conversas (id, telefone) values
  ('e1250000-0000-0000-0000-0000000000c2', '5531999991252'),
  ('e1250000-0000-0000-0000-0000000000c3', '5531999991253');
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo) values
  ('e1250000-0000-0000-0000-0000000000b1', 'e1250000-0000-0000-0000-0000000000c2', 'entrada', 'cliente', 'texto', 'preciso da guia'),
  ('e1250000-0000-0000-0000-0000000000b2', 'e1250000-0000-0000-0000-0000000000c3', 'entrada', 'cliente', 'texto', 'oi');
-- Demandas de antes do turno (agente) e do sistema (Triagem da passagem) não contam.
insert into public.chamados (conversa_id, titulo, origem, criado_em) values
  ('e1250000-0000-0000-0000-0000000000c2', 'Antiga', 'agente', now() - interval '1 hour');
select is(public.pegar_lote_do_turno('e1250000-0000-0000-0000-0000000000c2', array['e1250000-0000-0000-0000-0000000000b1']::uuid[],
  'e1250000-0000-0000-0000-0000000000f9') -> 'interrompidas', '[]'::jsonb, 'demanda de antes do turno não conta');
select ok((select turno_agente_entrada_em is not null from public.mensagens where id = 'e1250000-0000-0000-0000-0000000000b1'),
  'o turno grava quando pegou a mensagem');
insert into public.chamados (conversa_id, titulo, origem) values ('e1250000-0000-0000-0000-0000000000c2', 'Triagem', 'sistema');
select is(public.pegar_lote_do_turno('e1250000-0000-0000-0000-0000000000c2', array['e1250000-0000-0000-0000-0000000000b1']::uuid[],
  'e1250000-0000-0000-0000-0000000000fa') -> 'interrompidas', '[]'::jsonb, 'Triagem do sistema não conta');
-- O agente abriu a demanda e caiu antes de registrar a decisão.
insert into public.chamados (conversa_id, titulo, origem) values ('e1250000-0000-0000-0000-0000000000c2', 'Guia', 'agente');
select is(public.pegar_lote_do_turno('e1250000-0000-0000-0000-0000000000c2', array['e1250000-0000-0000-0000-0000000000b1']::uuid[],
  'e1250000-0000-0000-0000-0000000000fb'), '{"interrompidas": ["e1250000-0000-0000-0000-0000000000b1"], "respondeu": false}'::jsonb,
  'demanda do agente depois do turno, sem decisão gravada: o turno agiu');
-- Triagem já aberta antes, complementada pelo agente depois do turno (nota sem pessoa).
insert into public.chamados (id, conversa_id, titulo, origem, criado_em) values
  ('e1250000-0000-0000-0000-0000000000e1', 'e1250000-0000-0000-0000-0000000000c3', 'Triagem', 'agente', now() - interval '1 hour');
select is(public.pegar_lote_do_turno('e1250000-0000-0000-0000-0000000000c3', array['e1250000-0000-0000-0000-0000000000b2']::uuid[],
  'e1250000-0000-0000-0000-0000000000fc') -> 'interrompidas', '[]'::jsonb, 'Triagem antiga sem complemento: não agiu');
insert into public.chamado_eventos (chamado_id, tipo, texto) values ('e1250000-0000-0000-0000-0000000000e1', 'nota_interna', 'mais isto');
select is(public.pegar_lote_do_turno('e1250000-0000-0000-0000-0000000000c3', array['e1250000-0000-0000-0000-0000000000b2']::uuid[],
  'e1250000-0000-0000-0000-0000000000fd') -> 'interrompidas', '["e1250000-0000-0000-0000-0000000000b2"]'::jsonb,
  'Triagem complementada pelo agente depois do turno: o turno agiu');

select * from finish();
rollback;
