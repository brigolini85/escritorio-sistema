-- Cadastros comerciais por empresa atendida: redes/unidades (clientes e fornecedores), produtos,
-- preços por rede com histórico e documentos. Spec: 2026-09-28-cadastros-comerciais-design.md.

create type public.tipo_parceiro as enum ('cliente', 'fornecedor');

create table public.parceiros_grupos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  tipo public.tipo_parceiro not null,
  nome text not null check (length(trim(nome)) > 0),
  palavras_chave text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (cliente_id, tipo, nome),
  unique (id, cliente_id)
);

create table public.parceiros_unidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  grupo_id uuid not null,
  nome_unidade text not null check (length(trim(nome_unidade)) > 0),
  razao_social text,
  cnpj text check (cnpj ~ '^\d{14}$'),
  inscricao_estadual text,
  endereco text,
  bairro text,
  cidade text,
  uf char(2),
  palavras_chave text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  foreign key (grupo_id, cliente_id) references public.parceiros_grupos (id, cliente_id) on delete cascade,
  unique (cliente_id, cnpj)
);
create index parceiros_unidades_grupo_idx on public.parceiros_unidades (grupo_id);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  codigo text not null check (length(trim(codigo)) > 0),
  descricao text not null check (length(trim(descricao)) > 0),
  unidade text not null default 'UN',
  apelidos text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (cliente_id, codigo),
  unique (id, cliente_id)
);

create table public.precos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  grupo_id uuid not null,
  produto_id uuid not null,
  valor numeric(12, 2) not null check (valor > 0),
  vigente_desde timestamptz not null default now(),
  vigente_ate timestamptz,
  alterado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  foreign key (grupo_id, cliente_id) references public.parceiros_grupos (id, cliente_id) on delete cascade,
  foreign key (produto_id, cliente_id) references public.produtos (id, cliente_id) on delete cascade
);
create unique index precos_um_vigente on public.precos (grupo_id, produto_id) where vigente_ate is null;

create table public.documentos_empresa (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  arquivo_path text not null,
  arquivo_nome text not null,
  arquivo_mime text not null default 'application/pdf',
  ia_pode_enviar boolean not null default false,
  enviado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- RLS: leitura por usuário ativo; criar/editar com editar_clientes; excluir só admin.
alter table public.parceiros_grupos enable row level security;
alter table public.parceiros_unidades enable row level security;
alter table public.produtos enable row level security;
alter table public.precos enable row level security;
alter table public.documentos_empresa enable row level security;

do $$
declare t text;
begin
  foreach t in array array['parceiros_grupos', 'parceiros_unidades', 'produtos', 'documentos_empresa'] loop
    execute format('create policy leitura on public.%I for select to authenticated using (eh_usuario_ativo())', t);
    execute format('create policy inserir on public.%I for insert to authenticated with check (tem_permissao(''editar_clientes''))', t);
    execute format('create policy alterar on public.%I for update to authenticated using (tem_permissao(''editar_clientes'')) with check (tem_permissao(''editar_clientes''))', t);
    execute format('create policy excluir on public.%I for delete to authenticated using (eh_admin())', t);
  end loop;
end $$;

-- Preço: navegador só lê; grava pela função definir_preco.
create policy leitura on public.precos for select to authenticated using (eh_usuario_ativo());
revoke insert, update, delete on public.precos from authenticated, anon;

create function public.definir_preco(p_grupo uuid, p_produto uuid, p_valor numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_cliente uuid; v_tipo tipo_parceiro; v_id uuid;
begin
  if not tem_permissao('editar_precos') then raise exception 'sem permissão para editar preços'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'valor inválido'; end if;
  select cliente_id, tipo into v_cliente, v_tipo from parceiros_grupos where id = p_grupo;
  if v_cliente is null then raise exception 'rede não encontrada'; end if;
  if v_tipo <> 'cliente' then raise exception 'preço só vale para clientes da empresa'; end if;
  if not exists (select 1 from produtos where id = p_produto and cliente_id = v_cliente) then
    raise exception 'produto não pertence à empresa';
  end if;
  update precos set vigente_ate = now() where grupo_id = p_grupo and produto_id = p_produto and vigente_ate is null;
  insert into precos (cliente_id, grupo_id, produto_id, valor, alterado_por)
  values (v_cliente, p_grupo, p_produto, round(p_valor, 2), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Auditoria (mesmo gatilho dos outros cadastros).
do $$
declare t text;
begin
  foreach t in array array['parceiros_grupos', 'parceiros_unidades', 'produtos', 'precos', 'documentos_empresa'] loop
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t);
  end loop;
end $$;

-- Storage: documentos da empresa em clientes/{cliente_id}/{arquivo}.
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false);
create policy documentos_leitura on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and eh_usuario_ativo());
create policy documentos_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = 'clientes' and tem_permissao('editar_clientes'));
create policy documentos_exclusao on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and eh_admin());
