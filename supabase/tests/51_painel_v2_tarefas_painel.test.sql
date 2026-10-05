-- Parte I3a, Task 3 (spec 7E.4; D3, D7, D8, D11, D13, D14, D20): as ações de uma pessoa do setor na tarefa do agente.
-- Além do brief: F3 (conversa que a pessoa não vê), F10 (setor inativo), F11 (tipo do arquivo), F21 (teto do escritório),
-- F25 (ajuste em pausa por limite), pedido de nota sem "Pedidos de nota", envio ao Storage e leitura por quem não vê a demanda.
begin;
create extension if not exists pgtap with schema extensions;
select plan(60);

insert into auth.users (id, email) values
  ('f9000000-0000-0000-0000-00000000000a', 'claudia@i3b.local'), ('f9000000-0000-0000-0000-00000000000b', 'paula@i3b.local'),
  ('f9000000-0000-0000-0000-00000000000c', 'dono@i3b.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('f9000000-0000-0000-0000-00000000000a', 'I3 Cláudia', 'claudia@i3b.local', 'atendente', '{}'),
  ('f9000000-0000-0000-0000-00000000000b', 'I3 Paula', 'paula@i3b.local', 'atendente', '{}'),
  ('f9000000-0000-0000-0000-00000000000c', 'I3 Dono', 'dono@i3b.local', 'atendente', '{}');
update public.usuarios set dono = false where dono;
update public.usuarios set dono = true where id = 'f9000000-0000-0000-0000-00000000000c';
insert into public.usuario_setores (usuario_id, setor_id) values
  ('f9000000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil')),
  ('f9000000-0000-0000-0000-00000000000b', (select id from public.setores where nome = 'Pessoal')),
  ('f9000000-0000-0000-0000-00000000000c', (select id from public.setores where nome = 'Contábil'));
-- Paula vê todas as demandas, mas não é do Contábil (D20: vê; não mexe).
update public.usuario_permissoes set nivel = 'todas' where modulo = 'demandas' and usuario_id = 'f9000000-0000-0000-0000-00000000000b';
insert into public.clientes (id, razao_social, cnpj) values
  ('f9100000-0000-0000-0000-00000000000a', 'I3 Padaria Sol', '21448390000107'), ('f9100000-0000-0000-0000-00000000000b', 'I3 Outra', '11222333000181');
insert into public.chamados (id, cliente_id, setor_id, titulo) values
  ('f9200000-0000-0000-0000-00000000000a', 'f9100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechamento de outubro'),
  ('f9200000-0000-0000-0000-00000000000b', 'f9100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Fiscal'), 'Guia');
-- Demanda do Contábil com pedido de nota (ruling da Task 2: a tarefa segue "Pedidos de nota").
insert into public.chamados (id, cliente_id, setor_id, titulo, pedido_venda) values
  ('f9200000-0000-0000-0000-00000000000c', 'f9100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Nota de outubro', '{"itens":[]}');
update public.agentes set estado = 'ligado' where slug = 'contabil';
insert into public.agente_skills (id, agente_id, nome, tipo, ativo) values
  ('f9400000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'contabil'), 'fechamento-mensal', 'procedimento', true);
insert into public.agente_skill_versoes (skill_id, versao, titulo, descricao, tipo, corpo, skill_md) values
  ('f9400000-0000-0000-0000-00000000000a', 1, 'Fechamento mensal', 'Quando pedirem o fechamento.', 'procedimento', '## Etapas
1. Coletar documentos', '---');
insert into public.contatos (id, nome, telefone) values
  ('f9500000-0000-0000-0000-00000000000a', 'I3 Roberto', '5531999990301'), ('f9500000-0000-0000-0000-00000000000b', 'I3 Sem procura', '5531999990302');
insert into public.contato_clientes (contato_id, cliente_id, perfil) values
  ('f9500000-0000-0000-0000-00000000000a', 'f9100000-0000-0000-0000-00000000000a', 'personalizado'),
  ('f9500000-0000-0000-0000-00000000000b', 'f9100000-0000-0000-0000-00000000000a', 'personalizado');
insert into public.contato_cliente_setores (contato_id, cliente_id, setor_id, pode_ser_procurado) values
  ('f9500000-0000-0000-0000-00000000000a', 'f9100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), true),
  ('f9500000-0000-0000-0000-00000000000b', 'f9100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), false);

-- A RLS de agentes esconde o agente da pessoa do setor: os ids vêm guardados de antes (a tela os lê de agentes_de_trabalho_da_demanda).
select set_config('teste.contabil', (select id::text from public.agentes where slug = 'contabil'), true),
       set_config('teste.fiscal', (select id::text from public.agentes where slug = 'fiscal'), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1–4: agentes de trabalho da demanda (D3)
select is((select count(*)::int from public.agentes_de_trabalho_da_demanda('f9200000-0000-0000-0000-00000000000a')), 1, 'o Contábil aparece para a demanda do Contábil');
select is((select pode_pedir from public.agentes_de_trabalho_da_demanda('f9200000-0000-0000-0000-00000000000a')), true, 'Ligado: Cláudia pode pedir');
select is((select procedimentos -> 0 ->> 'nome' from public.agentes_de_trabalho_da_demanda('f9200000-0000-0000-0000-00000000000a')), 'fechamento-mensal', 'com os procedimentos');
select is((select count(*)::int from public.agentes_de_trabalho_da_demanda('f9200000-0000-0000-0000-00000000000b')), 0, 'demanda de outro setor: nenhum');

-- 5–7: criar recusado (D3)
select throws_ok($$ select public.criar_tarefa_agente('f9200000-0000-0000-0000-00000000000a', current_setting('teste.fiscal')::uuid, 'Fechar outubro') $$,
  'P0001', 'Este agente não faz tarefas deste setor.', 'agente de outro setor');
select throws_ok($$ select public.criar_tarefa_agente('f9200000-0000-0000-0000-00000000000a', current_setting('teste.contabil')::uuid, 'x') $$,
  'P0001', 'Escreva o que o agente deve fazer (até 2.000 letras).', 'pedido curto');
select throws_ok($$ select public.criar_tarefa_agente('f9200000-0000-0000-0000-00000000000a', current_setting('teste.contabil')::uuid, 'Fechar outubro', 'nao-existe') $$,
  'P0001', 'Procedimento não encontrado neste agente.', 'procedimento de fora');

-- 8–9: setor inativo: o agente não atende (F10)
reset role;
update public.setores set ativo = false where nome = 'Contábil';
set local role authenticated;
select is((select count(*)::int from public.agentes_de_trabalho_da_demanda('f9200000-0000-0000-0000-00000000000a')), 0, 'setor inativo: nenhum agente');
select throws_ok($$ select public.criar_tarefa_agente('f9200000-0000-0000-0000-00000000000a', current_setting('teste.contabil')::uuid, 'Fechar outubro') $$,
  'P0001', 'Este agente não faz tarefas deste setor.', 'setor inativo: não cria');
reset role;
update public.setores set ativo = true where nome = 'Contábil';

-- 10: demanda com pedido de nota, sem "Pedidos de nota" (ruling da Task 2)
update public.usuario_permissoes set nivel = 'sem_acesso' where modulo = 'notas' and usuario_id = 'f9000000-0000-0000-0000-00000000000a';
set local role authenticated;
select throws_ok($$ select public.criar_tarefa_agente('f9200000-0000-0000-0000-00000000000c', current_setting('teste.contabil')::uuid, 'Conferir a nota') $$,
  'P0001', 'Só quem vê os pedidos de nota pede tarefa nesta demanda.', 'pedido de nota sem acesso às notas: não cria');
reset role;
update public.usuario_permissoes set nivel = 'ver' where modulo = 'notas' and usuario_id = 'f9000000-0000-0000-0000-00000000000a';
set local role authenticated;

-- 11–14: criar (D3)
select isnt(public.criar_tarefa_agente('f9200000-0000-0000-0000-00000000000a', current_setting('teste.contabil')::uuid,
  'Fazer o fechamento de outubro', 'fechamento-mensal'), null, 'Cláudia cria');
select throws_ok($$ select public.criar_tarefa_agente('f9200000-0000-0000-0000-00000000000a', current_setting('teste.contabil')::uuid, 'De novo') $$,
  'P0001', 'Esta demanda já tem uma tarefa do agente em andamento.', 'uma ativa por demanda');
select is((select limite_usd from public.agente_tarefas), 2.00::numeric, 'copiou o limite de custo do agente (D13)');
select is((select texto from public.agente_tarefa_eventos), 'pediu a tarefa pelo painel', 'evento de quem pediu');

-- 15–18: quem não é do setor (D20)
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.agente_tarefas), 1, 'Paula vê a tarefa (vê a demanda)');
select throws_ok($$ select public.pausar_tarefa((select id from public.agente_tarefas)) $$, 'P0001',
  'Só quem é do setor da demanda mexe na tarefa do agente.', 'Paula não pausa');
select throws_ok($$ select public.criar_tarefa_agente('f9200000-0000-0000-0000-00000000000b', current_setting('teste.contabil')::uuid, 'Fechar') $$,
  'P0001', null, 'Paula não cria');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('tarefas', (select id from public.agente_tarefas)::text || '/9-paula.pdf') $$,
  '42501', null, 'Paula não envia arquivo à tarefa (Storage)');

-- 19–22: pausar e continuar (D4, D13)
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.pausar_tarefa((select id from public.agente_tarefas)) $$, 'Cláudia pausa');
select is((select motivo_pausa from public.agente_tarefas), 'pessoa', 'motivo: pessoa');
reset role;
update public.agente_tarefas set motivo_pausa = 'limite_custo', custo_usd = 2.10;
set local role authenticated;
select is(public.continuar_tarefa((select id from public.agente_tarefas)), true, 'continua (enfileirar)');
select is((select limite_usd from public.agente_tarefas), 4.00::numeric, 'limite de custo somado uma vez');

-- 23–26: pendência para o analista; resposta parcial não retoma; a última retoma (D8)
reset role;
update public.agente_tarefas set estado = 'aguardando_pendencias';
insert into public.agente_pendencias (id, tarefa_id, numero, tipo, pergunta, opcoes) values
  ('f9600000-0000-0000-0000-00000000000a', (select id from public.agente_tarefas), 1, 'analista', 'PIX é pró-labore?', '{Pró-labore,Distribuição de lucro}'),
  ('f9600000-0000-0000-0000-00000000000b', (select id from public.agente_tarefas), 2, 'analista', 'Despesa sem nota: qual conta?', '{}'),
  ('f9600000-0000-0000-0000-00000000000c', (select id from public.agente_tarefas), 3, 'cliente', 'Extrato do BB de outubro', '{}');
set local role authenticated;
select is(public.responder_pendencia('f9600000-0000-0000-0000-00000000000a', 'Pró-labore'), false, 'parcial: não retoma');
select throws_ok($$ select public.responder_pendencia('f9600000-0000-0000-0000-00000000000a', 'De novo') $$, 'P0001', 'Esta pendência já foi respondida.', 'resposta dupla');
select throws_ok($$ select public.responder_pendencia('f9600000-0000-0000-0000-00000000000c', 'x') $$, 'P0001', 'Pendência do cliente: use "Já recebi".', 'cliente não é respondida como analista');
select is(public.responder_pendencia('f9600000-0000-0000-0000-00000000000b', 'Manutenção'), false, 'ainda falta a do cliente');

-- 27–33: pedir ao cliente (D7)
select is((select count(*)::int from public.contatos_para_pendencia('f9600000-0000-0000-0000-00000000000c')), 1, 'só quem pode ser procurado no setor');
select throws_ok($$ select public.pedir_pendencia_ao_cliente('f9600000-0000-0000-0000-00000000000c', 'f9500000-0000-0000-0000-00000000000b', 'Oi! Manda o extrato?') $$,
  'P0001', 'Este contato não pode ser procurado pelo agente deste setor.', 'sem "pode ser procurado": recusa');
select is(public.pedir_pendencia_ao_cliente('f9600000-0000-0000-0000-00000000000c', 'f9500000-0000-0000-0000-00000000000a',
  'Roberto, bom dia! Para fechar outubro só falta o extrato do Banco do Brasil. Pode mandar o PDF por aqui?'), 1, 'primeiro pedido (vez 1)');
select throws_ok($$ select public.pedir_pendencia_ao_cliente('f9600000-0000-0000-0000-00000000000c', 'f9500000-0000-0000-0000-00000000000a', 'Cobrando de novo') $$,
  'P0001', 'Já foi pedido há menos de 24 horas. Cobre de novo amanhã.', 'cobrar antes de 24 h');
reset role;
update public.agente_pendencias set pedido_em = now() - interval '25 hours' where id = 'f9600000-0000-0000-0000-00000000000c';
set local role authenticated;
select is(public.pedir_pendencia_ao_cliente('f9600000-0000-0000-0000-00000000000c', 'f9500000-0000-0000-0000-00000000000a', 'Cobrando de novo o extrato.'), 2, 'cobrar de novo (vez 2)');
select is((select pedido_enviado_em from public.agente_pendencias where id = 'f9600000-0000-0000-0000-00000000000c'), null, 'cada pedido volta a "a enviar"');
select is((select texto from public.agente_tarefa_eventos order by criado_em desc limit 1), 'cobrou de novo a pendência 3', 'evento da cobrança');

-- 34: teto do escritório: 30 pedidos a clientes por dia, somando todos os contatos (F21)
reset role;
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, estado, respondida_em, pedido_em)
  select (select id from public.agente_tarefas), n, 'cliente', 'Pedido antigo ' || n, 'respondida', now(), now() from generate_series(10, 38) n;
insert into public.agente_pendencias (id, tarefa_id, numero, tipo, pergunta) values
  ('f9600000-0000-0000-0000-00000000000d', (select id from public.agente_tarefas), 5, 'cliente', 'Extrato do Itaú de outubro');
set local role authenticated;
select throws_ok($$ select public.pedir_pendencia_ao_cliente('f9600000-0000-0000-0000-00000000000d', 'f9500000-0000-0000-0000-00000000000a', 'Manda o extrato do Itaú?') $$,
  'P0001', 'O escritório já fez 30 pedidos a clientes hoje. Tente amanhã.', '31º pedido do dia no escritório: recusa');
reset role;
delete from public.agente_pendencias where numero = 5 or numero between 10 and 38;

-- 35–41: arquivo da conversa e "já recebi" (D7, D14, F3)
insert into public.conversas (id, telefone) values
  ('f9700000-0000-0000-0000-00000000000a', '5531999990301'), ('f9700000-0000-0000-0000-00000000000b', '5531999990302');
-- A conversa do Roberto é a da demanda (Cláudia a vê); a do outro contato não está em demanda nenhuma do setor (Cláudia não vê).
update public.chamados set conversa_id = 'f9700000-0000-0000-0000-00000000000a' where id = 'f9200000-0000-0000-0000-00000000000a';
insert into public.mensagens (id, conversa_id, cliente_id, direcao, autor, tipo, arquivo_path, arquivo_nome, arquivo_mime) values
  ('f9800000-0000-0000-0000-00000000000a', 'f9700000-0000-0000-0000-00000000000a', null, 'entrada', 'cliente', 'documento', 'conversas/x/extrato-bb.pdf', 'extrato-bb.pdf', 'application/pdf'),
  ('f9800000-0000-0000-0000-00000000000b', 'f9700000-0000-0000-0000-00000000000a', null, 'entrada', 'cliente', 'audio', 'conversas/x/audio.ogg', 'audio.ogg', 'audio/ogg'),
  ('f9800000-0000-0000-0000-00000000000c', 'f9700000-0000-0000-0000-00000000000b', null, 'entrada', 'cliente', 'documento', 'conversas/y/outro.pdf', 'outro.pdf', 'application/pdf');
set local role authenticated;
select is((select count(*)::int from public.arquivos_da_conversa_para_pendencia('f9600000-0000-0000-0000-00000000000c')), 1,
  'só os tipos que o agente lê, das conversas que a pessoa vê');
select throws_ok($$ select public.receber_pendencia('f9600000-0000-0000-0000-00000000000c', null, null, 'f9800000-0000-0000-0000-00000000000b') $$,
  'P0001', null, 'áudio não entra');
select throws_ok($$ select public.receber_pendencia('f9600000-0000-0000-0000-00000000000c', null, null, 'f9800000-0000-0000-0000-00000000000c') $$,
  'P0001', 'Arquivo da conversa não encontrado para esta empresa.', 'anexo de conversa que a pessoa não vê: recusa (F3)');
select is(public.receber_pendencia('f9600000-0000-0000-0000-00000000000c', 'Chegou pelo WhatsApp.', null, 'f9800000-0000-0000-0000-00000000000a'), true,
  'já recebi com o arquivo da conversa: a última pendência retoma');
select is((select estado from public.agente_tarefas), 'trabalhando', 'voltou a trabalhar');
select is((select bucket || ':' || origem from public.agente_tarefa_arquivos), 'anexos:conversa', 'referência ao anexo, sem cópia');
select is((select resposta from public.agente_pendencias where numero = 3), 'Chegou pelo WhatsApp. · arquivo: extrato-bb.pdf', 'resposta com o arquivo');

-- 42–47: arquivo enviado (D14, F11)
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('tarefas', (select id from public.agente_tarefas)::text || '/2-planilha.xlsx') $$,
  'Cláudia (do setor) envia ao Storage');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('tarefas', 'nao-e-tarefa/1-extrato.pdf') $$,
  '42501', null, 'caminho inválido: o Storage recusa');
reset role;
insert into storage.objects (bucket_id, name) values ('tarefas', (select id from public.agente_tarefas)::text || '/1-extrato itau.pdf');
set local role authenticated;
select isnt(public.registrar_arquivo_tarefa((select id from public.agente_tarefas), (select id from public.agente_tarefas)::text || '/1-extrato itau.pdf',
  'extrato itau.pdf', 'application/pdf', 1000), null, 'registra o enviado');
select throws_ok($$ select public.registrar_arquivo_tarefa((select id from public.agente_tarefas), (select id from public.agente_tarefas)::text || '/2-falso.pdf',
  'falso.pdf', 'application/pdf', 10) $$, 'P0001', 'Arquivo não encontrado no envio.', 'sem o objeto no Storage: recusa');
select throws_ok($$ select public.registrar_arquivo_tarefa((select id from public.agente_tarefas), (select id from public.agente_tarefas)::text || '/1-extrato itau.pdf',
  'extrato itau.pdf', 'application/pdf', 1000) $$, 'P0001', 'Este arquivo já está na tarefa.', 'mesmo caminho: recusa');
select throws_ok($$ select public.registrar_arquivo_tarefa((select id from public.agente_tarefas), (select id from public.agente_tarefas)::text || '/2-planilha.xlsx',
  'planilha.xlsx', 'application/octet-stream', 10) $$, 'P0001', 'O agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.', 'tipo não aceito: recusa');

-- 48–49: pedir ajuste numa pausa por limite soma o limite, como CONTINUAR (F25)
reset role;
update public.agente_tarefas set estado = 'pausada', motivo_pausa = 'limite_tempo', segundos_trabalhando = 1200;
set local role authenticated;
select is(public.pedir_ajuste_tarefa((select id from public.agente_tarefas), 'Separe o pró-labore em outra linha.'), true, 'ajuste na pausa por limite (enfileirar)');
select is((select limite_minutos from public.agente_tarefas), 40, 'limite de tempo somado uma vez');

-- 50–55: aprovar (D11)
select throws_ok($$ select public.aprovar_tarefa((select id from public.agente_tarefas)) $$, 'P0001',
  'A tarefa ainda não está pronta para aprovar.', 'trabalhando: não aprova');
reset role;
update public.agente_tarefas set estado = 'pronta',
  resultado = '{"versao":1,"resumo":"214 lançamentos; Itaú conciliado.","destaques":[],"linhas":[],"observacoes":null}';
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta) values ((select id from public.agente_tarefas), 4, 'analista', 'Ainda aberta?');
set local role authenticated;
select throws_ok($$ select public.aprovar_tarefa((select id from public.agente_tarefas)) $$, 'P0001',
  'Responda as pendências antes de aprovar.', 'travado com pendência aberta');
reset role;
delete from public.agente_pendencias where numero = 4;
set local role authenticated;
select lives_ok($$ select public.aprovar_tarefa((select id from public.agente_tarefas)) $$, 'aprova');
select throws_ok($$ select public.aprovar_tarefa((select id from public.agente_tarefas)) $$, 'P0001', 'A tarefa já foi decidida.', 'clique duplo');
select is((select status::text from public.chamados where id = 'f9200000-0000-0000-0000-00000000000a'), 'concluido', 'a demanda foi concluída');
select is((select count(*)::int from public.chamado_eventos where chamado_id = 'f9200000-0000-0000-0000-00000000000a' and tipo = 'nota_interna'
  and texto like 'Resultado da tarefa do Agente Contábil, aprovado por I3 Cláudia: 214 lançamentos%'), 1, 'uma nota interna com o resumo');

-- 56–58: quem não vê a demanda não lê pendências, linha do tempo nem arquivos (D20)
reset role;
update public.usuario_permissoes set nivel = 'meu_setor' where modulo = 'demandas' and usuario_id = 'f9000000-0000-0000-0000-00000000000b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.agente_pendencias), 0, 'Paula (só o setor dela) não vê as pendências');
select is((select count(*)::int from public.agente_tarefa_eventos), 0, 'nem a linha do tempo');
select is((select count(*)::int from public.agente_tarefa_arquivos), 0, 'nem os arquivos');

-- 59–60: limites só do dono (D13)
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_limites_tarefa('contabil', 3, 30) $$, 'P0001', 'Só o dono altera os limites das tarefas.', 'Cláudia não muda');
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_limites_tarefa('contabil', 3.5, 30) $$, 'o dono muda');

select * from finish();
rollback;
