-- Auditoria 1.3 e 6.10: documentos_empresa.arquivo_path e cliente_id eram livres. Quem edita clientes podia, pela API,
-- apontar o documento da empresa A para o arquivo da empresa B: o agente enviava o arquivo de B ao contato de A, e a
-- exclusão do documento de A apagava o arquivo de B. Agora:
--   * o caminho fica na pasta da própria empresa (clientes/<cliente_id>/...), sem ".." como pasta ("Relatorio..pdf" vale);
--   * empresa e arquivo não mudam depois de criados (para trocar o arquivo, exclui e envia de novo).
-- Auditoria 6.9: "anexos" e "documentos" não tinham limite de tamanho nem de tipo (o envio direto pela API do Storage não
-- passa pelo limite do painel). Ganham os dois; a lista cobre o que o escritório recebe e envia hoje.

-- ---------- Linhas antigas fora do padrão: a migração para e lista os ids (nada é mudado às cegas) ----------
-- Para conferir antes de aplicar (só leitura):
--   select id, cliente_id, arquivo_path from public.documentos_empresa
--    where not (arquivo_path like 'clientes/' || cliente_id::text || '/%' and arquivo_path !~ '(^|/)\.\.(/|$)');
do $$
declare v_ids text;
begin
  select string_agg(id::text, ', ' order by criado_em) into v_ids
    from public.documentos_empresa
   where not (arquivo_path like 'clientes/' || cliente_id::text || '/%' and arquivo_path !~ '(^|/)\.\.(/|$)');
  if v_ids is not null then
    raise exception 'Documentos com o arquivo fora da pasta da própria empresa (clientes/<cliente_id>/): %', v_ids
      using errcode = '23514',
            hint = 'Confira cada um no painel: exclua e envie de novo o arquivo certo, depois aplique esta migração.';
  end if;
end $$;

alter table public.documentos_empresa add constraint caminho_da_empresa
  check (arquivo_path like 'clientes/' || cliente_id::text || '/%' and arquivo_path !~ '(^|/)\.\.(/|$)');

-- ---------- Empresa e arquivo fixos depois do insert ----------
create function public.documento_empresa_imutavel() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.cliente_id is distinct from old.cliente_id or new.arquivo_path is distinct from old.arquivo_path then
    raise exception 'O documento não muda de empresa nem de arquivo. Exclua e envie de novo.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.documento_empresa_imutavel() from public, anon, authenticated;

create trigger documento_empresa_imutavel before update of cliente_id, arquivo_path on public.documentos_empresa
  for each row execute function public.documento_empresa_imutavel();

-- ---------- 6.9: limite de tamanho e de tipo ----------
-- Mesmas listas de packages/core/src/tipos-arquivo.ts (um teste do trabalhador compara as duas).
-- Sem curinga ("image/*" aceitaria image/svg+xml, que o navegador executa) e sem html/script.
-- O Storage compara o tipo inteiro, com os parâmetros: o áudio de voz chega da Z-API como "audio/ogg; codecs=opus". O
-- trabalhador novo sobe sem parâmetros e, fora da lista, como application/octet-stream; as duas grafias do opus ficam
-- para o contêiner antigo (o esquema sobe antes).
-- anexos (25 MB): o que chega do WhatsApp (o trabalhador já recusa acima de 20 MB) e o que a equipe anexa na resposta.
update storage.buckets set file_size_limit = 26214400, allowed_mime_types = array[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp',
  'text/xml', 'application/xml', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
  'application/vnd.oasis.opendocument.text',
  'application/zip', 'application/x-zip-compressed',
  'audio/ogg', 'audio/ogg; codecs=opus', 'audio/ogg;codecs=opus', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/aac',
  'audio/amr', 'audio/webm', 'audio/wav', 'audio/x-wav',
  'video/mp4', 'video/3gpp', 'video/quicktime',
  'application/x-ofx', 'application/ofx',
  -- Tipo desconhecido (.pfx, .rar, .7z...) sobe assim; o navegador só baixa, não abre.
  'application/octet-stream']
 where id = 'anexos';

-- documentos (20 MB; o envio pelo WhatsApp recusa acima de 15 MB): os documentos da empresa que a equipe sobe no painel.
update storage.buckets set file_size_limit = 20971520, allowed_mime_types = array[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp',
  'text/xml', 'application/xml', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
  'application/vnd.oasis.opendocument.text',
  'application/zip', 'application/x-zip-compressed',
  'audio/ogg', 'audio/mpeg', 'audio/mp4']
 where id = 'documentos';
