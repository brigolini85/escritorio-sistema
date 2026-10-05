-- Parte I1, Task 4 (spec 7E.2, 7E.3 "Atividade e custo", 7E.8; D10, D16–D18): custo e atendimentos por agente; registro
-- antigo do agente conta para o Thiago; números só para dono e administrador; Gastos por agente só para o administrador.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

update public.usuarios set dono = false where dono;
insert into auth.users (id, email) values
  ('f5300000-0000-0000-0000-00000000000a', 'dono@i1c.local'), ('f5300000-0000-0000-0000-00000000000b', 'admin@i1c.local'),
  ('f5300000-0000-0000-0000-00000000000c', 'ana@i1c.local'), ('f5300000-0000-0000-0000-00000000000d', 'ze@i1c.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('f5300000-0000-0000-0000-00000000000a', 'I1C Dono', 'dono@i1c.local', 'admin', '{}'),
  ('f5300000-0000-0000-0000-00000000000b', 'I1C Admin', 'admin@i1c.local', 'admin', '{}'),
  ('f5300000-0000-0000-0000-00000000000c', 'I1C Ana', 'ana@i1c.local', 'atendente', '{treinar_agente}'),
  ('f5300000-0000-0000-0000-00000000000d', 'I1C Zé', 'ze@i1c.local', 'atendente', '{}');
update public.usuarios set dono = true where id = 'f5300000-0000-0000-0000-00000000000a';
insert into public.clientes (id, razao_social, nome_fantasia, cnpj) values
  ('f5400000-0000-0000-0000-00000000000a', 'I1C Padaria Sol ME', 'I1C Padaria Sol', '11444777000161');
insert into public.conversas (id, telefone) values
  ('f5500000-0000-0000-0000-00000000000a', '5531966660001'), ('f5500000-0000-0000-0000-00000000000b', '5531966660002');
-- 01/10 (Brasília): conversa A só com o agente (antigo sem agente_id + novo com); 02/10: conversa B passa para pessoa; teste do dono.
insert into public.uso_ia (funcionalidade, agente_id, conversa_id, cliente_id, usuario_id, modelo, tokens_entrada, tokens_saida, custo_usd, criado_em) values
  ('agente_clientes', null, 'f5500000-0000-0000-0000-00000000000a', 'f5400000-0000-0000-0000-00000000000a', null, 'm', 1, 1, 0.4, '2026-10-01 13:00Z'),
  ('agente_clientes', 'a0000000-0000-4000-8000-000000000001', 'f5500000-0000-0000-0000-00000000000a', null, null, 'm', 1, 1, 0.2, '2026-10-01 14:00Z'),
  ('agente_clientes', 'a0000000-0000-4000-8000-000000000001', 'f5500000-0000-0000-0000-00000000000b', 'f5400000-0000-0000-0000-00000000000a', null, 'm', 1, 1, 0.3, '2026-10-02 13:00Z'),
  ('testar_agente', null, null, null, 'f5300000-0000-0000-0000-00000000000a', 'm', 1, 1, 0.1, '2026-10-02 15:00Z'),
  ('especialista_setor', (select id from public.agentes where slug = 'fiscal'), null, null, null, 'm', 1, 1, 0.05, '2026-10-03 13:00Z'),
  ('assistente_site', null, null, null, 'f5300000-0000-0000-0000-00000000000b', 'm', 1, 1, 1.0, '2026-10-03 13:00Z');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, criado_em) values
  ('f5500000-0000-0000-0000-00000000000b', 'saida', 'atendente', 'texto', 'Oi, aqui é a Ana.', '2026-10-02 13:30Z');
insert into public.agente_skills (id, agente_id, nome, tipo, ativo) values
  ('f5600000-0000-0000-0000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'conferencia-certidao', 'procedimento', true);
insert into public.decisoes_agente (conversa_id, etapa, entrada, criado_em) values
  ('f5500000-0000-0000-0000-00000000000a', 'ler_skill', '{"nome":"conferencia-certidao"}', '2026-10-01 13:00Z'),
  ('f5500000-0000-0000-0000-00000000000b', 'ler_skill', '{"nome":"conferencia-certidao"}', '2026-10-02 13:00Z'),
  ('f5500000-0000-0000-0000-00000000000b', 'ler_skill', '{"nome":"de-outro-agente"}', '2026-10-02 13:00Z');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f5300000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1–6: o dono
select results_eq($$ select atendimentos, resolvidos, custo_usd, custo_testes_usd from public.agentes_numeros('2026-10-01 03:00Z', '2026-11-01 03:00Z')
  where agente_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values (2::bigint, 1::bigint, 0.9::numeric, 0.1::numeric) $$, 'Thiago: 2 atendimentos, 1 sozinho, custo com o registro antigo, teste à parte');
select results_eq($$ select atendimentos, custo_usd from public.agentes_numeros('2026-10-01 03:00Z', '2026-11-01 03:00Z') n
  join public.agentes a on a.id = n.agente_id where a.slug = 'fiscal' $$, $$ values (0::bigint, 0.05::numeric) $$, 'o Fiscal tem o custo dele');
select is((select ultima_empresa from public.agentes_numeros('2026-10-01 03:00Z', '2026-11-01 03:00Z')
  where agente_id = 'a0000000-0000-4000-8000-000000000001'), 'I1C Padaria Sol', 'última atividade com a empresa');
select results_eq($$ select dia, atendimentos, resolvidos, custo_usd, custo_testes_usd
  from public.atividade_do_agente('atendimento', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$,
  $$ values ('2026-10-01'::date, 1::bigint, 1::bigint, 0.6::numeric, 0::numeric), ('2026-10-02'::date, 1::bigint, 0::bigint, 0.3::numeric, 0.1::numeric) $$,
  'atividade por dia (D18)');
select bag_eq($$ select slug, custo_usd, chamadas from public.gastos_por_agente('2026-10-01 03:00Z', '2026-11-01 03:00Z') $$,
  $$ values ('atendimento', 1.0::numeric, 4::bigint), ('fiscal', 0.05::numeric, 1::bigint) $$, 'Gastos por agente: assistente fica de fora (D17)');
select throws_ok($$ select * from public.agentes_numeros('2026-11-01 03:00Z', '2026-10-01 03:00Z') $$, 'P0001', 'Período inválido.',
  'período invertido: recusa');

-- 7: administrador que não é dono
select set_config('request.jwt.claims', '{"sub":"f5300000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.agentes_numeros('2026-10-01 03:00Z', '2026-11-01 03:00Z')), 7, 'administrador vê os números');

-- 8–10: quem treina vê o uso das skills, não os números
select set_config('request.jwt.claims', '{"sub":"f5300000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select * from public.agentes_numeros('2026-10-01 03:00Z', '2026-11-01 03:00Z') $$, 'P0001',
  'Só o dono e o administrador veem os números dos agentes.', 'quem treina não vê custos');
select results_eq($$ select nome, vezes from public.uso_skills('atendimento', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$,
  $$ values ('conferencia-certidao', 2::bigint) $$, 'uso no mês só das skills do agente (D10)');
select throws_ok($$ select * from public.atividade_do_agente('atendimento', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$, 'P0001',
  'Só o dono e o administrador veem os números dos agentes.', 'nem a atividade');

select throws_ok($$ select * from public.uso_skills('atendimento', '2026-11-01 03:00Z', '2026-10-01 03:00Z') $$, 'P0001', 'Período inválido.',
  'uso das skills: período invertido recusa');

-- 11–13: sem Treinar o agente
select set_config('request.jwt.claims', '{"sub":"f5300000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select * from public.gastos_por_agente('2026-10-01 03:00Z', '2026-11-01 03:00Z') $$, 'P0001',
  'Só o administrador vê os gastos com IA.', 'Gastos por agente só do administrador');
select throws_ok($$ select * from public.uso_skills('atendimento', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$, 'P0001',
  'Você não tem acesso aos agentes.', 'uso das skills só de quem vê os agentes');
select throws_ok($$ select public.agente_do_uso(null, 'agente_clientes') $$, '42501', null, 'a regra interna não é da API');
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
