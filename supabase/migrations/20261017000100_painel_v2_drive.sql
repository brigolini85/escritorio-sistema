-- supabase/migrations/20261017000100_painel_v2_drive.sql
-- Painel v2, Parte I3b (spec 7E.6; D3–D9): a pasta do cliente no Google Drive. Só acréscimos; as funções da I3a não mudam aqui.
-- Nada entra no Realtime (teste 22). A chave da conta de serviço nunca entra no banco (D3): só o e-mail e o último erro.

-- D8: "Pasta no Drive" (o código; o painel converte o link). Uma pasta é de um cliente só. Tamanho 19–200 (F13).
alter table public.clientes add column drive_pasta_id text
  check (drive_pasta_id is null or drive_pasta_id ~ '^[A-Za-z0-9_-]{19,200}$');
create unique index clientes_drive_pasta_unica on public.clientes (drive_pasta_id) where drive_pasta_id is not null;

-- D9: a situação da conta de serviço, gravada pelo trabalhador ao ligar e a cada leitura de pasta.
-- F1: erro só para problema da conta; uma leitura bem-sucedida limpa (erro nulo).
create table public.drive_conta (
  id int primary key default 1 check (id = 1),
  email text check (email is null or char_length(email) <= 320),
  erro text check (erro is null or char_length(erro) <= 300),
  verificado_em timestamptz not null default now()
);
alter table public.drive_conta enable row level security;
create policy leitura on public.drive_conta for select to authenticated using (public.eh_usuario_ativo());
revoke all on public.drive_conta from anon;
revoke insert, update, delete, truncate on public.drive_conta from authenticated, service_role;

-- D4: o arquivo do Drive é copiado para a tarefa, com o código e a data de modificação (o mesmo não entra duas vezes).
alter table public.agente_tarefa_arquivos drop constraint agente_tarefa_arquivos_origem_check;
alter table public.agente_tarefa_arquivos add constraint agente_tarefa_arquivos_origem_check check (origem in ('enviado', 'conversa', 'drive'));
alter table public.agente_tarefa_arquivos
  add column drive_id text check (drive_id is null or drive_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  add column drive_modificado_em timestamptz,
  add constraint agente_tarefa_arquivos_drive_check check ((origem = 'drive') = (drive_id is not null));
create index agente_tarefa_arquivos_drive_idx on public.agente_tarefa_arquivos (tarefa_id, drive_id) where drive_id is not null;

-- ---------- O que a pessoa faz ----------
create function public.salvar_pasta_drive(p_cliente uuid, p_pasta text) returns text
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_pasta, '')), '');
begin
  if not public.eh_usuario_ativo() then raise exception 'Cliente não encontrado.'; end if;
  if not public.tem_permissao('clientes', 'editar') then raise exception 'Você não tem permissão para editar clientes.'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente and ativo) then raise exception 'Cliente não encontrado.'; end if;
  if v is not null and v !~ '^[A-Za-z0-9_-]{19,200}$' then
    raise exception 'Cole o link da pasta do Drive (drive.google.com/drive/folders/…).';
  end if;
  if v is not null and exists (select 1 from public.clientes where drive_pasta_id = v and id <> p_cliente) then
    raise exception 'Esta pasta do Drive já é de outro cliente.';
  end if;
  update public.clientes set drive_pasta_id = v where id = p_cliente;
  return v;
end $$;
revoke execute on function public.salvar_pasta_drive(uuid, text) from public, anon, service_role;
grant execute on function public.salvar_pasta_drive(uuid, text) to authenticated;

-- D7: LER A PASTA DE NOVO (pessoa do setor; o painel enfileira em pasta_drive). Uma a cada 2 minutos por tarefa.
create function public.pedir_leitura_da_pasta(p_tarefa uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype;
begin
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  t := interno.tarefa_da_pessoa(p_tarefa);
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  if not exists (select 1 from public.clientes c where c.id = t.cliente_id and c.drive_pasta_id is not null) then
    raise exception 'O cliente desta demanda não tem pasta no Drive. Preencha na ficha do cliente, em Arquivos.';
  end if;
  if exists (select 1 from public.agente_tarefa_eventos where tarefa_id = p_tarefa and texto = 'pediu para ler a pasta do Drive de novo'
             and criado_em > now() - interval '2 minutes') then
    raise exception 'A pasta já está sendo lida. Espere um pouco.';
  end if;
  perform interno.evento_tarefa(p_tarefa, 'pessoa', 'pediu para ler a pasta do Drive de novo');
  return true;
end $$;
revoke execute on function public.pedir_leitura_da_pasta(uuid) from public, anon, service_role;
grant execute on function public.pedir_leitura_da_pasta(uuid) to authenticated;

-- ---------- O que só o trabalhador chama ----------
-- D5: a pasta deste cliente, as pastas de todos os outros (para não descer nelas) e o que já foi copiado.
create function public.pasta_drive_da_tarefa(p_tarefa uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'estado', t.estado, 'cliente_id', t.cliente_id, 'pasta', c.drive_pasta_id,
    'outras', coalesce((select jsonb_agg(o.drive_pasta_id order by o.drive_pasta_id) from public.clientes o
                         where o.drive_pasta_id is not null and o.id is distinct from t.cliente_id), '[]'::jsonb),
    'importados', coalesce((select jsonb_agg(jsonb_build_object('drive_id', a.drive_id, 'modificado_em', a.drive_modificado_em))
                              from public.agente_tarefa_arquivos a where a.tarefa_id = t.id and a.drive_id is not null), '[]'::jsonb),
    'total', (select count(*) from public.agente_tarefa_arquivos a where a.tarefa_id = t.id))
  from public.agente_tarefas t left join public.clientes c on c.id = t.cliente_id
  where t.id = p_tarefa
$$;

-- D4, D5 (barreira 4): só para tarefa ativa de cliente com pasta, com o objeto já em <tarefa>/drive/ no compartimento "tarefas".
create function public.registrar_arquivo_drive(p_tarefa uuid, p_caminho text, p_nome text, p_mime text, p_tamanho int, p_drive_id text,
  p_modificado timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype; v_id uuid; v_nome text;
begin
  select * into t from public.agente_tarefas where id = p_tarefa for update;
  if not found then raise exception 'Tarefa não encontrada.'; end if;
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  if not exists (select 1 from public.clientes c where c.id = t.cliente_id and c.drive_pasta_id is not null) then
    raise exception 'O cliente não tem pasta no Drive.';
  end if;
  if p_drive_id is null or p_drive_id !~ '^[A-Za-z0-9_-]{10,200}$' then raise exception 'Código do Drive inválido.'; end if;
  if p_caminho is null or left(p_caminho, 43) <> p_tarefa::text || '/drive/'
     or not exists (select 1 from storage.objects where bucket_id = 'tarefas' and name = p_caminho) then
    raise exception 'Arquivo não encontrado no envio.';
  end if;
  if not interno.extensao_aceita(p_nome) then raise exception 'O agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.'; end if;
  if p_tamanho is null or p_tamanho < 1 then raise exception 'O arquivo está vazio.'; end if;
  if p_tamanho > 10485760 then raise exception 'O arquivo passa de 10 MB.'; end if;
  if exists (select 1 from public.agente_tarefa_arquivos where tarefa_id = t.id and drive_id = p_drive_id
             and drive_modificado_em is not distinct from p_modificado) then
    raise exception 'Este arquivo do Drive já está na tarefa.';
  end if;
  if (select count(*) from public.agente_tarefa_arquivos where tarefa_id = t.id) >= 30 then raise exception 'No máximo 30 arquivos por tarefa.'; end if;
  v_nome := interno.nome_livre_na_tarefa(t.id, p_nome);
  insert into public.agente_tarefa_arquivos (tarefa_id, origem, bucket, caminho, nome, mime, tamanho, drive_id, drive_modificado_em)
  values (t.id, 'drive', 'tarefas', p_caminho, v_nome, left(coalesce(nullif(p_mime, ''), 'application/octet-stream'), 120), p_tamanho,
          p_drive_id, p_modificado)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'nome', v_nome);
end $$;

-- D9, F1: o trabalhador grava o e-mail da conta e o último erro de conta (curto, sem a chave); erro nulo limpa.
-- Sem e-mail novo, mantém o que já estava (erro de conta pode ocorrer antes de conhecer o e-mail).
create function public.registrar_situacao_drive(p_email text, p_erro text) returns void
language sql security definer set search_path = '' as $$
  insert into public.drive_conta (id, email, erro, verificado_em) values (1, left(p_email, 320), left(p_erro, 300), now())
  on conflict (id) do update set email = coalesce(excluded.email, public.drive_conta.email), erro = excluded.erro,
    verificado_em = excluded.verificado_em
$$;

revoke execute on function public.pasta_drive_da_tarefa(uuid), public.registrar_arquivo_drive(uuid, text, text, text, int, text, timestamptz),
  public.registrar_situacao_drive(text, text) from public, anon, authenticated;
grant execute on function public.pasta_drive_da_tarefa(uuid), public.registrar_arquivo_drive(uuid, text, text, text, int, text, timestamptz),
  public.registrar_situacao_drive(text, text) to service_role;
