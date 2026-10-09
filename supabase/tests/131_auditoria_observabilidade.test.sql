-- Auditoria 4.8, 4.9, 4.13 e 4.15: o /saude mede o atraso das mensagens de cliente e as falhas de envio; a falha geral da
-- IA (3 conversas diferentes seguidas em 10 min) é contada no banco; uso_ia guarda o turno.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- O banco local é compartilhado com os testes do trabalhador: começa sem mensagens nem falhas (o rollback devolve).
delete from public.mensagens;
delete from public.ia_falhas_seguidas;

-- 1–8: estrutura e permissões (só o trabalhador)
select has_column('public', 'uso_ia', 'turno', 'uso_ia guarda o turno da vez');
select has_table('public', 'ia_falhas_seguidas', 'tabela das falhas seguidas da IA');
select ok(not has_table_privilege('authenticated', 'public.ia_falhas_seguidas', 'select'), 'o painel não lê as falhas da IA');
select ok(not has_function_privilege('authenticated', 'public.indicadores_saude()', 'execute'), 'o painel não lê os indicadores');
select ok(not has_function_privilege('anon', 'public.indicadores_saude()', 'execute'), 'visitante não lê os indicadores');
select ok(not has_function_privilege('authenticated', 'public.registrar_resultado_ia(uuid, boolean)', 'execute'), 'o painel não registra falha da IA');
select ok(not has_function_privilege('anon', 'public.registrar_resultado_ia(uuid, boolean)', 'execute'), 'visitante não registra falha da IA');
select ok(has_function_privilege('service_role', 'public.indicadores_saude()', 'execute'), 'o trabalhador lê os indicadores');

insert into public.conversas (id, telefone) values
  ('e1310000-0000-0000-0000-0000000000c1', '5531999991311'),
  ('e1310000-0000-0000-0000-0000000000c2', '5531999991312'),
  ('e1310000-0000-0000-0000-0000000000c3', '5531999991313'),
  ('e1310000-0000-0000-0000-0000000000c4', '5531999991314');
update public.conversas set estado = 'humano' where id = 'e1310000-0000-0000-0000-0000000000c2';
update public.conversas set aguardando_pessoa_desde = now() where id = 'e1310000-0000-0000-0000-0000000000c3';

-- 9–13: conversas atrasadas (entrada não processada há mais de 5 min e menos de 24 h, fora das conversas com pessoa)
select is((public.indicadores_saude() ->> 'conversas_atrasadas')::int, 0, 'sem mensagens: nada atrasado');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, criado_em) values
  ('e1310000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'texto', 'recente', now() - interval '2 minutes');
select is((public.indicadores_saude() ->> 'conversas_atrasadas')::int, 0, 'mensagem de 2 min: ainda no prazo');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, criado_em) values
  ('e1310000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'texto', 'parada', now() - interval '6 minutes'),
  ('e1310000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'texto', 'parada 2', now() - interval '7 minutes'),
  ('e1310000-0000-0000-0000-0000000000c2', 'entrada', 'cliente', 'texto', 'com pessoa', now() - interval '20 minutes'),
  ('e1310000-0000-0000-0000-0000000000c3', 'entrada', 'cliente', 'texto', 'esperando pessoa', now() - interval '20 minutes');
select is((public.indicadores_saude() ->> 'conversas_atrasadas')::int, 1,
  'conta conversas (não mensagens); a conversa com pessoa e a que espera pessoa ficam de fora');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, criado_em, processada_em) values
  ('e1310000-0000-0000-0000-0000000000c4', 'entrada', 'cliente', 'texto', 'processada', now() - interval '20 minutes', now());
select is((public.indicadores_saude() ->> 'conversas_atrasadas')::int, 1, 'mensagem processada não conta');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, criado_em) values
  ('e1310000-0000-0000-0000-0000000000c4', 'entrada', 'cliente', 'texto', 'esquecida', now() - interval '25 hours');
select is((public.indicadores_saude() ->> 'conversas_atrasadas')::int, 1, 'mais de 24 h sai do /saude (vai ao alerta diário)');

-- 14–15: entradas esquecidas (mais de 24 h, fora das conversas com pessoa): a quantidade de mensagens
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, criado_em) values
  ('e1310000-0000-0000-0000-0000000000c2', 'entrada', 'cliente', 'texto', 'antiga com pessoa', now() - interval '30 hours');
select is((public.indicadores_saude() ->> 'entradas_esquecidas')::int, 1, 'uma mensagem esquecida há mais de 24 h (a da conversa com pessoa não conta)');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, criado_em) values
  ('e1310000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'texto', 'esquecida 2', now() - interval '40 hours');
select is((public.indicadores_saude() ->> 'entradas_esquecidas')::int, 2, 'conta mensagens, de todas as conversas');

-- 16–17: envios com falha na última hora (falhou e incerto)
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, status_envio, criado_em) values
  ('e1310000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', 'a', 'falhou', now() - interval '10 minutes'),
  ('e1310000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', 'b', 'incerto', now() - interval '20 minutes'),
  ('e1310000-0000-0000-0000-0000000000c1', 'saida', 'atendente', 'texto', 'c', 'falhou', now() - interval '30 minutes'),
  ('e1310000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', 'd', 'falhou', now() - interval '2 hours'),
  ('e1310000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', 'e', 'enviada', now() - interval '5 minutes');
select is((public.indicadores_saude() ->> 'envios_com_falha')::int, 3, 'falhou e incerto da última hora; a de 2 h e a enviada não contam');
select is(public.indicadores_saude() ?& array['conversas_atrasadas', 'envios_com_falha', 'entradas_esquecidas'], true, 'as três chaves');

-- 18–22: falha geral da IA: 3 falhas seguidas de conversas diferentes em 10 min; um sucesso no meio zera
select is(public.registrar_resultado_ia('e1310000-0000-0000-0000-0000000000c1', false), false, '1ª falha: ainda não');
select is(public.registrar_resultado_ia('e1310000-0000-0000-0000-0000000000c1', false), false, '2ª falha da mesma conversa: ainda não (1 conversa)');
select is(public.registrar_resultado_ia('e1310000-0000-0000-0000-0000000000c2', false), false, '2 conversas: ainda não');
select public.registrar_resultado_ia(null, true);
select is(public.registrar_resultado_ia('e1310000-0000-0000-0000-0000000000c3', false), false, 'um sucesso no meio zerou a conta');
select public.registrar_resultado_ia('e1310000-0000-0000-0000-0000000000c1', false);
update public.ia_falhas_seguidas set criado_em = now() - interval '11 minutes' where conversa_id = 'e1310000-0000-0000-0000-0000000000c3';
select public.registrar_resultado_ia('e1310000-0000-0000-0000-0000000000c2', false);
select is(public.registrar_resultado_ia('e1310000-0000-0000-0000-0000000000c4', false), true,
  'c1, c2 e c4 nos últimos 10 min (a de 11 min saiu): falha geral');

select * from finish();
rollback;
