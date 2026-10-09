-- Auditoria 6.3 e 6.4: a retenção apaga o que o manual promete (conversas paradas, demandas concluídas com os eventos e as
-- tarefas, alertas, avisos de acesso, envios do Radar: 1 ano; auditoria_acessos: 5 anos), em lotes; anonimizar_contato
-- alcança alertas, envios do Radar e avisos de tarefa; a varredura de arquivos sem dono lê as referências de um lugar só
-- (caminhos_referenciados), e uma coluna nova com cara de caminho de arquivo que não entrou nela derruba este teste.
begin;
create extension if not exists pgtap with schema extensions;
select plan(71);

-- 1–12: estrutura e permissões (só o trabalhador; a chave da varredura só o administrador muda)
select has_column('public', 'configuracoes', 'varredura_orfaos_apagar', 'configuracoes tem a chave da varredura');
select is((select varredura_orfaos_apagar from public.configuracoes where id = 1), false, 'a varredura começa só relatando');
select has_view('public', 'caminhos_referenciados', 'as referências ao Storage num lugar só');
select ok(not has_table_privilege('authenticated', 'public.caminhos_referenciados', 'select'), 'o painel não lê as referências');
select ok(not has_table_privilege('anon', 'public.caminhos_referenciados', 'select'), 'visitante não lê as referências');
select ok(has_table_privilege('service_role', 'public.caminhos_referenciados', 'select'), 'o trabalhador lê as referências');
select ok(not has_function_privilege('authenticated', 'public.retencao_apagar(text, timestamptz, integer)', 'execute'), 'o painel não apaga por retenção');
select ok(not has_function_privilege('anon', 'public.retencao_apagar(text, timestamptz, integer)', 'execute'), 'visitante não apaga por retenção');
select ok(has_function_privilege('service_role', 'public.retencao_apagar(text, timestamptz, integer)', 'execute'), 'o trabalhador apaga por retenção');
select ok(not has_function_privilege('authenticated', 'public.listar_objetos_storage(text, text, integer)', 'execute'), 'o painel não lista o Storage');
select ok(not has_function_privilege('authenticated', 'public.caminhos_sem_referencia(text, text[])', 'execute'), 'o painel não confere referências');
select ok(has_function_privilege('service_role', 'public.caminhos_sem_referencia(text, text[])', 'execute'), 'o trabalhador confere referências');

-- 13: guarda contra arquivo "esquecido". Toda coluna com cara de caminho de arquivo precisa estar em caminhos_referenciados
-- ou na lista abaixo (com o motivo). Coluna nova (catálogo, tarefas, Radar...): ponha na view; se não for arquivo do Storage,
-- ponha aqui com o motivo. Sem isso, a varredura apagaria os arquivos dela.
select is_empty($$
  select c.table_name || '.' || c.column_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
   where c.table_schema = 'public'
     and c.column_name ~* '(path|caminho|arquivo|midia|bucket|objeto|storage|anexo|pdf|xml|comprovante|logo|foto|imagem|file|key)'
     and not exists (select 1 from information_schema.view_column_usage u
                      where u.view_schema = 'public' and u.view_name = 'caminhos_referenciados'
                        and u.table_schema = 'public' and u.table_name = c.table_name and u.column_name = c.column_name)
     and c.table_name || '.' || c.column_name not in (
       'agente_pendencias.arquivo_id',        -- aponta para agente_tarefa_arquivos (que está na view)
       'agente_skill_arquivos.caminho',       -- nome do arquivo dentro do pacote da skill; o conteúdo fica no banco
       'assistente_mensagens.arquivo',        -- descritor do CSV montado na hora (nada no Storage)
       'documentos_empresa.arquivo_mime', 'documentos_empresa.arquivo_nome',
       'mensagens.arquivo_mime', 'mensagens.arquivo_nome',
       'mensagens.midia_url_origem',          -- endereço da mídia na Z-API (fora do nosso Storage)
       'radar_fontes.caminho',                -- caminho da página no site da fonte
       'mensagens.reenfileirada', 'mensagens.reenfileirada_em')  -- "enFILEirada": marca da fila, não é arquivo
$$, 'toda coluna com caminho de arquivo está em caminhos_referenciados (ou explicada no teste)');
-- 14: o mesmo para tabelas com nome de arquivo: precisam de ao menos uma coluna na view (ou explicação).
select is_empty($$
  select t.table_name from information_schema.tables t
   where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
     and t.table_name ~* '(arquivo|anexo|documento|midia|storage|upload)'
     and not exists (select 1 from information_schema.view_column_usage u
                      where u.view_schema = 'public' and u.view_name = 'caminhos_referenciados' and u.table_name = t.table_name)
     and t.table_name not in ('agente_skill_arquivos')  -- conteúdo no banco
$$, 'toda tabela de arquivos aparece em caminhos_referenciados (ou explicada no teste)');

-- Cenário. "Agora" fixo: 2026-10-10. Um ano antes: 2025-10-10. Cinco anos: 2021-10-10.
insert into auth.users (id, email) values ('e1320000-0000-0000-0000-00000000000a', 'adm132@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values ('e1320000-0000-0000-0000-00000000000a', 'Adm 132', 'adm132@pgtap.local', 'admin');
insert into auth.users (id, email) values ('e1320000-0000-0000-0000-00000000000b', 'ana132@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values ('e1320000-0000-0000-0000-00000000000b', 'Ana 132', 'ana132@pgtap.local', 'atendente');
update public.usuario_permissoes set nivel = 'sim' where usuario_id = 'e1320000-0000-0000-0000-00000000000b' and modulo = 'configuracoes';
insert into public.clientes (id, razao_social, cnpj) values ('e1321000-0000-0000-0000-000000000001', 'Empresa 132', '13213200000101');
insert into public.contatos (id, nome, telefone) values ('e1322000-0000-0000-0000-000000000001', 'Rita 132', '5531999991321');

-- Conversas: c1 parada há 2 anos sem mensagem (sai); c2 parada há 2 anos com mensagem (fica: a etapa das mensagens vem antes);
-- c3 recente sem mensagem (fica); c4 parada há 2 anos sem mensagem, mas com a demanda aberta d3 (fica).
insert into public.conversas (id, telefone, criado_em, atualizado_em) values
  ('e1323000-0000-0000-0000-000000000001', '5531999991322', '2024-10-01', '2024-10-01'),
  ('e1323000-0000-0000-0000-000000000002', '5531999991323', '2024-10-01', '2024-10-01'),
  ('e1323000-0000-0000-0000-000000000003', '5531999991324', now(), now()),
  ('e1323000-0000-0000-0000-000000000004', '5531999991325', '2024-10-01', '2024-10-01');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, criado_em) values
  ('e1323000-0000-0000-0000-000000000002', 'entrada', 'cliente', 'texto', 'oi', '2024-10-01');
insert into public.conversa_eventos (conversa_id, tipo, texto, criado_em) values
  ('e1323000-0000-0000-0000-000000000003', 'passou_para_pessoa', 'antigo', '2025-01-01'),
  ('e1323000-0000-0000-0000-000000000003', 'passou_para_pessoa', 'novo', '2026-09-01');

-- Demandas: d1 concluída há 2 anos (sai com evento e tarefa); d2 concluída há 2 meses (fica); d3 aberta antiga (fica);
-- d4 concluída há 2 anos com arquivo vivo no compartimento "tarefas" (fica: a guarda dos arquivos é do dono).
insert into public.chamados (id, cliente_id, conversa_id, titulo, resumo) values
  ('e1324000-0000-0000-0000-000000000001', 'e1321000-0000-0000-0000-000000000001', 'e1323000-0000-0000-0000-000000000001', 'D1', 'antiga'),
  ('e1324000-0000-0000-0000-000000000002', 'e1321000-0000-0000-0000-000000000001', null, 'D2', 'recente'),
  ('e1324000-0000-0000-0000-000000000003', 'e1321000-0000-0000-0000-000000000001', 'e1323000-0000-0000-0000-000000000004', 'D3', 'aberta'),
  ('e1324000-0000-0000-0000-000000000004', 'e1321000-0000-0000-0000-000000000001', null, 'D4', 'com arquivo');
insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto) values
  ('e1324000-0000-0000-0000-000000000001', 'e1321000-0000-0000-0000-000000000001', 'nota_interna', 'e1320000-0000-0000-0000-00000000000a', 'nota antiga');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, pedido, limite_usd, limite_minutos) values
  ('e1325000-0000-0000-0000-000000000001', (select id from public.agentes where slug = 'contabil'), 'e1324000-0000-0000-0000-000000000001',
   'e1321000-0000-0000-0000-000000000001', 'Fechar o mês', 2, 20),
  ('e1325000-0000-0000-0000-000000000004', (select id from public.agentes where slug = 'contabil'), 'e1324000-0000-0000-0000-000000000004',
   'e1321000-0000-0000-0000-000000000001', 'Conferir extrato', 2, 20);
insert into public.agente_tarefa_arquivos (tarefa_id, origem, bucket, caminho, nome, mime, tamanho) values
  ('e1325000-0000-0000-0000-000000000004', 'enviado', 'tarefas', 'e1325000-0000-0000-0000-000000000004/1-extrato.pdf', 'extrato.pdf',
   'application/pdf', 10);
-- Conclui (o gatilho descarta as tarefas) e só depois põe a data antiga.
update public.chamados set status = 'concluido'
 where id in ('e1324000-0000-0000-0000-000000000001', 'e1324000-0000-0000-0000-000000000002', 'e1324000-0000-0000-0000-000000000004');
update public.chamados set concluido_em = '2024-10-01'
 where id in ('e1324000-0000-0000-0000-000000000001', 'e1324000-0000-0000-0000-000000000004');
update public.chamados set concluido_em = '2026-08-01' where id = 'e1324000-0000-0000-0000-000000000002';
update public.chamados set criado_em = '2024-01-01' where id = 'e1324000-0000-0000-0000-000000000003';
-- Pedido de venda e etapas da tarefa com texto livre (revisão 2). Gravados direto: o gatilho de chamados só marca a data,
-- e a data antiga é posta de novo abaixo.
update public.chamados set pedido_venda = '{"unidade_id":null,"texto_destinatario":"Mercado do Joaquim","data":"01/10/2024","itens":[{"produto":"Arroz","sku":null,"un":"UN","quantidade":2,"valor_unitario":10}],"data_prevista":null,"forma_pagamento":"Pix","valor_frete":5,"tipo_frete":"R","transportadora":"Transportes do Joaquim","observacoes":"ligar para Joaquim 31 99999-0000","entrega":{"endereco":"Rua do Joaquim","numero":"10","complemento":null,"bairro":"Centro","cidade":"BH","uf":"MG","cep":"30000000"}}'
 where id = 'e1324000-0000-0000-0000-000000000001';
update public.chamados set atualizado_em = '2024-10-01' where id = 'e1324000-0000-0000-0000-000000000001';
update public.agente_tarefas set etapas = '[{"nome":"Conferir extrato","concluida":true,"resumo":"Joaquim deve R$ 10"},{"nome":"Fechar","concluida":false,"resumo":null}]',
       drive_subpasta = 'Joaquim/2024'
 where id = 'e1325000-0000-0000-0000-000000000001';

insert into public.alertas (nivel, mensagem, criado_em) values ('aviso', 'alerta antigo', '2025-01-01'), ('aviso', 'alerta novo', '2026-09-01');
insert into public.auditoria_acessos (acao, entidade, entidade_id, criado_em) values
  ('editar', 'teste132', 'seis anos', '2020-10-01'), ('editar', 'teste132', 'quatro anos', '2022-10-01');
insert into public.pedidos_fora_do_acesso (contato_id, cliente_id, setor_id, dia, criado_em) values
  ('e1322000-0000-0000-0000-000000000001', 'e1321000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), '2025-01-01', '2025-01-01'),
  ('e1322000-0000-0000-0000-000000000001', 'e1321000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), '2026-09-01', '2026-09-01');
insert into public.radar_novidades (id, titulo, url, url_normalizada, fonte_nome, selo, resumo, impacto) values
  ('e1326000-0000-0000-0000-000000000001', 'Novidade 132', 'https://www.cfc.org.br/132', 'cfc.org.br/132', 'CFC', 'oficial', 'Resumo 132.', 'baixo'),
  ('e1326000-0000-0000-0000-000000000002', 'Novidade 132b', 'https://www.cfc.org.br/132b', 'cfc.org.br/132b', 'CFC', 'oficial', 'Resumo 132.', 'baixo'),
  ('e1326000-0000-0000-0000-000000000003', 'Novidade 132c', 'https://www.cfc.org.br/132c', 'cfc.org.br/132c', 'CFC', 'oficial', 'Resumo 132.', 'baixo');
insert into public.radar_envios (id, novidade_id, setor_id, cliente_id, contato_id, texto, estado, enviado_em) values
  ('e1327000-0000-0000-0000-000000000001', 'e1326000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
   'e1321000-0000-0000-0000-000000000001', 'e1322000-0000-0000-0000-000000000001', 'Rita, saiu a regra.', 'enviado', '2025-01-01'),
  ('e1327000-0000-0000-0000-000000000002', 'e1326000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Fiscal'),
   'e1321000-0000-0000-0000-000000000001', 'e1322000-0000-0000-0000-000000000001', 'Rita, saiu outra.', 'enviado', '2026-09-01'),
  ('e1327000-0000-0000-0000-000000000003', 'e1326000-0000-0000-0000-000000000003', (select id from public.setores where nome = 'Fiscal'),
   'e1321000-0000-0000-0000-000000000001', 'e1322000-0000-0000-0000-000000000001', 'Rita, aguardando.', 'aguardando', null);

-- 15–17: conversas
select is(public.retencao_apagar('conversas', '2026-10-10', 1000), 1, 'conversas: uma parada há mais de 1 ano, sem mensagem');
select ok(not exists (select 1 from public.conversas where id = 'e1323000-0000-0000-0000-000000000001'), 'a conversa parada saiu');
select is((select count(*)::int from public.conversas where id in ('e1323000-0000-0000-0000-000000000002', 'e1323000-0000-0000-0000-000000000003')), 2,
  'a conversa com mensagem e a recente ficam');
select ok(exists (select 1 from public.conversas where id = 'e1323000-0000-0000-0000-000000000004'),
  'conversa parada sem mensagem, mas com demanda aberta, fica (revisão)');
-- 18: a demanda da conversa apagada fica sem a conversa (sem bloquear e sem cascata)
select is((select conversa_id from public.chamados where id = 'e1324000-0000-0000-0000-000000000001'), null, 'a demanda perde só o vínculo com a conversa');

-- 19–20: eventos da conversa
select is(public.retencao_apagar('conversa_eventos', '2026-10-10', 1000), 1, 'eventos de conversa: um com mais de 1 ano');
select is((select array_agg(texto) from public.conversa_eventos where conversa_id = 'e1323000-0000-0000-0000-000000000003'), array['novo'], 'o recente fica');

-- Demandas, modo 'manter' (padrão): nada muda.
select is((select retencao_demandas from public.configuracoes where id = 1), 'manter', 'demandas: o padrão é manter');
select is(public.retencao_apagar('demandas', '2026-10-10', 1000), 0, 'manter: nenhuma demanda tocada');
select is((select titulo from public.chamados where id = 'e1324000-0000-0000-0000-000000000001'), 'D1', 'manter: o título fica');
select throws_ok($$ update public.configuracoes set retencao_demandas = 'jogar fora' where id = 1 $$, '23514', null, 'modo desconhecido é recusado');

-- Modo 'anonimizar': a linha fica (número, datas, status); saem os textos; a segunda volta não repete.
create temp table antes_132 as select id, numero, criado_em, atualizado_em, concluido_em, setor_id, status from public.chamados
 where id in ('e1324000-0000-0000-0000-000000000001', 'e1324000-0000-0000-0000-000000000004');
update public.configuracoes set retencao_demandas = 'anonimizar' where id = 1;
select is(public.retencao_apagar('demandas', '2026-10-10', 1000), 2, 'anonimizar: as duas concluídas há mais de 1 ano (com ou sem arquivo)');
select is((select count(*)::int from public.chamados ch join antes_132 a using (id)
            where (ch.numero, ch.criado_em, ch.atualizado_em, ch.concluido_em, ch.setor_id, ch.status)
                  is not distinct from (a.numero, a.criado_em, a.atualizado_em, a.concluido_em, a.setor_id, a.status)), 2,
  'anonimizar: número, datas, setor e status ficam como estavam');
select ok((select titulo = '[texto apagado pela guarda de 1 ano]' and resumo = '[texto apagado pela guarda de 1 ano]'
  from public.chamados where id = 'e1324000-0000-0000-0000-000000000001'), 'anonimizar: título e resumo saem');
select is((select texto from public.chamado_eventos where chamado_id = 'e1324000-0000-0000-0000-000000000001' and tipo = 'nota_interna'), null,
  'anonimizar: a nota sai (o evento fica)');
select is((select pedido from public.agente_tarefas where id = 'e1325000-0000-0000-0000-000000000001'), '[texto apagado pela guarda de 1 ano]',
  'anonimizar: o pedido da tarefa sai (a tarefa fica)');
select is((select pedido_venda - 'itens' from public.chamados where id = 'e1324000-0000-0000-0000-000000000001'),
  '{"unidade_id":null,"texto_destinatario":"[texto apagado pela guarda de 1 ano]","data":"01/10/2024","data_prevista":null,"forma_pagamento":"Pix","valor_frete":5,"tipo_frete":"R"}'::jsonb,
  'anonimizar: o pedido perde destinatário, entrega, observações e transportadora; o resto fica');
select is((select pedido_venda -> 'itens' from public.chamados where id = 'e1324000-0000-0000-0000-000000000001'),
  '[{"produto":"Arroz","sku":null,"un":"UN","quantidade":2,"valor_unitario":10}]'::jsonb, 'anonimizar: os itens do pedido ficam (relatórios de venda)');
select is((select etapas from public.agente_tarefas where id = 'e1325000-0000-0000-0000-000000000001'),
  '[{"nome":"Conferir extrato","concluida":true,"resumo":null},{"nome":"Fechar","concluida":false,"resumo":null}]'::jsonb,
  'anonimizar: o resumo de cada etapa sai; nome e situação ficam');
select is((select drive_subpasta from public.agente_tarefas where id = 'e1325000-0000-0000-0000-000000000001'), null,
  'anonimizar: a subpasta do Drive sai');
select is((select titulo from public.chamados where id = 'e1324000-0000-0000-0000-000000000002'), 'D2', 'anonimizar: a recente fica');
select is((select titulo from public.chamados where id = 'e1324000-0000-0000-0000-000000000003'), 'D3', 'anonimizar: a aberta fica');
select is(public.retencao_apagar('demandas', '2026-10-10', 1000), 0, 'anonimizar: a próxima volta não repete');

-- Modo 'apagar': com eventos e tarefa; a com arquivo vivo fica.
update public.configuracoes set retencao_demandas = 'apagar' where id = 1;
select is(public.retencao_apagar('demandas', '2026-10-10', 1000), 1, 'apagar: uma concluída há mais de 1 ano sem arquivo vivo');
select ok(not exists (select 1 from public.chamados where id = 'e1324000-0000-0000-0000-000000000001'), 'a demanda antiga saiu');
select ok(not exists (select 1 from public.chamado_eventos where chamado_id = 'e1324000-0000-0000-0000-000000000001'), 'com os eventos');
select ok(not exists (select 1 from public.agente_tarefas where id = 'e1325000-0000-0000-0000-000000000001'), 'e com a tarefa');
select ok(exists (select 1 from public.chamados where id = 'e1324000-0000-0000-0000-000000000002'), 'concluída há menos de 1 ano fica');
select ok(exists (select 1 from public.chamados where id = 'e1324000-0000-0000-0000-000000000003'), 'aberta antiga fica');
select ok(exists (select 1 from public.chamados where id = 'e1324000-0000-0000-0000-000000000004'),
  'com arquivo vivo no compartimento "tarefas" fica (a guarda dos arquivos é do dono)');

-- 28–35: alertas, auditoria, avisos de acesso, Radar
select is(public.retencao_apagar('alertas', '2026-10-10', 1000), 1, 'alertas: um com mais de 1 ano');
select is((select array_agg(mensagem) from public.alertas where mensagem like 'alerta %'), array['alerta novo'], 'o recente fica');
select is(public.retencao_apagar('auditoria', '2026-10-10', 1000), 1, 'auditoria: só a de mais de 5 anos');
select is((select array_agg(entidade_id) from public.auditoria_acessos where entidade = 'teste132'), array['quatro anos'], 'a de 4 anos fica');
select is(public.retencao_apagar('fora_do_acesso', '2026-10-10', 1000), 1, 'pedidos fora do acesso: um com mais de 1 ano');
select is(public.retencao_apagar('radar_envios', '2026-10-10', 1000), 1, 'envios do Radar: um enviado há mais de 1 ano');
select is((select array_agg(id::text order by id) from public.radar_envios where contato_id = 'e1322000-0000-0000-0000-000000000001'),
  array['e1327000-0000-0000-0000-000000000002', 'e1327000-0000-0000-0000-000000000003'], 'o recente e o aguardando ficam');
select throws_ok($$ select public.retencao_apagar('mensagens', '2026-10-10', 1000) $$, 'P0001', null, 'regra desconhecida é recusada');

-- 36–37: em lotes
insert into public.alertas (nivel, mensagem, criado_em) values ('aviso', 'lote 1', '2024-01-01'), ('aviso', 'lote 2', '2024-01-01'), ('aviso', 'lote 3', '2024-01-01');
select is(public.retencao_apagar('alertas', '2026-10-10', 2), 2, 'apaga no máximo o lote');
select is(public.retencao_apagar('alertas', '2026-10-10', 2), 1, 'a próxima volta apaga o resto');

-- 38–41: listagem do Storage (paginada) e referências
insert into storage.objects (bucket_id, name, created_at) values
  ('anexos', 'conversas/e1323000-0000-0000-0000-000000000002/1-a.pdf', '2026-09-01'),
  ('anexos', 'conversas/e1323000-0000-0000-0000-000000000002/2-b.pdf', '2026-09-01'),
  ('anexos', 'conversas/e1323000-0000-0000-0000-000000000002/3-c.pdf', '2026-09-01');
update public.mensagens set arquivo_path = 'conversas/e1323000-0000-0000-0000-000000000002/2-b.pdf'
 where conversa_id = 'e1323000-0000-0000-0000-000000000002';
select is((select array_agg(nome order by nome) from public.listar_objetos_storage('anexos', 'conversas/e1323000-0000-0000-0000-000000000002/', 2)),
  array['conversas/e1323000-0000-0000-0000-000000000002/1-a.pdf', 'conversas/e1323000-0000-0000-0000-000000000002/2-b.pdf'],
  'lista em ordem, no máximo o limite');
select is((select array_agg(nome) from public.listar_objetos_storage('anexos', 'conversas/e1323000-0000-0000-0000-000000000002/2-b.pdf', 2)),
  array['conversas/e1323000-0000-0000-0000-000000000002/3-c.pdf'], 'a próxima página começa depois do último');
select is_empty($$ select * from public.listar_objetos_storage('avatars', null, 10) $$, 'só os três compartimentos');
select is((select array_agg(c order by c) from public.caminhos_sem_referencia('anexos', array[
    'conversas/e1323000-0000-0000-0000-000000000002/1-a.pdf', 'conversas/e1323000-0000-0000-0000-000000000002/2-b.pdf',
    'e1325000-0000-0000-0000-000000000004/1-extrato.pdf']) c),
  array['conversas/e1323000-0000-0000-0000-000000000002/1-a.pdf', 'e1325000-0000-0000-0000-000000000004/1-extrato.pdf'],
  'sem referência: o da mensagem fica de fora; o caminho da tarefa conta só no compartimento dela');
-- 42–43
select is((select array_agg(c) from public.caminhos_sem_referencia('tarefas', array['e1325000-0000-0000-0000-000000000004/1-extrato.pdf', 'x/1-y.pdf']) c),
  array['x/1-y.pdf'], 'arquivo vivo da tarefa é referência');
update public.agente_tarefa_arquivos set removido_em = now() where tarefa_id = 'e1325000-0000-0000-0000-000000000004';
select is((select array_agg(c) from public.caminhos_sem_referencia('tarefas', array['e1325000-0000-0000-0000-000000000004/1-extrato.pdf']) c),
  array['e1325000-0000-0000-0000-000000000004/1-extrato.pdf'], 'arquivo marcado como removido não é mais referência');

-- 44–48: anonimizar_contato alcança alertas (telefone), envios do Radar e avisos de tarefa
insert into public.conversas (id, telefone, contato_id) values ('e1323000-0000-0000-0000-000000000009', '5531999991321', 'e1322000-0000-0000-0000-000000000001');
insert into public.chamados (id, cliente_id, conversa_id, titulo, resumo) values
  ('e1324000-0000-0000-0000-000000000009', 'e1321000-0000-0000-0000-000000000001', 'e1323000-0000-0000-0000-000000000009', 'Da Rita', 'Rita pediu');
update public.chamados set pedido_venda = '{"unidade_id":null,"texto_destinatario":"Rita","data":"09/10/2026","itens":[],"data_prevista":null,"forma_pagamento":null,"valor_frete":null,"tipo_frete":null,"transportadora":null,"observacoes":"falar com Rita","entrega":null}'
 where id = 'e1324000-0000-0000-0000-000000000009';
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, pedido, limite_usd, limite_minutos) values
  ('e1325000-0000-0000-0000-000000000009', (select id from public.agentes where slug = 'contabil'), 'e1324000-0000-0000-0000-000000000009',
   'e1321000-0000-0000-0000-000000000001', 'Tarefa da Rita', 2, 20);
insert into public.agente_tarefa_avisos (tarefa_id, usuario_id, canal, tipo, chave, mensagem) values
  ('e1325000-0000-0000-0000-000000000009', 'e1320000-0000-0000-0000-00000000000a', 'whatsapp', 'pronta', 'p132', 'Tarefa da Rita pronta.');
-- Número antigo da Rita: conversa dela com outro telefone (revisão).
insert into public.conversas (id, telefone, contato_id) values ('e1323000-0000-0000-0000-00000000000a', '5531988881321', 'e1322000-0000-0000-0000-000000000001');
insert into public.alertas (nivel, mensagem) values
  ('aviso', 'A mensagem de 5531999991321 ficou sem resposta do agente.'), ('aviso', 'A mensagem de 5531999990000 ficou sem resposta.'),
  ('aviso', 'O agente parou de responder 5531988881321.');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1320000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select lives_ok($$ select public.anonimizar_contato('e1322000-0000-0000-0000-000000000001') $$, 'o administrador anonimiza');
reset role;
select is((select count(*)::int from public.alertas where mensagem like '%5531999991321%'), 0, 'nenhum alerta guarda o telefone do titular');
select is((select count(*)::int from public.alertas where mensagem like '%5531988881321%'), 0, 'nem o número antigo dele (revisão)');
select ok(exists (select 1 from public.alertas where mensagem = 'A mensagem de 5531999990000 ficou sem resposta.'), 'alerta de outro número fica');
select is((select count(*)::int from public.radar_envios where contato_id = 'e1322000-0000-0000-0000-000000000001' and texto like '%Rita%'), 0,
  'envios do Radar ao titular sem o texto');
select is((select mensagem from public.agente_tarefa_avisos where chave = 'p132'), '[removido a pedido do titular]', 'aviso da tarefa sem o texto');
select is((select pedido_venda from public.chamados where id = 'e1324000-0000-0000-0000-000000000009'),
  '{"unidade_id":null,"texto_destinatario":"[removido a pedido do titular]","data":"09/10/2026","itens":[],"data_prevista":null,"forma_pagamento":null,"valor_frete":null,"tipo_frete":null}'::jsonb,
  'pedido de venda do titular: destinatário, entrega, observações e transportadora saem (revisão 2)');

-- 49–51: a chave da varredura só o administrador muda
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1320000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
select throws_ok($$ update public.configuracoes set varredura_orfaos_apagar = true where id = 1 $$, 'P0001',
  'Só o administrador muda a guarda das demandas e a remoção dos arquivos sem dono.', 'Configurações Sim (sem ser administrador) não liga a remoção');
select throws_ok($$ update public.configuracoes set retencao_demandas = 'manter' where id = 1 $$, 'P0001',
  'Só o administrador muda a guarda das demandas e a remoção dos arquivos sem dono.', 'Configurações Sim não muda a guarda das demandas');
select set_config('request.jwt.claims', '{"sub":"e1320000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select lives_ok($$ update public.configuracoes set varredura_orfaos_apagar = true where id = 1 $$, 'o administrador liga');
reset role;
select is((select varredura_orfaos_apagar from public.configuracoes where id = 1), true, 'ficou ligada');

select * from finish();
rollback;
