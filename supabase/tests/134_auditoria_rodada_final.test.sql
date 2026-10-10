-- Rodada final da auditoria (revisão final da Fase 2): ambiente do banco, resposta que falhou, incertas desta rodada,
-- janela da tentativa devolvida, anonimizar_contato nas etapas e no Drive, e o aviso do aplicativo de código pelo Auth.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- 1–2 (item 1): ambiente_do_banco recusa valor fora de producao|homologacao|local; o painel não chama
select throws_ok($$ select public.ambiente_do_banco('teste') $$, '22023', null, 'ambiente fora da lista: recusado');
select ok(not has_function_privilege('authenticated', 'public.ambiente_do_banco(text)', 'execute'), 'o painel não carimba o ambiente');

-- 3–6 (item 2, M1): a saída do turno que falhou de certo não é resposta (o aviso "IA indisponível" sai)
insert into public.conversas (id, telefone) values ('e1340000-0000-0000-0000-0000000000c1', '5531999991341');
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, turno_agente_entrada) values
  ('e1340000-0000-0000-0000-0000000000a1', 'e1340000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'texto', 'oi',
   'e1340000-0000-0000-0000-0000000000f1');
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, turno_agente, status_envio) values
  ('e1340000-0000-0000-0000-0000000000b1', 'e1340000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', 'Olá!',
   'e1340000-0000-0000-0000-0000000000f1', 'falhou');
select is(public.pegar_lote_do_turno('e1340000-0000-0000-0000-0000000000c1', array['e1340000-0000-0000-0000-0000000000a1']::uuid[],
  'e1340000-0000-0000-0000-0000000000f2'),
  '{"interrompidas": ["e1340000-0000-0000-0000-0000000000a1"], "respondeu": false}'::jsonb,
  'saída que falhou: o turno agiu (interrompida), mas não respondeu');
update public.mensagens set id_provedor = 'Z134' where id = 'e1340000-0000-0000-0000-0000000000b1';
select is(public.pegar_lote_do_turno('e1340000-0000-0000-0000-0000000000c1', array['e1340000-0000-0000-0000-0000000000a1']::uuid[],
  'e1340000-0000-0000-0000-0000000000f2') -> 'respondeu', 'true'::jsonb, '"falhou" com id do provedor pode ter chegado: conta');
update public.mensagens set id_provedor = null, status_envio = 'enviada' where id = 'e1340000-0000-0000-0000-0000000000b1';
select is(public.pegar_lote_do_turno('e1340000-0000-0000-0000-0000000000c1', array['e1340000-0000-0000-0000-0000000000a1']::uuid[],
  'e1340000-0000-0000-0000-0000000000f2') -> 'respondeu', 'true'::jsonb, 'saída enviada: respondeu');
update public.mensagens set status_envio = null where id = 'e1340000-0000-0000-0000-0000000000b1';
select is(public.pegar_lote_do_turno('e1340000-0000-0000-0000-0000000000c1', array['e1340000-0000-0000-0000-0000000000a1']::uuid[],
  'e1340000-0000-0000-0000-0000000000f2') -> 'respondeu', 'true'::jsonb, 'saída sem status (na fila): respondeu, como antes');

-- 7–10 (item 7, T14): marcar_incertos_antigos devolve os ids marcados nesta rodada
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, status_envio, criado_em) values
  ('e1340000-0000-0000-0000-0000000000d1', 'e1340000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', 'Antiga', 'incerto',
   now() - interval '30 minutes');
select is((select mensagens from public.marcar_incertos_antigos() where conversa_id = 'e1340000-0000-0000-0000-0000000000c1'),
  array['e1340000-0000-0000-0000-0000000000d1']::uuid[], 'a incerta marcada nesta rodada volta com o id');
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, status_envio, criado_em) values
  ('e1340000-0000-0000-0000-0000000000d2', 'e1340000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'texto', 'Nova', 'incerto',
   now() - interval '15 minutes');
select is((select mensagens from public.marcar_incertos_antigos() where conversa_id = 'e1340000-0000-0000-0000-0000000000c1'),
  array['e1340000-0000-0000-0000-0000000000d2']::uuid[], 'a rodada seguinte devolve só a nova (a antiga já estava marcada)');
select ok(not has_function_privilege('authenticated', 'public.marcar_incertos_antigos()', 'execute'), 'o painel não varre incertas');
select ok(not has_function_privilege('anon', 'public.marcar_incertos_antigos()', 'execute'), 'visitante não varre incertas');

-- 11–18 (item 8, T12): a tentativa devolvida na janela em que foi contada
select isnt(public.contar_tentativa_janela('t134', 2, 60), null, 'dentro do limite: devolve a janela');
select is(public.contar_tentativa_janela('t134', 2, 60),
  to_timestamp(floor(extract(epoch from now()) / 60) * 60), 'a janela é o começo do intervalo');
select is(public.contar_tentativa_janela('t134', 2, 60), null, 'passou do limite: nulo (não conta)');
insert into public.tentativas_login (chave, janela, total) values ('t134', '2026-01-01 00:00:00+00', 3);
select lives_ok($$ select public.devolver_tentativa('t134', '2026-01-01 00:00:00+00'::timestamptz) $$, 'devolve na janela dada');
select is((select total from public.tentativas_login where chave = 't134' and janela = '2026-01-01 00:00:00+00'), 2,
  'a janela da contagem perdeu uma');
select is((select total from public.tentativas_login where chave = 't134' and janela <> '2026-01-01 00:00:00+00'), 2,
  'a janela de agora não muda');
select ok(not has_function_privilege('authenticated', 'public.contar_tentativa_janela(text, integer, integer)', 'execute')
  and not has_function_privilege('anon', 'public.contar_tentativa_janela(text, integer, integer)', 'execute'),
  'só o servidor do painel conta');
select ok(not has_function_privilege('authenticated', 'public.devolver_tentativa(text, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.devolver_tentativa(text, timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.devolver_tentativa(text, timestamptz)', 'execute'),
  'só o servidor do painel devolve');

-- 19–22 (item 9, T15): anonimizar_contato limpa o resumo das etapas (o nome fica) e a subpasta do Drive
insert into auth.users (id, email) values ('e1340000-0000-0000-0000-00000000000a', 'adm134@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values ('e1340000-0000-0000-0000-00000000000a', 'Adm 134', 'adm134@pgtap.local', 'admin');
insert into public.clientes (id, razao_social, cnpj) values ('e1340000-0000-0000-0000-0000000000e1', 'Empresa 134', '13413400000101');
insert into public.contatos (id, nome, telefone) values ('e1340000-0000-0000-0000-0000000000a9', 'Rita 134', '5531999991349');
insert into public.conversas (id, telefone, contato_id) values
  ('e1340000-0000-0000-0000-0000000000c9', '5531999991349', 'e1340000-0000-0000-0000-0000000000a9');
insert into public.chamados (id, cliente_id, conversa_id, titulo, resumo) values
  ('e1340000-0000-0000-0000-0000000000e9', 'e1340000-0000-0000-0000-0000000000e1', 'e1340000-0000-0000-0000-0000000000c9', 'Da Rita', 'Rita pediu');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, pedido, limite_usd, limite_minutos) values
  ('e1340000-0000-0000-0000-0000000000f9', (select id from public.agentes where slug = 'contabil'), 'e1340000-0000-0000-0000-0000000000e9',
   'e1340000-0000-0000-0000-0000000000e1', 'Tarefa da Rita', 2, 20);
update public.agente_tarefas
   set etapas = '[{"nome":"Conferir extrato","concluida":true,"resumo":"Rita deve R$ 10"},{"nome":"Fechar","concluida":false}]',
       drive_subpasta = 'Rita/2026'
 where id = 'e1340000-0000-0000-0000-0000000000f9';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1340000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select lives_ok($$ select public.anonimizar_contato('e1340000-0000-0000-0000-0000000000a9') $$, 'o administrador anonimiza');
reset role;
select is((select etapas from public.agente_tarefas where id = 'e1340000-0000-0000-0000-0000000000f9'),
  '[{"nome":"Conferir extrato","concluida":true,"resumo":null},{"nome":"Fechar","concluida":false}]'::jsonb,
  'etapas: o resumo sai, o nome e a situação ficam');
select is((select drive_subpasta from public.agente_tarefas where id = 'e1340000-0000-0000-0000-0000000000f9'), null,
  'a subpasta do Drive (pode ter o nome do titular) sai');
select is((select pedido from public.agente_tarefas where id = 'e1340000-0000-0000-0000-0000000000f9'), '[removido a pedido do titular]',
  'o pedido continua saindo, como antes');

-- 23–34 (item 11, auditoria 2.5): aplicativo de código cadastrado pelo Auth (sem o painel) avisa o dono, uma vez só
insert into auth.users (id, email) values ('e1340000-0000-0000-0000-00000000000b', 'ana134@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values ('e1340000-0000-0000-0000-00000000000b', 'Ana 134', 'ana134@pgtap.local', 'atendente');
select has_trigger('auth', 'mfa_factors', 'aviso_fator_cadastrado', 'gatilho no cadastro do fator');
select ok(not has_function_privilege('authenticated', 'public.aviso_fator_cadastrado()', 'execute')
  and not has_function_privilege('anon', 'public.aviso_fator_cadastrado()', 'execute'), 'ninguém chama o gatilho direto');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) values
  ('e1340000-0000-0000-0000-0000000000f1', 'e1340000-0000-0000-0000-00000000000b', 'T134', 'totp', 'verified', now(), now(), 'x');
select is((select count(*)::int from public.alertas where mensagem = 'Ana 134 cadastrou um aplicativo de código'), 1,
  'fator confirmado inserido direto: um aviso');
select is((select count(*)::int from public.auditoria_acessos where acao = 'cadastrar_fator'
  and entidade_id = 'e1340000-0000-0000-0000-0000000000f1' and usuario_id = 'e1340000-0000-0000-0000-00000000000b'), 1, 'e a marca na auditoria');
update auth.mfa_factors set status = 'verified', updated_at = now() where id = 'e1340000-0000-0000-0000-0000000000f1';
select is((select count(*)::int from public.alertas where mensagem = 'Ana 134 cadastrou um aplicativo de código'), 1,
  'atualizar o mesmo fator não repete');
-- O painel chama depois do primeiro código: não repete o aviso do gatilho.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1340000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
select is(public.registrar_fator_cadastrado(), 0, 'o painel depois do gatilho: nada a registrar');
reset role;
select is((select count(*)::int from public.alertas where mensagem = 'Ana 134 cadastrou um aplicativo de código'), 1,
  'os dois caminhos juntos: um aviso só');
-- O caminho comum do Auth: cadastra sem confirmar (nada) e confirma depois (avisa).
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) values
  ('e1340000-0000-0000-0000-0000000000f2', 'e1340000-0000-0000-0000-00000000000b', 'T134b', 'totp', 'unverified', now(), now(), 'x');
select is((select count(*)::int from public.alertas where mensagem = 'Ana 134 cadastrou um aplicativo de código'), 1,
  'fator ainda não confirmado: sem aviso');
update auth.mfa_factors set status = 'verified' where id = 'e1340000-0000-0000-0000-0000000000f2';
select is((select count(*)::int from public.alertas where mensagem = 'Ana 134 cadastrou um aplicativo de código'), 2,
  'confirmado depois: avisa');
-- Conta sem cadastro na equipe também avisa.
insert into auth.users (id, email) values ('e1340000-0000-0000-0000-00000000000c', 'fora134@pgtap.local');
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) values
  ('e1340000-0000-0000-0000-0000000000f3', 'e1340000-0000-0000-0000-00000000000c', 'T134c', 'totp', 'verified', now(), now(), 'x');
select ok(exists (select 1 from public.alertas where mensagem = 'Uma conta sem cadastro na equipe cadastrou um aplicativo de código'),
  'conta sem cadastro na equipe: avisa também');
-- A falha no aviso não impede o cadastro do fator.
alter table public.alertas add constraint t134_quebra check (mensagem not like 'Quebra 134%');
insert into auth.users (id, email) values ('e1340000-0000-0000-0000-00000000000d', 'quebra134@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values ('e1340000-0000-0000-0000-00000000000d', 'Quebra 134', 'quebra134@pgtap.local', 'atendente');
select lives_ok($$ insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) values
  ('e1340000-0000-0000-0000-0000000000f4', 'e1340000-0000-0000-0000-00000000000d', 'T134d', 'totp', 'verified', now(), now(), 'x') $$,
  'o aviso falhou e o cadastro do fator segue');
select ok(exists (select 1 from auth.mfa_factors where id = 'e1340000-0000-0000-0000-0000000000f4'), 'o fator ficou gravado');

select * from finish();
rollback;
