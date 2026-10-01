begin;
create extension if not exists pgtap with schema extensions;
select plan(68);

-- Treinar o agente (pedido do dono, 2026-09-30): orientações, versões e simulações.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'dono@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'marcada@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000b3', 'sem@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000b4', 'inativa@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes, ativo) values
  ('00000000-0000-0000-0000-0000000000b1', 'Dono', 'dono@pgtap.local', 'admin', '{}', true),
  ('00000000-0000-0000-0000-0000000000b2', 'Marcada', 'marcada@pgtap.local', 'atendente', '{treinar_agente}', true),
  ('00000000-0000-0000-0000-0000000000b3', 'Sem Permissão', 'sem@pgtap.local', 'atendente', '{assistente_site}', true),
  ('00000000-0000-0000-0000-0000000000b4', 'Inativa', 'inativa@pgtap.local', 'atendente', '{treinar_agente}', false);
insert into public.clientes (id, razao_social, cnpj) values
  ('40000000-0000-0000-0000-0000000000b1', 'Indústria Treino', '99888777000166');
insert into public.clientes (id, razao_social, cnpj, ativo) values
  ('40000000-0000-0000-0000-0000000000b2', 'Indústria Inativa', '99888777000247', false);
insert into public.setores (id, nome, ativo) values
  ('30000000-0000-0000-0000-0000000000b1', 'Setor Desativado', false);
-- Simulação da pessoa sem permissão (gravada direto): nem ela lê.
insert into public.simulacoes_agente (usuario_id, mensagem) values ('00000000-0000-0000-0000-0000000000b3', 'antiga');

set local role authenticated;

-- Administrador cria (sem a marcação: admin sempre pode).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok($$ select set_config('teste.o1', public.salvar_orientacao(null, '  Cumprimento  ', ' Cumprimente pelo nome. ', 'jeito', null, null, true)::text, true) $$,
  'admin cria orientação');
select is((select titulo || '|' || texto || '|' || ativo from public.orientacoes_agente where id = current_setting('teste.o1')::uuid),
  'Cumprimento|Cumprimente pelo nome.|true', 'grava sem espaços nas pontas');
select is((select criado_por from public.orientacoes_agente where id = current_setting('teste.o1')::uuid),
  '00000000-0000-0000-0000-0000000000b1'::uuid, 'guarda quem criou');
select is((select acao || ':' || usuario_id from public.orientacoes_agente_versoes where orientacao_id = current_setting('teste.o1')::uuid),
  'criar:00000000-0000-0000-0000-0000000000b1', 'criar grava a versão com quem');

-- Pessoa marcada edita, liga, desliga e restaura.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*) from public.orientacoes_agente)::int, 1, 'marcada lê as orientações');
select is(public.salvar_orientacao(current_setting('teste.o1')::uuid, 'Cumprimento', 'Chame pelo primeiro nome.', 'jeito',
  '40000000-0000-0000-0000-0000000000b1', null, true), current_setting('teste.o1')::uuid, 'marcada edita; devolve o mesmo id');
select is((select atualizado_por from public.orientacoes_agente where id = current_setting('teste.o1')::uuid),
  '00000000-0000-0000-0000-0000000000b2'::uuid, 'guarda quem atualizou');
select is(public.alternar_orientacao(current_setting('teste.o1')::uuid, false), false, 'desliga');
select is((select ativo from public.orientacoes_agente where id = current_setting('teste.o1')::uuid), false, 'ficou desligada');
select is((select array_agg(acao order by criado_em) from public.orientacoes_agente_versoes
  where orientacao_id = current_setting('teste.o1')::uuid), array['criar', 'editar', 'desligar'], 'cada mudança grava uma versão');
select is((select count(*) from public.orientacoes_agente_versoes)::int, 3, 'marcada lê as versões');
select is(public.alternar_orientacao(current_setting('teste.o1')::uuid, false), false, 'desligar o que já está desligado devolve o estado');
select is((select count(*) from public.orientacoes_agente_versoes)::int, 3, 'sem mudança não grava versão');
select set_config('teste.atualizado', (select atualizado_em::text from public.orientacoes_agente where id = current_setting('teste.o1')::uuid), true);
select is(public.salvar_orientacao(current_setting('teste.o1')::uuid, ' Cumprimento ', 'Chame pelo primeiro nome.', 'jeito',
  '40000000-0000-0000-0000-0000000000b1', null, null), current_setting('teste.o1')::uuid, 'salvar sem mudar nada devolve o id');
select is((select count(*) from public.orientacoes_agente_versoes)::int, 3, 'salvar sem mudar nada não grava versão');
select is((select atualizado_em::text from public.orientacoes_agente where id = current_setting('teste.o1')::uuid),
  current_setting('teste.atualizado'), 'salvar sem mudar nada não mexe em atualizado_em (nem na auditoria)');

-- Restaurar a primeira versão: volta o texto e a empresa; ligada/desligada fica como está.
select lives_ok($$ select public.restaurar_orientacao((select id from public.orientacoes_agente_versoes
  where orientacao_id = current_setting('teste.o1')::uuid and acao = 'criar')) $$, 'restaura a versão de criação');
select is((select texto || '|' || coalesce(cliente_id::text, 'todos') || '|' || ativo from public.orientacoes_agente
  where id = current_setting('teste.o1')::uuid), 'Cumprimente pelo nome.|todos|false', 'conteúdo restaurado; continua desligada');
select is((select count(*) from public.orientacoes_agente_versoes where acao = 'restaurar')::int, 1, 'restaurar grava nova versão');
select throws_ok($$ select public.restaurar_orientacao('99999999-0000-0000-0000-000000000000') $$, 'P0001', 'Versão não encontrada.',
  'versão inexistente');
select throws_ok($$ select public.alternar_orientacao('99999999-0000-0000-0000-000000000000', true) $$, 'P0001', 'Orientação não encontrada.',
  'ligar orientação inexistente');

-- Validações.
select throws_ok($$ select public.salvar_orientacao(null, '   ', 'x', 'jeito', null, null, false) $$, 'P0001',
  'Informe o título da orientação.', 'título vazio');
select throws_ok($$ select public.salvar_orientacao(null, repeat('a', 121), 'x', 'jeito', null, null, false) $$, 'P0001',
  'O título pode ter no máximo 120 caracteres.', 'título longo');
select throws_ok($$ select public.salvar_orientacao(null, 'T', repeat('a', 2001), 'jeito', null, null, false) $$, 'P0001',
  'O texto pode ter no máximo 2000 caracteres.', 'texto longo');
select lives_ok($$ select public.salvar_orientacao(null, repeat('a', 120), repeat('b', 2000), 'regra', null, null, false) $$,
  'limites exatos passam');
select throws_ok($$ select public.salvar_orientacao(null, 'T', '', 'jeito', null, null, false) $$, 'P0001',
  'Escreva o texto da orientação.', 'texto vazio');
select throws_ok($$ select public.salvar_orientacao(null, 'T', 'x', 'outro', null, null, false) $$, 'P0001',
  'Escolha o tipo da orientação.', 'tipo inválido');
select throws_ok($$ select public.salvar_orientacao(null, 'T', 'x', 'situacao', '40000000-0000-0000-0000-0000000000b1',
  (select id from public.setores limit 1), false) $$, 'P0001',
  'A orientação vale para uma empresa ou para um setor, não para os dois.', 'empresa e setor juntos');
select throws_ok($$ select public.salvar_orientacao(null, 'T', 'x', 'situacao', '99999999-0000-0000-0000-000000000000', null, false) $$,
  'P0001', 'Empresa não encontrada.', 'empresa inexistente');
select throws_ok($$ select public.salvar_orientacao('99999999-0000-0000-0000-000000000000', 'T', 'x', 'jeito', null, null, false) $$,
  'P0001', 'Orientação não encontrada.', 'editar orientação inexistente');
select lives_ok($$ select public.salvar_orientacao(null, 'Fiscal', 'Guia de DAS: peça o mês.', 'situacao', null,
  (select id from public.setores where nome = 'Fiscal'), false) $$, 'orientação de setor');
select lives_ok($$ select public.salvar_orientacao(null, 'Só título', 'Padrões omitidos.', 'jeito') $$,
  'empresa, setor e ativo podem ser omitidos');
select throws_ok($$ select public.salvar_orientacao(null, 'T', 'x', 'situacao', '40000000-0000-0000-0000-0000000000b2', null, false) $$,
  'P0001', 'Esta empresa está inativa. Escolha outra empresa ou reative o cadastro.', 'empresa inativa');
select throws_ok($$ select public.salvar_orientacao(null, 'T', 'x', 'situacao', null, '30000000-0000-0000-0000-0000000000b1', false) $$,
  'P0001', 'Este setor está inativo. Escolha outro setor ou reative o setor.', 'setor inativo');

-- Empresa desativada depois: ligar e restaurar recusam; desligar continua valendo.
select set_config('teste.o2', public.salvar_orientacao(null, 'Empresa', 'Só para a Treino.', 'regra',
  '40000000-0000-0000-0000-0000000000b1', null, true)::text, true);
reset role;
update public.clientes set ativo = false where id = '40000000-0000-0000-0000-0000000000b1';
set local role authenticated;
select is(public.alternar_orientacao(current_setting('teste.o2')::uuid, false), false, 'desliga a da empresa desativada');
select throws_ok($$ select public.alternar_orientacao(current_setting('teste.o2')::uuid, true) $$, 'P0001',
  'Esta empresa está inativa. Escolha outra empresa ou reative o cadastro.', 'não liga com empresa inativa');
select throws_ok($$ select public.restaurar_orientacao((select id from public.orientacoes_agente_versoes
  where orientacao_id = current_setting('teste.o2')::uuid and acao = 'criar')) $$, 'P0001',
  'Esta empresa está inativa. Escolha outra empresa ou reative o cadastro.', 'não restaura versão com empresa inativa');
select throws_ok($$ select public.criar_simulacao('oi', '40000000-0000-0000-0000-0000000000b1') $$, 'P0001',
  'Esta empresa está inativa. Escolha outra empresa ou reative o cadastro.', 'não testa com empresa inativa');
reset role;
update public.clientes set ativo = true where id = '40000000-0000-0000-0000-0000000000b1';
set local role authenticated;

-- Nem a pessoa marcada grava direto nas tabelas (só pelas funções).
select throws_ok($$ insert into public.orientacoes_agente (titulo, texto, tipo) values ('T', 'x', 'jeito') $$, '42501', null,
  'marcada não insere direto');
select throws_ok($$ update public.orientacoes_agente set ativo = true $$, '42501', null, 'marcada não altera direto');
select throws_ok($$ delete from public.orientacoes_agente $$, '42501', null, 'marcada não apaga direto');
select throws_ok($$ insert into public.orientacoes_agente_versoes (orientacao_id, acao, titulo, texto, tipo, ativo)
  values (current_setting('teste.o1')::uuid, 'editar', 'T', 'x', 'jeito', true) $$, '42501', null, 'marcada não forja versão');

-- Simulações.
select lives_ok($$ select set_config('teste.s1', public.criar_simulacao(' Oi, preciso de nota ', '40000000-0000-0000-0000-0000000000b1',
  '{"titulo":"Rascunho","texto":" Peça o CNPJ. ","tipo":"regra","cliente_id":null,"setor_id":null}')::text, true) $$,
  'marcada cria simulação com rascunho');
select is((select mensagem || '|' || status || '|' || (rascunho->>'texto') from public.simulacoes_agente
  where id = current_setting('teste.s1')::uuid), 'Oi, preciso de nota|pendente|Peça o CNPJ.', 'simulação gravada pendente, rascunho limpo');
select throws_ok($$ select public.criar_simulacao('outra', null, null) $$, 'P0001',
  'Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.', 'só uma pendente por pessoa');
reset role;
update public.simulacoes_agente set criado_em = now() - interval '6 minutes' where id = current_setting('teste.s1')::uuid;
set local role authenticated;
select lives_ok($$ select public.criar_simulacao('outra', null, null) $$, 'pendente há mais de 5 minutos conta como abandonada');
select throws_ok($$ select public.criar_simulacao('   ', null, null) $$, 'P0001', 'Escreva a mensagem do cliente para o teste.',
  'mensagem vazia');
select throws_ok($$ select public.criar_simulacao(repeat('a', 2001), null, null) $$, 'P0001',
  'A mensagem de teste pode ter no máximo 2000 caracteres.', 'mensagem longa');
select throws_ok($$ select public.criar_simulacao('oi', null, '{"texto":"x","tipo":"jeito","titulo":"T","extra":1}') $$, 'P0001',
  'Rascunho da orientação inválido.', 'rascunho com campo estranho');
select throws_ok($$ select public.criar_simulacao('oi', null, '{"texto":"x","tipo":"jeito","titulo":"T","cliente_id":"abc"}') $$, 'P0001',
  'Rascunho da orientação inválido.', 'rascunho com id inválido');
select throws_ok($$ select public.criar_simulacao('oi', null, '{"texto":"x","tipo":"nenhum","titulo":"T"}') $$, 'P0001',
  'Escolha o tipo da orientação.', 'rascunho validado como orientação');
select throws_ok($$ update public.simulacoes_agente set status = 'pronta', respostas = '{"mensagens":["forjada"]}' $$, '42501', null,
  'marcada não forja o resultado da própria simulação');
select is((select count(*) from public.simulacoes_agente)::int, 2, 'marcada lê só as suas simulações');

-- Admin lê as orientações mas não as simulações da outra pessoa.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*) from public.simulacoes_agente)::int, 0, 'admin não lê simulações dos outros');

-- Sem a permissão (e usuária inativa): não lê nem grava.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
select is((select count(*) from public.orientacoes_agente)::int, 0, 'sem permissão não lê orientações');
select is((select count(*) from public.orientacoes_agente_versoes)::int, 0, 'sem permissão não lê versões');
select throws_ok($$ select public.salvar_orientacao(null, 'T', 'x', 'jeito', null, null, true) $$, 'P0001',
  'Você não tem permissão para treinar o agente.', 'sem permissão não cria');
select throws_ok($$ select public.alternar_orientacao(current_setting('teste.o1')::uuid, true) $$, 'P0001',
  'Você não tem permissão para treinar o agente.', 'sem permissão não liga');
select throws_ok($$ select public.criar_simulacao('oi', null, null) $$, 'P0001',
  'Você não tem permissão para treinar o agente.', 'sem permissão não testa');
select throws_ok($$ select public.restaurar_orientacao((select id from public.orientacoes_agente_versoes limit 1)) $$, 'P0001',
  'Você não tem permissão para treinar o agente.', 'sem permissão não restaura');
select throws_ok($$ insert into public.orientacoes_agente (titulo, texto, tipo) values ('T', 'x', 'jeito') $$, '42501', null,
  'gravação direta na tabela é recusada');
select is((select count(*) from public.simulacoes_agente)::int, 0, 'sem permissão não lê nem a própria simulação');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
select is((select count(*) from public.orientacoes_agente)::int, 0, 'usuária inativa não lê');
select throws_ok($$ select public.salvar_orientacao(null, 'T', 'x', 'jeito') $$, 'P0001',
  'Você não tem permissão para treinar o agente.', 'usuária inativa não cria');
select throws_ok($$ select public.criar_simulacao('oi') $$, 'P0001',
  'Você não tem permissão para treinar o agente.', 'usuária inativa não testa');

set local role anon;
select throws_ok($$ select public.salvar_orientacao(null, 'T', 'x', 'jeito', null, null, true) $$, '42501', null, 'anon não chama a função');

reset role;
select is((select array_agg(acao || ':' || coalesce(detalhes->'depois'->>'ativo', '') order by acao || ':' || coalesce(detalhes->'depois'->>'ativo', '')) from public.auditoria_acessos
  where entidade = 'orientacoes_agente' and entidade_id = current_setting('teste.o1')),
  array['insert:true', 'update:false', 'update:false', 'update:true'],
  'auditoria registra criar, editar, desligar e restaurar (o desligar repetido não conta)');
select ok(not has_function_privilege('authenticated', 'interno.validar_orientacao(text, text, text, uuid, uuid)', 'execute'),
  'função interna fora do alcance do navegador');

select * from finish();
rollback;
