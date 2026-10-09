-- Auditoria 1.3, 6.9 e 6.10: o documento só aponta para a pasta da própria empresa (clientes/<cliente_id>/), não muda de
-- empresa nem de arquivo depois de criado, e os compartimentos "anexos" e "documentos" têm limite de tamanho e de tipo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email) values ('e1280000-0000-0000-0000-00000000000a', 'admin128@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values ('e1280000-0000-0000-0000-00000000000a', 'Admin 128', 'admin128@pgtap.local', 'admin');
insert into public.clientes (id, razao_social, cnpj) values
  ('e1280000-0000-0000-0000-0000000000a1', 'Empresa A 128 Ltda', '11444777000161'),
  ('e1280000-0000-0000-0000-0000000000b1', 'Empresa B 128 Ltda', '11222333000181');

-- ---------- 1.3: o caminho é da própria empresa ----------
select throws_ok($$ insert into public.documentos_empresa (cliente_id, nome, arquivo_path, arquivo_nome) values
  ('e1280000-0000-0000-0000-0000000000a1', 'Contrato', 'clientes/e1280000-0000-0000-0000-0000000000b1/contrato.pdf', 'contrato.pdf') $$,
  '23514', null, 'caminho na pasta de outra empresa: recusado');
select throws_ok($$ insert into public.documentos_empresa (cliente_id, nome, arquivo_path, arquivo_nome) values
  ('e1280000-0000-0000-0000-0000000000a1', 'Contrato', 'clientes/e1280000-0000-0000-0000-0000000000a1/../e1280000-0000-0000-0000-0000000000b1/contrato.pdf', 'contrato.pdf') $$,
  '23514', null, 'caminho com ".." recusado');
select throws_ok($$ insert into public.documentos_empresa (cliente_id, nome, arquivo_path, arquivo_nome) values
  ('e1280000-0000-0000-0000-0000000000a1', 'Contrato', 'e1280000-0000-0000-0000-0000000000a1/contrato.pdf', 'contrato.pdf') $$,
  '23514', null, 'caminho fora de "clientes/" recusado');
select throws_ok($$ insert into public.documentos_empresa (cliente_id, nome, arquivo_path, arquivo_nome) values
  ('e1280000-0000-0000-0000-0000000000a1', 'Contrato', 'clientes/e1280000-0000-0000-0000-0000000000a1x/contrato.pdf', 'contrato.pdf') $$,
  '23514', null, 'id da empresa com sobra (prefixo de outro id): recusado');
select throws_ok($$ insert into public.documentos_empresa (cliente_id, nome, arquivo_path, arquivo_nome) values
  ('e1280000-0000-0000-0000-0000000000a1', 'Contrato', 'clientes/e1280000-0000-0000-0000-0000000000a1/..', 'contrato.pdf') $$,
  '23514', null, '".." como última pasta: recusado');
-- Revisão da Task 10: ".." só conta como pasta; dois pontos no nome do arquivo são válidos.
select lives_ok($$ insert into public.documentos_empresa (cliente_id, nome, arquivo_path, arquivo_nome) values
  ('e1280000-0000-0000-0000-0000000000a1', 'Relatório', 'clientes/e1280000-0000-0000-0000-0000000000a1/1700000000-Relatorio..pdf', 'Relatorio..pdf') $$,
  'nome com dois pontos seguidos: aceito');
select lives_ok($$ insert into public.documentos_empresa (id, cliente_id, nome, arquivo_path, arquivo_nome) values
  ('e1280000-0000-0000-0000-0000000000d1', 'e1280000-0000-0000-0000-0000000000a1', 'Contrato', 'clientes/e1280000-0000-0000-0000-0000000000a1/1700000000-contrato.pdf', 'contrato.pdf') $$,
  'caminho na pasta da própria empresa: aceito');

-- ---------- 1.3 / 6.10: empresa e arquivo não mudam depois de criados ----------
select throws_ok($$ update public.documentos_empresa set cliente_id = 'e1280000-0000-0000-0000-0000000000b1'
  where id = 'e1280000-0000-0000-0000-0000000000d1' $$, '23514', null, 'trocar a empresa do documento: recusado');
select throws_ok($$ update public.documentos_empresa set arquivo_path = 'clientes/e1280000-0000-0000-0000-0000000000b1/contrato.pdf'
  where id = 'e1280000-0000-0000-0000-0000000000d1' $$, '23514', null, 'apontar para o arquivo de outra empresa: recusado');
select throws_ok($$ update public.documentos_empresa set arquivo_path = 'clientes/e1280000-0000-0000-0000-0000000000a1/outro.pdf'
  where id = 'e1280000-0000-0000-0000-0000000000d1' $$, '23514', null, 'trocar o arquivo, mesmo na pasta certa: recusado');
select throws_ok($$ update public.documentos_empresa set cliente_id = 'e1280000-0000-0000-0000-0000000000b1',
  arquivo_path = 'clientes/e1280000-0000-0000-0000-0000000000b1/1700000000-contrato.pdf'
  where id = 'e1280000-0000-0000-0000-0000000000d1' $$, '23514', null, 'trocar empresa e caminho juntos: recusado');
select lives_ok($$ update public.documentos_empresa set nome = 'Contrato social', ia_pode_enviar = true,
  cliente_id = 'e1280000-0000-0000-0000-0000000000a1' where id = 'e1280000-0000-0000-0000-0000000000d1' $$,
  'mudar nome e liberação (e regravar a mesma empresa) continua valendo');

-- Pela API, com a sessão de quem edita clientes: o mesmo bloqueio.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1280000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select throws_ok($$ insert into public.documentos_empresa (cliente_id, nome, arquivo_path, arquivo_nome) values
  ('e1280000-0000-0000-0000-0000000000a1', 'Contrato', 'clientes/e1280000-0000-0000-0000-0000000000b1/contrato.pdf', 'contrato.pdf') $$,
  '23514', null, 'pela API: caminho de outra empresa recusado');
select throws_ok($$ update public.documentos_empresa set cliente_id = 'e1280000-0000-0000-0000-0000000000b1'
  where id = 'e1280000-0000-0000-0000-0000000000d1' $$, '23514', null, 'pela API: trocar a empresa recusado');
reset role;
select set_config('request.jwt.claims', '', true);
select is((select cliente_id::text || ' ' || arquivo_path from public.documentos_empresa where id = 'e1280000-0000-0000-0000-0000000000d1'),
  'e1280000-0000-0000-0000-0000000000a1 clientes/e1280000-0000-0000-0000-0000000000a1/1700000000-contrato.pdf', 'o documento continua onde estava');

-- ---------- 6.9: limite de tamanho e de tipo nos compartimentos ----------
select is((select file_size_limit from storage.buckets where id = 'anexos'), 26214400::bigint, 'anexos: até 25 MB');
select is((select file_size_limit from storage.buckets where id = 'documentos'), 20971520::bigint, 'documentos: até 20 MB');
select is((select count(*)::int from storage.buckets where id in ('anexos', 'documentos', 'tarefas')
  and file_size_limit is not null and cardinality(allowed_mime_types) > 0), 3, 'os 3 compartimentos têm limite de tamanho e lista de tipos');
select is((select count(*)::int from storage.buckets, unnest(allowed_mime_types) t
  where id in ('anexos', 'documentos') and (t like '%*%' or t in ('image/svg+xml', 'text/html', 'application/xhtml+xml', 'text/javascript', 'application/javascript'))),
  0, 'nenhum tipo que o navegador executa (svg, html, script) nem curinga');
select ok((select array['application/pdf', 'image/jpeg', 'image/png', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'text/xml',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
  <@ allowed_mime_types from storage.buckets where id = 'anexos')
  and (select array['application/pdf', 'image/jpeg', 'image/png', 'audio/ogg', 'audio/mpeg', 'audio/mp4',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
  <@ allowed_mime_types from storage.buckets where id = 'documentos'), 'os tipos usuais (pdf, imagem, áudio, planilha, Word, XML de nota) continuam aceitos');
select ok((select array['image/tiff', 'image/bmp', 'application/zip', 'application/x-zip-compressed']
  <@ allowed_mime_types from storage.buckets where id = 'documentos'), 'documentos: tiff, bmp e zip aceitos (revisão da Task 10)');

select * from finish();
rollback;
