begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

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
select throws_ok($$ insert into public.orientacoes_agente (titulo, texto, tipo) values ('T', 'x', 'jeito') $$, '42501', null,
  'gravação direta na tabela é recusada');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
select is((select count(*) from public.orientacoes_agente)::int, 0, 'usuária inativa não lê');

set local role anon;
select throws_ok($$ select public.salvar_orientacao(null, 'T', 'x', 'jeito', null, null, true) $$, '42501', null, 'anon não chama a função');

reset role;
select ok((select count(*) from public.auditoria_acessos where entidade = 'orientacoes_agente'
  and entidade_id = current_setting('teste.o1')) >= 4, 'auditoria registra criar, editar, desligar e restaurar');

select * from finish();
rollback;
