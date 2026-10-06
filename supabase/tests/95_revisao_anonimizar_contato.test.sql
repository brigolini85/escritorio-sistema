-- Revisão geral, área 1, I5: anonimizar_contato (LGPD) alcança o que as Partes C e I passaram a guardar.
-- Demandas do titular (pela conversa ou só por chamados.contato_id): título, resumo e notas; tarefas dessas demandas
-- (pedido, anotações, resultado, ajustes); pendências dessas tarefas ou com o contato (textos); sugestões e pré-análises;
-- e os arquivos das tarefas: anexos da conversa e arquivos do compartimento "tarefas" ligados a pendência do contato
-- saem marcados como removidos e voltam no retorno, para a fila apagar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values ('95000000-0000-0000-0000-00000000000a', 'adm95@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values ('95000000-0000-0000-0000-00000000000a', 'Adm 95', 'adm95@pgtap.local', 'admin');
insert into public.clientes (id, razao_social, cnpj) values ('95100000-0000-0000-0000-000000000001', 'Empresa 95', '95950000000101');
insert into public.contatos (id, nome, telefone) values ('95200000-0000-0000-0000-000000000001', 'João 95', '5531999999501');
insert into public.conversas (id, telefone, contato_id) values
  ('95300000-0000-0000-0000-000000000001', '5531999999501', '95200000-0000-0000-0000-000000000001');
insert into public.mensagens (id, conversa_id, direcao, autor, tipo, conteudo, arquivo_path) values
  ('95400000-0000-0000-0000-000000000001', '95300000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'documento', 'meu RG',
   'conversas/95300000-0000-0000-0000-000000000001/rg.pdf');
-- A: pela conversa. B: só pelo contato (criar_demanda com p_contato). C: de outra pessoa.
insert into public.chamados (id, cliente_id, conversa_id, contato_id, titulo, resumo) values
  ('95500000-0000-0000-0000-00000000000a', '95100000-0000-0000-0000-000000000001', '95300000-0000-0000-0000-000000000001', null, 'NF do João 95', 'João pediu NF'),
  ('95500000-0000-0000-0000-00000000000b', '95100000-0000-0000-0000-000000000001', null, '95200000-0000-0000-0000-000000000001', 'Pedido do João 95', 'CPF do João'),
  ('95500000-0000-0000-0000-00000000000c', '95100000-0000-0000-0000-000000000001', null, null, 'Fechamento 95', 'Rotina');
insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto) values
  ('95500000-0000-0000-0000-00000000000b', '95100000-0000-0000-0000-000000000001', 'nota_interna', '95000000-0000-0000-0000-00000000000a', 'João ligou');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, pedido, anotacoes, resultado, ajustes, limite_usd, limite_minutos) values
  ('95600000-0000-0000-0000-00000000000b', (select id from public.agentes where slug = 'contabil'), '95500000-0000-0000-0000-00000000000b',
   '95100000-0000-0000-0000-000000000001', 'Conferir o CPF do João', 'João é sócio', '{"linhas":["João"]}', '["trocar o nome do João"]', 2, 20),
  ('95600000-0000-0000-0000-00000000000c', (select id from public.agentes where slug = 'contabil'), '95500000-0000-0000-0000-00000000000c',
   '95100000-0000-0000-0000-000000000001', 'Fechar o mês', 'rotina', null, '[]', 2, 20);
insert into public.agente_tarefa_arquivos (id, tarefa_id, origem, bucket, caminho, nome, mime, tamanho) values
  ('95700000-0000-0000-0000-000000000001', '95600000-0000-0000-0000-00000000000b', 'conversa', 'anexos',
   'conversas/95300000-0000-0000-0000-000000000001/rg.pdf', 'rg.pdf', 'application/pdf', 0),
  ('95700000-0000-0000-0000-000000000002', '95600000-0000-0000-0000-00000000000c', 'enviado', 'tarefas',
   '95600000-0000-0000-0000-00000000000c/1-comprovante-joao.pdf', 'comprovante-joao.pdf', 'application/pdf', 10),
  ('95700000-0000-0000-0000-000000000003', '95600000-0000-0000-0000-00000000000c', 'enviado', 'tarefas',
   '95600000-0000-0000-0000-00000000000c/2-balancete.pdf', 'balancete.pdf', 'application/pdf', 10);
-- Pendência ao cliente com o João, numa tarefa que não é dele, respondida com o arquivo dele; outra pendência sem o João.
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, detalhe, mensagem, estado, resposta, respondida_em, arquivo_id,
                                      contato_id, pedido_texto) values
  ('95600000-0000-0000-0000-00000000000c', 1, 'cliente', 'Comprovante de endereço', 'do sócio João', 'Oi João, mande o comprovante',
   'respondida', 'João mandou', now(), '95700000-0000-0000-0000-000000000002', '95200000-0000-0000-0000-000000000001', 'João, mande o comprovante'),
  ('95600000-0000-0000-0000-00000000000c', 2, 'analista', 'Saldo confere?', 'rotina', null, 'aberta', null, null, null, null, null);
insert into public.agente_sugestoes (chamado_id, cliente_id, agente_id, tipo, conteudo) values
  ('95500000-0000-0000-0000-00000000000a', '95100000-0000-0000-0000-000000000001', (select id from public.agentes where slug = 'contabil'),
   'nota_interna', '{"texto":"João pediu"}'),
  ('95500000-0000-0000-0000-00000000000c', '95100000-0000-0000-0000-000000000001', (select id from public.agentes where slug = 'contabil'),
   'nota_interna', '{"texto":"rotina"}');
insert into public.pre_analises_nota (chamado_id, cliente_id, resultado) values
  ('95500000-0000-0000-0000-00000000000b', '95100000-0000-0000-0000-000000000001', '{"versao":1,"linhas":[{"cliente":"João"}]}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"95000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
-- 1. Devolve os anexos da conversa e o arquivo do compartimento "tarefas" ligado à pendência do João.
select is((select array_agg(p order by p) from unnest(public.anonimizar_contato('95200000-0000-0000-0000-000000000001')) p),
  array['95600000-0000-0000-0000-00000000000c/1-comprovante-joao.pdf', 'conversas/95300000-0000-0000-0000-000000000001/rg.pdf'],
  'devolve os arquivos a remover dos dois compartimentos');
reset role;

-- 2 a 5. Demandas.
select ok((select titulo = '[removido a pedido do titular]' and resumo = '[removido a pedido do titular]'
  from public.chamados where id = '95500000-0000-0000-0000-00000000000a'), 'demanda da conversa: título e resumo apagados');
select ok((select titulo = '[removido a pedido do titular]' and resumo = '[removido a pedido do titular]'
  from public.chamados where id = '95500000-0000-0000-0000-00000000000b'), 'demanda só pelo contato: título e resumo apagados');
select is((select texto from public.chamado_eventos where chamado_id = '95500000-0000-0000-0000-00000000000b' and tipo = 'nota_interna'),
  null, 'nota da demanda só pelo contato apagada');
select ok((select titulo = 'Fechamento 95' and resumo = 'Rotina' from public.chamados where id = '95500000-0000-0000-0000-00000000000c'),
  'demanda de outra pessoa fica');
-- 6 a 7. Tarefas.
select ok((select pedido = '[removido a pedido do titular]' and anotacoes = '' and resultado is null and ajustes = '[]'::jsonb
  from public.agente_tarefas where id = '95600000-0000-0000-0000-00000000000b'), 'tarefa da demanda do titular: textos apagados');
select ok((select pedido = 'Fechar o mês' and anotacoes = 'rotina' from public.agente_tarefas where id = '95600000-0000-0000-0000-00000000000c'),
  'tarefa de outra demanda fica');
-- 8 a 9. Pendências.
select ok((select pedido_texto is null and resposta is null and mensagem is null and detalhe is null
  and pergunta = '[removido a pedido do titular]'
  from public.agente_pendencias where tarefa_id = '95600000-0000-0000-0000-00000000000c' and numero = 1),
  'pendência com o contato: textos apagados');
select ok((select pergunta = 'Saldo confere?' and detalhe = 'rotina' from public.agente_pendencias
  where tarefa_id = '95600000-0000-0000-0000-00000000000c' and numero = 2), 'pendência sem o contato fica');
-- 10 a 12. Sugestões e pré-análise.
select is((select count(*)::int from public.agente_sugestoes where chamado_id = '95500000-0000-0000-0000-00000000000a'), 0,
  'sugestões da demanda do titular apagadas');
select is((select count(*)::int from public.agente_sugestoes where chamado_id = '95500000-0000-0000-0000-00000000000c'), 1,
  'sugestão de outra demanda fica');
select is((select count(*)::int from public.pre_analises_nota where chamado_id = '95500000-0000-0000-0000-00000000000b'), 0,
  'pré-análise da demanda do titular apagada');
-- 13 a 15. Arquivos das tarefas.
select ok((select removido_em is not null from public.agente_tarefa_arquivos where id = '95700000-0000-0000-0000-000000000001'),
  'anexo da conversa na tarefa marcado como removido');
select ok((select removido_em is not null from public.agente_tarefa_arquivos where id = '95700000-0000-0000-0000-000000000002'),
  'arquivo do compartimento "tarefas" ligado ao contato marcado como removido');
select ok((select removido_em is null from public.agente_tarefa_arquivos where id = '95700000-0000-0000-0000-000000000003'),
  'outro arquivo da tarefa fica');
-- 16. O que já valia continua.
select is((select conteudo from public.mensagens where id = '95400000-0000-0000-0000-000000000001'), '[removido a pedido do titular]',
  'mensagem continua apagada');

select * from finish();
rollback;
