-- Parte G3, Task 1 (spec 7C.2 e 7C.6): visão contatos_lista e resumo do WhatsApp do contato, os dois com a regra de leitura
-- de quem consulta (security invoker, D2); marcações e vínculos por empresa com a mesma permissão de hoje.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, email) values
  ('e3000000-0000-0000-0000-00000000000a', 'admin@g3.local'), ('e3000000-0000-0000-0000-00000000000b', 'ana@g3.local'),
  ('e3000000-0000-0000-0000-00000000000c', 'arquivada@g3.local');
insert into public.usuarios (id, nome, email, papel) values
  ('e3000000-0000-0000-0000-00000000000a', 'Admin G3', 'admin@g3.local', 'admin'),
  ('e3000000-0000-0000-0000-00000000000b', 'Ana G3', 'ana@g3.local', 'atendente'),
  ('e3000000-0000-0000-0000-00000000000c', 'Arquivada G3', 'arquivada@g3.local', 'atendente');
update public.usuarios set ativo = false where id = 'e3000000-0000-0000-0000-00000000000c';
insert into public.setores (id, nome, ativo) values ('e3100000-0000-0000-0000-000000000001', 'G3 Fiscal', true);
insert into public.usuario_setores (usuario_id, setor_id) values ('e3000000-0000-0000-0000-00000000000b', 'e3100000-0000-0000-0000-000000000001');

-- Empresas: Alfa e Beta ativas; Zeta arquivada.
insert into public.clientes (id, razao_social, nome_fantasia, cnpj, ativo) values
  ('e3200000-0000-0000-0000-00000000000a', 'G3 Alfa', null, '33000000000101', true),
  ('e3200000-0000-0000-0000-00000000000b', 'G3 Beta Ltda', 'Beta Fantasia', '33000000000202', true),
  ('e3200000-0000-0000-0000-00000000000c', 'G3 Zeta', null, '33000000000303', false);
-- Carla: Alfa (pede nota), Beta (nada) e Zeta (muda preço, mas a empresa está arquivada). Rui: sem empresa, agente desligado.
-- Paula: Beta; a conversa dela está ligada só pelo telefone.
insert into public.contatos (id, nome, telefone, agente_pausado) values
  ('e3300000-0000-0000-0000-000000000001', 'G3 Carla', '5531980000001', false),
  ('e3300000-0000-0000-0000-000000000002', 'G3 Rui', '5531980000002', true),
  ('e3300000-0000-0000-0000-000000000003', 'G3 Paula', '5531980000003', false);
insert into public.contato_clientes (contato_id, cliente_id, pode_pedir_nota, pode_atualizar_preco) values
  ('e3300000-0000-0000-0000-000000000001', 'e3200000-0000-0000-0000-00000000000a', true, false),
  ('e3300000-0000-0000-0000-000000000001', 'e3200000-0000-0000-0000-00000000000b', false, false),
  ('e3300000-0000-0000-0000-000000000001', 'e3200000-0000-0000-0000-00000000000c', false, true),
  ('e3300000-0000-0000-0000-000000000003', 'e3200000-0000-0000-0000-00000000000b', false, false);

-- Conversa da Carla (K): dia 10 a equipe respondeu; dia 11 só o agente; dia 12 o agente passou para pessoa (esperando).
-- Conversa da Paula (P), só pelo telefone: dia 12, só a mensagem do cliente.
insert into public.conversas (id, telefone, contato_id, aguardando_pessoa_desde) values
  ('e3400000-0000-0000-0000-00000000000a', '5531980000001', 'e3300000-0000-0000-0000-000000000001', '2025-03-12 08:01-03');
insert into public.conversas (id, telefone) values ('e3400000-0000-0000-0000-00000000000b', '5531980000003');
insert into public.mensagens (conversa_id, direcao, autor, conteudo, criado_em) values
  ('e3400000-0000-0000-0000-00000000000a', 'entrada', 'cliente', 'oi', '2025-03-10 09:00-03'),
  ('e3400000-0000-0000-0000-00000000000a', 'saida', 'atendente', 'pois não', '2025-03-10 09:10-03'),
  ('e3400000-0000-0000-0000-00000000000a', 'entrada', 'cliente', 'oi', '2025-03-11 10:00-03'),
  ('e3400000-0000-0000-0000-00000000000a', 'saida', 'agente', 'olá', '2025-03-11 10:01-03'),
  ('e3400000-0000-0000-0000-00000000000a', 'entrada', 'cliente', 'quero falar com alguém', '2025-03-12 08:00-03'),
  ('e3400000-0000-0000-0000-00000000000b', 'entrada', 'cliente', 'oi', '2025-03-12 11:00-03');
insert into public.conversa_eventos (conversa_id, tipo, criado_em) values ('e3400000-0000-0000-0000-00000000000a', 'passou_para_pessoa', '2025-03-12 08:01-03');
-- A conversa da Paula tem demanda no setor da Ana: ela vê essa conversa (Parte D), não a da Carla.
insert into public.chamados (setor_id, conversa_id, titulo) values
  ('e3100000-0000-0000-0000-000000000001', 'e3400000-0000-0000-0000-00000000000b', 'G3 nota da Paula');

-- 1–7: estrutura e quem consulta
select has_view('public', 'contatos_lista', 'visão existe');
select ok((select coalesce('security_invoker=true' = any (c.reloptions), false) from pg_class c where c.oid = 'public.contatos_lista'::regclass),
  'visão com a regra de leitura de quem consulta');
select ok(not has_table_privilege('anon', 'public.contatos_lista', 'select'), 'anon não lê a visão');
select ok(not has_table_privilege('authenticated', 'public.contatos_lista', 'update'), 'a visão é só leitura');
select has_function('public', 'contato_whatsapp_resumo', 'resumo existe');
select ok(not (select prosecdef from pg_proc where oid = 'public.contato_whatsapp_resumo(uuid)'::regprocedure),
  'resumo roda com a regra de leitura de quem chama');
select ok(not has_function_privilege('anon', 'public.contato_whatsapp_resumo(uuid)', 'execute'), 'anon não lê o resumo');

-- 8–17: o administrador vê tudo
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select results_eq(
  $$ select n_empresas, pode_pedir_nota_alguma, muda_preco_alguma from public.contatos_lista where id = 'e3300000-0000-0000-0000-000000000001' $$,
  $$ values (2, true, false) $$, 'Carla: duas empresas ativas; a marcação da arquivada não conta (D5)');
select is((select array(select e ->> 'nome' from jsonb_array_elements(l.empresas) e) from public.contatos_lista l
           where l.id = 'e3300000-0000-0000-0000-000000000001'),
  array['Beta Fantasia', 'G3 Alfa'], 'empresas pelo nome que a equipe conhece, em ordem');
select is((select empresa_ids @> array['e3200000-0000-0000-0000-00000000000c']::uuid[] from public.contatos_lista
           where id = 'e3300000-0000-0000-0000-000000000001'), false, 'empresa arquivada fora dos filtros');
select is((select count(*)::int from public.contatos_lista where nome like 'G3 %' and empresas_busca ilike '%G3 Beta Ltda%'), 2,
  'busca pela razão social de quem tem nome fantasia (Carla e Paula)');
select results_eq(
  $$ select n_empresas, conversa_id is null, ultimo_contato_em is null, agente_pausado from public.contatos_lista
     where id = 'e3300000-0000-0000-0000-000000000002' $$,
  $$ values (0, true, true, true) $$, 'Rui: sem empresa, sem conversa, agente desligado');
select results_eq(
  $$ select conversa_id, ultimo_contato_em from public.contatos_lista where id = 'e3300000-0000-0000-0000-000000000003' $$,
  $$ values ('e3400000-0000-0000-0000-00000000000b'::uuid, '2025-03-12 11:00-03'::timestamptz) $$,
  'Paula: a conversa ligada só pelo telefone também conta');
select results_eq(
  $$ select conversa_id, estado_conversa::text, espera_desde from public.contatos_lista where id = 'e3300000-0000-0000-0000-000000000001' $$,
  $$ values ('e3400000-0000-0000-0000-00000000000a'::uuid, 'agente', '2025-03-12 08:01-03'::timestamptz) $$,
  'Carla: a mesma espera da caixa de entrada');
select is(array(select nome from public.contatos_lista where nome like 'G3 %' order by ultimo_contato_em desc nulls last),
  array['G3 Paula', 'G3 Carla', 'G3 Rui'], 'ordem pelo último contato; sem conversa no fim');
select is(public.contato_whatsapp_resumo('e3300000-0000-0000-0000-000000000001'), '{"atendimentos":3,"resolvidas_agente":1}'::jsonb,
  'Carla: 3 dias; só o dia 11 o agente resolveu sozinho (D3)');
select is(public.contato_whatsapp_resumo('e3300000-0000-0000-0000-000000000002'), '{"atendimentos":0,"resolvidas_agente":0}'::jsonb,
  'Rui: nada');

-- 18–22: Ana ("Conversas dos meus setores") vê os contatos, mas só a conversa com demanda no setor dela
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.contatos_lista where nome like 'G3 %'), 3, 'Ana vê os três contatos (como hoje)');
select results_eq(
  $$ select conversa_id is null, ultimo_contato_em is null, espera_desde is null from public.contatos_lista
     where id = 'e3300000-0000-0000-0000-000000000001' $$,
  $$ values (true, true, true) $$, 'Ana: nada da conversa da Carla (fora dos setores dela)');
select is((select conversa_id from public.contatos_lista where id = 'e3300000-0000-0000-0000-000000000003'),
  'e3400000-0000-0000-0000-00000000000b'::uuid, 'Ana: a conversa da Paula aparece');
select is(public.contato_whatsapp_resumo('e3300000-0000-0000-0000-000000000001'), '{"atendimentos":0,"resolvidas_agente":0}'::jsonb,
  'Ana: o resumo da Carla não revela nada');
select is(public.contato_whatsapp_resumo('e3300000-0000-0000-0000-000000000003'), '{"atendimentos":1,"resolvidas_agente":1}'::jsonb,
  'Ana: o resumo da Paula');

-- 23–26: marcações e vínculos com a permissão de hoje (Clientes e contatos ≥ "Ver e editar" = editar_clientes)
select throws_ok(
  $$ insert into public.contato_clientes (contato_id, cliente_id) values ('e3300000-0000-0000-0000-000000000002', 'e3200000-0000-0000-0000-00000000000a') $$,
  '42501', null, '"Só ver": não vincula empresa');
update public.contato_clientes set pode_atualizar_preco = true
 where contato_id = 'e3300000-0000-0000-0000-000000000001' and cliente_id = 'e3200000-0000-0000-0000-00000000000a';
reset role;
select is((select pode_atualizar_preco from public.contato_clientes
           where contato_id = 'e3300000-0000-0000-0000-000000000001' and cliente_id = 'e3200000-0000-0000-0000-00000000000a'),
  false, '"Só ver": a marcação não muda');
update public.usuario_permissoes set nivel = 'editar' where usuario_id = 'e3000000-0000-0000-0000-00000000000b' and modulo = 'clientes';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
update public.contato_clientes set pode_atualizar_preco = true
 where contato_id = 'e3300000-0000-0000-0000-000000000001' and cliente_id = 'e3200000-0000-0000-0000-00000000000a';
reset role;
select is((select pode_atualizar_preco from public.contato_clientes
           where contato_id = 'e3300000-0000-0000-0000-000000000001' and cliente_id = 'e3200000-0000-0000-0000-00000000000a'),
  true, '"Ver e editar": a marcação muda');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.contato_clientes (contato_id, cliente_id) values ('e3300000-0000-0000-0000-000000000002', 'e3200000-0000-0000-0000-00000000000a') $$,
  '"Ver e editar": vincula empresa');

-- 27: arquivada não vê nada
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.contatos_lista where nome like 'G3 %'), 0, 'arquivada: nada');
reset role;

-- 28–29: visitante recusado
set local role anon;
select throws_ok($$ select * from public.contatos_lista $$, '42501', null, 'visitante: lista recusada');
select throws_ok($$ select public.contato_whatsapp_resumo('e3300000-0000-0000-0000-000000000001') $$, '42501', null, 'visitante: resumo recusado');
reset role;

select * from finish();
rollback;
