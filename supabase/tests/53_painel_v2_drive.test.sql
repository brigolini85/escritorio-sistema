-- Parte I3b, Task 4 (spec 7E.6; D4, D5, D8, D9): a pasta do cliente no Drive, a situação da conta e os arquivos do Drive na tarefa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values
  ('fb000000-0000-0000-0000-00000000000a', 'claudia@i3d.local'), ('fb000000-0000-0000-0000-00000000000b', 'paula@i3d.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('fb000000-0000-0000-0000-00000000000a', 'I3D Cláudia', 'claudia@i3d.local', 'atendente', '{editar_clientes}'),
  ('fb000000-0000-0000-0000-00000000000b', 'I3D Paula', 'paula@i3d.local', 'atendente', '{}');
insert into public.usuario_setores (usuario_id, setor_id) values
  ('fb000000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil')),
  ('fb000000-0000-0000-0000-00000000000b', (select id from public.setores where nome = 'Pessoal'));
update public.usuario_permissoes set nivel = 'todas' where modulo = 'demandas' and usuario_id = 'fb000000-0000-0000-0000-00000000000b';
insert into public.clientes (id, razao_social, cnpj) values
  ('fb100000-0000-0000-0000-00000000000a', 'I3D Padaria Sol', '21448390000107'), ('fb100000-0000-0000-0000-00000000000b', 'I3D Mercearia Lua', '11222333000181');
insert into public.chamados (id, cliente_id, setor_id, titulo) values
  ('fb200000-0000-0000-0000-00000000000a', 'fb100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechamento de outubro');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, setor_id, pedido, limite_usd, limite_minutos) values
  ('fb300000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'contabil'), 'fb200000-0000-0000-0000-00000000000a',
   'fb100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechar outubro', 2, 20);
insert into storage.objects (bucket_id, name) values
  ('tarefas', 'fb300000-0000-0000-0000-00000000000a/drive/1PdfDoDriveAbcdefghij-1.pdf'),
  ('tarefas', 'fb300000-0000-0000-0000-00000000000a/drive/1DocxDoDriveAbcdefghi-1.docx'),
  ('tarefas', 'fb300000-0000-0000-0000-00000000000a/outra/1PdfDoDriveAbcdefghij-2.pdf');

-- 1–4: as colunas e a tabela
select has_column('public', 'clientes', 'drive_pasta_id', 'clientes.drive_pasta_id');
select throws_ok($$ update public.clientes set drive_pasta_id = 'curta' where id = 'fb100000-0000-0000-0000-00000000000a' $$, '23514', null, 'formato do código da pasta');
select has_table('public', 'drive_conta', 'drive_conta');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('drive_conta')), 0, 'drive_conta fora do Realtime');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fb000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
-- 5: Paula não edita clientes
select throws_ok($$ select public.salvar_pasta_drive('fb100000-0000-0000-0000-00000000000a', '1PastaDaPadariaSolAbcdefghij') $$,
  'P0001', 'Você não tem permissão para editar clientes.', 'sem editar clientes: recusa');
select set_config('request.jwt.claims', '{"sub":"fb000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
-- 6–10: Cláudia salva, limpa, e a pasta é de um cliente só
select is(public.salvar_pasta_drive('fb100000-0000-0000-0000-00000000000a', ' 1PastaDaPadariaSolAbcdefghij '), '1PastaDaPadariaSolAbcdefghij', 'salva o código sem espaços');
select throws_ok($$ select public.salvar_pasta_drive('fb100000-0000-0000-0000-00000000000b', '1PastaDaPadariaSolAbcdefghij') $$,
  'P0001', 'Esta pasta do Drive já é de outro cliente.', 'pasta de outro cliente: recusa');
select throws_ok($$ select public.salvar_pasta_drive('fb100000-0000-0000-0000-00000000000b', 'https://drive.google.com/x') $$,
  'P0001', 'Cole o link da pasta do Drive (drive.google.com/drive/folders/…).', 'link cru: o painel converte antes');
select is(public.salvar_pasta_drive('fb100000-0000-0000-0000-00000000000b', '1PastaDaMerceariaLuaAbcdefgh'), '1PastaDaMerceariaLuaAbcdefgh', 'Lua com a pasta dela');
select throws_ok($$ select public.salvar_pasta_drive('fb100000-0000-0000-0000-0000000000ff', '1PastaQueNaoExisteAbcdefghij') $$,
  'P0001', 'Cliente não encontrado.', 'cliente que não existe');
-- 11–12: a situação do Drive: pessoa ativa lê; ninguém grava pela API
select is((select count(*)::int from public.drive_conta), 0, 'sem situação gravada ainda');
select throws_ok($$ insert into public.drive_conta (id, email) values (1, 'x@y.z') $$, '42501', null, 'pessoa não grava a situação');
-- 13–14: só o trabalhador
select throws_ok($$ select public.registrar_situacao_drive('x@y.z', null) $$, '42501', null, 'pessoa não chama registrar_situacao_drive');
select throws_ok($$ select public.pasta_drive_da_tarefa('fb300000-0000-0000-0000-00000000000a') $$, '42501', null, 'pessoa não chama pasta_drive_da_tarefa');
-- 15–17: LER A PASTA DE NOVO
select is(public.pedir_leitura_da_pasta('fb300000-0000-0000-0000-00000000000a'), true, 'Cláudia pede a leitura');
select is((select texto from public.agente_tarefa_eventos where tarefa_id = 'fb300000-0000-0000-0000-00000000000a' order by criado_em desc limit 1),
  'pediu para ler a pasta do Drive de novo', 'evento na linha do tempo');
select throws_ok($$ select public.pedir_leitura_da_pasta('fb300000-0000-0000-0000-00000000000a') $$,
  'P0001', 'A pasta já está sendo lida. Espere um pouco.', 'duas vezes em 2 minutos: recusa');
select set_config('request.jwt.claims', '{"sub":"fb000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
-- 18: quem não é do setor não pede
select throws_ok($$ select public.pedir_leitura_da_pasta('fb300000-0000-0000-0000-00000000000a') $$,
  'P0001', 'Só quem é do setor da demanda mexe na tarefa do agente.', 'outro setor: recusa');

reset role;
select set_config('request.jwt.claims', '', true);
set local role service_role;
-- 19–20: o que o trabalhador recebe
select is((public.pasta_drive_da_tarefa('fb300000-0000-0000-0000-00000000000a') ->> 'pasta'), '1PastaDaPadariaSolAbcdefghij', 'a pasta da Padaria');
select is((public.pasta_drive_da_tarefa('fb300000-0000-0000-0000-00000000000a') -> 'outras'), '["1PastaDaMerceariaLuaAbcdefgh"]'::jsonb, 'as pastas dos outros clientes (D5)');
-- 21–26: registrar arquivo do Drive
select throws_ok($$ select public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/outra/1PdfDoDriveAbcdefghij-2.pdf',
  'extrato.pdf', 'application/pdf', 100, '1PdfDoDriveAbcdefghij', '2026-10-01') $$, 'P0001', 'Arquivo não encontrado no envio.', 'caminho fora de <tarefa>/drive/');
select throws_ok($$ select public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/drive/1DocxDoDriveAbcdefghi-1.docx',
  'contrato.docx', 'application/octet-stream', 100, '1DocxDoDriveAbcdefghi', '2026-10-01') $$, 'P0001', 'O agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.', 'tipo não aceito');
select throws_ok($$ select public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/drive/1PdfDoDriveAbcdefghij-1.pdf',
  'extrato.pdf', 'application/pdf', 100, 'x', '2026-10-01') $$, 'P0001', 'Código do Drive inválido.', 'código inválido');
select is((public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/drive/1PdfDoDriveAbcdefghij-1.pdf',
  'extrato.pdf', 'application/pdf', 100, '1PdfDoDriveAbcdefghij', '2026-10-01') ->> 'nome'), 'extrato.pdf', 'registra o arquivo do Drive');
select is((select origem || ':' || drive_id from public.agente_tarefa_arquivos where tarefa_id = 'fb300000-0000-0000-0000-00000000000a'),
  'drive:1PdfDoDriveAbcdefghij', 'origem drive com o código');
select throws_ok($$ select public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/drive/1PdfDoDriveAbcdefghij-1.pdf',
  'extrato.pdf', 'application/pdf', 100, '1PdfDoDriveAbcdefghij', '2026-10-01') $$, 'P0001', 'Este arquivo do Drive já está na tarefa.', 'o mesmo arquivo não entra duas vezes');
-- 27: cliente sem pasta (a pessoa limpou no meio): o banco recusa
reset role;
update public.clientes set drive_pasta_id = null where id = 'fb100000-0000-0000-0000-00000000000a';
set local role service_role;
select throws_ok($$ select public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/drive/1PdfDoDriveAbcdefghij-1.pdf',
  'extrato2.pdf', 'application/pdf', 100, '1OutroPdfAbcdefghijkl', '2026-10-01') $$, 'P0001', 'O cliente não tem pasta no Drive.', 'sem pasta: recusa (D5, barreira 4)');
-- 28: situação gravada pelo trabalhador
select lives_ok($$ select public.registrar_situacao_drive('drive@escritorio.iam.gserviceaccount.com', null) $$, 'o trabalhador grava a situação');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fb000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
-- 29–30: quem vê a demanda lê a situação e o arquivo do Drive (D9, D20 da I3a)
select is((select email from public.drive_conta), 'drive@escritorio.iam.gserviceaccount.com', 'pessoa ativa lê a situação');
select is((select count(*)::int from public.agente_tarefa_arquivos where tarefa_id = 'fb300000-0000-0000-0000-00000000000a'), 1, 'quem vê a demanda vê o arquivo do Drive');

select * from finish();
rollback;
