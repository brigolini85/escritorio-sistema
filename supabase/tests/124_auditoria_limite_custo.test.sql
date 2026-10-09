-- Auditoria 4.2, 5.2 e 4.12 (decisão D2): limite diário de gasto com IA por telefone, no dia de São Paulo, configurável
-- só pelo administrador; e a marcação do alerta de 80% do mês feita por uma chamada só.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('e1240000-0000-0000-0000-00000000000a', 'admin@t124.local'),
  ('e1240000-0000-0000-0000-000000000072', 'caio@t124.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e1240000-0000-0000-0000-00000000000a', 'Admin T124', 'admin@t124.local', 'admin', '{}'),
  ('e1240000-0000-0000-0000-000000000072', 'Caio T124', 'caio@t124.local', 'atendente', '{}');
update public.usuario_permissoes set nivel = 'sim' where usuario_id = 'e1240000-0000-0000-0000-000000000072' and modulo = 'configuracoes';

insert into public.conversas (id, telefone) values
  ('e1240000-0000-0000-0000-0000000000c1', '5531999991241'),
  ('e1240000-0000-0000-0000-0000000000c2', '5531999991242');

-- Meia-noite de hoje em São Paulo, como instante.
create function pg_temp.meia_noite_sp() returns timestamptz language sql as $$
  select date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
$$;
create function pg_temp.uso(p_conversa uuid, p_custo numeric, p_quando timestamptz) returns void language sql as $$
  insert into public.uso_ia (funcionalidade, conversa_id, modelo, tokens_entrada, tokens_saida, custo_usd, criado_em)
  values ('agente_clientes', p_conversa, 'claude-sonnet-5', 1, 1, p_custo, p_quando)
$$;

-- 1–4: colunas e padrões (D2)
select is((select limite_dia_contato_usd from public.configuracoes where id = 1), 2::numeric, 'contato cadastrado: US$ 2,00 por dia');
select is((select limite_dia_desconhecido_usd from public.configuracoes where id = 1), 0.30::numeric, 'número desconhecido: US$ 0,30 por dia');
select throws_ok($$ update public.configuracoes set limite_dia_contato_usd = -1 where id = 1 $$, '23514', null, 'limite negativo é recusado');
select throws_ok($$ update public.configuracoes set limite_dia_desconhecido_usd = null where id = 1 $$, '23502', null, 'limite vazio é recusado');

-- 5–9: a soma é do telefone e do dia de São Paulo
select pg_temp.uso('e1240000-0000-0000-0000-0000000000c1', 0.10, pg_temp.meia_noite_sp() - interval '1 minute');  -- 23h59 de ontem
select pg_temp.uso('e1240000-0000-0000-0000-0000000000c1', 0.20, pg_temp.meia_noite_sp());                         -- 0h00 de hoje
select pg_temp.uso('e1240000-0000-0000-0000-0000000000c1', 0.05, now());
select pg_temp.uso('e1240000-0000-0000-0000-0000000000c2', 1.00, now());                                            -- outro telefone
insert into public.uso_ia (funcionalidade, conversa_id, modelo, tokens_entrada, tokens_saida, custo_usd) values ('testar_agente', null, 'claude-sonnet-5', 1, 1, 3);  -- sem conversa
select is(public.custo_ia_do_telefone_hoje('5531999991241'), 0.25::numeric, 'soma só hoje (São Paulo): 23h59 de ontem não conta');
select is(public.custo_ia_do_telefone_hoje('5531999991242'), 1.00::numeric, 'cada telefone tem a sua soma');
select is(public.custo_ia_do_telefone_hoje('5531999990000'), 0::numeric, 'telefone sem gasto: zero');
select ok(not has_function_privilege('anon', 'public.custo_ia_do_telefone_hoje(text)', 'execute'), 'visitante não consulta');
select ok(not has_function_privilege('authenticated', 'public.custo_ia_do_telefone_hoje(text)', 'execute'), 'o painel não consulta (só o trabalhador)');

-- 10–13: alerta de 80% (4.12): só a primeira chamada do mês marca
update public.configuracoes set alerta_ia_80_mes = '2026-09' where id = 1;
select is(public.marcar_alerta_ia80('2026-10'), true, 'primeira chamada do mês marca');
select is(public.marcar_alerta_ia80('2026-10'), false, 'segunda chamada do mesmo mês não marca');
select is((select alerta_ia_80_mes from public.configuracoes where id = 1), '2026-10', 'o mês fica gravado');
select ok(not has_function_privilege('authenticated', 'public.marcar_alerta_ia80(text)', 'execute'), 'o painel não marca o alerta');

-- 14–17: só o administrador muda os limites
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'e1240000-0000-0000-0000-000000000072', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select throws_ok($$ update public.configuracoes set limite_dia_contato_usd = 50 where id = 1 $$, 'P0001',
  'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'Configurações Sim: não muda o limite do contato');
select throws_ok($$ update public.configuracoes set limite_dia_desconhecido_usd = 50 where id = 1 $$, 'P0001',
  'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'Configurações Sim: não muda o limite do desconhecido');
select set_config('request.jwt.claims', json_build_object('sub', 'e1240000-0000-0000-0000-00000000000a', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select lives_ok($$ update public.configuracoes set limite_dia_contato_usd = 3, limite_dia_desconhecido_usd = 0.5 where id = 1 $$,
  'o administrador muda os limites');
reset role;
select is((select limite_dia_contato_usd from public.configuracoes where id = 1), 3::numeric, 'limite gravado');

select * from finish();
rollback;
