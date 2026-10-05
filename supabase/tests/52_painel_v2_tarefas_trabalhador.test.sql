-- Parte I3a, Task 4 (spec 7E.4; D5, D6, D7, D8, D13, D26): o que o trabalhador grava na tarefa, sempre por função.
-- Rulings do pré-voo: F5 (pedidos ao cliente parados), F6 (vez zumbi não apaga a marca da nova), F22 (pode ser procurado na hora
-- do envio); limites de volume conferidos também no envio.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

insert into public.clientes (id, razao_social, cnpj) values ('fa100000-0000-0000-0000-00000000000a', 'I3 Padaria Sol', '21448390000107');
insert into public.chamados (id, cliente_id, setor_id, titulo) values
  ('fa200000-0000-0000-0000-00000000000a', 'fa100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechamento');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, setor_id, pedido, limite_usd, limite_minutos) values
  ('fa300000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'contabil'), 'fa200000-0000-0000-0000-00000000000a',
   'fa100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechar outubro', 2, 20);
insert into public.contatos (id, nome, telefone) values ('fa500000-0000-0000-0000-00000000000a', 'I3 Roberto', '5531999990401');
-- F22: o envio confere "pode ser procurado" no setor da tarefa.
insert into public.contato_clientes (contato_id, cliente_id, perfil) values
  ('fa500000-0000-0000-0000-00000000000a', 'fa100000-0000-0000-0000-00000000000a', 'personalizado');
insert into public.contato_cliente_setores (contato_id, cliente_id, setor_id, pode_ser_procurado) values
  ('fa500000-0000-0000-0000-00000000000a', 'fa100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), true);

set local role service_role;
-- 1–2: a vez (D6)
select is(public.iniciar_execucao_tarefa('fa300000-0000-0000-0000-00000000000a'), now(), 'pega a tarefa e devolve a marca da vez');
select is(public.iniciar_execucao_tarefa('fa300000-0000-0000-0000-00000000000a'), null::timestamptz, 'não roda duas vezes ao mesmo tempo');

-- 3–7: etapas (D5)
select lives_ok($$ select public.definir_etapas_tarefa('fa300000-0000-0000-0000-00000000000a', array['Coletar documentos', 'Ler e lançar', 'Conciliar', 'Aprovação']) $$, 'define');
select lives_ok($$ select public.definir_etapas_tarefa('fa300000-0000-0000-0000-00000000000a', array['Outra', 'Aprovação']) $$, 'segunda vez: não muda');
select is((select jsonb_array_length(etapas) from public.agente_tarefas), 4, 'continuam as 4');
select lives_ok($$ select public.concluir_etapa_tarefa('fa300000-0000-0000-0000-00000000000a', 1, 'leu 3 arquivos') $$, 'conclui a 1');
select throws_ok($$ select public.concluir_etapa_tarefa('fa300000-0000-0000-0000-00000000000a', 4, 'x') $$, 'P0001',
  'Etapa inválida: a última (Aprovação) é da pessoa.', 'a Aprovação não é do agente');

-- 8–9: custo pela etapa atual (D12)
select lives_ok($$ select public.somar_custo_tarefa('fa300000-0000-0000-0000-00000000000a', 0.5) $$, 'soma');
select is((select (custo_etapas ->> '2')::numeric from public.agente_tarefas), 0.5, 'na etapa 2 (a atual)');

-- 10–13: pendências
select is(public.abrir_pendencia_tarefa('fa300000-0000-0000-0000-00000000000a', 'analista', 'PIX de R$ 3.200 é pró-labore?', null,
  array['Pró-labore', 'Distribuição de lucro'], null), 1, 'abre a 1');
select is(public.abrir_pendencia_tarefa('fa300000-0000-0000-0000-00000000000a', 'analista', 'pix de r$ 3.200 é pró-labore?', null, '{}', null), 1,
  'a mesma pergunta aberta não duplica');
select throws_ok($$ select public.abrir_pendencia_tarefa('fa300000-0000-0000-0000-00000000000a', 'cliente', 'Extrato do BB', null, '{}', null) $$,
  'P0001', 'Pendência do cliente precisa da mensagem para o cliente.', 'cliente sem mensagem');
select is(public.abrir_pendencia_tarefa('fa300000-0000-0000-0000-00000000000a', 'cliente', 'Extrato do Banco do Brasil de outubro', null, '{}',
  'Roberto, bom dia! Para fechar outubro só falta o extrato do Banco do Brasil. Pode mandar o PDF por aqui?'), 2, 'abre a 2');

-- 14–17: resultado e o fim da vez
select throws_ok($$ select public.entregar_resultado_tarefa('fa300000-0000-0000-0000-00000000000a', '{"versao":2}') $$, 'P0001', 'Resultado inválido.', 'formato conferido');
select lives_ok($$ select public.entregar_resultado_tarefa('fa300000-0000-0000-0000-00000000000a',
  '{"versao":1,"resumo":"Prévia.","destaques":[],"linhas":[],"observacoes":null}') $$, 'entrega');
select is(public.finalizar_vez_tarefa('fa300000-0000-0000-0000-00000000000a', 30, 'fim'), 'aguardando_pendencias', 'com pendência aberta: aguarda');
select ok((select executando_desde is null and segundos_trabalhando = 30 from public.agente_tarefas), 'soltou a vez e somou o tempo');

-- 18–21: resposta que chegou no meio da vez (D8)
reset role;
update public.agente_tarefas set estado = 'trabalhando';
update public.agente_pendencias set estado = 'respondida', resposta = 'Pró-labore', respondida_em = now();
set local role service_role;
select is(public.finalizar_vez_tarefa('fa300000-0000-0000-0000-00000000000a', 5, 'fim'), 'trabalhando', 'resposta não vista: continua trabalhando');
select lives_ok($$ select public.marcar_pendencias_vistas('fa300000-0000-0000-0000-00000000000a') $$, 'marca as vistas');
select is(public.finalizar_vez_tarefa('fa300000-0000-0000-0000-00000000000a', 5, 'fim'), 'pronta', 'agora vai para aprovar');
select is((select etapa_atual from public.agente_tarefas), 4::smallint, 'barra na Aprovação');

-- 22–23: ajuste pedido e não entregue (D11)
reset role;
update public.agente_tarefas set estado = 'trabalhando', ajuste_pendente = true;
set local role service_role;
select is(public.finalizar_vez_tarefa('fa300000-0000-0000-0000-00000000000a', 5, 'fim'), 'pausada', 'ajuste sem nova entrega: pausa');
select is((select motivo_pausa from public.agente_tarefas), 'sem_resultado', 'motivo sem_resultado');

-- 24–27: limites, continuar, vez parada (D13, D8)
reset role;
update public.agente_tarefas set estado = 'trabalhando', motivo_pausa = null, ajuste_pendente = false;
set local role service_role;
select is(public.finalizar_vez_tarefa('fa300000-0000-0000-0000-00000000000a', 5, 'limite_custo'), 'pausada', 'limite de custo pausa');
select is((select texto from public.agente_tarefa_eventos order by criado_em desc limit 1), 'pausou: chegou ao limite de custo (US$ 2,00)', 'evento do limite');
reset role;
update public.agente_tarefas set estado = 'trabalhando', motivo_pausa = null, atualizado_em = now() - interval '10 minutes';
set local role service_role;
select is(public.finalizar_vez_tarefa('fa300000-0000-0000-0000-00000000000a', 0, 'continuar'), 'trabalhando', 'continuar mantém');
reset role;
update public.agente_tarefas set atualizado_em = now() - interval '10 minutes';
set local role service_role;
select ok('fa300000-0000-0000-0000-00000000000a'::uuid in (select public.tarefas_paradas(2)), 'tarefa parada volta para a fila');

-- 28–33: envio do pedido ao cliente (D7) e pedidos ao contato (D26)
reset role;
update public.agente_pendencias set estado = 'aberta', resposta = null, respondida_em = null, contato_id = 'fa500000-0000-0000-0000-00000000000a',
  pedido_texto = 'Pode mandar o extrato?', pedido_em = now(), pedidos = 1 where numero = 2;
insert into public.conversas (id, telefone) values ('fa700000-0000-0000-0000-00000000000a', '5531999990401');
insert into public.mensagens (id, conversa_id, direcao, autor, conteudo) values
  ('fa800000-0000-0000-0000-00000000000a', 'fa700000-0000-0000-0000-00000000000a', 'saida', 'agente', 'Pode mandar o extrato?');
set local role service_role;
select is((select count(*)::int from public.reservar_envio_pendencia((select id from public.agente_pendencias where numero = 2))), 1, 'reserva para enviar');
select is((select count(*)::int from public.reservar_envio_pendencia((select id from public.agente_pendencias where numero = 2))), 0, 'não reserva duas vezes');
select lives_ok($$ select public.marcar_pendencia_enviada((select id from public.agente_pendencias where numero = 2), 'fa800000-0000-0000-0000-00000000000a') $$, 'marca enviada');
select is((select count(*)::int from public.pendencias_pedidas_ao_contato('fa500000-0000-0000-0000-00000000000a')), 1, 'o Thiago sabe do pedido');
select is(public.contato_respondeu_pendencias('fa500000-0000-0000-0000-00000000000a'), 1, 'contato respondeu: evento');
select is(public.contato_respondeu_pendencias('fa500000-0000-0000-0000-00000000000a'), 0, 'no máximo uma vez por hora');

-- 34–36: vez zumbi (F6): só a vez que tem a marca decide o estado e solta a marca
reset role;
update public.agente_tarefas set executando_desde = now() - interval '1 minute';
set local role service_role;
select is(public.finalizar_vez_tarefa('fa300000-0000-0000-0000-00000000000a', 7, 'fim', now() - interval '40 minutes'), 'trabalhando',
  'vez zumbi: não decide o estado');
select ok((select executando_desde = now() - interval '1 minute' from public.agente_tarefas), 'vez zumbi não apaga a marca da vez nova');
select is(public.finalizar_vez_tarefa('fa300000-0000-0000-0000-00000000000a', 0, 'continuar',
  (select executando_desde from public.agente_tarefas)), 'trabalhando', 'a vez dona da marca solta a marca');

-- 37–38: pedido reservado e não enviado (F5): a reserva velha é solta e o pedido volta para a fila
reset role;
update public.agente_pendencias set mensagem_id = null, pedido_em = now() - interval '20 minutes',
  pedido_enviado_em = now() - interval '15 minutes' where numero = 2;
set local role service_role;
select ok((select id from public.agente_pendencias where numero = 2) in (select public.pedidos_ao_cliente_parados(2)), 'pedido parado volta para a fila');
select ok((select pedido_enviado_em is null from public.agente_pendencias where numero = 2), 'reserva velha solta');

-- 39–40: pedido de mais de 24 h sem envio não sai mais (a pessoa cobra de novo)
reset role;
update public.agente_pendencias set pedido_em = now() - interval '25 hours' where numero = 2;
set local role service_role;
select is((select count(*)::int from public.reservar_envio_pendencia((select id from public.agente_pendencias where numero = 2))), 0, 'pedido vencido não sai');
select ok((select id from public.agente_pendencias where numero = 2) not in (select public.pedidos_ao_cliente_parados(2)), 'pedido vencido não volta para a fila');

-- 41: o contato deixou de poder ser procurado entre o pedido e o envio (F22)
reset role;
update public.agente_pendencias set pedido_em = now() - interval '5 minutes' where numero = 2;
update public.contato_cliente_setores set pode_ser_procurado = false where contato_id = 'fa500000-0000-0000-0000-00000000000a';
set local role service_role;
select is((select count(*)::int from public.reservar_envio_pendencia((select id from public.agente_pendencias where numero = 2))), 0, 'sem "pode ser procurado": não sai');

-- 42–43: os limites de volume valem também no envio (3 por contato por dia; 30 no escritório)
reset role;
update public.contato_cliente_setores set pode_ser_procurado = true where contato_id = 'fa500000-0000-0000-0000-00000000000a';
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, contato_id, pedido_texto, pedido_em, pedidos, pedido_enviado_em)
select 'fa300000-0000-0000-0000-00000000000a', n, 'cliente', 'Documento ' || n, 'fa500000-0000-0000-0000-00000000000a', 'Pode mandar?',
       now() - interval '2 hours', 1, now() - interval '1 hour' from generate_series(3, 5) n;
set local role service_role;
select is((select count(*)::int from public.reservar_envio_pendencia((select id from public.agente_pendencias where numero = 2))), 0, '4º envio do dia ao contato: não sai');
reset role;
delete from public.agente_pendencias where numero between 3 and 5;
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, pedido_texto, pedido_em, pedidos, pedido_enviado_em)
select 'fa300000-0000-0000-0000-00000000000a', n, 'cliente', 'Documento ' || n, 'Pode mandar?', now() - interval '2 hours', 1, now() - interval '1 hour'
  from generate_series(10, 39) n;
set local role service_role;
select is((select count(*)::int from public.reservar_envio_pendencia((select id from public.agente_pendencias where numero = 2))), 0, '31º envio do dia no escritório: não sai');

-- 44–45: só o trabalhador chama; search_path vazio
reset role;
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (
    'iniciar_execucao_tarefa', 'definir_etapas_tarefa', 'concluir_etapa_tarefa', 'anotar_tarefa', 'somar_custo_tarefa', 'abrir_pendencia_tarefa',
    'entregar_resultado_tarefa', 'marcar_arquivo_lido', 'marcar_pendencias_vistas', 'evento_tarefa_agente', 'finalizar_vez_tarefa', 'tarefas_paradas',
    'reservar_envio_pendencia', 'liberar_envio_pendencia', 'marcar_pendencia_enviada', 'pendencias_pedidas_ao_contato', 'contato_respondeu_pendencias',
    'pedidos_ao_cliente_parados')
  and has_function_privilege('service_role', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute')
  and not has_function_privilege('anon', p.oid, 'execute')), 18, 'as 18 funções: só service_role executa');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (
    'iniciar_execucao_tarefa', 'definir_etapas_tarefa', 'concluir_etapa_tarefa', 'anotar_tarefa', 'somar_custo_tarefa', 'abrir_pendencia_tarefa',
    'entregar_resultado_tarefa', 'marcar_arquivo_lido', 'marcar_pendencias_vistas', 'evento_tarefa_agente', 'finalizar_vez_tarefa', 'tarefas_paradas',
    'reservar_envio_pendencia', 'liberar_envio_pendencia', 'marcar_pendencia_enviada', 'pendencias_pedidas_ao_contato', 'contato_respondeu_pendencias',
    'pedidos_ao_cliente_parados')
  and p.prosecdef and p.proconfig @> array['search_path=""']), 18, 'as 18 funções: security definer com search_path vazio');

select * from finish();
rollback;
