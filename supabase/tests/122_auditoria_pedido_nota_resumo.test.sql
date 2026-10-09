-- Auditoria 1.1 e 5.5: o pedido de nota só abre com um resumo que o cliente respondeu depois de recebê-lo, numa vez
-- anterior, da empresa em foco, nas últimas 24 h, e uma vez só (consumir_resumo_nota).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into public.clientes (id, razao_social, cnpj) values
  ('e1220000-0000-0000-0000-00000000000a', 'T122 A Ltda', '11222333000181'),
  ('e1220000-0000-0000-0000-00000000000b', 'T122 B Ltda', '11222333000262');
insert into public.conversas (id, telefone) values ('e1220000-0000-0000-0000-0000000000c1', '5531999991220');
-- No pgTAP tudo roda numa transação (now() parado): as horas das mensagens e dos resumos vão explícitas.
insert into public.mensagens (id, conversa_id, direcao, autor, conteudo, status_envio, criado_em) values
  -- Resumo 1: enviado às 10:00; o cliente respondeu às 10:05.
  ('e1220000-0000-0000-0000-0000000000a1', 'e1220000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'Resumo 1', 'enviada', now() - interval '60 min'),
  ('e1220000-0000-0000-0000-0000000000e1', 'e1220000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'sim', null, now() - interval '55 min'),
  -- Resumo 2: gravado como saída às 10:10, mas o resumo só ficou registrado às 10:12; a entrada das 10:11 chegou no meio.
  ('e1220000-0000-0000-0000-0000000000a2', 'e1220000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'Resumo 2', 'enviada', now() - interval '50 min'),
  ('e1220000-0000-0000-0000-0000000000e2', 'e1220000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'oi', null, now() - interval '49 min'),
  -- Resumo 3: a saída ficou pendente (não chegou ao cliente).
  ('e1220000-0000-0000-0000-0000000000a3', 'e1220000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'Resumo 3', 'pendente', now() - interval '70 min');

insert into public.pedidos_nota_resumo (id, conversa_id, cliente_id, turno, mensagem_resumo_id, pedido, hash, criado_em) values
  ('e1220000-0000-0000-0000-000000000001', 'e1220000-0000-0000-0000-0000000000c1', 'e1220000-0000-0000-0000-00000000000a', 't1',
   'e1220000-0000-0000-0000-0000000000a1', '{"x": 1}', 'h1', now() - interval '60 min'),
  ('e1220000-0000-0000-0000-000000000002', 'e1220000-0000-0000-0000-0000000000c1', 'e1220000-0000-0000-0000-00000000000a', 't2',
   'e1220000-0000-0000-0000-0000000000a2', '{"x": 2}', 'h2', now() - interval '48 min'),
  ('e1220000-0000-0000-0000-000000000003', 'e1220000-0000-0000-0000-0000000000c1', 'e1220000-0000-0000-0000-00000000000a', 't3',
   'e1220000-0000-0000-0000-0000000000a3', '{"x": 3}', 'h3', now() - interval '70 min'),
  -- Resumo 4: de 25 h atrás.
  ('e1220000-0000-0000-0000-000000000004', 'e1220000-0000-0000-0000-0000000000c1', 'e1220000-0000-0000-0000-00000000000a', 't4',
   'e1220000-0000-0000-0000-0000000000a1', '{"x": 4}', 'h4', now() - interval '25 hours');

-- 1–5: catálogo e acesso
select has_table('public', 'pedidos_nota_resumo', 'tabela dos resumos de nota');
select ok((select relrowsecurity from pg_class where oid = 'public.pedidos_nota_resumo'::regclass), 'RLS ligada');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'pedidos_nota_resumo'), 0,
  'sem política: o painel não lê nem grava');
select ok(not has_function_privilege('authenticated', 'public.consumir_resumo_nota(uuid, uuid, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.consumir_resumo_nota(uuid, uuid, uuid, text)', 'execute'),
  'só o trabalhador consome');
select ok(has_function_privilege('service_role', 'public.consumir_resumo_nota(uuid, uuid, uuid, text)', 'execute'), 'o trabalhador consome');

-- 6–8: quem está logado no painel não enxerga nem grava
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e1220000-0000-0000-0000-0000000000ff", "role": "authenticated"}', true);
select throws_ok($$ select count(*) from public.pedidos_nota_resumo $$, '42501', null, 'authenticated não lê a tabela');
select throws_ok($$ update public.pedidos_nota_resumo set usado_em = now() $$, '42501', null, 'authenticated não grava');
select throws_ok($$ select public.consumir_resumo_nota('e1220000-0000-0000-0000-000000000001', 'e1220000-0000-0000-0000-0000000000c1',
  'e1220000-0000-0000-0000-00000000000a', 't9') $$, '42501', null, 'authenticated não chama a função');
reset role;

set local role service_role;
-- 9: mesma vez do resumo
select is(public.consumir_resumo_nota('e1220000-0000-0000-0000-000000000001', 'e1220000-0000-0000-0000-0000000000c1',
  'e1220000-0000-0000-0000-00000000000a', 't1') ->> 'motivo', 'mesmo_turno', 'na mesma vez do resumo: recusado');
-- 10: vez sem identificação
select is(public.consumir_resumo_nota('e1220000-0000-0000-0000-000000000001', 'e1220000-0000-0000-0000-0000000000c1',
  'e1220000-0000-0000-0000-00000000000a', null) ->> 'motivo', 'mesmo_turno', 'vez sem identificação: recusado');
-- 11: empresa em foco diferente
select is(public.consumir_resumo_nota('e1220000-0000-0000-0000-000000000001', 'e1220000-0000-0000-0000-0000000000c1',
  'e1220000-0000-0000-0000-00000000000b', 't9') ->> 'motivo', 'outra_empresa', 'foco em outra empresa: recusado');
-- 12: conversa diferente
select is(public.consumir_resumo_nota('e1220000-0000-0000-0000-000000000001', 'e1220000-0000-0000-0000-0000000000c9',
  'e1220000-0000-0000-0000-00000000000a', 't9') ->> 'motivo', 'nao_encontrado', 'outra conversa: não encontrado');
-- 13: entrada que chegou antes de o resumo ficar registrado como enviado
select is(public.consumir_resumo_nota('e1220000-0000-0000-0000-000000000002', 'e1220000-0000-0000-0000-0000000000c1',
  'e1220000-0000-0000-0000-00000000000a', 't9') ->> 'motivo', 'sem_resposta', 'a entrada no meio do envio não confirma');
-- 14: saída que não chegou ao cliente
select is(public.consumir_resumo_nota('e1220000-0000-0000-0000-000000000003', 'e1220000-0000-0000-0000-0000000000c1',
  'e1220000-0000-0000-0000-00000000000a', 't9') ->> 'motivo', 'sem_envio', 'resumo não enviado: recusado');
-- 15: mais de 24 h
select is(public.consumir_resumo_nota('e1220000-0000-0000-0000-000000000004', 'e1220000-0000-0000-0000-0000000000c1',
  'e1220000-0000-0000-0000-00000000000a', 't9') ->> 'motivo', 'expirado', 'resumo de mais de 24 h: recusado');
-- 16–17: tudo certo: consome e devolve o pedido
select is(public.consumir_resumo_nota('e1220000-0000-0000-0000-000000000001', 'e1220000-0000-0000-0000-0000000000c1',
  'e1220000-0000-0000-0000-00000000000a', 't9'), '{"ok": true, "pedido": {"x": 1}}'::jsonb, 'resumo respondido: consome');
select isnt((select usado_em from public.pedidos_nota_resumo where id = 'e1220000-0000-0000-0000-000000000001'), null, 'marcado como usado');
-- 18–20: uma vez só; depois de vinculado, devolve o número da demanda
select is(public.consumir_resumo_nota('e1220000-0000-0000-0000-000000000001', 'e1220000-0000-0000-0000-0000000000c1',
  'e1220000-0000-0000-0000-00000000000a', 't10'), '{"ok": false, "motivo": "ja_usado", "numero": null}'::jsonb, 'segunda vez: já usado');
reset role;
insert into public.chamados (id, cliente_id, conversa_id, titulo)
  values ('e1220000-0000-0000-0000-0000000000d1', 'e1220000-0000-0000-0000-00000000000a', 'e1220000-0000-0000-0000-0000000000c1', 'NF T122');
update public.pedidos_nota_resumo set chamado_id = 'e1220000-0000-0000-0000-0000000000d1' where id = 'e1220000-0000-0000-0000-000000000001';
set local role service_role;
select is((public.consumir_resumo_nota('e1220000-0000-0000-0000-000000000001', 'e1220000-0000-0000-0000-0000000000c1',
  'e1220000-0000-0000-0000-00000000000a', 't11') ->> 'numero')::bigint,
  (select numero from public.chamados where id = 'e1220000-0000-0000-0000-0000000000d1'), 'já usado: devolve o número da demanda aberta');
select is((select usado_em is not null and chamado_id is not null from public.pedidos_nota_resumo where id = 'e1220000-0000-0000-0000-000000000001'),
  true, 'continua usado e vinculado');

select * from finish();
rollback;
