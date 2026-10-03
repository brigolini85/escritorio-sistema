-- Parte F, Task 1 (spec 7B.2): colunas novas de uso_ia, a regra de classificação de quem grava sem funcionalidade
-- (registros antigos e trabalhador antigo) e as configurações só do administrador.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('fa000000-0000-0000-0000-00000000000a', 'admin@gastos1.local'),
  ('fa000000-0000-0000-0000-00000000000b', 'ana@gastos1.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('fa000000-0000-0000-0000-00000000000a', 'Admin G', 'admin@gastos1.local', 'admin', '{}'),
  ('fa000000-0000-0000-0000-00000000000b', 'Ana G', 'ana@gastos1.local', 'atendente', '{}');
insert into public.usuario_permissoes (usuario_id, modulo, nivel)
  values ('fa000000-0000-0000-0000-00000000000b', 'configuracoes', 'sim')
  on conflict (usuario_id, modulo) do update set nivel = excluded.nivel;
insert into public.clientes (id, razao_social, cnpj) values
  ('fb000000-0000-0000-0000-000000000001', 'Rede Bom Preço Ltda', '11111111000101'),
  ('fb000000-0000-0000-0000-000000000002', 'Mercado Central', '22222222000102');
insert into public.conversas (id, telefone, cliente_em_foco) values
  ('fc000000-0000-0000-0000-000000000001', '5531944440001', 'fb000000-0000-0000-0000-000000000002');
-- A empresa de 10h é a Rede; às 12h a conversa passou a falar da Central.
insert into public.mensagens (conversa_id, cliente_id, direcao, autor, conteudo, criado_em) values
  ('fc000000-0000-0000-0000-000000000001', 'fb000000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'oi', '2026-09-20 10:00-03'),
  ('fc000000-0000-0000-0000-000000000001', 'fb000000-0000-0000-0000-000000000002', 'entrada', 'cliente', 'e a outra', '2026-09-20 12:00-03');

-- 1–5: colunas
select has_column('public', 'uso_ia', 'cliente_id', 'empresa');
select has_column('public', 'uso_ia', 'setor_id', 'setor (Parte I)');
select col_default_is('public', 'uso_ia', 'provedor', 'anthropic'::text, 'provedor padrão: anthropic');
select throws_ok($$ insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd, funcionalidade, provedor)
  values ('m', 0, 0, 0, 'transcricao_audio', 'openai') $$, '23514', null, 'provedor fora da lista: recusa');
select throws_ok($$ insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd, funcionalidade, segundos_audio)
  values ('m', 0, 0, 0, 'transcricao_audio', -1) $$, '23514', null, 'segundos negativos: recusa');

-- 6–9: a regra única de classificação
select results_eq($$ select funcionalidade, cliente_id from public.uso_ia_classificacao(null, now()) $$,
  $$ values ('nao_identificado'::text, null::uuid) $$, 'sem conversa: nao_identificado, sem empresa');
select results_eq($$ select funcionalidade, cliente_id from public.uso_ia_classificacao('fc000000-0000-0000-0000-000000000001', '2026-09-20 11:00-03') $$,
  $$ values ('agente_clientes'::text, 'fb000000-0000-0000-0000-000000000001'::uuid) $$, 'com conversa: agente, empresa da última mensagem até ali');
select results_eq($$ select cliente_id from public.uso_ia_classificacao('fc000000-0000-0000-0000-000000000001', '2026-09-20 13:00-03') $$,
  $$ values ('fb000000-0000-0000-0000-000000000002'::uuid) $$, 'depois da troca: a empresa nova');
select results_eq($$ select cliente_id from public.uso_ia_classificacao('fc000000-0000-0000-0000-000000000001', '2026-09-20 09:00-03') $$,
  $$ values (null::uuid) $$, 'antes de qualquer mensagem com empresa: sem empresa (nunca a em foco de hoje)');

-- 10–13: o gatilho aplica a regra a quem grava sem funcionalidade (trabalhador antigo)
insert into public.uso_ia (conversa_id, modelo, tokens_entrada, tokens_saida, custo_usd, criado_em)
  values ('fc000000-0000-0000-0000-000000000001', 'claude-sonnet-5', 10, 5, 0.01, '2026-09-20 11:00-03');
insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd) values ('claude-sonnet-5', 10, 5, 0.02);
select results_eq($$ select funcionalidade, cliente_id::text from public.uso_ia where custo_usd = 0.01 $$,
  $$ values ('agente_clientes'::text, 'fb000000-0000-0000-0000-000000000001') $$, 'trabalhador antigo com conversa: agente + empresa');
select results_eq($$ select funcionalidade from public.uso_ia where custo_usd = 0.02 $$,
  $$ values ('nao_identificado'::text) $$, 'trabalhador antigo sem conversa: nao_identificado');
insert into public.uso_ia (conversa_id, cliente_id, modelo, tokens_entrada, tokens_saida, custo_usd, funcionalidade, usuario_id)
  values ('fc000000-0000-0000-0000-000000000001', 'fb000000-0000-0000-0000-000000000002', 'm', 1, 1, 0.03, 'sugerir_resposta', 'fa000000-0000-0000-0000-00000000000b');
select results_eq($$ select funcionalidade, cliente_id::text from public.uso_ia where custo_usd = 0.03 $$,
  $$ values ('sugerir_resposta'::text, 'fb000000-0000-0000-0000-000000000002') $$, 'quem grava completo: o gatilho não mexe');
select is(public.custo_ia_periodo('2000-01-01', '2100-01-01'), 0.06::numeric, 'teto soma tudo, inclusive o classificado');

-- 14–15: funções internas fechadas
select ok(not has_function_privilege('authenticated', 'public.uso_ia_classificacao(uuid, timestamptz)', 'execute'), 'classificação: só interna');
select ok(not has_function_privilege('authenticated', 'public.uso_ia_completar()', 'execute'), 'gatilho: só interno');

-- 16–20: configurações novas, só do administrador
select has_column('public', 'configuracoes', 'cotacao_usd_brl', 'cotação');
select has_column('public', 'configuracoes', 'custo_minuto_transcricao_usd', 'custo por minuto da transcrição');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ update public.configuracoes set cotacao_usd_brl = 5.5 where id = 1 $$, 'P0001',
  'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'Configurações: Sim não muda a cotação');
select throws_ok($$ update public.configuracoes set custo_minuto_transcricao_usd = 0.001 where id = 1 $$, 'P0001',
  'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'nem o custo por minuto');
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ update public.configuracoes set cotacao_usd_brl = 5.55, custo_minuto_transcricao_usd = 0.000667 where id = 1 $$,
  'administrador muda os dois');

select * from finish();
rollback;
