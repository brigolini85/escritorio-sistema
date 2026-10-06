-- Parte I3a, Task 2 (spec 7E.4, 7E.8; D3, D4, D11, D14, D20): tabelas das tarefas de trabalho, leitura por quem vê a demanda,
-- escrita só por funções, compartimento "tarefas" e a tarefa descartada quando a demanda é concluída por outro caminho.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email) values
  ('f8000000-0000-0000-0000-00000000000a', 'claudia@i3a.local'), ('f8000000-0000-0000-0000-00000000000b', 'paula@i3a.local'),
  ('f8000000-0000-0000-0000-00000000000c', 'admin@i3a.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('f8000000-0000-0000-0000-00000000000a', 'I3 Cláudia', 'claudia@i3a.local', 'atendente', '{}'),
  ('f8000000-0000-0000-0000-00000000000b', 'I3 Paula', 'paula@i3a.local', 'atendente', '{}'),
  ('f8000000-0000-0000-0000-00000000000c', 'I3 Admin', 'admin@i3a.local', 'admin', '{}');
insert into public.usuario_setores (usuario_id, setor_id) values
  ('f8000000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil')),
  ('f8000000-0000-0000-0000-00000000000b', (select id from public.setores where nome = 'Pessoal'));
insert into public.clientes (id, razao_social, cnpj) values ('f8100000-0000-0000-0000-00000000000a', 'I3 Padaria Sol', '21448390000107');
insert into public.chamados (id, cliente_id, setor_id, titulo) values
  ('f8200000-0000-0000-0000-00000000000a', 'f8100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechamento de outubro'),
  ('f8200000-0000-0000-0000-00000000000b', 'f8100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Conferência');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, setor_id, pedida_por, pedido, limite_usd, limite_minutos) values
  ('f8300000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'contabil'), 'f8200000-0000-0000-0000-00000000000a',
   'f8100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'f8000000-0000-0000-0000-00000000000a',
   'Fechar outubro', 2, 20);
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta) values
  ('f8300000-0000-0000-0000-00000000000a', 1, 'analista', 'PIX de R$ 3.200 é pró-labore?');
insert into public.agente_tarefa_eventos (tarefa_id, quem, texto) values ('f8300000-0000-0000-0000-00000000000a', 'sistema', 'teste');

-- 1–5: estrutura e padrões
select has_table('public', 'agente_tarefas', 'agente_tarefas existe');
select col_default_is('public', 'agentes', 'tarefa_limite_usd', '2', 'limite de custo padrão US$ 2 (D13)');
select col_default_is('public', 'agentes', 'tarefa_limite_minutos', '20', 'limite de tempo padrão 20 min (D13)');
select has_column('public', 'uso_ia', 'tarefa_id', 'uso_ia.tarefa_id (D12)');
select is((select estado from public.agente_tarefas where id = 'f8300000-0000-0000-0000-00000000000a'), 'trabalhando', 'nasce trabalhando');

-- 6–9: travas da tabela
select throws_ok($$ insert into public.agente_tarefas (agente_id, chamado_id, pedido, limite_usd, limite_minutos)
  values ((select id from public.agentes where slug = 'contabil'), 'f8200000-0000-0000-0000-00000000000a', 'Outra', 2, 20) $$,
  '23505', null, 'uma tarefa ativa por demanda (D3)');
select throws_ok($$ update public.agente_tarefas set estado = 'pausada' where id = 'f8300000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'pausada sem motivo: recusa (D4)');
select throws_ok($$ update public.agente_tarefas set estado = 'aprovada' where id = 'f8300000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'aprovada sem data da decisão: recusa');
select throws_ok($$ insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta) values ('f8300000-0000-0000-0000-00000000000a', 1, 'analista', 'repetida') $$,
  '23505', null, 'número da pendência único na tarefa');

-- 10–15: quem vê (D20)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.agente_tarefas), 1, 'Cláudia (Contábil) vê a tarefa da demanda do setor');
select is((select count(*)::int from public.agente_pendencias), 1, 'Cláudia vê a pendência');
select is((select count(*)::int from public.agente_tarefa_eventos), 1, 'Cláudia vê a linha do tempo');
select is(public.pode_mexer_na_tarefa('f8300000-0000-0000-0000-00000000000a'), true, 'Cláudia mexe (setor da tarefa)');
select throws_ok($$ insert into public.agente_tarefa_eventos (tarefa_id, quem, texto) values ('f8300000-0000-0000-0000-00000000000a', 'pessoa', 'x') $$,
  '42501', null, 'ninguém grava direto');
select set_config('request.jwt.claims', '{"sub":"f8000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.agente_tarefas), 0, 'Paula (Pessoal, nível do setor) não vê');

-- 16–17: administrador
select set_config('request.jwt.claims', '{"sub":"f8000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.agente_tarefas), 1, 'administrador vê');
select is(public.pode_mexer_na_tarefa('f8300000-0000-0000-0000-00000000000a'), true, 'administrador mexe');

-- 18–19: o caminho do arquivo diz a tarefa (D14)
reset role;
select is(public.tarefa_do_caminho('f8300000-0000-0000-0000-00000000000a/1-extrato.pdf'), 'f8300000-0000-0000-0000-00000000000a'::uuid, 'tarefa do caminho');
select is(public.tarefa_do_caminho('../outra/extrato.pdf'), null, 'caminho sem tarefa: nulo (a regra recusa)');

-- 20–21: service_role também só pelas funções
set local role service_role;
select throws_ok($$ update public.agente_tarefas set custo_usd = 1 where id = 'f8300000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'service_role não atualiza direto');
select throws_ok($$ insert into public.agente_tarefa_arquivos (tarefa_id, origem, bucket, caminho, nome, mime, tamanho)
  values ('f8300000-0000-0000-0000-00000000000a', 'enviado', 'tarefas', 'x', 'x.pdf', 'application/pdf', 1) $$, '42501', null, 'service_role não insere arquivo direto');
reset role;

-- 22–24: demanda concluída por outro caminho descarta a tarefa ativa (D11)
update public.chamados set status = 'concluido', concluido_em = now() where id = 'f8200000-0000-0000-0000-00000000000a';
select is((select estado from public.agente_tarefas where id = 'f8300000-0000-0000-0000-00000000000a'), 'descartada', 'tarefa descartada');
select ok((select decidida_em is not null and decidida_por is null from public.agente_tarefas where id = 'f8300000-0000-0000-0000-00000000000a'), 'data da decisão, sem pessoa');
select is((select texto from public.agente_tarefa_eventos where tarefa_id = 'f8300000-0000-0000-0000-00000000000a' order by criado_em desc limit 1),
  'descartou a tarefa: a demanda foi concluída', 'evento do sistema');

-- 25–26: compartimento sem leitura direta e só com os tipos aceitos (F7)
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT' and qual like '%tarefas%'), 0,
  'sem política de leitura no compartimento tarefas (download só pela rota auditada)');
select is((select array_length(allowed_mime_types, 1) from storage.buckets where id = 'tarefas'), 9, 'compartimento tarefas aceita só os tipos da D14');

-- 27–32: demanda com pedido de nota: a tarefa segue "Pedidos de nota", como as sugestões (P11/I2; revisão final, Important 1)
insert into public.chamados (id, cliente_id, setor_id, titulo, pedido_venda) values
  ('f8200000-0000-0000-0000-00000000000c', 'f8100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Nota de outubro', '{"itens":[]}');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, setor_id, pedida_por, pedido, limite_usd, limite_minutos) values
  ('f8300000-0000-0000-0000-00000000000b', (select id from public.agentes where slug = 'contabil'), 'f8200000-0000-0000-0000-00000000000c',
   'f8100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'f8000000-0000-0000-0000-00000000000a',
   'Conferir a nota', 2, 20);
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta) values ('f8300000-0000-0000-0000-00000000000b', 1, 'analista', 'Qual CFOP?');
insert into public.agente_tarefa_eventos (tarefa_id, quem, texto) values ('f8300000-0000-0000-0000-00000000000b', 'sistema', 'nota');
insert into public.agente_tarefa_arquivos (tarefa_id, origem, bucket, caminho, nome, mime, tamanho) values
  ('f8300000-0000-0000-0000-00000000000b', 'enviado', 'tarefas', 'f8300000-0000-0000-0000-00000000000b/1-pedido.pdf', 'pedido.pdf', 'application/pdf', 1);
update public.usuario_permissoes set nivel = 'sem_acesso' where modulo = 'notas' and usuario_id = 'f8000000-0000-0000-0000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.agente_tarefas where id = 'f8300000-0000-0000-0000-00000000000b'), 0,
  'sem "Pedidos de nota": Cláudia não vê a tarefa da demanda com pedido');
select is((select count(*)::int from public.agente_pendencias where tarefa_id = 'f8300000-0000-0000-0000-00000000000b'), 0, 'nem as pendências');
select is((select count(*)::int from public.agente_tarefa_arquivos where tarefa_id = 'f8300000-0000-0000-0000-00000000000b')
        + (select count(*)::int from public.agente_tarefa_eventos where tarefa_id = 'f8300000-0000-0000-0000-00000000000b'), 0, 'nem os arquivos e a linha do tempo');
select is(public.pode_mexer_na_tarefa('f8300000-0000-0000-0000-00000000000b'), false, 'nem mexe (nem envia arquivo)');
reset role;
update public.usuario_permissoes set nivel = 'ver' where modulo = 'notas' and usuario_id = 'f8000000-0000-0000-0000-00000000000a';
set local role authenticated;
select is((select count(*)::int from public.agente_pendencias where tarefa_id = 'f8300000-0000-0000-0000-00000000000b'), 1,
  'com "Pedidos de nota": vê as pendências');
select is(public.pode_ver_tarefa('f8300000-0000-0000-0000-00000000000b'), true, 'e vê a tarefa (download e CSV)');
reset role;

select * from finish();
rollback;
