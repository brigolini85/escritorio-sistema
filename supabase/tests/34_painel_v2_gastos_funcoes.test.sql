-- Parte F, Task 3 (spec 7B.2, 7B.4): funções de leitura só do administrador; atendimento = conversa + dia de Brasília;
-- "passou para pessoa" quando houve assumir ou resposta humana naquele dia.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

insert into auth.users (id, email) values
  ('fd000000-0000-0000-0000-00000000000a', 'admin@gastos3.local'),
  ('fd000000-0000-0000-0000-00000000000b', 'ana@gastos3.local'),
  ('fd000000-0000-0000-0000-00000000000c', 'velho@gastos3.local');
insert into public.usuarios (id, nome, email, papel, permissoes, ativo) values
  ('fd000000-0000-0000-0000-00000000000a', 'Thiago', 'admin@gastos3.local', 'admin', '{}', true),
  ('fd000000-0000-0000-0000-00000000000b', 'Ana', 'ana@gastos3.local', 'atendente', '{assistente_site}', true),
  ('fd000000-0000-0000-0000-00000000000c', 'Admin arquivado', 'velho@gastos3.local', 'admin', '{}', false);
insert into public.clientes (id, razao_social, nome_fantasia, cnpj) values
  ('fe000000-0000-0000-0000-000000000001', 'Rede Bom Preço Ltda', null, '33333333000101'),
  ('fe000000-0000-0000-0000-000000000002', 'Mercado Central Ltda', 'Mercado Central', '44444444000102');
insert into public.contatos (id, nome, telefone) values ('ff000000-0000-0000-0000-000000000001', 'Carla Mendes', '5531955550001');
insert into public.conversas (id, telefone, contato_id) values
  ('f0000000-0000-0000-0000-000000000001', '5531955550001', 'ff000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000002', '5531955550002', null);
-- Carla: dia 20 (agente sozinho), dia 21 23:50 e 22 00:10 de Brasília (dois dias; no 22 Ana responde), dia 23 (Ana assume).
insert into public.mensagens (conversa_id, cliente_id, direcao, autor, atendente_id, conteudo, criado_em) values
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'entrada', 'cliente', null, 'oi', '2026-09-20 10:00-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'saida', 'agente', null, 'olá', '2026-09-20 10:01-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'saida', 'sistema', null, 'aviso', '2026-09-20 10:01-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'entrada', 'cliente', null, 'nota', '2026-09-21 23:50-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'entrada', 'cliente', null, 'e aí', '2026-09-22 00:10-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'saida', 'atendente', 'fd000000-0000-0000-0000-00000000000b', 'vi', '2026-09-22 09:00-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'entrada', 'cliente', null, 'de novo', '2026-09-23 10:00-03');
insert into public.conversa_eventos (conversa_id, tipo, usuario_id, criado_em)
  values ('f0000000-0000-0000-0000-000000000001', 'assumida', 'fd000000-0000-0000-0000-00000000000b', '2026-09-23 10:05-03');
insert into public.uso_ia (conversa_id, cliente_id, usuario_id, funcionalidade, modelo, tokens_entrada, tokens_saida, tokens_cache_leitura, custo_usd, segundos_audio, provedor, criado_em) values
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', null, 'agente_clientes', 'claude-sonnet-5', 100, 10, 1000000, 0.10, null, 'anthropic', '2026-09-20 10:00-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', null, 'agente_clientes', 'claude-sonnet-5', 100, 10, 0, 0.20, null, 'anthropic', '2026-09-21 23:50-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', null, 'transcricao_audio', 'whisper', 0, 0, 0, 0.01, 90, 'groq', '2026-09-22 00:10-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-00000000000b', 'sugerir_resposta', 'claude-sonnet-5', 100, 10, 0, 0.30, null, 'anthropic', '2026-09-22 08:59-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', null, 'agente_clientes', 'claude-sonnet-5', 100, 10, 0, 0.40, null, 'anthropic', '2026-09-23 10:00-03'),
  ('f0000000-0000-0000-0000-000000000002', null, null, 'agente_clientes', 'claude-sonnet-5', 100, 10, 0, 0.05, null, 'anthropic', '2026-09-23 11:00-03'),
  (null, null, 'fd000000-0000-0000-0000-00000000000b', 'assistente_site', 'claude-sonnet-5', 100, 10, 0, 0.50, null, 'anthropic', '2026-09-23 12:00-03'),
  (null, null, 'fd000000-0000-0000-0000-00000000000a', 'testar_agente', 'claude-sonnet-5', 100, 10, 0, 0.90, null, 'anthropic', '2026-09-23 13:00-03'),
  (null, null, null, 'nao_identificado', 'claude-sonnet-5', 1, 1, 0, 0.04, null, 'anthropic', '2026-09-24 09:00-03');

-- Revisão final (I2): conversa 3 em 10/08 com uma chamada da Mercado Central (10:00) e uma sem empresa depois (10:30):
-- um atendimento só, da empresa da chamada mais recente que tem empresa.
insert into public.conversas (id, telefone, contato_id) values ('f0000000-0000-0000-0000-000000000003', '5531955550003', null);
insert into public.uso_ia (conversa_id, cliente_id, usuario_id, funcionalidade, modelo, tokens_entrada, tokens_saida, custo_usd, provedor, criado_em) values
  ('f0000000-0000-0000-0000-000000000003', 'fe000000-0000-0000-0000-000000000002', null, 'agente_clientes', 'claude-sonnet-5', 100, 10, 0.07, 'anthropic', '2026-08-10 10:00-03'),
  ('f0000000-0000-0000-0000-000000000003', null, null, 'transcricao_audio', 'whisper', 0, 0, 0.02, 'groq', '2026-08-10 10:30-03');
create temp table p2 as select '2026-08-10 00:00-03'::timestamptz as de, '2026-08-11 00:00-03'::timestamptz as ate;
grant select on p2 to authenticated;

-- Período: 20/09 00:00 a 25/09 00:00 de Brasília (5 dias).
create temp table p as select '2026-09-20 00:00-03'::timestamptz as de, '2026-09-25 00:00-03'::timestamptz as ate;
grant select on p to authenticated;

set local role authenticated;
-- 1–9: atendente recusada em todas; arquivado também
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.gastos_resumo(de, ate) from p $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: resumo');
select throws_ok($$ select * from public.gastos_por_funcionalidade((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: funcionalidade');
select throws_ok($$ select * from public.gastos_por_dia((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: dia');
select throws_ok($$ select * from public.gastos_dia_mais_caro((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: dia mais caro');
select throws_ok($$ select * from public.gastos_por_pessoa((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: pessoa');
select throws_ok($$ select * from public.gastos_por_cliente((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: cliente');
select throws_ok($$ select * from public.gastos_atendimentos_do_cliente('fe000000-0000-0000-0000-000000000001', (select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: atendimentos');
select throws_ok($$ select * from public.gastos_chamadas((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: chamadas');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.gastos_resumo(de, ate) from p $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'administrador arquivado: recusado');

-- 10: anon nem executa
select ok(not has_function_privilege('anon', 'public.gastos_resumo(timestamptz, timestamptz)', 'execute'), 'anon sem execução');
-- Revisão final (M4): as internas nem o authenticated executa (só as funções do administrador as chamam).
select ok(not has_function_privilege('authenticated', 'public.gastos_checar(timestamptz, timestamptz)', 'execute'), 'authenticated sem execução de gastos_checar');
select ok(not has_function_privilege('authenticated', 'public.gastos_atendimentos_base(timestamptz, timestamptz)', 'execute'), 'authenticated sem execução de gastos_atendimentos_base');

-- 11–31: administrador
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.gastos_resumo('2026-09-25', '2026-09-20') $$, 'P0001', 'Período inválido.', 'de depois de até: recusa');
select throws_ok($$ select public.gastos_resumo('2025-01-01', '2026-09-20') $$, 'P0001', 'Período inválido.', 'mais de 366 dias: recusa');
select is((select (public.gastos_resumo(de, ate) ->> 'total_usd')::numeric from p), 2.50, 'total do período');
select is((select (public.gastos_resumo(de, ate) ->> 'chamadas')::int from p), 9, 'chamadas');
-- Carla: 20, 21, 22, 23 = 4; conversa 2: 23 = 1 → 5 (21 23:50 e 22 00:10 são dias diferentes em Brasília).
select is((select (public.gastos_resumo(de, ate) ->> 'atendimentos')::int from p), 5, 'mesmo telefone em dois dias = dois atendimentos');
select is((select (public.gastos_resumo(de, ate) ->> 'custo_atendimentos_usd')::numeric from p), 1.06, 'custo dos atendimentos (só com conversa)');
select is((select (public.gastos_resumo(de, ate) ->> 'segundos_audio')::numeric from p), 90::numeric, 'segundos de áudio');
-- 1.000.000 tokens de leitura de cache × (2 − 0,2) US$/milhão = US$ 1,80 de economia.
select is((select (public.gastos_resumo(de, ate) ->> 'economia_cache_usd')::numeric from p), 1.80, 'economia do cache pelos preços');
select is((select (public.gastos_resumo(de, ate) ->> 'nao_identificado')::int from p), 1, 'chamadas não identificadas contadas');
select results_eq($$ select funcionalidade, custo_usd from public.gastos_por_funcionalidade((select de from p), (select ate from p)) order by custo_usd desc limit 2 $$,
  $$ values ('testar_agente'::text, 0.90::numeric), ('agente_clientes'::text, 0.75::numeric) $$, 'por funcionalidade, mais caro primeiro');
select is((select count(*) from public.gastos_por_dia((select de from p), (select ate from p))), 5::bigint, 'todos os dias do período');
select is((select custo_usd from public.gastos_por_dia((select de from p), (select ate from p)) where dia = '2026-09-21'), 0.20, 'dia 21 (23:50 de Brasília) fica no 21');
select results_eq($$ select dia, funcionalidade, pessoa, chamadas from public.gastos_dia_mais_caro((select de from p), (select ate from p)) $$,
  $$ values ('2026-09-23'::date, 'testar_agente'::text, 'Thiago'::text, 1::bigint) $$, 'dia mais caro e o que mais pesou nele');
select is((select dias_com_gasto from public.gastos_dia_mais_caro((select de from p), (select ate from p))), 5::bigint, 'dias com gasto (o alerta só aparece com 2 ou mais)');
select is((select count(*) from public.gastos_por_pessoa((select de from p), (select ate from p)) where usuario_id is null), 0::bigint, 'ranking só com ações de pessoas');
select is((select sum(custo_usd) from public.gastos_por_pessoa((select de from p), (select ate from p)) where nome = 'Ana'), 0.80, 'Ana: sugestão + assistente');
select results_eq($$ select nome, atendimentos, custo_usd, resolvidos from public.gastos_por_cliente((select de from p), (select ate from p)) $$,
  $$ values ('Rede Bom Preço Ltda'::text, 4::bigint, 1.01::numeric, 2::bigint), ('Sem empresa identificada'::text, 1::bigint, 0.05::numeric, 1::bigint) $$,
  'por cliente: atendimentos, custo e resolvidos pelo agente');
select is((select count(*) from public.gastos_por_cliente((select de from p), (select ate from p), 'central')), 0::bigint, 'busca sem gasto: vazio');
select results_eq($$ select dia, contato, mensagens, resultado from public.gastos_atendimentos_do_cliente('fe000000-0000-0000-0000-000000000001', (select de from p), (select ate from p)) order by dia $$,
  $$ values ('2026-09-20'::date, 'Carla Mendes'::text, 2::bigint, 'resolvido_pelo_agente'::text),
            ('2026-09-21'::date, 'Carla Mendes'::text, 1::bigint, 'resolvido_pelo_agente'::text),
            ('2026-09-22'::date, 'Carla Mendes'::text, 2::bigint, 'passou_para_pessoa'::text),
            ('2026-09-23'::date, 'Carla Mendes'::text, 1::bigint, 'passou_para_pessoa'::text) $$,
  'atendimentos: mensagens sem as do sistema; resposta humana ou assumir = passou para pessoa');
select is((select count(*) from public.gastos_chamadas((select de from p), (select ate from p), p_usuario => 'fd000000-0000-0000-0000-00000000000b')), 2::bigint, 'chamadas de uma pessoa');
select is((select count(*) from public.gastos_chamadas((select de from p), (select ate from p), p_limite => 3)), 3::bigint, 'limite');
-- Revisão final (M4): busca que acha (sem diferença de maiúsculas) e filtro por funcionalidade.
select results_eq($$ select nome, atendimentos from public.gastos_por_cliente((select de from p), (select ate from p), '  BOM preço ') $$,
  $$ values ('Rede Bom Preço Ltda'::text, 4::bigint) $$, 'busca acha pelo nome, sem diferença de maiúsculas');
select is((select count(*) from public.gastos_chamadas((select de from p), (select ate from p), p_funcionalidade => 'agente_clientes')), 4::bigint, 'chamadas de uma funcionalidade');
-- Revisão final (I2): um atendimento por (conversa, dia); a empresa é a da chamada mais recente do dia que tem empresa.
select results_eq($$ select nome, atendimentos, custo_usd from public.gastos_por_cliente((select de from p2), (select ate from p2)) $$,
  $$ values ('Mercado Central'::text, 1::bigint, 0.09::numeric) $$, 'chamada sem empresa e chamada da empresa no mesmo dia = um atendimento da empresa');
select is((select sum(atendimentos) from public.gastos_por_cliente((select de from p), (select ate from p))),
  (select (public.gastos_resumo(de, ate) ->> 'atendimentos')::numeric from p), 'soma dos atendimentos por cliente = atendimentos do resumo');
select is((select sum(atendimentos) from public.gastos_por_cliente((select de from p2), (select ate from p2))),
  (select (public.gastos_resumo(de, ate) ->> 'atendimentos')::numeric from p2), 'soma por cliente = resumo, também com chamada sem empresa no dia');

select * from finish();
rollback;
