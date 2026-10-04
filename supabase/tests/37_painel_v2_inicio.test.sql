-- Parte G2, Task 1 (spec 7C.1 e 7C.6): estado_sistema_resumo sem custos e legível por quem atende; números do agente só
-- para o administrador; demandas por setor contadas pela regra de leitura de cada pessoa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values
  ('e2000000-0000-0000-0000-00000000000a', 'admin@g2.local'), ('e2000000-0000-0000-0000-00000000000b', 'ana@g2.local'),
  ('e2000000-0000-0000-0000-00000000000c', 'arquivada@g2.local'), ('e2000000-0000-0000-0000-00000000000d', 'noite@g2.local');
insert into public.usuarios (id, nome, email, papel) values
  ('e2000000-0000-0000-0000-00000000000a', 'Admin G2', 'admin@g2.local', 'admin'),
  ('e2000000-0000-0000-0000-00000000000b', 'Ana G2', 'ana@g2.local', 'atendente'),
  ('e2000000-0000-0000-0000-00000000000c', 'Arquivada G2', 'arquivada@g2.local', 'atendente'),
  ('e2000000-0000-0000-0000-00000000000d', 'Noite G2', 'noite@g2.local', 'atendente');
update public.usuarios set ativo = false where id = 'e2000000-0000-0000-0000-00000000000c';
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'e2000000-0000-0000-0000-00000000000d';

insert into public.setores (id, nome, ativo) values
  ('e2100000-0000-0000-0000-000000000001', 'G2 Fiscal', true), ('e2100000-0000-0000-0000-000000000002', 'G2 Pessoal', true),
  ('e2100000-0000-0000-0000-000000000003', 'G2 Desligado', false), ('e2100000-0000-0000-0000-000000000004', 'G2 Antigo', false);
insert into public.usuario_setores (usuario_id, setor_id) values ('e2000000-0000-0000-0000-00000000000b', 'e2100000-0000-0000-0000-000000000002');

-- Agente pausado, teto longe; WhatsApp com sinal há 20 s; fila sem sinal há 10 min.
update public.configuracoes set agente_pausado = true, teto_ia_usd = 500000 where id = 1;
delete from public.sinais_vida;
insert into public.sinais_vida (componente, visto_em) values ('whatsapp', now() - interval '20 seconds'), ('fila', now() - interval '10 minutes');

-- 1–8: estrutura e quem executa
select has_function('public', 'estado_sistema_resumo', 'estado existe');
select has_function('public', 'agente_numeros_hoje', 'números do agente existem');
select has_function('public', 'demandas_por_setor', 'demandas por setor existe');
select is((select provolatile::text from pg_proc where oid = 'public.estado_sistema_resumo()'::regprocedure), 's', 'estado é stable: não grava');
select ok(not (select prosecdef from pg_proc where oid = 'public.demandas_por_setor(timestamptz)'::regprocedure),
  'por setor roda com a regra de leitura de quem chama');
select ok(not has_function_privilege('anon', 'public.estado_sistema_resumo()', 'execute'), 'anon não lê o estado');
select ok(not has_function_privilege('anon', 'public.agente_numeros_hoje(timestamptz)', 'execute'), 'anon não lê os números');
select ok(not has_function_privilege('anon', 'public.demandas_por_setor(timestamptz)', 'execute'), 'anon não lê por setor');

-- 9–13: quem atende, sem permissão nenhuma, lê o estado; nenhuma chave e nenhum número de custo
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.estado_sistema_resumo() $$, 'atendente lê o estado');
select is((select array_agg(k order by k) from jsonb_object_keys(public.estado_sistema_resumo()) k),
  array['agente_pausado', 'teto_atingido', 'trabalhador_ok', 'verificado_em', 'whatsapp_conectado'], 'só as cinco chaves');
select ok(not jsonb_path_exists(public.estado_sistema_resumo(), '$.* ? (@.type() == "number")'), 'nenhum número: nada de gasto, teto ou cotação');
select is(public.estado_sistema_resumo() - 'verificado_em',
  '{"agente_pausado":true,"teto_atingido":false,"whatsapp_conectado":true,"trabalhador_ok":false}'::jsonb,
  'pausado; teto longe; WhatsApp com sinal; fila parada');
reset role;
insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd, funcionalidade) values ('g2-teste', 1, 1, 600000, 'agente_clientes');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((public.estado_sistema_resumo() ->> 'teto_atingido')::boolean, true, 'gasto do mês passou do teto: só o sim, sem o valor');

-- 14–16: arquivada, fora do horário e visitante
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.estado_sistema_resumo(), null::jsonb, 'arquivada: nada');
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(public.estado_sistema_resumo(), null::jsonb, 'fora do horário: nada');
reset role;
set local role anon;
select throws_ok($$ select public.estado_sistema_resumo() $$, '42501', null, 'visitante: recusado');
reset role;

-- Conversas de 12/03/2025 (data fixa, longe dos dados do seed): A só com o agente; B a equipe respondeu; C é da noite
-- de 11/03; D o agente passou para pessoa e ninguém pegou.
insert into public.conversas (id, telefone) values
  ('e2200000-0000-0000-0000-00000000000a', '5531970000001'), ('e2200000-0000-0000-0000-00000000000b', '5531970000002'),
  ('e2200000-0000-0000-0000-00000000000c', '5531970000003'), ('e2200000-0000-0000-0000-00000000000d', '5531970000004');
insert into public.mensagens (conversa_id, direcao, autor, conteudo, criado_em) values
  ('e2200000-0000-0000-0000-00000000000a', 'entrada', 'cliente', 'oi', '2025-03-12 09:00-03'),
  ('e2200000-0000-0000-0000-00000000000a', 'saida', 'agente', 'olá', '2025-03-12 09:01-03'),
  ('e2200000-0000-0000-0000-00000000000b', 'entrada', 'cliente', 'oi', '2025-03-12 10:00-03'),
  ('e2200000-0000-0000-0000-00000000000b', 'saida', 'atendente', 'pois não', '2025-03-12 10:05-03'),
  ('e2200000-0000-0000-0000-00000000000c', 'entrada', 'cliente', 'oi', '2025-03-11 23:30-03'),
  ('e2200000-0000-0000-0000-00000000000d', 'entrada', 'cliente', 'quero falar com alguém', '2025-03-12 11:00-03');
insert into public.conversa_eventos (conversa_id, tipo, criado_em) values ('e2200000-0000-0000-0000-00000000000d', 'passou_para_pessoa', '2025-03-12 11:01-03');

-- 17–19: números do agente
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.agente_numeros_hoje('2025-03-12 15:00-03') $$, 'P0001', 'Só o administrador vê os números do agente.', 'atendente: recusado');
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(public.agente_numeros_hoje('2025-03-12 15:00-03'), '{"conversas":3,"resolvidas_agente":1}'::jsonb,
  'A, B e D falaram hoje; só A resolvida pelo agente (B teve a equipe, D passou para pessoa)');
select is(public.agente_numeros_hoje('2025-03-12 01:00+00'), '{"conversas":1,"resolvidas_agente":1}'::jsonb,
  '01:00 UTC ainda é dia 11 em Brasília: só C');
reset role;

-- Demandas: as abertas da Triagem do seed saem da conta (a Triagem conta o banco inteiro).
update public.chamados set status = 'concluido', concluido_em = coalesce(concluido_em, now()) where setor_id is null and status <> 'concluido';
insert into public.chamados (id, setor_id, titulo, prioridade, prazo_em, responsavel_id) values
  ('e2300000-0000-0000-0000-000000000001', 'e2100000-0000-0000-0000-000000000001', 'G2 vence hoje', 'urgente', '2025-03-12 18:00-03', null),
  ('e2300000-0000-0000-0000-000000000002', 'e2100000-0000-0000-0000-000000000001', 'G2 vencida', 'normal', '2025-03-11 18:00-03', 'e2000000-0000-0000-0000-00000000000a'),
  ('e2300000-0000-0000-0000-000000000003', 'e2100000-0000-0000-0000-000000000001', 'G2 no prazo', 'normal', '2025-03-20 18:00-03', null),
  ('e2300000-0000-0000-0000-000000000006', 'e2100000-0000-0000-0000-000000000001', 'G2 venceu de manhã', 'alta', '2025-03-12 09:00-03', null),
  ('e2300000-0000-0000-0000-000000000007', 'e2100000-0000-0000-0000-000000000002', 'G2 Pessoal vencida', 'normal', '2025-03-11 18:00-03', null),
  ('e2300000-0000-0000-0000-000000000008', 'e2100000-0000-0000-0000-000000000004', 'G2 setor antigo', 'baixa', '2025-03-20 18:00-03', null),
  ('e2300000-0000-0000-0000-000000000009', null, 'G2 triagem', 'normal', '2025-03-20 18:00-03', null);
insert into public.chamados (id, setor_id, titulo, prioridade, prazo_em, status, prazo_pausado_desde) values
  ('e2300000-0000-0000-0000-000000000004', 'e2100000-0000-0000-0000-000000000001', 'G2 com o cliente', 'normal', '2025-03-11 18:00-03',
   'aguardando_cliente', '2025-03-10 10:00-03');
insert into public.chamados (id, setor_id, titulo, prioridade, prazo_em, status, concluido_em) values
  ('e2300000-0000-0000-0000-000000000005', 'e2100000-0000-0000-0000-000000000001', 'G2 concluída', 'urgente', '2025-03-11 18:00-03',
   'concluido', '2025-03-11 12:00-03');

-- 20–25: o administrador vê tudo
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select results_eq(
  $$ select abertas, no_prazo, vencem_hoje, vencidas, sem_responsavel, urgentes from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Fiscal' $$,
  $$ values (5, 2, 1, 2, 4, 1) $$,
  'Fiscal: "Com o cliente" conta no prazo; a de 09:00 já venceu (não "vence hoje"); concluída fora');
select results_eq(
  $$ select abertas, no_prazo, vencem_hoje, vencidas, sem_responsavel, urgentes from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Pessoal' $$,
  $$ values (1, 0, 0, 1, 1, 0) $$, 'Pessoal: uma vencida sem responsável');
select is((select abertas from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Antigo'), 1, 'setor desativado com aberta continua');
select is((select count(*)::int from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Desligado'), 0, 'setor desativado sem aberta sai');
select is((select t.setor from public.demandas_por_setor('2025-03-12 15:00-03') with ordinality t order by t.ordinality desc limit 1),
  'Triagem', 'Triagem por último');
select results_eq($$ select setor_id is null, abertas from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'Triagem' $$,
  $$ values (true, 1) $$, 'Triagem: sem setor');

-- 26–29: Ana ("Do meu setor", só Pessoal) conta só o que vê
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select results_eq($$ select abertas, vencidas, sem_responsavel from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Fiscal' $$,
  $$ values (0, 0, 0) $$, 'Ana não conta o Fiscal');
select results_eq($$ select abertas, vencidas, sem_responsavel from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Pessoal' $$,
  $$ values (1, 1, 1) $$, 'Ana conta o Pessoal');
select is((select count(*)::int from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Antigo'), 0, 'setor desativado que ela não vê: fora');
select is((select abertas from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'Triagem'), 0, 'Triagem: ela não vê');

-- 30: "Só as minhas": nem o setor dela conta
reset role;
update public.usuario_permissoes set nivel = 'minhas' where usuario_id = 'e2000000-0000-0000-0000-00000000000b' and modulo = 'demandas';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select results_eq($$ select abertas from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Pessoal' $$,
  $$ values (0) $$, '"Só as minhas": nada sem responsável no setor');
reset role;

select * from finish();
rollback;
