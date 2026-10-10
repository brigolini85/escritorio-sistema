-- Parte D, Task 1: o que cada pessoa vê e pode fazer HOJE, antes dos níveis (spec 7.3, "risco principal").
-- Este arquivo não muda depois do commit da Task 1. Se falhar depois de uma migração da Parte D, a migração mudou o
-- que alguém vê sem o administrador mexer: corrija a migração, nunca este teste.
begin;
create extension if not exists pgtap with schema extensions;
select plan(100);

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-00000000000a', 'admin@regressao.local'),
  ('d0000000-0000-0000-0000-00000000000b', 'ana@regressao.local'),
  ('d0000000-0000-0000-0000-00000000000c', 'caio@regressao.local'),
  ('d0000000-0000-0000-0000-00000000000d', 'duda@regressao.local'),
  ('d0000000-0000-0000-0000-00000000000e', 'eva@regressao.local'),
  ('d0000000-0000-0000-0000-00000000000f', 'ex@regressao.local');
insert into public.usuarios (id, nome, email, papel, permissoes, telefone) values
  ('d0000000-0000-0000-0000-00000000000a', 'Admin R', 'admin@regressao.local', 'admin', '{}', null),
  ('d0000000-0000-0000-0000-00000000000b', 'Ana R', 'ana@regressao.local', 'atendente', '{}', null),
  ('d0000000-0000-0000-0000-00000000000c', 'Caio R', 'caio@regressao.local', 'atendente', '{editar_clientes}', '5531988880011'),
  ('d0000000-0000-0000-0000-00000000000d', 'Duda R', 'duda@regressao.local', 'atendente',
   '{assistente_site,assistente_whatsapp,treinar_agente}', '5531988880099'),
  ('d0000000-0000-0000-0000-00000000000e', 'Eva R', 'eva@regressao.local', 'atendente', '{editar_precos,emitir_notas}', null),
  ('d0000000-0000-0000-0000-00000000000f', 'Ex R', 'ex@regressao.local', 'atendente', '{editar_clientes,assistente_whatsapp}', '5531988880022');
update public.usuarios set ativo = false where id = 'd0000000-0000-0000-0000-00000000000f';
insert into public.usuario_setores (usuario_id, setor_id)
select v.u, s.id
from (values ('d0000000-0000-0000-0000-00000000000b'::uuid, 'Fiscal'), ('d0000000-0000-0000-0000-00000000000c'::uuid, 'Pessoal'),
             ('d0000000-0000-0000-0000-00000000000e'::uuid, 'Fiscal'), ('d0000000-0000-0000-0000-00000000000e'::uuid, 'Pessoal'),
             ('d0000000-0000-0000-0000-00000000000f'::uuid, 'Fiscal')) v(u, nome)
join public.setores s on s.nome = v.nome;

insert into public.clientes (id, razao_social, cnpj) values ('d1000000-0000-0000-0000-000000000001', 'Regressão Ltda', '11222333000181');
insert into public.parceiros_grupos (id, cliente_id, tipo, nome) values
  ('d4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'cliente', 'Rede Regressão');
insert into public.produtos (id, cliente_id, codigo, descricao) values
  ('d5000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'RV1', 'Produto Regressão');
insert into public.precos (cliente_id, grupo_id, produto_id, valor) values
  ('d1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', 12.34);
insert into public.conversas (id, telefone, estado, atendente_id) values
  ('d2000000-0000-0000-0000-000000000001', '5531977770001', 'agente', null),
  ('d2000000-0000-0000-0000-000000000002', '5531977770002', 'agente', null),
  ('d2000000-0000-0000-0000-000000000003', '5531977770003', 'humano', 'd0000000-0000-0000-0000-00000000000c'),
  ('d2000000-0000-0000-0000-000000000004', '5531977770004', 'agente', null),
  ('d2000000-0000-0000-0000-000000000005', '5531977770005', 'agente', null);
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo)
select id, 'entrada', 'cliente', 'texto', 'oi ' || telefone from public.conversas where telefone ~ '^553197777000[1-5]$';
insert into public.chamados (id, cliente_id, conversa_id, setor_id, responsavel_id, titulo, status, concluido_em) values
  ('d3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001',
   (select id from public.setores where nome = 'Fiscal'), null, 'R1 Fiscal aberta', 'aberto', null),
  ('d3000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002',
   (select id from public.setores where nome = 'Pessoal'), 'd0000000-0000-0000-0000-00000000000d', 'R2 Pessoal da Duda', 'em_andamento', null),
  ('d3000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000005',
   null, null, 'R3 Triagem', 'aberto', null),
  ('d3000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', null,
   (select id from public.setores where nome = 'Contábil'), 'd0000000-0000-0000-0000-00000000000b', 'R4 Contábil da Ana', 'aberto', null),
  ('d3000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001', null,
   (select id from public.setores where nome = 'Fiscal'), null, 'R5 Fiscal concluída', 'concluido', now());
insert into public.alertas (nivel, setor_id, usuario_id, mensagem) values
  ('aviso', (select id from public.setores where nome = 'Fiscal'), null, 'R alerta do Fiscal'),
  ('aviso', (select id from public.setores where nome = 'Contábil'), 'd0000000-0000-0000-0000-00000000000b', 'R alerta da Ana'),
  -- Pessoal da Ana dentro do Fiscal: Eva (também do Fiscal) não vê. Alerta do arquivado: só o administrador vê.
  ('aviso', (select id from public.setores where nome = 'Fiscal'), 'd0000000-0000-0000-0000-00000000000b', 'R alerta pessoal da Ana no Fiscal'),
  ('aviso', (select id from public.setores where nome = 'Fiscal'), 'd0000000-0000-0000-0000-00000000000f', 'R alerta do Ex');

set local role authenticated;

-- ===== Leituras (11 por pessoa) =====

-- Administrador
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo ~ '^R[1-5] ' order by titulo),
  array['R1 Fiscal aberta', 'R2 Pessoal da Duda', 'R3 Triagem', 'R4 Contábil da Ana', 'R5 Fiscal concluída'], 'admin: demandas');
select is(array(select titulo from public.demandas_lista where titulo ~ '^R[1-5] ' order by titulo),
  array['R1 Fiscal aberta', 'R2 Pessoal da Duda', 'R3 Triagem', 'R4 Contábil da Ana', 'R5 Fiscal concluída'], 'admin: lista das demandas');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  array['1', '2', '3', '4', '5'], 'admin: linha do tempo das demandas');
select is(array(select telefone from public.conversas where telefone ~ '^553197777000[1-5]$' order by telefone),
  array['5531977770001', '5531977770002', '5531977770003', '5531977770004', '5531977770005'], 'admin: conversas');
select is(array(select conteudo from public.mensagens where conteudo ~ '^oi 553197777000[1-5]$' order by conteudo),
  array['oi 5531977770001', 'oi 5531977770002', 'oi 5531977770003', 'oi 5531977770004', 'oi 5531977770005'], 'admin: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone ~ '^553197777000[1-5]$' order by telefone),
  array['5531977770001', '5531977770002', '5531977770003', '5531977770004', '5531977770005'], 'admin: Atendimento');
select is(array(select mensagem from public.alertas where mensagem ~ '^R alerta ' order by mensagem),
  array['R alerta da Ana', 'R alerta do Ex', 'R alerta do Fiscal', 'R alerta pessoal da Ana no Fiscal'], 'admin: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente'], 'admin: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), '{}'::text[], 'admin: setores');
select is(array(select razao_social from public.clientes where id = 'd1000000-0000-0000-0000-000000000001'), array['Regressão Ltda'], 'admin: empresas');
select is(array(select valor from public.precos where cliente_id = 'd1000000-0000-0000-0000-000000000001'), array[12.34]::numeric[], 'admin: preços');

-- Ana (Fiscal)
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo ~ '^R[1-5] ' order by titulo),
  array['R1 Fiscal aberta', 'R4 Contábil da Ana', 'R5 Fiscal concluída'], 'Ana: demandas do Fiscal e a dela');
select is(array(select titulo from public.demandas_lista where titulo ~ '^R[1-5] ' order by titulo),
  array['R1 Fiscal aberta', 'R4 Contábil da Ana', 'R5 Fiscal concluída'], 'Ana: lista das demandas');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  array['1', '4', '5'], 'Ana: linha do tempo');
select is(array(select telefone from public.conversas where telefone ~ '^553197777000[1-5]$' order by telefone),
  array['5531977770001'], 'Ana: conversas');
select is(array(select conteudo from public.mensagens where conteudo ~ '^oi 553197777000[1-5]$' order by conteudo),
  array['oi 5531977770001'], 'Ana: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone ~ '^553197777000[1-5]$' order by telefone),
  array['5531977770001'], 'Ana: Atendimento');
select is(array(select mensagem from public.alertas where mensagem ~ '^R alerta ' order by mensagem),
  array['R alerta da Ana', 'R alerta do Fiscal', 'R alerta pessoal da Ana no Fiscal'], 'Ana: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  '{}'::text[], 'Ana: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), array['Fiscal'], 'Ana: setores');
select is(array(select razao_social from public.clientes where id = 'd1000000-0000-0000-0000-000000000001'), array['Regressão Ltda'], 'Ana: empresas');
select is(array(select valor from public.precos where cliente_id = 'd1000000-0000-0000-0000-000000000001'), array[12.34]::numeric[], 'Ana: preços');

-- Caio (Pessoal, assumiu a conversa 3)
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo ~ '^R[1-5] ' order by titulo), array['R2 Pessoal da Duda'], 'Caio: demandas');
select is(array(select titulo from public.demandas_lista where titulo ~ '^R[1-5] ' order by titulo), array['R2 Pessoal da Duda'], 'Caio: lista');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  array['2'], 'Caio: linha do tempo');
select is(array(select telefone from public.conversas where telefone ~ '^553197777000[1-5]$' order by telefone),
  array['5531977770002', '5531977770003'], 'Caio: conversas do Pessoal e a que assumiu');
select is(array(select conteudo from public.mensagens where conteudo ~ '^oi 553197777000[1-5]$' order by conteudo),
  array['oi 5531977770002', 'oi 5531977770003'], 'Caio: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone ~ '^553197777000[1-5]$' order by telefone),
  array['5531977770002', '5531977770003'], 'Caio: Atendimento');
select is(array(select mensagem from public.alertas where mensagem ~ '^R alerta ' order by mensagem), '{}'::text[], 'Caio: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  array['editar_clientes'], 'Caio: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), array['Pessoal'], 'Caio: setores');
select is(array(select razao_social from public.clientes where id = 'd1000000-0000-0000-0000-000000000001'), array['Regressão Ltda'], 'Caio: empresas');
select is(array(select valor from public.precos where cliente_id = 'd1000000-0000-0000-0000-000000000001'), array[12.34]::numeric[], 'Caio: preços');

-- Duda (sem setor, responsável pela R2)
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo ~ '^R[1-5] ' order by titulo), array['R2 Pessoal da Duda'], 'Duda: só a dela');
select is(array(select titulo from public.demandas_lista where titulo ~ '^R[1-5] ' order by titulo), array['R2 Pessoal da Duda'], 'Duda: lista');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  array['2'], 'Duda: linha do tempo');
select is(array(select telefone from public.conversas where telefone ~ '^553197777000[1-5]$' order by telefone),
  array['5531977770002'], 'Duda: conversa da demanda dela');
select is(array(select conteudo from public.mensagens where conteudo ~ '^oi 553197777000[1-5]$' order by conteudo),
  array['oi 5531977770002'], 'Duda: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone ~ '^553197777000[1-5]$' order by telefone),
  array['5531977770002'], 'Duda: Atendimento');
select is(array(select mensagem from public.alertas where mensagem ~ '^R alerta ' order by mensagem), '{}'::text[], 'Duda: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  array['assistente_site', 'assistente_whatsapp', 'treinar_agente'], 'Duda: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), '{}'::text[], 'Duda: setores');
select is(array(select razao_social from public.clientes where id = 'd1000000-0000-0000-0000-000000000001'), array['Regressão Ltda'], 'Duda: empresas');
select is(array(select valor from public.precos where cliente_id = 'd1000000-0000-0000-0000-000000000001'), array[12.34]::numeric[], 'Duda: preços');

-- Eva (Fiscal e Pessoal)
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo ~ '^R[1-5] ' order by titulo),
  array['R1 Fiscal aberta', 'R2 Pessoal da Duda', 'R5 Fiscal concluída'], 'Eva: demandas dos dois setores');
select is(array(select titulo from public.demandas_lista where titulo ~ '^R[1-5] ' order by titulo),
  array['R1 Fiscal aberta', 'R2 Pessoal da Duda', 'R5 Fiscal concluída'], 'Eva: lista');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  array['1', '2', '5'], 'Eva: linha do tempo');
select is(array(select telefone from public.conversas where telefone ~ '^553197777000[1-5]$' order by telefone),
  array['5531977770001', '5531977770002'], 'Eva: conversas');
select is(array(select conteudo from public.mensagens where conteudo ~ '^oi 553197777000[1-5]$' order by conteudo),
  array['oi 5531977770001', 'oi 5531977770002'], 'Eva: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone ~ '^553197777000[1-5]$' order by telefone),
  array['5531977770001', '5531977770002'], 'Eva: Atendimento');
select is(array(select mensagem from public.alertas where mensagem ~ '^R alerta ' order by mensagem), array['R alerta do Fiscal'], 'Eva: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  array['editar_precos', 'emitir_notas'], 'Eva: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), array['Fiscal', 'Pessoal'], 'Eva: setores');
select is(array(select razao_social from public.clientes where id = 'd1000000-0000-0000-0000-000000000001'), array['Regressão Ltda'], 'Eva: empresas');
select is(array(select valor from public.precos where cliente_id = 'd1000000-0000-0000-0000-000000000001'), array[12.34]::numeric[], 'Eva: preços');

-- Ex (arquivado)
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo ~ '^R[1-5] ' order by titulo), '{}'::text[], 'Ex: nada');
select is(array(select titulo from public.demandas_lista where titulo ~ '^R[1-5] ' order by titulo), '{}'::text[], 'Ex: lista vazia');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  '{}'::text[], 'Ex: linha do tempo vazia');
select is(array(select telefone from public.conversas where telefone ~ '^553197777000[1-5]$' order by telefone), '{}'::text[], 'Ex: conversas');
select is(array(select conteudo from public.mensagens where conteudo ~ '^oi 553197777000[1-5]$' order by conteudo), '{}'::text[], 'Ex: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone ~ '^553197777000[1-5]$' order by telefone), '{}'::text[], 'Ex: Atendimento');
select is(array(select mensagem from public.alertas where mensagem ~ '^R alerta ' order by mensagem), '{}'::text[], 'Ex: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  '{}'::text[], 'Ex: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), '{}'::text[], 'Ex: setores');
select is(array(select razao_social from public.clientes where id = 'd1000000-0000-0000-0000-000000000001'), '{}'::text[], 'Ex: empresas');
select is(array(select valor from public.precos where cliente_id = 'd1000000-0000-0000-0000-000000000001'), '{}'::numeric[], 'Ex: preços');

-- ===== Gravações =====

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.nota_interna('d3000000-0000-0000-0000-000000000001', 'nota R') $$, 'Ana: nota interna no Fiscal');
select throws_ok($$ select public.nota_interna('d3000000-0000-0000-0000-000000000002', 'nota R') $$,
  'P0001', 'sem acesso a este chamado', 'Ana: sem nota no Pessoal');
select throws_ok($$ insert into public.clientes (razao_social, cnpj) values ('R Nova', '99888777000166') $$, '42501', null, 'Ana: não cria cliente');
select throws_ok($$ select public.uso_do_cadastro('cliente', 'd1000000-0000-0000-0000-000000000001') $$, 'P0001', 'Sem permissão para arquivar cadastros.', 'Ana: não arquiva');
select throws_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
                    values ('d0000000-0000-0000-0000-00000000000b', 'site', 'usuario', 'pergunta R') $$, '42501', null, 'Ana: sem assistente');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$ insert into public.clientes (razao_social, cnpj) values ('R Outra', '55444333000122') $$, 'Caio: cria cliente');
select lives_ok($$ select public.uso_do_cadastro('cliente', 'd1000000-0000-0000-0000-000000000001') $$, 'Caio: arquiva');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$ select public.uso_do_cadastro('cliente', 'd1000000-0000-0000-0000-000000000001') $$, 'P0001', 'Sem permissão para arquivar cadastros.', 'Eva: não arquiva');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
                   values ('d0000000-0000-0000-0000-00000000000d', 'site', 'usuario', 'pergunta R') $$, 'Duda: pergunta ao assistente');
select ok(public.eh_telefone_do_assistente('5531988880099'), 'telefone da Duda é do assistente');
select ok(not public.eh_telefone_do_assistente('5531977770001'), 'telefone de cliente não é do assistente');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select throws_ok($$ select public.nota_interna('d3000000-0000-0000-0000-000000000001', 'nota R') $$,
  'P0001', 'sem acesso a este chamado', 'Ex: arquivado não grava');
select throws_ok($$ select public.uso_do_cadastro('cliente', 'd1000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Sem permissão para arquivar cadastros.', 'Ex: arquivado não arquiva, mesmo com editar_clientes');

-- Assistente: a marcação vale também para o administrador (não há passe livre); o telefone só com a marcação e ativo.
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
                    values ('d0000000-0000-0000-0000-00000000000a', 'site', 'usuario', 'pergunta R') $$, '42501', null,
  'admin sem a marcação não pergunta ao assistente');
select ok(not public.eh_telefone_do_assistente('5531988880011'), 'telefone do Caio (sem assistente_whatsapp) não é do assistente');
select ok(not public.eh_telefone_do_assistente('5531988880022'), 'telefone do Ex (arquivado, com assistente_whatsapp) não é do assistente');

-- Ações na demanda e na conversa fora do que a pessoa vê
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.assumir_demanda('d3000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Você não tem acesso a esta demanda.', 'Ana: não assume demanda do Pessoal');
select throws_ok($$ select public.concluir_chamado('d3000000-0000-0000-0000-000000000002') $$,
  'P0001', 'sem acesso a este chamado', 'Ana: não conclui demanda do Pessoal');
select throws_ok($$ select public.transferir_chamado('d3000000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Fiscal'), null) $$,
  'P0001', 'sem acesso a este chamado', 'Ana: não transfere demanda do Pessoal');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.assumir_conversa('d2000000-0000-0000-0000-000000000001') $$,
  'P0001', 'sem acesso a esta conversa', 'Caio: não assume conversa do Fiscal');

-- Eva age no Fiscal: assume, transfere para o Pessoal (continua vendo), conclui; e assume a conversa do Pessoal.
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select lives_ok($$ select public.assumir_demanda('d3000000-0000-0000-0000-000000000001') $$, 'Eva: assume a R1');
select is((select responsavel_id from public.chamados where id = 'd3000000-0000-0000-0000-000000000001'),
  'd0000000-0000-0000-0000-00000000000e'::uuid, 'Eva: R1 fica com ela');
select lives_ok($$ select public.transferir_chamado('d3000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Pessoal'), null) $$,
  'Eva: transfere a R1 para o Pessoal');
select lives_ok($$ select public.concluir_chamado('d3000000-0000-0000-0000-000000000001') $$, 'Eva: conclui a R1');
select is((select status::text from public.chamados where id = 'd3000000-0000-0000-0000-000000000001'), 'concluido', 'Eva: R1 concluída');
select lives_ok($$ select public.assumir_conversa('d2000000-0000-0000-0000-000000000002') $$, 'Eva: assume a conversa do Pessoal');

-- ===== Realtime: as mesmas tabelas, filtradas pelas mesmas regras de leitura =====
select is(array(select tablename::text from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1),
  array['assistente_mensagens', 'chamados', 'conversas', 'mensagens', 'simulacoes_agente'], 'Realtime: tabelas publicadas');
select matches((select qual from pg_policies where schemaname = 'public' and tablename = 'chamados' and policyname = 'leitura'),
  'pode_ver_chamado\(id\)', 'Realtime: demandas pela regra de leitura');
select matches((select qual from pg_policies where schemaname = 'public' and tablename = 'conversas' and policyname = 'leitura'),
  'pode_ver_conversa\(id\)', 'Realtime: conversas pela regra de leitura');
select matches((select qual from pg_policies where schemaname = 'public' and tablename = 'mensagens' and policyname = 'leitura'),
  'pode_ver_conversa\(conversa_id\)', 'Realtime: mensagens pela regra de leitura');
select ok(has_table_privilege('authenticated', 'public.chamados', 'select') and has_table_privilege('authenticated', 'public.conversas', 'select')
  and has_table_privilege('authenticated', 'public.mensagens', 'select'), 'Realtime: a equipe lê pelas políticas');

-- ===== Visitante (sem login) =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select 1 from public.demandas_lista $$, '42501', null, 'visitante: sem lista das demandas');
-- Auditoria 6.14: o visitante não tem mais grant nas tabelas e views (antes a RLS devolvia zero linhas).
select throws_ok($$ select count(*) from public.caixa_entrada $$, '42501', null, 'visitante: Atendimento vazio');
select throws_ok($$ select count(*) from public.clientes $$, '42501', null, 'visitante: nenhuma empresa');

select * from finish();
rollback;
