-- supabase/tests/19_painel_v2_acoes_demanda.test.sql
-- Parte C (spec 6.3, 6.4, 6.6 e 6.7): cada ação gera seu evento, quem é de outro setor não age, reabrir limpa concluido_em.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000019a1', 'ana19@pgtap.local'),
  ('00000000-0000-0000-0000-0000000019a2', 'bia19@pgtap.local'),
  ('00000000-0000-0000-0000-0000000019a3', 'caio19@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values
  ('00000000-0000-0000-0000-0000000019a1', 'Ana', 'ana19@pgtap.local', 'atendente'),
  ('00000000-0000-0000-0000-0000000019a2', 'Bia', 'bia19@pgtap.local', 'atendente'),
  ('00000000-0000-0000-0000-0000000019a3', 'Caio', 'caio19@pgtap.local', 'atendente');
insert into public.usuario_setores (usuario_id, setor_id)
  select u, s.id from (values ('00000000-0000-0000-0000-0000000019a1'::uuid), ('00000000-0000-0000-0000-0000000019a2'::uuid)) v(u),
    public.setores s where s.nome = 'Fiscal';
insert into public.usuario_setores (usuario_id, setor_id)
  select '00000000-0000-0000-0000-0000000019a3', id from public.setores where nome = 'Pessoal';

insert into public.clientes (id, razao_social, nome_fantasia, cnpj) values
  ('19000000-0000-0000-0000-000000000001', 'Indústria 19 Ltda', 'Indústria 19', '19191919000119');
insert into public.contatos (id, nome, telefone) values
  ('19100000-0000-0000-0000-000000000001', 'Carla', '5531999991901'),
  ('19100000-0000-0000-0000-000000000002', 'Duda', '5531999991902'),
  ('19100000-0000-0000-0000-000000000003', 'Estranho', '5531999991903');
insert into public.contato_clientes (contato_id, cliente_id) values
  ('19100000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001'),
  ('19100000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000001');

-- F1: a demanda das ações. F2: contato que será arquivado. F3: vencida. F4: vencida, mas pausada.
insert into public.chamados (id, cliente_id, setor_id, titulo, resumo, contato_id, status, prazo_em)
  select x.id, '19000000-0000-0000-0000-000000000001', s.id, x.titulo, 'Descrição', x.contato, x.status::public.status_chamado, x.prazo
  from public.setores s, (values
    ('19300000-0000-0000-0000-000000000001'::uuid, 'Guia DAS', null::uuid, 'aberto', null::timestamptz),
    ('19300000-0000-0000-0000-000000000002'::uuid, 'Certidão', '19100000-0000-0000-0000-000000000002'::uuid, 'aberto', null),
    ('19300000-0000-0000-0000-000000000003'::uuid, 'Guia ICMS', null, 'em_andamento', now() - interval '1 day'),
    ('19300000-0000-0000-0000-000000000004'::uuid, 'Guia ISS', null, 'aguardando_cliente', now() - interval '1 day')
  ) x(id, titulo, contato, status, prazo)
  where s.nome = 'Fiscal';
update public.contatos set ativo = false where id = '19100000-0000-0000-0000-000000000002';

set local role authenticated;

-- 1-2: Caio (Pessoal) não age nas demandas do Fiscal nem abre demanda lá.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a3","role":"authenticated"}', true);
select throws_ok($$ select public.assumir_demanda('19300000-0000-0000-0000-000000000001') $$,
  'P0001', 'Você não tem acesso a esta demanda.', 'outro setor não assume');
select throws_ok($$ select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'Guia DAS', '') $$,
  'P0001', 'Escolha um dos seus setores.', 'outro setor não abre demanda no Fiscal');

-- 3-4: Ana assume; Bia chega depois e recebe o aviso.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a1","role":"authenticated"}', true);
select public.assumir_demanda('19300000-0000-0000-0000-000000000001');
select results_eq($$ select responsavel_id, status::text from public.chamados where id = '19300000-0000-0000-0000-000000000001' $$,
  $$ values ('00000000-0000-0000-0000-0000000019a1'::uuid, 'em_andamento') $$, 'assumir: responsável = Ana e Nova vira Resolvendo');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a2","role":"authenticated"}', true);
select throws_ok($$ select public.assumir_demanda('19300000-0000-0000-0000-000000000001') $$,
  'P0001', 'A demanda já está com Ana.', 'quem chega depois não toma a demanda');

-- 5-13: responsável, status, prioridade, prazo, nota, edição (Ana).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a1","role":"authenticated"}', true);
select throws_ok($$ select public.definir_responsavel('19300000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000019a3') $$,
  'P0001', 'Escolha uma pessoa ativa do setor da demanda.', 'responsável de outro setor é recusado');
select lives_ok($$ select public.definir_responsavel('19300000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000019a2') $$, 'Bia vira responsável');
select lives_ok($$ select public.alterar_status_chamado('19300000-0000-0000-0000-000000000001', 'aguardando_cliente') $$, 'Com o cliente');
select is((select public.definir_prioridade_prazo('19300000-0000-0000-0000-000000000001', 'urgente') ->> 'prioridade'), 'urgente', 'prioridade urgente');
select is((select prazo_em from public.chamados where id = '19300000-0000-0000-0000-000000000001'), public.calcular_prazo('urgente', now()),
  'prioridade nova sem prazo: prazo recalculado a partir de agora');
select throws_ok($$ select public.definir_prioridade_prazo('19300000-0000-0000-0000-000000000001', null, now() - interval '1 hour') $$,
  'P0001', 'O prazo precisa ser depois de agora.', 'prazo no passado é recusado');
select lives_ok($$ select public.definir_prioridade_prazo('19300000-0000-0000-0000-000000000001', null, '2030-01-15 12:00-03') $$, 'prazo escolhido à mão');
select lives_ok($$ select public.nota_interna('19300000-0000-0000-0000-000000000001', 'Cliente ligou') $$, 'nota interna');
select lives_ok($$ select public.editar_demanda('19300000-0000-0000-0000-000000000001', 'Guia DAS de outubro', 'Descrição nova',
  '19100000-0000-0000-0000-000000000001') $$, 'editar título, descrição e contato');

-- 14-18: transferir, concluir, recusa em concluída, reabrir.
select lives_ok($$ select public.transferir_chamado('19300000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  '00000000-0000-0000-0000-0000000019a1') $$, 'transferir');
select lives_ok($$ select public.concluir_chamado('19300000-0000-0000-0000-000000000001') $$, 'concluir');
select throws_ok($$ select public.alterar_status_chamado('19300000-0000-0000-0000-000000000001', 'em_andamento') $$,
  'P0001', 'Esta demanda está concluída. Reabra antes de mudar.', 'concluída não muda de status: reabrir antes');
select lives_ok($$ select public.reabrir_demanda('19300000-0000-0000-0000-000000000001') $$, 'reabrir');
select results_eq($$ select status::text, concluido_em, prazo_em from public.chamados where id = '19300000-0000-0000-0000-000000000001' $$,
  $$ values ('aberto', null::timestamptz, public.calcular_prazo('urgente', now())) $$, 'reabrir: Nova, sem concluido_em, prazo novo');

-- 19-20: cada ação gerou o seu evento.
select results_eq(
  $$ select tipo, count(*)::int from public.chamado_eventos where chamado_id = '19300000-0000-0000-0000-000000000001' group by tipo order by tipo $$,
  $$ values ('assumido', 1), ('conclusao', 1), ('criacao', 1), ('editado', 1), ('nota_interna', 1), ('prazo_alterado', 4),
            ('prioridade_alterada', 2), ('reaberto', 1), ('responsavel_alterado', 1), ('status_alterado', 1), ('transferencia', 1) $$,
  'um evento para cada ação (prazo: sugerido, recalculado, à mão e ao reabrir)');
select results_eq(
  $$ select tipo, texto from public.chamado_eventos where chamado_id = '19300000-0000-0000-0000-000000000001'
       and tipo in ('editado', 'responsavel_alterado', 'status_alterado') order by tipo $$,
  $$ values ('editado', 'título, descrição, contato'), ('responsavel_alterado', 'Bia'), ('status_alterado', 'aguardando_cliente') $$,
  'textos dos eventos');

-- 21-22: contato arquivado depois: editar só o título salva; trocar por contato de fora é recusado.
select lives_ok($$ select public.editar_demanda('19300000-0000-0000-0000-000000000002', 'Certidão negativa', 'Descrição',
  '19100000-0000-0000-0000-000000000002') $$, 'contato arquivado que não mudou não impede a edição');
select throws_ok($$ select public.editar_demanda('19300000-0000-0000-0000-000000000002', 'Certidão negativa', 'Descrição',
  '19100000-0000-0000-0000-000000000003') $$, 'P0001', 'Escolha um contato desta empresa.', 'contato de fora da empresa é recusado');

-- 23-26: a lista (visão demandas_lista): vencida, pausada, nomes, RLS.
select is((select vencida from public.demandas_lista where id = '19300000-0000-0000-0000-000000000003'), true, 'prazo passado: vencida');
select is((select vencida from public.demandas_lista where id = '19300000-0000-0000-0000-000000000004'), false, 'pausada em Com o cliente: não vence');
select results_eq($$ select empresa, setor, responsavel, contato from public.demandas_lista where id = '19300000-0000-0000-0000-000000000001' $$,
  $$ values ('Indústria 19', 'Fiscal', 'Ana', 'Carla') $$, 'nomes resolvidos na lista');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a3","role":"authenticated"}', true);
select is((select count(*) from public.demandas_lista where setor = 'Fiscal'), 0::bigint, 'Caio não vê o Fiscal na lista');

-- 27-32: nova demanda pela equipe (Ana).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a1","role":"authenticated"}', true);
create temp table nova as select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  'Férias da Joana', 'Cálculo de férias a partir de 20/10', 'alta', null, '00000000-0000-0000-0000-0000000019a2',
  '19100000-0000-0000-0000-000000000001') as r;
select results_eq($$ select origem, criado_por, prioridade::text, responsavel_id, contato_id, prazo_em = public.calcular_prazo('alta', criado_em)
                     from public.chamados where id = (select (r ->> 'id')::uuid from nova) $$,
  $$ values ('equipe', '00000000-0000-0000-0000-0000000019a1'::uuid, 'alta', '00000000-0000-0000-0000-0000000019a2'::uuid,
            '19100000-0000-0000-0000-000000000001'::uuid, true) $$, 'nova demanda: origem equipe, quem abriu, prioridade, prazo sugerido');
select results_eq($$ select tipo, usuario_id from public.chamado_eventos where chamado_id = (select (r ->> 'id')::uuid from nova)
                     and tipo in ('criacao', 'prazo_alterado') order by criado_em $$,
  $$ values ('criacao', '00000000-0000-0000-0000-0000000019a1'::uuid), ('prazo_alterado', null::uuid) $$,
  'abriu por Ana; prazo sugerido pelo Sistema');
create temp table nova2 as select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  'Holerite', '', 'normal', '2030-01-15 12:00-03') as r;
select is((select usuario_id from public.chamado_eventos where chamado_id = (select (r ->> 'id')::uuid from nova2) and tipo = 'prazo_alterado'),
  '00000000-0000-0000-0000-0000000019a1'::uuid, 'prazo escolhido por quem abriu fica com o nome dela');
select throws_ok($$ select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  'Holerite', '', 'normal', null, '00000000-0000-0000-0000-0000000019a3') $$,
  'P0001', 'Escolha uma pessoa ativa do setor da demanda.', 'responsável de outro setor é recusado na nova demanda');
select throws_ok($$ select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'ab', '') $$,
  'P0001', 'O título precisa ter de 3 a 120 caracteres.', 'título curto é recusado');
select throws_ok($$ select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  'Holerite', '', 'normal', null, null, '19100000-0000-0000-0000-000000000003') $$,
  'P0001', 'Escolha um contato desta empresa.', 'contato de outra empresa é recusado');

-- 33-35: preferência Tabela/Quadro.
select lives_ok($$ select public.definir_visao_demandas('quadro') $$, 'escolhe o quadro');
select is((select visao_demandas from public.usuarios where id = '00000000-0000-0000-0000-0000000019a1'), 'quadro', 'preferência gravada');
select throws_ok($$ select public.definir_visao_demandas('lista') $$, 'P0001', 'Visão inválida.', 'valor estranho é recusado');

-- 36-37: anônimo não chama as ações; o painel chama calcular_prazo.
reset role;
select ok(not has_function_privilege('anon', 'public.criar_demanda(uuid, uuid, text, text, public.prioridade_demanda, timestamptz, uuid, uuid)', 'execute'),
  'anônimo não abre demanda');
select ok(has_function_privilege('authenticated', 'public.calcular_prazo(public.prioridade_demanda, timestamptz)', 'execute'),
  'o painel calcula o prazo sugerido');

-- 38: trocar só a empresa ou "fora do contrato" também muda a última atualização (sobra da Task 1).
update public.chamados set atualizado_em = now() - interval '1 day' where id = '19300000-0000-0000-0000-000000000003';
update public.chamados set fora_do_contrato = true where id = '19300000-0000-0000-0000-000000000003';
select ok((select atualizado_em > now() - interval '1 minute' from public.chamados where id = '19300000-0000-0000-0000-000000000003'),
  'fora do contrato conta como atualização');

select * from finish();
rollback;
