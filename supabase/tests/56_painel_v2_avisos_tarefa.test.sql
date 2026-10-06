-- Parte I4, Task 4 (spec 7E.4, 7E.5, 7E.8; D9–D11): avisos de quem pediu, pendências repassadas e a resposta pelo WhatsApp.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

insert into auth.users (id, email) values ('fd000000-0000-0000-0000-00000000000a', 'claudia@i4a.local'), ('fd000000-0000-0000-0000-00000000000b', 'paula@i4a.local');
insert into public.usuarios (id, nome, email, papel, telefone) values
  ('fd000000-0000-0000-0000-00000000000a', 'I4A Cláudia', 'claudia@i4a.local', 'atendente', '5531911110001'),
  ('fd000000-0000-0000-0000-00000000000b', 'I4A Paula', 'paula@i4a.local', 'atendente', null);
insert into public.usuario_setores (usuario_id, setor_id) select u, (select id from public.setores where nome = 'Contábil')
  from unnest(array['fd000000-0000-0000-0000-00000000000a', 'fd000000-0000-0000-0000-00000000000b']::uuid[]) u;
update public.usuario_permissoes set nivel = 'site_whatsapp' where modulo = 'assistente' and usuario_id = 'fd000000-0000-0000-0000-00000000000a';
insert into public.clientes (id, razao_social, cnpj) values ('fd100000-0000-0000-0000-00000000000a', 'I4A Padaria Sol', '21448390000107');
insert into public.chamados (id, cliente_id, setor_id, titulo) select ('fd20000' || n || '-0000-0000-0000-000000000000')::uuid,
  'fd100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Demanda ' || n from generate_series(1, 4) n;
-- T1 aguardando (Cláudia, WhatsApp e painel); T2 pronta (Paula, sem telefone); T3 pausada pela pessoa; T4 pronta (Cláudia, só WhatsApp).
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, setor_id, pedida_por, pedido, limite_usd, limite_minutos, estado,
                                   motivo_pausa, resultado, avisar_painel, avisar_whatsapp)
select ('fd30000' || n || '-0000-0000-0000-000000000000')::uuid, (select id from public.agentes where slug = 'contabil'),
       ('fd20000' || n || '-0000-0000-0000-000000000000')::uuid, 'fd100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'),
       case when n = 2 then 'fd000000-0000-0000-0000-00000000000b' else 'fd000000-0000-0000-0000-00000000000a' end::uuid, 'Fechar outubro', 2, 20,
       case n when 1 then 'aguardando_pendencias' when 3 then 'pausada' else 'pronta' end, case when n = 3 then 'pessoa' end,
       case when n in (2, 4) then '{"versao":1,"resumo":"ok","destaques":[],"linhas":[],"observacoes":null}'::jsonb end,
       n <> 4, true
  from generate_series(1, 4) n;
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, opcoes, mensagem) values
  ('fd300001-0000-0000-0000-000000000000', 1, 'analista', 'PIX de R$ 3.200 para o sócio: o que é?', '{pró-labore,lucro,empréstimo}', null),
  ('fd300001-0000-0000-0000-000000000000', 2, 'cliente', 'Extrato do Banco do Brasil', '{}', 'Pode mandar o extrato do BB?');

set local role service_role;
-- 1–4: pendências: um aviso de WhatsApp, um de painel, e nada em dobro
select is((select count(*)::int from public.registrar_avisos_da_tarefa('fd300001-0000-0000-0000-000000000000')), 1, 'um aviso de WhatsApp a mandar');
select is((select tipo || ':' || chave || ':' || estado || ':' || pendencias::text from public.agente_tarefa_avisos
            where tarefa_id = 'fd300001-0000-0000-0000-000000000000' and canal = 'whatsapp'), 'pendencias:pendencias:2:pendente:{1,2}', 'o aviso de pendências');
select is((select count(*)::int from public.alertas where usuario_id = 'fd000000-0000-0000-0000-00000000000a' and mensagem like 'Tarefa T-% pendência%'), 1, 'aviso no painel');
select is((select count(*)::int from public.registrar_avisos_da_tarefa('fd300001-0000-0000-0000-000000000000')), 0, 'registrar de novo não repete');
-- 5–6: Paula sem telefone: WhatsApp "não enviado" e o painel recebe
select is((select count(*)::int from public.registrar_avisos_da_tarefa('fd300002-0000-0000-0000-000000000000')), 0, 'nada a mandar pelo WhatsApp');
select is((select estado || ':' || motivo from public.agente_tarefa_avisos where tarefa_id = 'fd300002-0000-0000-0000-000000000000' and canal = 'whatsapp'),
  'nao_enviado:sem_whatsapp', 'motivo gravado');
-- 7: pausa feita por pessoa não avisa
select is((select count(*)::int from public.registrar_avisos_da_tarefa('fd300003-0000-0000-0000-000000000000')) +
          (select count(*)::int from public.agente_tarefa_avisos where tarefa_id = 'fd300003-0000-0000-0000-000000000000'), 0, 'pausa da pessoa: nada');
-- 8–11: reservar, marcar enviado e repassar só as do analista
select is((public.reservar_aviso_tarefa((select id from public.agente_tarefa_avisos where tarefa_id = 'fd300001-0000-0000-0000-000000000000' and canal = 'whatsapp')) ->> 'telefone'),
  '5531911110001', 'reserva devolve o telefone de quem pediu');
select is(public.reservar_aviso_tarefa((select id from public.agente_tarefa_avisos where tarefa_id = 'fd300001-0000-0000-0000-000000000000' and canal = 'whatsapp')),
  null, 'reservar de novo: nada');
select lives_ok($$ select public.marcar_aviso_tarefa((select id from public.agente_tarefa_avisos where tarefa_id = 'fd300001-0000-0000-0000-000000000000' and canal = 'whatsapp'), true) $$,
  'marca enviado');
select is((select array_agg(numero order by numero) from public.agente_pendencias where tarefa_id = 'fd300001-0000-0000-0000-000000000000' and repassada_em is not null),
  '{1}'::smallint[], 'só a pendência do analista fica repassada');
-- 12: o Assistente lê as repassadas
select is((select pergunta || '|' || array_to_string(opcoes, '/') from public.pendencias_repassadas_de('fd000000-0000-0000-0000-00000000000a')),
  'PIX de R$ 3.200 para o sócio: o que é?|pró-labore/lucro/empréstimo', 'pendência repassada com as opções');
-- 13–19: responder pelo WhatsApp (D11)
select throws_ok(format($$ select public.responder_pendencia_de('fd000000-0000-0000-0000-00000000000b', %s, 1, 'x') $$,
  (select numero from public.agente_tarefas where id = 'fd300001-0000-0000-0000-000000000000')), 'P0001', 'Tarefa não encontrada.', 'quem não pediu: recusa sem dizer nada');
select throws_ok(format($$ select public.responder_pendencia_de('fd000000-0000-0000-0000-00000000000a', %s, 2, 'x') $$,
  (select numero from public.agente_tarefas where id = 'fd300001-0000-0000-0000-000000000000')), 'P0001', 'Pendência do cliente: use "Já recebi" no painel.', 'pendência do cliente: nunca pelo WhatsApp');
select is((public.responder_pendencia_de('fd000000-0000-0000-0000-00000000000a', (select numero from public.agente_tarefas where id = 'fd300001-0000-0000-0000-000000000000'),
  1, ' empréstimo ') ->> 'retomou'), 'false', 'respondida; a do cliente continua aberta');
select is((select resposta || ':' || (respondida_por = 'fd000000-0000-0000-0000-00000000000a') from public.agente_pendencias
            where tarefa_id = 'fd300001-0000-0000-0000-000000000000' and numero = 1), 'empréstimo:true', 'resposta e quem respondeu');
select ok(exists (select 1 from public.agente_tarefa_eventos where tarefa_id = 'fd300001-0000-0000-0000-000000000000'
                  and texto = 'respondeu a pendência 1 pelo WhatsApp' and usuario_id = 'fd000000-0000-0000-0000-00000000000a'), 'evento com a pessoa');
select throws_ok(format($$ select public.responder_pendencia_de('fd000000-0000-0000-0000-00000000000a', %s, 1, 'x') $$,
  (select numero from public.agente_tarefas where id = 'fd300001-0000-0000-0000-000000000000')), 'P0001', 'Esta pendência já foi respondida.', 'duas vezes: recusa');
select is((select count(*)::int from public.pendencias_repassadas_de('fd000000-0000-0000-0000-00000000000a')), 0, 'nada mais repassado em aberto');
-- 20 (F5): pergunta do analista que ainda não foi ao WhatsApp dela não é respondida por lá
reset role;
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, opcoes) values
  ('fd300001-0000-0000-0000-000000000000', 3, 'analista', 'Aluguel de outubro: competência ou caixa?', '{competência,caixa}');
set local role service_role;
select throws_ok(format($$ select public.responder_pendencia_de('fd000000-0000-0000-0000-00000000000a', %s, 3, 'caixa') $$,
  (select numero from public.agente_tarefas where id = 'fd300001-0000-0000-0000-000000000000')), 'P0001', 'Pendência não encontrada.', 'não repassada: recusa');
-- 21–24 (F6): quem pediu deixou de ver a demanda ("Só as minhas"): nada repassado, o aviso não sai, nem no painel
reset role;
update public.agente_pendencias set repassada_em = now() where tarefa_id = 'fd300001-0000-0000-0000-000000000000' and numero = 3;
update public.usuario_permissoes set nivel = 'minhas' where modulo = 'demandas' and usuario_id = 'fd000000-0000-0000-0000-00000000000a';
insert into public.agente_tarefa_avisos (tarefa_id, usuario_id, canal, tipo, chave, mensagem)
values ('fd300003-0000-0000-0000-000000000000', 'fd000000-0000-0000-0000-00000000000a', 'whatsapp', 'pronta', 'oculta', 'Tarefa pronta.');
set local role service_role;
select is((select count(*)::int from public.pendencias_repassadas_de('fd000000-0000-0000-0000-00000000000a')), 0, 'sem ver a demanda: nada repassado');
select is(public.reservar_aviso_tarefa((select id from public.agente_tarefa_avisos where tarefa_id = 'fd300003-0000-0000-0000-000000000000' and chave = 'oculta')),
  null, 'sem ver a demanda: o aviso não sai');
select is((select string_agg(canal || ':' || estado || ':' || coalesce(motivo, '-'), ',' order by canal) from public.agente_tarefa_avisos
            where tarefa_id = 'fd300003-0000-0000-0000-000000000000' and chave = 'oculta'), 'whatsapp:nao_enviado:sem_whatsapp', 'nem no painel');
reset role;
update public.usuario_permissoes set nivel = 'meu_setor' where modulo = 'demandas' and usuario_id = 'fd000000-0000-0000-0000-00000000000a';
set local role service_role;
select is((select count(*)::int from public.pendencias_repassadas_de('fd000000-0000-0000-0000-00000000000a')), 1, 'vê de novo: a repassada volta');
-- 20–21: limite por pessoa (D10) e o painel recebe mesmo sem "Painel" marcado (T4). Gravar direto na tabela só como dono do banco.
reset role;
insert into public.agente_tarefa_avisos (tarefa_id, usuario_id, canal, tipo, chave, estado, mensagem, enviado_em)
select 'fd300001-0000-0000-0000-000000000000', 'fd000000-0000-0000-0000-00000000000a', 'whatsapp', 'pronta', 'teste:' || n, 'enviado', 'x', now()
  from generate_series(1, 20) n;
set local role service_role;
select is((select count(*)::int from public.registrar_avisos_da_tarefa('fd300004-0000-0000-0000-000000000000')), 0, '21º aviso do dia: não sai');
select is((select string_agg(canal || ':' || estado || ':' || coalesce(motivo, '-'), ',' order by canal) from public.agente_tarefa_avisos
            where tarefa_id = 'fd300004-0000-0000-0000-000000000000'), 'painel:enviado:-,whatsapp:nao_enviado:limite_pessoa', 'vai ao painel com o motivo');
-- 22–23: vencido (mais de 24 h) e parados
reset role;
update public.agente_tarefa_avisos set estado = 'pendente', criado_em = now() - interval '25 hours' where tarefa_id = 'fd300004-0000-0000-0000-000000000000' and canal = 'whatsapp';
set local role service_role;
select is(public.reservar_aviso_tarefa((select id from public.agente_tarefa_avisos where tarefa_id = 'fd300004-0000-0000-0000-000000000000' and canal = 'whatsapp')),
  null, 'mais de 24 h: não sai');
reset role;
update public.agente_tarefa_avisos set estado = 'pendente', criado_em = now() - interval '5 minutes', chave = 'parado' where tarefa_id = 'fd300002-0000-0000-0000-000000000000' and canal = 'whatsapp';
set local role service_role;
select ok((select id from public.agente_tarefa_avisos where tarefa_id = 'fd300002-0000-0000-0000-000000000000' and canal = 'whatsapp')
          in (select public.avisos_tarefa_parados()), 'pendente há 5 min volta para a fila');
-- F3: o limite vale na reserva — aviso registrado antes dos 20 enviados não sai pelo WhatsApp; vai ao painel
reset role;
insert into public.agente_tarefa_avisos (tarefa_id, usuario_id, canal, tipo, chave, mensagem, criado_em)
values ('fd300004-0000-0000-0000-000000000000', 'fd000000-0000-0000-0000-00000000000a', 'whatsapp', 'pronta', 'antes', 'Tarefa pronta.', now() - interval '1 hour');
set local role service_role;
select is(public.reservar_aviso_tarefa((select id from public.agente_tarefa_avisos where tarefa_id = 'fd300004-0000-0000-0000-000000000000' and chave = 'antes')),
  null, 'acima de 20 no dia: a reserva não sai');
select is((select string_agg(canal || ':' || estado || ':' || coalesce(motivo, '-'), ',' order by canal) from public.agente_tarefa_avisos
            where tarefa_id = 'fd300004-0000-0000-0000-000000000000' and chave = 'antes'), 'painel:enviado:-,whatsapp:nao_enviado:limite_pessoa', 'limite na reserva: painel');
-- F4: reserva esquecida há mais de 10 min não é mandada de novo: "não enviado" e painel
reset role;
insert into public.agente_tarefa_avisos (tarefa_id, usuario_id, canal, tipo, chave, estado, mensagem, reservado_em)
values ('fd300004-0000-0000-0000-000000000000', 'fd000000-0000-0000-0000-00000000000a', 'whatsapp', 'pronta', 'travado', 'enviando', 'Tarefa pronta.',
        now() - interval '15 minutes');
set local role service_role;
select ok((select id from public.agente_tarefa_avisos where tarefa_id = 'fd300004-0000-0000-0000-000000000000' and chave = 'travado' and canal = 'whatsapp')
          not in (select public.avisos_tarefa_parados()), 'reserva esquecida não volta para a fila');
select is((select string_agg(canal || ':' || estado || ':' || coalesce(motivo, '-'), ',' order by canal) from public.agente_tarefa_avisos
            where tarefa_id = 'fd300004-0000-0000-0000-000000000000' and chave = 'travado'), 'painel:enviado:-,whatsapp:nao_enviado:falha', 'no máximo um envio: painel');
-- F2: fora do horário de acesso o aviso fica segurado (não vira "sem WhatsApp")
reset role;
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'fd000000-0000-0000-0000-00000000000a';
insert into public.agente_tarefa_avisos (tarefa_id, usuario_id, canal, tipo, chave, mensagem)
values ('fd300004-0000-0000-0000-000000000000', 'fd000000-0000-0000-0000-00000000000a', 'whatsapp', 'pronta', 'noite', 'Tarefa pronta.');
set local role service_role;
select is(public.reservar_aviso_tarefa((select id from public.agente_tarefa_avisos where tarefa_id = 'fd300004-0000-0000-0000-000000000000' and chave = 'noite')),
  null, 'fora do horário: não sai agora');
select is((select string_agg(canal || ':' || estado || ':' || coalesce(motivo, '-'), ',' order by canal) from public.agente_tarefa_avisos
            where tarefa_id = 'fd300004-0000-0000-0000-000000000000' and chave = 'noite'), 'whatsapp:segurado:fora_do_horario', 'segurado até o horário abrir');
reset role;
update public.usuarios set horario_acesso = null where id = 'fd000000-0000-0000-0000-00000000000a';

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
-- 24–27: só o trabalhador; a pessoa lê só os avisos dela
select throws_ok($$ select public.registrar_avisos_da_tarefa('fd300001-0000-0000-0000-000000000000') $$, '42501', null, 'pessoa não registra aviso');
select throws_ok($$ select public.responder_pendencia_de('fd000000-0000-0000-0000-00000000000b', 1, 1, 'x') $$, '42501', null, 'pessoa não chama a resposta do trabalhador');
select is((select count(*)::int from public.agente_tarefa_avisos where usuario_id = 'fd000000-0000-0000-0000-00000000000a'), 0, 'Paula não vê os avisos da Cláudia');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'agente_tarefa_avisos'), 0, 'fora do Realtime');

select * from finish();
rollback;
