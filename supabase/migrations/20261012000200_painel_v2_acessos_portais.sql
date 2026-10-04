-- supabase/migrations/20261012000200_painel_v2_acessos_portais.sql
-- Painel v2, Parte H1 (spec 7D.1 item 8): acessos de portais. A senha é cifrada no servidor do painel (AES-256-GCM, chave
-- fora do banco, D1); aqui só se guarda o texto cifrado, que nenhum papel lê direto (nem a chave de serviço, D2):
-- sai só por revelar_acesso, que confere a permissão e grava a auditoria antes de devolver.

-- ---------- Permissão "Ver acessos de portais" (à parte dos módulos de nível, D3) ----------

alter table public.usuarios add column ver_acessos_portais boolean not null default false;

-- Administrador sempre; os outros, ativos e no horário (eh_usuario_ativo), com a marcação.
create function public.pode_ver_acessos() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin()
      or (public.eh_usuario_ativo() and exists (select 1 from public.usuarios where id = auth.uid() and ver_acessos_portais))
$$;
revoke execute on function public.pode_ver_acessos() from public, anon;
grant execute on function public.pode_ver_acessos() to authenticated;

-- Só o administrador dá ou tira; a auditoria de usuarios registra quem e quando (antes/depois).
create function public.definir_ver_acessos(p_usuario uuid, p_pode boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'Só o administrador muda pessoas.'; end if;
  update public.usuarios set ver_acessos_portais = coalesce(p_pode, false) where id = p_usuario and ativo;
  if not found then raise exception 'Pessoa não encontrada.'; end if;
end $$;
revoke execute on function public.definir_ver_acessos(uuid, boolean) from public, anon, service_role;
grant execute on function public.definir_ver_acessos(uuid, boolean) to authenticated;

-- ---------- Acessos ----------

create table public.cliente_acessos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  portal text not null check (char_length(btrim(portal)) between 1 and 80),
  usuario text check (usuario is null or char_length(usuario) <= 120),
  -- Formato do painel (lib/cofre.ts): v1.<iv 12 bytes>.<etiqueta 16 bytes>.<cifra>, em base64url. Texto puro não entra.
  senha_cifrada text check (senha_cifrada ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'),
  tem_senha boolean generated always as (senha_cifrada is not null) stored,
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz not null default now()
);
create index cliente_acessos_cliente_idx on public.cliente_acessos (cliente_id, portal);
alter table public.cliente_acessos enable row level security;
create policy leitura on public.cliente_acessos for select to authenticated using (public.eh_usuario_ativo());
-- Leitura por coluna: a cifra fica de fora para todos os papéis da API, inclusive a chave de serviço (D2).
-- Sem auditoria genérica aqui: ela copiaria a linha inteira (com a cifra) para auditoria_acessos.
revoke all on public.cliente_acessos from public, anon, authenticated, service_role;
grant select (id, cliente_id, portal, usuario, tem_senha, atualizado_por, atualizado_em) on public.cliente_acessos
  to authenticated, service_role;

-- Cadastrar ou editar. p_senha_cifrada: nulo = mantém a atual; '' = sem senha (ex.: e-CAC pelo certificado).
create function public.salvar_acesso(p_id uuid, p_cliente uuid, p_portal text, p_usuario text, p_senha_cifrada text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_portal text := btrim(coalesce(p_portal, ''));
  v_senha text := nullif(p_senha_cifrada, '');
begin
  if not (public.tem_permissao('editar_clientes') and public.pode_ver_acessos()) then
    raise exception 'Sem permissão para mudar acessos de portais.';
  end if;
  if char_length(v_portal) not between 1 and 80 then raise exception 'Informe o portal.'; end if;
  -- Conferidos aqui para o erro de checagem do Postgres ("Failing row contains ...") nunca levar a cifra para um log.
  if char_length(btrim(coalesce(p_usuario, ''))) > 120 then raise exception 'Usuário do portal muito longo.'; end if;
  if v_senha is not null and v_senha !~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$' then
    raise exception 'Senha em formato inválido.';
  end if;
  if v_id is null then
    if not exists (select 1 from public.clientes where id = p_cliente) then raise exception 'Cliente não encontrado.'; end if;
    insert into public.cliente_acessos (cliente_id, portal, usuario, senha_cifrada, atualizado_por)
    values (p_cliente, v_portal, nullif(btrim(p_usuario), ''), v_senha, auth.uid())
    returning id into v_id;
  else
    update public.cliente_acessos
    set portal = v_portal, usuario = nullif(btrim(p_usuario), ''),
        senha_cifrada = case when p_senha_cifrada = '' then null else coalesce(v_senha, senha_cifrada) end,
        atualizado_por = auth.uid(), atualizado_em = now()
    where id = v_id and cliente_id = p_cliente;
    if not found then raise exception 'Acesso não encontrado.'; end if;
  end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'salvar_acesso', 'cliente_acessos', v_id::text,
          jsonb_build_object('cliente_id', p_cliente, 'portal', v_portal, 'senha_trocada', p_senha_cifrada is not null));
  return v_id;
end $$;

create function public.remover_acesso(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.cliente_acessos%rowtype;
begin
  if not (public.tem_permissao('editar_clientes') and public.pode_ver_acessos()) then
    raise exception 'Sem permissão para mudar acessos de portais.';
  end if;
  delete from public.cliente_acessos where id = p_id returning * into v;
  if v.id is null then raise exception 'Acesso não encontrado.'; end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'remover_acesso', 'cliente_acessos', v.id::text, jsonb_build_object('cliente_id', v.cliente_id, 'portal', v.portal));
end $$;

-- Única saída da cifra: confere a permissão, grava a auditoria (quem, quando, empresa, portal; nunca o segredo) e devolve.
create function public.revelar_acesso(p_id uuid, p_acao text default 'revelar') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.cliente_acessos%rowtype;
begin
  -- A trava de pessoa ativa e no horário fica escrita aqui também (portão do teste 25), mesmo já estando em pode_ver_acessos.
  if not (public.eh_admin() or (public.eh_usuario_ativo() and public.pode_ver_acessos())) then
    raise exception 'Sem permissão para ver acessos de portais.';
  end if;
  if p_acao is null or p_acao not in ('revelar', 'copiar') then raise exception 'Ação inválida.'; end if;
  select * into v from public.cliente_acessos where id = p_id;
  if v.id is null or v.senha_cifrada is null then raise exception 'Este acesso não tem senha guardada.'; end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), p_acao || '_acesso', 'cliente_acessos', v.id::text, jsonb_build_object('cliente_id', v.cliente_id, 'portal', v.portal));
  return jsonb_build_object('cliente_id', v.cliente_id, 'senha_cifrada', v.senha_cifrada);
end $$;

revoke execute on function public.salvar_acesso(uuid, uuid, text, text, text), public.remover_acesso(uuid),
  public.revelar_acesso(uuid, text) from public, anon, service_role;
grant execute on function public.salvar_acesso(uuid, uuid, text, text, text), public.remover_acesso(uuid),
  public.revelar_acesso(uuid, text) to authenticated;
