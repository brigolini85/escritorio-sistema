-- Parte I2, Task 3 (spec 7E.3 Ferramentas, 7E.8; D8, D9, D19): a pré-análise do pedido de nota e as sugestões do agente,
-- que só valem quando uma pessoa do setor da demanda aprova.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email) values
  ('f7000000-0000-0000-0000-00000000000a', 'ana@i2b.local'), ('f7000000-0000-0000-0000-00000000000b', 'paula@i2b.local'),
  ('f7000000-0000-0000-0000-00000000000c', 'admin@i2b.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('f7000000-0000-0000-0000-00000000000a', 'I2 Ana', 'ana@i2b.local', 'atendente', '{}'),
  ('f7000000-0000-0000-0000-00000000000b', 'I2 Paula', 'paula@i2b.local', 'atendente', '{}'),
  ('f7000000-0000-0000-0000-00000000000c', 'I2 Admin', 'admin@i2b.local', 'admin', '{}');
insert into public.usuario_setores (usuario_id, setor_id) values
  ('f7000000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Fiscal')),
  ('f7000000-0000-0000-0000-00000000000b', (select id from public.setores where nome = 'Pessoal'));
insert into public.clientes (id, razao_social, cnpj) values ('f7100000-0000-0000-0000-00000000000a', 'I2 Padaria', '77111222000100');
insert into public.chamados (id, cliente_id, setor_id, titulo, pedido_venda) values
  ('f7200000-0000-0000-0000-00000000000a', 'f7100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Fiscal'),
   'NF de venda – teste', '{"unidade_id":null,"texto_destinatario":"X","data":"05/10/2026","itens":[]}'),
  ('f7200000-0000-0000-0000-00000000000b', 'f7100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Pessoal'),
   'Folha', null);

-- 1–5: o trabalhador grava a pré-análise (uma por demanda)
select lives_ok($$ select public.salvar_pre_analise('f7200000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal'),
  '{"versao":1,"linhas":[{"situacao":"falta","texto":"Destinatário não cadastrado."}],"contagem":{"falta":1,"atencao":0,"ok":0}}') $$, 'grava');
select lives_ok($$ select public.salvar_pre_analise('f7200000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal'),
  '{"versao":1,"linhas":[],"contagem":{"falta":0,"atencao":0,"ok":0}}') $$, 'grava de novo');
select is((select count(*)::int from public.pre_analises_nota where chamado_id = 'f7200000-0000-0000-0000-00000000000a'), 1, 'uma por demanda (a nova substitui)');
select throws_ok($$ select public.salvar_pre_analise('f7200000-0000-0000-0000-00000000000b', (select id from public.agentes where slug = 'fiscal'),
  '{"versao":1,"linhas":[],"contagem":{}}') $$, 'P0001', 'Esta demanda não tem pedido de nota.', 'só em demanda com pedido');
select throws_ok($$ select public.salvar_pre_analise('f7200000-0000-0000-0000-00000000000a', null, '[]') $$, 'P0001',
  'Pré-análise inválida.', 'formato conferido');

select throws_ok($$ select public.salvar_pre_analise('f7200000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'pessoal'),
  '{"versao":1,"linhas":[],"contagem":{}}') $$, 'P0001', 'A demanda não é do setor deste agente.', 'agente de outro setor não grava a pré-análise');

-- 6–10: o trabalhador cria sugestões (só do setor do agente, demanda aberta)
select isnt(public.criar_sugestao_agente('f7200000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal'), null,
  'nota_interna', '{"texto":"Conferir o CFOP 5.405."}'), null, 'nota interna sugerida');
select isnt(public.criar_sugestao_agente('f7200000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal'), null,
  'correcao', '{"campo":"quantidade do item 1","de":"10","para":"12","motivo":"o cliente corrigiu"}'), null, 'correção sugerida');
select throws_ok($$ select public.criar_sugestao_agente('f7200000-0000-0000-0000-00000000000b', (select id from public.agentes where slug = 'fiscal'), null,
  'nota_interna', '{"texto":"x"}') $$, 'P0001', 'A demanda não é do setor deste agente.', 'demanda de outro setor: recusa');
select throws_ok($$ select public.criar_sugestao_agente('f7200000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal'), null,
  'nota_interna', '{"texto":""}') $$, 'P0001', 'Sugestão inválida.', 'texto vazio: recusa');
select throws_ok($$ select public.criar_sugestao_agente('f7200000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal'), null,
  'correcao', '{"campo":"x","para":"y"}') $$, 'P0001', 'Sugestão inválida.', 'correção sem motivo: recusa');

-- 11–18: quem decide (D19)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
-- Paula pode nem ver a demanda (nível "Do meu setor"): qualquer das duas recusas vale ("não encontrada" ou "só quem é do setor").
select throws_ok($$ select public.decidir_sugestao((select id from public.agente_sugestoes where tipo = 'nota_interna'), true) $$, 'P0001', null,
  'Paula (Pessoal) não decide sugestão do Fiscal');
select throws_ok($$ insert into public.agente_sugestoes (chamado_id, agente_id, tipo, conteudo)
  values ('f7200000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal'), 'nota_interna', '{"texto":"x"}') $$,
  '42501', null, 'ninguém grava direto');
select set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.agente_sugestoes), 2, 'Ana (Fiscal) vê as sugestões da demanda');
select is(public.decidir_sugestao((select id from public.agente_sugestoes where tipo = 'nota_interna'), true), 'aprovada', 'Ana aprova');
select is((select texto from public.chamado_eventos where chamado_id = 'f7200000-0000-0000-0000-00000000000a' and tipo = 'nota_interna'),
  'Agente Fiscal (sugestão aprovada por I2 Ana): Conferir o CFOP 5.405.', 'aprovar grava a nota interna com quem aprovou');
select throws_ok($$ select public.decidir_sugestao((select id from public.agente_sugestoes where tipo = 'nota_interna'), true) $$, 'P0001',
  'Esta sugestão já foi decidida.', 'clique duplo: nada duplicado');
reset role;
update public.chamados set status = 'concluido', concluido_em = now() where id = 'f7200000-0000-0000-0000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.decidir_sugestao((select id from public.agente_sugestoes where tipo = 'correcao'), true) $$, 'P0001',
  'A demanda já foi concluída.', 'demanda concluída: não aprova');
select is(public.decidir_sugestao((select id from public.agente_sugestoes where tipo = 'correcao'), false), 'descartada', 'mas descarta');

-- 19–20: a pré-análise segue a demanda e o nível "Pedidos de nota"; a nota não duplicou
select is((select count(*)::int from public.pre_analises_nota), 1, 'Ana vê a pré-análise da demanda do Fiscal');
select set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.chamado_eventos where chamado_id = 'f7200000-0000-0000-0000-00000000000a' and tipo = 'nota_interna'), 1,
  'uma nota só, mesmo depois do clique duplo');
reset role;

-- 21–24: sem o nível "Pedidos de nota", as sugestões da demanda com pedido ficam escondidas e não se decidem (F5)
update public.chamados set status = 'aberto', concluido_em = null where id = 'f7200000-0000-0000-0000-00000000000a';
select set_config('i2.sug', public.criar_sugestao_agente('f7200000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal'), null,
  'nota_interna', '{"texto":"Outra."}')::text, true);
select is((select count(*)::int from public.agente_sugestoes where estado = 'aguardando'), 1, 'sugestão nova aguardando');
update public.usuario_permissoes set nivel = 'sem_acesso' where modulo = 'notas' and usuario_id = 'f7000000-0000-0000-0000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.agente_sugestoes), 0, 'Ana sem nível de notas não vê as sugestões da demanda com pedido');
select is((select count(*)::int from public.pre_analises_nota), 0, 'nem a pré-análise');
select throws_ok($$ select public.decidir_sugestao(current_setting('i2.sug')::uuid, true) $$, 'P0001', 'Sugestão não encontrada.', 'nem decide');
reset role;

-- 26–28: demanda na triagem (sem setor) ou agente sem setor: nenhum NULL passa nas guardas
insert into public.chamados (id, cliente_id, setor_id, titulo) values ('f7200000-0000-0000-0000-00000000000c', 'f7100000-0000-0000-0000-00000000000a', null, 'Triagem');
select throws_ok($$ select public.criar_sugestao_agente('f7200000-0000-0000-0000-00000000000c', (select id from public.agentes where slug = 'fiscal'), null,
  'nota_interna', '{"texto":"x"}') $$, 'P0001', 'A demanda não é do setor deste agente.', 'demanda na triagem: recusa');
insert into public.agentes (slug, nome, descricao, setor_id, tipos, estado, ferramentas, porta_de_entrada, ordem)
  values ('i2-sem-setor', 'I2 Sem setor', 'teste', null, '{trabalho}', 'desligado', '{}', false, 99);
select throws_ok($$ select public.criar_sugestao_agente('f7200000-0000-0000-0000-00000000000c', (select id from public.agentes where slug = 'i2-sem-setor'), null,
  'nota_interna', '{"texto":"x"}') $$, 'P0001', 'A demanda não é do setor deste agente.', 'agente sem setor + demanda na triagem: recusa');
insert into public.agente_sugestoes (chamado_id, agente_id, tipo, conteudo)
  values ('f7200000-0000-0000-0000-00000000000c', (select id from public.agentes where slug = 'fiscal'), 'nota_interna', '{"texto":"x"}');
select set_config('i2.sug2', (select id::text from public.agente_sugestoes where chamado_id = 'f7200000-0000-0000-0000-00000000000c'), true);
update public.usuario_permissoes set nivel = 'todas' where modulo = 'demandas' and usuario_id = 'f7000000-0000-0000-0000-00000000000b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.decidir_sugestao(current_setting('i2.sug2')::uuid, true) $$, 'P0001',
  'Só quem é do setor da demanda aprova as sugestões do agente.', 'demanda na triagem: quem não é admin não decide');
reset role;

select * from finish();
rollback;
