-- Auditoria 1.2, 5.4 e 1.7: preço e produto só mudam pelo WhatsApp com o "sim" do cliente a uma pergunta que o sistema
-- mandou, numa vez seguinte, em até 30 min e uma vez só (usar_confirmacao). As funções do agente exigem contato e empresa
-- ativos e perfil diferente de Básico (decisão D1).
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into public.clientes (id, razao_social, cnpj) values
  ('e1230000-0000-0000-0000-00000000000a', 'T123 A Ltda', '11222333000181'),
  ('e1230000-0000-0000-0000-00000000000b', 'T123 Inativa Ltda', '11222333000262');
update public.clientes set ativo = false where id = 'e1230000-0000-0000-0000-00000000000b';
insert into public.parceiros_grupos (id, cliente_id, tipo, nome) values
  ('e1230000-0000-0000-0000-0000000000f1', 'e1230000-0000-0000-0000-00000000000a', 'cliente', 'Supermercado Brasil'),
  ('e1230000-0000-0000-0000-0000000000f2', 'e1230000-0000-0000-0000-00000000000b', 'cliente', 'Rede da Inativa');
insert into public.produtos (id, cliente_id, codigo, descricao, unidade) values
  ('e1230000-0000-0000-0000-0000000000d1', 'e1230000-0000-0000-0000-00000000000a', '12', 'Costela', 'PAC'),
  ('e1230000-0000-0000-0000-0000000000d2', 'e1230000-0000-0000-0000-00000000000b', '12', 'Costela', 'PAC');
insert into public.precos (cliente_id, grupo_id, produto_id, valor) values
  ('e1230000-0000-0000-0000-00000000000a', 'e1230000-0000-0000-0000-0000000000f1', 'e1230000-0000-0000-0000-0000000000d1', 9.5);
insert into public.contatos (id, nome, telefone) values
  ('e1230000-0000-0000-0000-0000000000b1', 'Luana', '5531999991231'),
  ('e1230000-0000-0000-0000-0000000000b2', 'Básica', '5531999991232'),
  ('e1230000-0000-0000-0000-0000000000b3', 'Arquivada', '5531999991233');
update public.contatos set ativo = false where id = 'e1230000-0000-0000-0000-0000000000b3';
insert into public.contato_clientes (contato_id, cliente_id, perfil, pode_atualizar_preco) values
  ('e1230000-0000-0000-0000-0000000000b1', 'e1230000-0000-0000-0000-00000000000a', 'personalizado', true),
  ('e1230000-0000-0000-0000-0000000000b1', 'e1230000-0000-0000-0000-00000000000b', 'personalizado', true),
  ('e1230000-0000-0000-0000-0000000000b2', 'e1230000-0000-0000-0000-00000000000a', 'basico', true),
  ('e1230000-0000-0000-0000-0000000000b3', 'e1230000-0000-0000-0000-00000000000a', 'personalizado', true);

-- 1–7: 1.7 e D1: as funções do agente olham contato, empresa e perfil
select lives_ok($$ select public.definir_preco_agente('e1230000-0000-0000-0000-0000000000f1', 'e1230000-0000-0000-0000-0000000000d1', 9.8,
  'e1230000-0000-0000-0000-0000000000b1') $$, 'contato ativo, Personalizado e com a marcação muda o preço');
select throws_ok($$ select public.definir_preco_agente('e1230000-0000-0000-0000-0000000000f1', 'e1230000-0000-0000-0000-0000000000d1', 1,
  'e1230000-0000-0000-0000-0000000000b2') $$, 'P0001', 'contato sem permissão para mudar preço', 'Básico com a marcação antiga não muda preço (D1)');
select throws_ok($$ select public.definir_preco_agente('e1230000-0000-0000-0000-0000000000f1', 'e1230000-0000-0000-0000-0000000000d1', 1,
  'e1230000-0000-0000-0000-0000000000b3') $$, 'P0001', 'contato sem permissão para mudar preço', 'contato arquivado não muda preço (1.7)');
select throws_ok($$ select public.definir_preco_agente('e1230000-0000-0000-0000-0000000000f2', 'e1230000-0000-0000-0000-0000000000d2', 1,
  'e1230000-0000-0000-0000-0000000000b1') $$, 'P0001', 'contato sem permissão para mudar preço', 'empresa inativa: não muda preço (1.7)');
select throws_ok($$ select public.cadastrar_produto_agente('e1230000-0000-0000-0000-00000000000a', '40', 'Rosca', 'UN', '{}',
  'e1230000-0000-0000-0000-0000000000b2') $$, 'P0001', 'contato sem permissão para cadastrar produto', 'Básico não cadastra produto (D1)');
select throws_ok($$ select public.cadastrar_produto_agente('e1230000-0000-0000-0000-00000000000a', '40', 'Rosca', 'UN', '{}',
  'e1230000-0000-0000-0000-0000000000b3') $$, 'P0001', 'contato sem permissão para cadastrar produto', 'contato arquivado não cadastra produto (1.7)');
select throws_ok($$ select public.cadastrar_produto_agente('e1230000-0000-0000-0000-00000000000b', '40', 'Rosca', 'UN', '{}',
  'e1230000-0000-0000-0000-0000000000b1') $$, 'P0001', 'contato sem permissão para cadastrar produto', 'empresa inativa: não cadastra produto (1.7)');

-- Conversa da Luana. No pgTAP tudo roda numa transação (now() parado): as horas vão explícitas.
insert into public.conversas (id, telefone, contato_id) values
  ('e1230000-0000-0000-0000-0000000000c1', '5531999991231', 'e1230000-0000-0000-0000-0000000000b1'),
  ('e1230000-0000-0000-0000-0000000000c2', '5531999991232', 'e1230000-0000-0000-0000-0000000000b2');
insert into public.mensagens (id, conversa_id, direcao, autor, conteudo, status_envio, criado_em) values
  ('e1230000-0000-0000-0000-0000000000a1', 'e1230000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'Confirma preço?', 'enviada', now() - interval '10 min'),
  ('e1230000-0000-0000-0000-0000000000a2', 'e1230000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'Confirma cadastro?', 'enviada', now() - interval '9 min'),
  ('e1230000-0000-0000-0000-0000000000e1', 'e1230000-0000-0000-0000-0000000000c1', 'entrada', 'cliente', 'sim', null, now() - interval '5 min'),
  ('e1230000-0000-0000-0000-0000000000a3', 'e1230000-0000-0000-0000-0000000000c1', 'saida', 'agente', 'Confirma sem resposta?', 'enviada', now() - interval '2 min'),
  ('e1230000-0000-0000-0000-0000000000a4', 'e1230000-0000-0000-0000-0000000000c2', 'saida', 'agente', 'Confirma Básica?', 'enviada', now() - interval '10 min'),
  ('e1230000-0000-0000-0000-0000000000e4', 'e1230000-0000-0000-0000-0000000000c2', 'entrada', 'cliente', 'sim', null, now() - interval '5 min');

insert into public.confirmacoes_cliente (id, conversa_id, contato_id, cliente_id, tipo, dados, valor_antigo, mensagem_pergunta_id, turno, criado_em, expira_em) values
  -- 1: preço de 9,80 para 10,00, respondido.
  ('e1230000-0000-0000-0000-000000000001', 'e1230000-0000-0000-0000-0000000000c1', 'e1230000-0000-0000-0000-0000000000b1', 'e1230000-0000-0000-0000-00000000000a',
   'preco', '{"grupo_id": "e1230000-0000-0000-0000-0000000000f1", "produto_id": "e1230000-0000-0000-0000-0000000000d1", "novo_valor": 10}', 9.8,
   'e1230000-0000-0000-0000-0000000000a1', 't1', now() - interval '10 min', now() + interval '20 min'),
  -- 2: produto novo, respondido.
  ('e1230000-0000-0000-0000-000000000002', 'e1230000-0000-0000-0000-0000000000c1', 'e1230000-0000-0000-0000-0000000000b1', 'e1230000-0000-0000-0000-00000000000a',
   'produto', '{"codigo": "30", "descricao": "Lasanha", "unidade": "PAC", "apelidos": ["lasanha"]}', null,
   'e1230000-0000-0000-0000-0000000000a2', 't1', now() - interval '9 min', now() + interval '21 min'),
  -- 3: pergunta sem resposta depois dela.
  ('e1230000-0000-0000-0000-000000000003', 'e1230000-0000-0000-0000-0000000000c1', 'e1230000-0000-0000-0000-0000000000b1', 'e1230000-0000-0000-0000-00000000000a',
   'preco', '{"grupo_id": "e1230000-0000-0000-0000-0000000000f1", "produto_id": "e1230000-0000-0000-0000-0000000000d1", "novo_valor": 11}', 9.8,
   'e1230000-0000-0000-0000-0000000000a3', 't2', now() - interval '2 min', now() + interval '28 min'),
  -- 4: vencida (perguntada há 31 min).
  ('e1230000-0000-0000-0000-000000000004', 'e1230000-0000-0000-0000-0000000000c1', 'e1230000-0000-0000-0000-0000000000b1', 'e1230000-0000-0000-0000-00000000000a',
   'preco', '{"grupo_id": "e1230000-0000-0000-0000-0000000000f1", "produto_id": "e1230000-0000-0000-0000-0000000000d1", "novo_valor": 12}', 9.8,
   'e1230000-0000-0000-0000-0000000000a1', 't0', now() - interval '31 min', now() - interval '1 min'),
  -- 5: o preço vigente não é mais o da pergunta (mudou no painel).
  ('e1230000-0000-0000-0000-000000000005', 'e1230000-0000-0000-0000-0000000000c1', 'e1230000-0000-0000-0000-0000000000b1', 'e1230000-0000-0000-0000-00000000000a',
   'preco', '{"grupo_id": "e1230000-0000-0000-0000-0000000000f1", "produto_id": "e1230000-0000-0000-0000-0000000000d1", "novo_valor": 13}', 9.5,
   'e1230000-0000-0000-0000-0000000000a1', 't1', now() - interval '10 min', now() + interval '20 min'),
  -- 6: contato Básico que respondeu "sim" (perguntado com o preço que a confirmação 1 deixa vigente).
  ('e1230000-0000-0000-0000-000000000006', 'e1230000-0000-0000-0000-0000000000c2', 'e1230000-0000-0000-0000-0000000000b2', 'e1230000-0000-0000-0000-00000000000a',
   'preco', '{"grupo_id": "e1230000-0000-0000-0000-0000000000f1", "produto_id": "e1230000-0000-0000-0000-0000000000d1", "novo_valor": 1}', 10,
   'e1230000-0000-0000-0000-0000000000a4', 't1', now() - interval '10 min', now() + interval '20 min');

-- 8–13: catálogo e acesso
select has_table('public', 'confirmacoes_cliente', 'tabela das confirmações do cliente');
select ok((select relrowsecurity from pg_class where oid = 'public.confirmacoes_cliente'::regclass), 'RLS ligada');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'confirmacoes_cliente'), 0,
  'sem política: o painel não lê nem grava');
select ok(not has_function_privilege('authenticated', 'public.usar_confirmacao(uuid, uuid, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.usar_confirmacao(uuid, uuid, uuid, text)', 'execute'), 'só o trabalhador usa');
select ok(has_function_privilege('service_role', 'public.usar_confirmacao(uuid, uuid, uuid, text)', 'execute'), 'o trabalhador usa');
select ok((select bool_and(p.proconfig @> array['search_path=""']) from pg_proc p
  where p.oid in ('public.definir_preco_agente(uuid, uuid, numeric, uuid)'::regprocedure,
                  'public.cadastrar_produto_agente(uuid, text, text, text, text[], uuid)'::regprocedure)), 'funções do agente com search_path vazio');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e1230000-0000-0000-0000-0000000000ff", "role": "authenticated"}', true);
-- 14–15
select throws_ok($$ select count(*) from public.confirmacoes_cliente $$, '42501', null, 'authenticated não lê a tabela');
select throws_ok($$ select public.usar_confirmacao('e1230000-0000-0000-0000-000000000001', 'e1230000-0000-0000-0000-0000000000c1',
  'e1230000-0000-0000-0000-0000000000b1', 't9') $$, '42501', null, 'authenticated não chama a função');
reset role;

set local role service_role;
-- 16–21: recusas
select is(public.usar_confirmacao('e1230000-0000-0000-0000-000000000001', 'e1230000-0000-0000-0000-0000000000c1',
  'e1230000-0000-0000-0000-0000000000b1', 't1') ->> 'motivo', 'mesmo_turno', 'na mesma vez da pergunta: recusado');
select is(public.usar_confirmacao('e1230000-0000-0000-0000-000000000001', 'e1230000-0000-0000-0000-0000000000c1',
  'e1230000-0000-0000-0000-0000000000b1', null) ->> 'motivo', 'mesmo_turno', 'vez sem identificação: recusado');
select is(public.usar_confirmacao('e1230000-0000-0000-0000-000000000001', 'e1230000-0000-0000-0000-0000000000c1',
  'e1230000-0000-0000-0000-0000000000b2', 't9') ->> 'motivo', 'nao_encontrado', 'outro contato: não encontrado');
select is(public.usar_confirmacao('e1230000-0000-0000-0000-000000000003', 'e1230000-0000-0000-0000-0000000000c1',
  'e1230000-0000-0000-0000-0000000000b1', 't9') ->> 'motivo', 'sem_resposta', 'sem resposta do cliente depois da pergunta');
select is(public.usar_confirmacao('e1230000-0000-0000-0000-000000000004', 'e1230000-0000-0000-0000-0000000000c1',
  'e1230000-0000-0000-0000-0000000000b1', 't9') ->> 'motivo', 'expirado', 'mais de 30 min: recusado');
select is(public.usar_confirmacao('e1230000-0000-0000-0000-000000000005', 'e1230000-0000-0000-0000-0000000000c1',
  'e1230000-0000-0000-0000-0000000000b1', 't9') ->> 'motivo', 'preco_mudou', 'preço mudou depois da pergunta: recusado');
-- 22–25: preço confirmado: aplica uma vez só
select is(public.usar_confirmacao('e1230000-0000-0000-0000-000000000001', 'e1230000-0000-0000-0000-0000000000c1',
  'e1230000-0000-0000-0000-0000000000b1', 't9') - 'preco_id' - 'dados',
  '{"ok": true, "tipo": "preco", "valor_antigo": 9.8, "valor_novo": 10}'::jsonb, 'resposta depois da pergunta: aplica');
select is((select valor from public.precos where grupo_id = 'e1230000-0000-0000-0000-0000000000f1' and vigente_ate is null), 10.00::numeric,
  'preço novo vigente');
select is(public.usar_confirmacao('e1230000-0000-0000-0000-000000000001', 'e1230000-0000-0000-0000-0000000000c1',
  'e1230000-0000-0000-0000-0000000000b1', 't10') ->> 'motivo', 'ja_usado', 'segunda vez: já usado');
select is((select count(*)::int from public.precos where grupo_id = 'e1230000-0000-0000-0000-0000000000f1' and valor = 10), 1,
  'uma linha nova em precos');
-- 26–27: produto confirmado
select is(public.usar_confirmacao('e1230000-0000-0000-0000-000000000002', 'e1230000-0000-0000-0000-0000000000c1',
  'e1230000-0000-0000-0000-0000000000b1', 't9') ->> 'ok', 'true', 'cadastro confirmado: aplica');
select is((select descricao || '|' || unidade from public.produtos where cliente_id = 'e1230000-0000-0000-0000-00000000000a' and codigo = '30'),
  'Lasanha|PAC', 'produto cadastrado');
-- 28–29: Básico que respondeu "sim": recusado no banco e a confirmação não fica usada
select throws_ok($$ select public.usar_confirmacao('e1230000-0000-0000-0000-000000000006', 'e1230000-0000-0000-0000-0000000000c2',
  'e1230000-0000-0000-0000-0000000000b2', 't9') $$, 'P0001', 'contato sem permissão para mudar preço', 'Básico: recusado no banco');
select is((select usado_em from public.confirmacoes_cliente where id = 'e1230000-0000-0000-0000-000000000006'), null,
  'a recusa desfaz o uso');
-- 30–31: o preço da recusa não mudou
select is((select count(*)::int from public.precos where valor = 1), 0, 'nenhum preço de R$ 1');
select is((select usado_em is null from public.confirmacoes_cliente where id = 'e1230000-0000-0000-0000-000000000005'), true,
  'preco_mudou não consome');

select * from finish();
rollback;
