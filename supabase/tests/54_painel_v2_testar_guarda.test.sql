-- Parte I3b, Task 5 (D11, D12, D14, D15): Testar dos agentes dos setores, guarda dos arquivos das tarefas e as sobras da I3a.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email) values
  ('fc000000-0000-0000-0000-00000000000a', 'ana@i3t.local'), ('fc000000-0000-0000-0000-00000000000b', 'paula@i3t.local'),
  ('fc000000-0000-0000-0000-00000000000c', 'dono@i3t.local'), ('fc000000-0000-0000-0000-00000000000d', 'claudia@i3t.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('fc000000-0000-0000-0000-00000000000a', 'I3T Ana', 'ana@i3t.local', 'atendente', '{treinar_agente}'),
  ('fc000000-0000-0000-0000-00000000000b', 'I3T Paula', 'paula@i3t.local', 'atendente', '{treinar_agente}'),
  ('fc000000-0000-0000-0000-00000000000c', 'I3T Dono', 'dono@i3t.local', 'admin', '{}'),
  ('fc000000-0000-0000-0000-00000000000d', 'I3T Cláudia', 'claudia@i3t.local', 'atendente', '{}');
update public.usuarios set dono = false where dono;
update public.usuarios set dono = true where id = 'fc000000-0000-0000-0000-00000000000c';
insert into public.usuario_setores (usuario_id, setor_id) values
  ('fc000000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Fiscal')),
  ('fc000000-0000-0000-0000-00000000000b', (select id from public.setores where nome = 'Pessoal')),
  ('fc000000-0000-0000-0000-00000000000d', (select id from public.setores where nome = 'Contábil'));
insert into public.agente_skills (id, agente_id, nome, tipo, ativo) values
  ('fc400000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal'), 'tabela-cfop', 'conhecimento', false),
  ('fc400000-0000-0000-0000-00000000000b', (select id from public.agentes where slug = 'atendimento'), 'jeito-thiago', 'jeito', true);
insert into public.agente_skill_versoes (skill_id, versao, titulo, descricao, tipo, corpo, skill_md) values
  ('fc400000-0000-0000-0000-00000000000a', 1, 'Tabela CFOP', 'CFOP', 'conhecimento', 'x', '---'),
  ('fc400000-0000-0000-0000-00000000000b', 1, 'Jeito do Thiago', 'Jeito', 'jeito', 'x', '---');
insert into public.clientes (id, razao_social, cnpj) values ('fc100000-0000-0000-0000-00000000000a', 'I3T Padaria', '21448390000107');
insert into public.chamados (id, cliente_id, setor_id, titulo) values
  ('fc200000-0000-0000-0000-00000000000a', 'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechamento');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, setor_id, pedido, limite_usd, limite_minutos, estado, resultado) values
  ('fc300000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'contabil'), 'fc200000-0000-0000-0000-00000000000a',
   'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechar outubro', 2, 20, 'aguardando_pendencias',
   '{"versao":1,"resumo":"r","destaques":[],"linhas":[{"descricao":"Saldo BB","valor":10,"texto":null,"fonte":"pendência 1","provisoria":true}],"observacoes":null}');
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta) values ('fc300000-0000-0000-0000-00000000000a', 1, 'analista', 'Saldo do BB?');
update public.agentes set estado = 'ligado' where slug = 'contabil';

-- 1: a coluna do modo
select has_column('public', 'simulacoes_agente', 'modo', 'simulacoes_agente.modo');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
-- 2–9: criar_simulacao_agente (D11, D12)
select isnt(public.criar_simulacao_agente('fiscal', 'Saiu a nota do pedido 4512?', null, null, null, 'por_tras'), null, 'Ana (Fiscal, treinar) testa o Fiscal');
select is((select a.slug || ':' || coalesce(s.modo, '-') from public.simulacoes_agente s join public.agentes a on a.id = s.agente_id
           where s.usuario_id = 'fc000000-0000-0000-0000-00000000000a'), 'fiscal:por_tras', 'grava o agente e o modo');
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'De novo') $$, 'P0001',
  'Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.', 'um teste pendente por pessoa');
reset role;
delete from public.simulacoes_agente;
set local role authenticated;
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'Oi', null, null, 'fc400000-0000-0000-0000-00000000000a') $$, 'P0001',
  'Só o dono testa skills.', 'skill: só o dono');
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'Oi', null, null, null, 'gritando') $$, 'P0001', 'Modo inválido.', 'modo inválido');
select throws_ok($$ select public.criar_simulacao_agente('atendimento', 'Oi') $$, 'P0001', 'Para o Thiago, use o teste de sempre.', 'o Thiago não passa por aqui');
select throws_ok($$ select public.criar_simulacao_agente('contabil', 'Oi') $$, 'P0001',
  'Este agente só faz tarefas: teste pedindo uma tarefa numa demanda de teste, com o agente em Teste.', 'agente só de Trabalho');
select throws_ok($$ select public.criar_simulacao_agente('nao-existe', 'Oi') $$, 'P0001', 'Agente não encontrado.', 'agente que não existe');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
-- 10: Paula treina, mas é do Pessoal
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'Oi') $$, 'P0001', 'Você não tem permissão para testar este agente.', 'outro setor: recusa');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
-- 11–13: o dono testa a skill desligada do Fiscal; skill de outro agente é recusada
select isnt(public.criar_simulacao_agente('fiscal', 'Qual o CFOP?', null, null, 'fc400000-0000-0000-0000-00000000000a'), null, 'dono testa skill desligada');
reset role;
delete from public.simulacoes_agente;
set local role authenticated;
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'Oi', null, null, 'fc400000-0000-0000-0000-00000000000b') $$, 'P0001',
  'Skill não encontrada neste agente.', 'skill do Thiago no teste do Fiscal: recusa');
-- 13: com rascunho de orientação (validado como em criar_simulacao)
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'Oi', null, '{"titulo":"T","texto":"x","tipo":"jeito","extra":1}') $$, 'P0001',
  'Rascunho da orientação inválido.', 'rascunho com chave a mais');
-- 14–15: criar_simulacao_skill grava o agente (minor da I1) e continua recusando o Fiscal com a mesma frase
select isnt(public.criar_simulacao_skill('fc400000-0000-0000-0000-00000000000b', 'Oi'), null, 'skill do Thiago testa');
select is((select agente_id from public.simulacoes_agente where skill_id = 'fc400000-0000-0000-0000-00000000000b'),
  (select id from public.agentes where slug = 'atendimento'), 'grava o agente_id da skill');
reset role;
delete from public.simulacoes_agente;
set local role authenticated;
select throws_ok($$ select public.criar_simulacao_skill('fc400000-0000-0000-0000-00000000000a', 'Oi') $$, 'P0001',
  'Nesta etapa só dá para testar skills do Thiago.', 'frase da I1 continua (46:77)');

-- 17–21: guarda dos arquivos das tarefas (D14)
select is((select dias from public.tarefas_guarda), null, 'padrão: nunca apagar');
select throws_ok($$ select public.salvar_guarda_tarefas(45) $$, 'P0001', 'Escolha 90, 180, 365 ou 730 dias, ou nunca apagar.', 'prazo fora da lista');
select lives_ok($$ select public.salvar_guarda_tarefas(365) $$, 'o dono escolhe 365');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_guarda_tarefas(90) $$, 'P0001', 'Só o dono muda a guarda dos arquivos das tarefas.', 'só o dono');
select throws_ok($$ select public.arquivos_vencidos_das_tarefas(10) $$, '42501', null, 'pessoa não chama a limpeza');

reset role;
-- Arquivos: um de tarefa aprovada há 400 dias (vence), um de tarefa aprovada ontem (não vence), um anexo da conversa (nunca), um já removido.
insert into public.chamados (id, cliente_id, setor_id, titulo) values
  ('fc200000-0000-0000-0000-00000000000b', 'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Antiga'),
  ('fc200000-0000-0000-0000-00000000000c', 'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Recente');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, setor_id, pedido, limite_usd, limite_minutos, estado, decidida_em) values
  ('fc300000-0000-0000-0000-00000000000b', (select id from public.agentes where slug = 'contabil'), 'fc200000-0000-0000-0000-00000000000b',
   'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Antiga', 2, 20, 'aprovada', now() - interval '400 days'),
  ('fc300000-0000-0000-0000-00000000000c', (select id from public.agentes where slug = 'contabil'), 'fc200000-0000-0000-0000-00000000000c',
   'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Recente', 2, 20, 'descartada', now() - interval '1 day');
insert into public.agente_tarefa_arquivos (id, tarefa_id, origem, bucket, caminho, nome, mime, tamanho, removido_em) values
  ('fc600000-0000-0000-0000-00000000000a', 'fc300000-0000-0000-0000-00000000000b', 'enviado', 'tarefas', 'fc300000-0000-0000-0000-00000000000b/1-a.pdf', 'a.pdf', 'application/pdf', 1, null),
  ('fc600000-0000-0000-0000-00000000000b', 'fc300000-0000-0000-0000-00000000000c', 'enviado', 'tarefas', 'fc300000-0000-0000-0000-00000000000c/1-b.pdf', 'b.pdf', 'application/pdf', 1, null),
  ('fc600000-0000-0000-0000-00000000000c', 'fc300000-0000-0000-0000-00000000000b', 'conversa', 'anexos', 'conversas/x/1-c.pdf', 'c.pdf', 'application/pdf', 1, null),
  ('fc600000-0000-0000-0000-00000000000d', 'fc300000-0000-0000-0000-00000000000b', 'enviado', 'tarefas', 'fc300000-0000-0000-0000-00000000000b/1-d.pdf', 'd.pdf', 'application/pdf', 1, now());
set local role service_role;
-- 22–24
select is((select array_agg(id::text) from public.arquivos_vencidos_das_tarefas(100)), array['fc600000-0000-0000-0000-00000000000a'],
  'só o arquivo do compartimento tarefas, de tarefa decidida há mais de 365 dias, ainda não removido');
select is(public.marcar_arquivos_removidos(array['fc600000-0000-0000-0000-00000000000a', 'fc600000-0000-0000-0000-00000000000c']::uuid[]), 1,
  'marca só o do compartimento tarefas');
select is((select count(*)::int from public.arquivos_vencidos_das_tarefas(100)), 0, 'depois de marcado, não volta');
reset role;
update public.tarefas_guarda set dias = null;
set local role service_role;
-- 25
select is((select count(*)::int from public.arquivos_vencidos_das_tarefas(100)), 0, 'nunca apagar: nada vence');

-- 26–28: sobras da I3a (D15b): a última resposta com linha provisória pede para refazer
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(public.responder_pendencia((select id from public.agente_pendencias where tarefa_id = 'fc300000-0000-0000-0000-00000000000a'), 'R$ 10,00 no extrato'), true,
  'a última resposta retoma a tarefa');
select is((select ajuste_pendente from public.agente_tarefas where id = 'fc300000-0000-0000-0000-00000000000a'), true, 'linha provisória: ajuste pendente');
select is((select ajustes -> -1 ->> 'texto' from public.agente_tarefas where id = 'fc300000-0000-0000-0000-00000000000a'),
  'Refaça as linhas provisórias com as respostas das pendências e entregue de novo.', 'o ajuste diz o que fazer');

-- 29–31: sobras da I3a (D15c): setor desativado trava as ações; Pausar e Descartar continuam (ruling F8 do pré-voo)
reset role;
update public.setores set ativo = false where nome = 'Contábil';
set local role authenticated;
select throws_ok($$ select public.continuar_tarefa('fc300000-0000-0000-0000-00000000000a') $$, 'P0001',
  'O setor desta demanda está desativado: não dá para mexer na tarefa.', 'continuar com setor desativado: recusa');
select lives_ok($$ select public.descartar_tarefa('fc300000-0000-0000-0000-00000000000a') $$, 'descartar com setor desativado: deixa fechar a tarefa');
select throws_ok($$ select public.pedir_leitura_da_pasta('fc300000-0000-0000-0000-00000000000a') $$, 'P0001',
  'O setor desta demanda está desativado: não dá para mexer na tarefa.', 'ler a pasta com setor desativado: recusa');
reset role;
-- 32: nada no Realtime
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tarefas_guarda'), 0, 'tarefas_guarda fora do Realtime');

select * from finish();
rollback;
