begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

-- Foco da revisão 4, por comportamento: a pessoa fora do horário chama cada função de gravação que a equipe pode
-- chamar e é recusada; com o horário livre, a mesma chamada passa. Assim a recusa vem do horário, não de falta de nível.
-- (anonimizar_contato e excluir_cadastro_definitivo são só do administrador, que nunca é bloqueado.)
insert into auth.users (id, email) values
  ('d26b0000-0000-0000-0000-00000000000a', 'admin@forahorario.local'), ('d26b0000-0000-0000-0000-00000000000b', 'bia@forahorario.local'),
  ('d26b0000-0000-0000-0000-00000000000c', 'caio@forahorario.local');
insert into public.usuarios (id, nome, email, papel) values
  ('d26b0000-0000-0000-0000-00000000000a', 'Admin HB', 'admin@forahorario.local', 'admin'),
  ('d26b0000-0000-0000-0000-00000000000b', 'Bia HB', 'bia@forahorario.local', 'atendente'),
  ('d26b0000-0000-0000-0000-00000000000c', 'Caio HB', 'caio@forahorario.local', 'atendente');
-- Bia tem o maior nível em tudo; todos os dias bloqueados = fora do horário seja quando for que o teste rode.
update public.usuario_permissoes set nivel = v.nivel
from (values ('atendimento', 'todas'), ('demandas', 'todas'), ('clientes', 'arquivar'), ('precos', 'mudar'), ('notas', 'corrigir'),
             ('assistente', 'site'), ('treinar', 'sim'), ('prazos', 'sim'), ('configuracoes', 'sim')) v(modulo, nivel)
where usuario_id = 'd26b0000-0000-0000-0000-00000000000b' and usuario_permissoes.modulo = v.modulo;
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'd26b0000-0000-0000-0000-00000000000b';
insert into public.usuario_setores (usuario_id, setor_id)
select u, id from public.setores, unnest(array['d26b0000-0000-0000-0000-00000000000b', 'd26b0000-0000-0000-0000-00000000000c']::uuid[]) u
where nome = 'Fiscal';

insert into public.clientes (id, razao_social, cnpj, ativo) values
  ('d26b1000-0000-0000-0000-000000000001', 'HB Empresa', '26260000000101', true),
  ('d26b1000-0000-0000-0000-000000000002', 'HB Arquivada', '26260000000202', false),
  ('d26b1000-0000-0000-0000-000000000003', 'HB Para arquivar', '26260000000303', true);
insert into public.parceiros_grupos (id, cliente_id, tipo, nome) values
  ('d26b4000-0000-0000-0000-000000000001', 'd26b1000-0000-0000-0000-000000000001', 'cliente', 'HB Rede');
insert into public.produtos (id, cliente_id, codigo, descricao) values
  ('d26b5000-0000-0000-0000-000000000001', 'd26b1000-0000-0000-0000-000000000001', 'HB1', 'HB Produto');
insert into public.parceiros_unidades (id, cliente_id, grupo_id, nome_unidade, ativo) values
  ('d26b7000-0000-0000-0000-000000000001', 'd26b1000-0000-0000-0000-000000000001', 'd26b4000-0000-0000-0000-000000000001', 'HB Unidade', false);
insert into public.conversas (id, telefone, estado) values ('d26b2000-0000-0000-0000-000000000001', '5531966660001', 'agente');
insert into public.contatos (id, nome, telefone) values ('d26b6000-0000-0000-0000-000000000001', 'HB Contato', '5531966660001');
insert into public.chamados (id, cliente_id, conversa_id, setor_id, titulo, status, concluido_em)
select v.id, 'd26b1000-0000-0000-0000-000000000001', v.conversa, s.id, v.titulo, v.status::public.status_chamado, v.concluido
from public.setores s, (values
  ('d26b3000-0000-0000-0000-000000000001'::uuid, 'd26b2000-0000-0000-0000-000000000001'::uuid, 'HB1 aberta', 'aberto', null::timestamptz),
  ('d26b3000-0000-0000-0000-000000000002', null, 'HB2 concluída', 'concluido', now()),
  ('d26b3000-0000-0000-0000-000000000003', null, 'HB3 sem dono', 'aberto', null)) v(id, conversa, titulo, status, concluido)
where s.nome = 'Fiscal';
insert into public.alertas (id, nivel, usuario_id, mensagem) values
  ('d26b8000-0000-0000-0000-000000000001', 'aviso', 'd26b0000-0000-0000-0000-00000000000b', 'HB alerta da Bia');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d26b0000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('teste.o1', public.salvar_orientacao(null, 'HB base', 'Texto base HB.', 'jeito', null, null, true)::text, true);
select set_config('teste.v1', (select id from public.orientacoes_agente_versoes where orientacao_id = current_setting('teste.o1')::uuid)::text, true);

-- Fora do horário (1 a 30)
select set_config('request.jwt.claims', '{"sub":"d26b0000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select ok(not public.pode_acessar_agora(), 'Bia está fora do horário');
select throws_ok($$ select public.alterar_status_chamado('d26b3000-0000-0000-0000-000000000001', 'aguardando_cliente') $$, null, null, 'fora do horário: alterar_status_chamado recusa');
select throws_ok($$ select public.assumir_demanda('d26b3000-0000-0000-0000-000000000003') $$, null, null, 'fora do horário: assumir_demanda recusa');
select throws_ok($$ select public.definir_prioridade_prazo('d26b3000-0000-0000-0000-000000000001', 'alta', now() + interval '3 days') $$, null, null, 'fora do horário: definir_prioridade_prazo recusa');
select throws_ok($$ select public.definir_responsavel('d26b3000-0000-0000-0000-000000000001', 'd26b0000-0000-0000-0000-00000000000c') $$, null, null, 'fora do horário: definir_responsavel recusa');
select throws_ok($$ select public.editar_demanda('d26b3000-0000-0000-0000-000000000001', 'HB título novo', 'descrição nova', null) $$, null, null, 'fora do horário: editar_demanda recusa');
select throws_ok($$ select public.reabrir_demanda('d26b3000-0000-0000-0000-000000000002') $$, null, null, 'fora do horário: reabrir_demanda recusa');
select throws_ok($$ select public.concluir_chamado('d26b3000-0000-0000-0000-000000000003') $$, null, null, 'fora do horário: concluir_chamado recusa');
select throws_ok($$ select public.nota_interna('d26b3000-0000-0000-0000-000000000001', 'nota HB') $$, null, null, 'fora do horário: nota_interna recusa');
select throws_ok($$ select public.transferir_chamado('d26b3000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), null) $$, null, null, 'fora do horário: transferir_chamado recusa');
select throws_ok($$ select public.assumir_conversa('d26b2000-0000-0000-0000-000000000001') $$, null, null, 'fora do horário: assumir_conversa recusa');
select throws_ok($$ select public.registrar_resposta('d26b2000-0000-0000-0000-000000000001', 'resposta HB', null, null, null) $$, null, null, 'fora do horário: registrar_resposta recusa');
select throws_ok($$ select public.devolver_ao_agente('d26b2000-0000-0000-0000-000000000001') $$, 'P0001', 'Fora do seu horário de acesso.', 'fora do horário: devolver_ao_agente recusa');
select throws_ok($$ select public.salvar_orientacao(null, 'HB orientação', 'Texto da orientação HB.', 'jeito', null, null, false) $$, null, null, 'fora do horário: salvar_orientacao recusa');
select throws_ok($$ select public.alternar_orientacao(current_setting('teste.o1')::uuid, false) $$, null, null, 'fora do horário: alternar_orientacao recusa');
select throws_ok($$ select public.restaurar_orientacao(current_setting('teste.v1')::uuid) $$, null, null, 'fora do horário: restaurar_orientacao recusa');
select throws_ok($$ select public.criar_simulacao('Olá, teste HB', null, null) $$, null, null, 'fora do horário: criar_simulacao recusa');
select throws_ok($$ select public.cadastrar_contato('Contato HB novo', '5531966660009', null, null, '{}') $$, null, null, 'fora do horário: cadastrar_contato recusa');
select throws_ok($$ select public.definir_preco('d26b4000-0000-0000-0000-000000000001', 'd26b5000-0000-0000-0000-000000000001', 10.5) $$, null, null, 'fora do horário: definir_preco recusa');
select throws_ok($$ select public.vincular_contato_conversa('d26b2000-0000-0000-0000-000000000001', 'd26b6000-0000-0000-0000-000000000001') $$, null, null, 'fora do horário: vincular_contato_conversa recusa');
select throws_ok($$ select public.arquivar_cadastro('cliente', 'd26b1000-0000-0000-0000-000000000003') $$, null, null, 'fora do horário: arquivar_cadastro recusa');
select throws_ok($$ select public.restaurar_cadastro('cliente', 'd26b1000-0000-0000-0000-000000000002') $$, null, null, 'fora do horário: restaurar_cadastro recusa');
select throws_ok($$ select public.restaurar_unidade('d26b7000-0000-0000-0000-000000000001', false) $$, null, null, 'fora do horário: restaurar_unidade recusa');
select throws_ok($$ select public.criar_demanda('d26b1000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'HB demanda nova', '', 'normal', null, null, null) $$, 'P0001', 'Fora do seu horário de acesso.', 'fora do horário: criar_demanda recusa');
select throws_ok($$ select public.definir_visao_demandas('quadro') $$, 'P0001', 'Fora do seu horário de acesso.', 'fora do horário: definir_visao_demandas recusa');
select throws_ok($$ select public.definir_tamanho_letra('grande') $$, 'P0001', 'Fora do seu horário de acesso.', 'fora do horário: definir_tamanho_letra recusa');
select throws_ok($$ select public.salvar_usuario('d26b0000-0000-0000-0000-00000000000c', '{"nome":"Caio HB","papel":"admin"}') $$,
  'P0001', 'Só o administrador muda pessoas.', 'fora do horário: salvar_usuario recusa (só administrador, que nunca é bloqueado)');
-- marcar_alerta_lido não dá erro: fora do horário ela não acha alerta nenhum e não muda nada.
select lives_ok($$ select public.marcar_alerta_lido('d26b8000-0000-0000-0000-000000000001') $$, 'fora do horário: marcar_alerta_lido não muda nada');
reset role;
select ok((select lido_em is null from public.alertas where id = 'd26b8000-0000-0000-0000-000000000001'), 'alerta continua não lido');
select ok(
  not exists (select 1 from public.chamado_eventos where usuario_id = 'd26b0000-0000-0000-0000-00000000000b')
  and not exists (select 1 from public.mensagens where atendente_id = 'd26b0000-0000-0000-0000-00000000000b')
  and not exists (select 1 from public.chamados where titulo like 'HB demanda%' or titulo like 'HB título%')
  and not exists (select 1 from public.orientacoes_agente where titulo = 'HB orientação')
  and (select ativo from public.orientacoes_agente where id = current_setting('teste.o1')::uuid)
  and not exists (select 1 from public.simulacoes_agente where usuario_id = 'd26b0000-0000-0000-0000-00000000000b')
  and not exists (select 1 from public.contatos where telefone = '5531966660009')
  and not exists (select 1 from public.precos where alterado_por = 'd26b0000-0000-0000-0000-00000000000b')
  and (select contato_id is null and estado = 'agente' from public.conversas where id = 'd26b2000-0000-0000-0000-000000000001')
  and (select ativo from public.clientes where id = 'd26b1000-0000-0000-0000-000000000003')
  and not (select ativo from public.clientes where id = 'd26b1000-0000-0000-0000-000000000002')
  and not (select ativo from public.parceiros_unidades where id = 'd26b7000-0000-0000-0000-000000000001')
  and (select visao_demandas = 'tabela' and tamanho_letra = 'normal' from public.usuarios where id = 'd26b0000-0000-0000-0000-00000000000b')
  and (select status = 'concluido' from public.chamados where id = 'd26b3000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.auditoria_acessos where usuario_id = 'd26b0000-0000-0000-0000-00000000000b'),
  'fora do horário: nada foi gravado');

-- Com o horário livre, as mesmas chamadas passam (31 a 57)
update public.usuarios set horario_acesso = null where id = 'd26b0000-0000-0000-0000-00000000000b';
set local role authenticated;
select lives_ok($$ select public.alterar_status_chamado('d26b3000-0000-0000-0000-000000000001', 'aguardando_cliente') $$, 'no horário: alterar_status_chamado passa');
select lives_ok($$ select public.assumir_demanda('d26b3000-0000-0000-0000-000000000003') $$, 'no horário: assumir_demanda passa');
select lives_ok($$ select public.definir_prioridade_prazo('d26b3000-0000-0000-0000-000000000001', 'alta', now() + interval '3 days') $$, 'no horário: definir_prioridade_prazo passa');
select lives_ok($$ select public.definir_responsavel('d26b3000-0000-0000-0000-000000000001', 'd26b0000-0000-0000-0000-00000000000c') $$, 'no horário: definir_responsavel passa');
select lives_ok($$ select public.editar_demanda('d26b3000-0000-0000-0000-000000000001', 'HB título novo', 'descrição nova', null) $$, 'no horário: editar_demanda passa');
select lives_ok($$ select public.reabrir_demanda('d26b3000-0000-0000-0000-000000000002') $$, 'no horário: reabrir_demanda passa');
select lives_ok($$ select public.concluir_chamado('d26b3000-0000-0000-0000-000000000003') $$, 'no horário: concluir_chamado passa');
select lives_ok($$ select public.nota_interna('d26b3000-0000-0000-0000-000000000001', 'nota HB') $$, 'no horário: nota_interna passa');
select lives_ok($$ select public.transferir_chamado('d26b3000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), null) $$, 'no horário: transferir_chamado passa');
select lives_ok($$ select public.assumir_conversa('d26b2000-0000-0000-0000-000000000001') $$, 'no horário: assumir_conversa passa');
select lives_ok($$ select public.registrar_resposta('d26b2000-0000-0000-0000-000000000001', 'resposta HB', null, null, null) $$, 'no horário: registrar_resposta passa');
select lives_ok($$ select public.devolver_ao_agente('d26b2000-0000-0000-0000-000000000001') $$, 'no horário: devolver_ao_agente passa');
select lives_ok($$ select public.salvar_orientacao(null, 'HB orientação', 'Texto da orientação HB.', 'jeito', null, null, false) $$, 'no horário: salvar_orientacao passa');
select lives_ok($$ select public.alternar_orientacao(current_setting('teste.o1')::uuid, false) $$, 'no horário: alternar_orientacao passa');
select lives_ok($$ select public.restaurar_orientacao(current_setting('teste.v1')::uuid) $$, 'no horário: restaurar_orientacao passa');
select lives_ok($$ select public.criar_simulacao('Olá, teste HB', null, null) $$, 'no horário: criar_simulacao passa');
select lives_ok($$ select public.cadastrar_contato('Contato HB novo', '5531966660009', null, null, '{}') $$, 'no horário: cadastrar_contato passa');
select lives_ok($$ select public.definir_preco('d26b4000-0000-0000-0000-000000000001', 'd26b5000-0000-0000-0000-000000000001', 10.5) $$, 'no horário: definir_preco passa');
select lives_ok($$ select public.vincular_contato_conversa('d26b2000-0000-0000-0000-000000000001', 'd26b6000-0000-0000-0000-000000000001') $$, 'no horário: vincular_contato_conversa passa');
select lives_ok($$ select public.arquivar_cadastro('cliente', 'd26b1000-0000-0000-0000-000000000003') $$, 'no horário: arquivar_cadastro passa');
select lives_ok($$ select public.restaurar_cadastro('cliente', 'd26b1000-0000-0000-0000-000000000002') $$, 'no horário: restaurar_cadastro passa');
select lives_ok($$ select public.restaurar_unidade('d26b7000-0000-0000-0000-000000000001', false) $$, 'no horário: restaurar_unidade passa');
select lives_ok($$ select public.criar_demanda('d26b1000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'HB demanda nova', '', 'normal', null, null, null) $$, 'no horário: criar_demanda passa');
select lives_ok($$ select public.definir_visao_demandas('quadro') $$, 'no horário: definir_visao_demandas passa');
select lives_ok($$ select public.definir_tamanho_letra('grande') $$, 'no horário: definir_tamanho_letra passa');
select lives_ok($$ select public.marcar_alerta_lido('d26b8000-0000-0000-0000-000000000001') $$, 'no horário: marcar_alerta_lido passa');
reset role;
select ok((select lido_em is not null from public.alertas where id = 'd26b8000-0000-0000-0000-000000000001'), 'no horário: o alerta fica lido');

select * from finish();
rollback;
