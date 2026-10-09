-- Auditoria 3.2, 3.3 e 3.11: envio com resultado incerto (a Z-API pode ter entregado), eco que casa com a saída pendente
-- ou incerta, separação atômica do texto e do arquivo, "Enviar de novo" do painel e o limite de avisos do sistema no banco.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into auth.users (id, email) values
  ('e1270000-0000-0000-0000-00000000000a', 'admin127@pgtap.local'),
  ('e1270000-0000-0000-0000-00000000000b', 'bia127@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values
  ('e1270000-0000-0000-0000-00000000000a', 'Admin 127', 'admin127@pgtap.local', 'admin'),
  ('e1270000-0000-0000-0000-00000000000b', 'Bia 127', 'bia127@pgtap.local', 'atendente');
insert into public.clientes (id, razao_social, cnpj) values ('e1270000-0000-0000-0000-0000000000d1', 'Padaria 127 Ltda', '11444777000161');
insert into public.documentos_empresa (id, cliente_id, nome, arquivo_path, arquivo_nome) values
  ('e1270000-0000-0000-0000-0000000000d2', 'e1270000-0000-0000-0000-0000000000d1', 'Contrato', 'clientes/x/contrato.pdf', 'contrato.pdf');
insert into public.conversas (id, telefone) values
  ('e1270000-0000-0000-0000-0000000000c1', '5531999991271'),
  ('e1270000-0000-0000-0000-0000000000c2', '5531999991272');

-- 1–2: o valor novo do status
select ok('incerto' = any (enum_range(null::public.status_envio)::text[]), 'status_envio aceita "incerto"');
select lives_ok($$ insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, status_envio) values
  ('e1270000-0000-0000-0000-0000000000a1', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', 'Segue  a guia
 de maio', 'incerto') $$, 'saída pode ficar "incerto"');

-- 3–11: permissões (só o trabalhador casa eco, separa, reserva vaga; o painel só pede "Enviar de novo")
select ok(not has_function_privilege('authenticated', 'public.casar_eco_saida(uuid, text, text, text, boolean)', 'execute'), 'o painel não casa eco');
select ok(not has_function_privilege('anon', 'public.casar_eco_saida(uuid, text, text, text, boolean)', 'execute'), 'visitante não casa eco');
select ok(not has_function_privilege('authenticated', 'public.marcar_aviso_unico(text)', 'execute'), 'o painel não marca aviso');
select ok(not has_function_privilege('authenticated', 'public.marcar_incertos_antigos()', 'execute'), 'o painel não varre incertas');
select ok(not has_table_privilege('authenticated', 'public.avisos_unicos', 'select'), 'o painel não lê as marcas de aviso');
select ok(not has_function_privilege('authenticated', 'public.reservar_envio_sistema(integer)', 'execute'), 'o painel não reserva vaga de envio');
select ok(not has_function_privilege('authenticated', 'public.separar_texto_enviado(uuid, text, text)', 'execute'), 'o painel não separa texto');
select ok(not has_function_privilege('anon', 'public.reenviar_resposta(uuid)', 'execute'), 'visitante não reenvia resposta');
select ok(not has_table_privilege('authenticated', 'public.limite_envio_sistema', 'select'), 'o painel não lê o limite de envio');

-- 12–16: o eco casa pelo texto normalizado (espaços), com a saída incerta da mesma conversa, e a deixa "enviada"
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c2', 'Segue a guia de maio', null, 'ECO-127-0'), null,
  'outra conversa: não casa');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', 'Segue a guia de maio', null, 'ECO-127-1'),
  'e1270000-0000-0000-0000-0000000000a1'::uuid, 'mesma conversa e mesmo texto (espaços normalizados): casa com a incerta');
select is((select status_envio::text || ' ' || id_provedor from public.mensagens where id = 'e1270000-0000-0000-0000-0000000000a1'),
  'enviada ECO-127-1', 'a incerta vira enviada com o id do eco');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', 'Segue a guia de maio', null, 'ECO-127-2'), null,
  'a mesma saída não casa duas vezes');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', null, null, 'ECO-127-3'), null, 'eco sem texto nem arquivo: não casa');

-- 17–20: mais de uma candidata: a mais antiga; mais de 10 min: não casa; falhou: não casa
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, status_envio, criado_em) values
  ('e1270000-0000-0000-0000-0000000000a2', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'sistema', 'texto', 'Oi', 'pendente', now() - interval '3 minutes'),
  ('e1270000-0000-0000-0000-0000000000a3', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'sistema', 'texto', 'Oi', 'incerto', now() - interval '1 minute'),
  ('e1270000-0000-0000-0000-0000000000a4', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', 'Velha', 'incerto', now() - interval '11 minutes'),
  ('e1270000-0000-0000-0000-0000000000a5', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', 'Falhada', 'falhou', now());
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', 'Oi', null, 'ECO-127-4'),
  'e1270000-0000-0000-0000-0000000000a2'::uuid, 'duas candidatas: casa a mais antiga');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', 'Velha', null, 'ECO-127-5'), null, 'mais de 10 minutos: não casa');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', 'Falhada', null, 'ECO-127-6'), null, '"falhou" (4xx, certo) não casa');
update public.mensagens set envio_reservado_em = now() - interval '2 minutes' where id = 'e1270000-0000-0000-0000-0000000000a4';
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', 'Velha', null, 'ECO-127-7'),
  'e1270000-0000-0000-0000-0000000000a4'::uuid, 'criada há mais tempo, mas enviada (reservada) há 2 min: casa');

-- 18–23: arquivo casa pelo nome sem extensão nem maiúsculas (painel ou documento da empresa); sem nome que case (ou sem
-- nome, ex.: imagem), o arquivo mais antigo; resposta do painel ainda na fila (nunca tentada) não casa, nem por texto
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, documento_id, status_envio) values
  ('e1270000-0000-0000-0000-0000000000b1', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', '📎 Contrato',
   'e1270000-0000-0000-0000-0000000000d2', 'incerto');
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, arquivo_path, arquivo_nome, status_envio, envio_reservado_em, envio_tentado_em, criado_em) values
  ('e1270000-0000-0000-0000-0000000000b2', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'atendente', 'documento',
   'conversas/e1270000-0000-0000-0000-0000000000c1/guia.pdf', 'guia.pdf', 'incerto', now(), now(), now() - interval '4 minutes'),
  ('e1270000-0000-0000-0000-0000000000b6', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'atendente', 'imagem',
   'conversas/e1270000-0000-0000-0000-0000000000c1/foto.jpg', null, 'pendente', now(), now(), now() - interval '3 minutes'),
  ('e1270000-0000-0000-0000-0000000000b7', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'atendente', 'documento',
   'conversas/e1270000-0000-0000-0000-0000000000c1/fila.pdf', 'fila.pdf', 'pendente', null, null, now() - interval '5 minutes'),
  ('e1270000-0000-0000-0000-0000000000b8', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'atendente', 'documento',
   'conversas/e1270000-0000-0000-0000-0000000000c1/recibo.pdf', 'recibo.pdf', 'incerto', now(), now(), now() - interval '2 minutes');
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, status_envio) values
  ('e1270000-0000-0000-0000-0000000000ba', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'atendente', 'texto', 'Na fila', 'pendente');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', null, 'CONTRATO', 'ECO-127-8'),
  'e1270000-0000-0000-0000-0000000000b1'::uuid, 'documento da empresa: casa pelo nome sem extensão nem maiúsculas');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', null, 'guia.PDF', 'ECO-127-9'),
  'e1270000-0000-0000-0000-0000000000b2'::uuid, 'arquivo do painel: casa pelo nome (o mais antigo não rouba o eco)');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', null, null, 'ECO-127-10', true),
  'e1270000-0000-0000-0000-0000000000b6'::uuid, 'eco de arquivo sem nome (imagem): o arquivo mais antigo já tentado');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', null, 'outro-nome.pdf', 'ECO-127-10b'),
  'e1270000-0000-0000-0000-0000000000b8'::uuid, 'nome que não casa: o arquivo mais antigo já tentado');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', null, 'fila.pdf', 'ECO-127-10c'), null,
  'resposta do painel ainda na fila (nunca tentada): o eco do arquivo não casa');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', 'Na fila', null, 'ECO-127-10d'), null,
  'resposta do painel ainda na fila: a mesma frase digitada no celular não casa');

-- 24–28: separação atômica do texto de uma resposta com arquivo; repetir não duplica; o eco do texto separa sozinho
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, arquivo_path, arquivo_nome, status_envio, envio_reservado_em) values
  ('e1270000-0000-0000-0000-0000000000b3', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'atendente', 'documento', 'Segue o boleto',
   'conversas/e1270000-0000-0000-0000-0000000000c1/boleto.pdf', 'boleto.pdf', 'pendente', now()),
  ('e1270000-0000-0000-0000-0000000000b4', 'e1270000-0000-0000-0000-0000000000c1', 'saida', 'atendente', 'documento', 'Segue a nota',
   'conversas/e1270000-0000-0000-0000-0000000000c1/nota.pdf', 'nota.pdf', 'pendente', now());
select isnt(public.separar_texto_enviado('e1270000-0000-0000-0000-0000000000b3', null, 'incerto'), null, 'texto separado (incerto)');
select is((select count(*)::int from public.mensagens where conteudo = 'Segue o boleto' and status_envio = 'incerto' and arquivo_path is null), 1,
  'o texto vira uma mensagem própria, incerta');
select is((select conteudo from public.mensagens where id = 'e1270000-0000-0000-0000-0000000000b3'), null, 'a original fica só com o arquivo');
select is(public.separar_texto_enviado('e1270000-0000-0000-0000-0000000000b3', 'X', 'enviada'), null, 'repetir não separa de novo');
-- A função grava: a conferência vem numa instrução seguinte (a mesma instrução não vê o que a função mudou).
create temp table eco_nota as
  select public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c1', 'Segue a nota', null, 'ECO-127-11') as id;
select is((select id is not null from eco_nota)
  and (select conteudo is null and status_envio = 'pendente' from public.mensagens where id = 'e1270000-0000-0000-0000-0000000000b4')
  and exists (select 1 from public.mensagens where id_provedor = 'ECO-127-11' and conteudo = 'Segue a nota' and status_envio = 'enviada'),
  true, 'eco do texto antes da separação: o texto vira mensagem enviada e o arquivo continua pendente');

-- 29–32: limite de avisos do sistema por minuto, no banco (vale entre processos)
select is(public.reservar_envio_sistema(2), true, 'primeira vaga do minuto');
select is(public.reservar_envio_sistema(2), true, 'segunda vaga do minuto');
select is(public.reservar_envio_sistema(2), false, 'terceira no mesmo minuto: sem vaga');
select throws_ok($$ select public.reservar_envio_sistema(0) $$, '22023', null, 'limite inválido: recusa');

-- 33–37: "Enviar de novo" (só resposta do painel incerta, de conversa que a pessoa vê)
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, status_envio, envio_reservado_em) values
  ('e1270000-0000-0000-0000-0000000000b5', 'e1270000-0000-0000-0000-0000000000c2', 'saida', 'atendente', 'texto', 'Pronto', 'incerto', now() - interval '1 minute');
update public.mensagens set envio_tentado_em = now() - interval '1 minute' where id = 'e1270000-0000-0000-0000-0000000000b5';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1270000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal1"}', true);
select throws_ok($$ select public.reenviar_resposta('e1270000-0000-0000-0000-0000000000b5') $$, '42501', null,
  'quem não vê a conversa não reenvia');
select set_config('request.jwt.claims', '{"sub":"e1270000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select throws_ok($$ select public.reenviar_resposta('e1270000-0000-0000-0000-0000000000a3') $$, 'P0001', null,
  'mensagem do sistema (não é resposta do painel incerta): recusa');
select is(public.reenviar_resposta('e1270000-0000-0000-0000-0000000000b5'), 'e1270000-0000-0000-0000-0000000000b5'::uuid, 'reenvio aceito');
reset role;
select is((select status_envio::text || coalesce(envio_reservado_em::text, ' sem reserva') from public.mensagens
  where id = 'e1270000-0000-0000-0000-0000000000b5'), 'pendente sem reserva', 'volta a pendente, sem reserva, para a fila mandar');
select is(public.casar_eco_saida('e1270000-0000-0000-0000-0000000000c2', 'Pronto', null, 'ECO-127-TARDE'), 'e1270000-0000-0000-0000-0000000000b5'::uuid,
  'eco atrasado da primeira tentativa casa com a resposta reenviada (a fila não manda de novo)');

-- 38–41: alerta uma vez só por chave; incerta antiga avisa uma vez
select is(public.marcar_aviso_unico('celular:e1270000-0000-0000-0000-0000000000c1:2026-10-09T10'), true, 'primeira marca da chave');
select is(public.marcar_aviso_unico('celular:e1270000-0000-0000-0000-0000000000c1:2026-10-09T10'), false, 'a mesma chave não marca de novo');
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, status_envio, criado_em) values
  ('e1270000-0000-0000-0000-0000000000b9', 'e1270000-0000-0000-0000-0000000000c2', 'saida', 'agente', 'texto', 'Sem eco', 'incerto', now() - interval '15 minutes');
select is((select array_agg(telefone) from public.marcar_incertos_antigos()), array['5531999991272'], 'incerta há mais de 10 min: avisa a conversa');
select is((select count(*)::int from public.marcar_incertos_antigos()), 0, 'a mesma incerta não avisa de novo');

select * from finish();
rollback;
