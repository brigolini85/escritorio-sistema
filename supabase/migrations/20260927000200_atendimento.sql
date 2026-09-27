-- Atendimento: conversas, mensagens, chamados, registros do agente, alertas e RPCs do painel.

create type public.estado_conversa as enum ('agente', 'humano');
create type public.direcao_mensagem as enum ('entrada', 'saida');
create type public.autor_mensagem as enum ('cliente', 'agente', 'atendente', 'sistema');
create type public.tipo_mensagem as enum ('texto', 'audio', 'imagem', 'documento');
create type public.status_envio as enum ('pendente', 'enviada', 'falhou');
create type public.status_chamado as enum ('aberto', 'em_andamento', 'aguardando_cliente', 'concluido');

create table public.conversas (
  id uuid primary key default gen_random_uuid(),
  telefone text not null unique check (telefone ~ '^\d{12,13}$'),
  contato_id uuid references public.contatos (id) on delete set null,
  cliente_em_foco uuid references public.clientes (id) on delete set null,
  estado public.estado_conversa not null default 'agente',
  atendente_id uuid references public.usuarios (id) on delete set null,
  tentativas_nao_entendido int not null default 0,
  aviso_lgpd_enviado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  direcao public.direcao_mensagem not null,
  autor public.autor_mensagem not null,
  atendente_id uuid references public.usuarios (id) on delete set null,
  tipo public.tipo_mensagem not null default 'texto',
  conteudo text,
  transcricao text,
  midia_url_origem text,
  arquivo_path text,
  arquivo_nome text,
  arquivo_mime text,
  id_provedor text unique,
  status_envio public.status_envio,
  processada_em timestamptz,
  criado_em timestamptz not null default now()
);
create index mensagens_conversa_idx on public.mensagens (conversa_id, criado_em);
create index mensagens_pendentes_idx on public.mensagens (conversa_id) where processada_em is null and direcao = 'entrada';

create table public.chamados (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  cliente_id uuid references public.clientes (id) on delete set null,
  conversa_id uuid references public.conversas (id) on delete set null,
  setor_id uuid references public.setores (id),          -- null = triagem do administrador
  responsavel_id uuid references public.usuarios (id) on delete set null,
  titulo text not null,
  resumo text not null default '',
  status public.status_chamado not null default 'aberto',
  fora_do_contrato boolean not null default false,
  origem text not null default 'agente',
  alertado_fila_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  concluido_em timestamptz
);
create index chamados_conversa_idx on public.chamados (conversa_id) where status <> 'concluido';

create table public.chamado_eventos (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  tipo text not null check (tipo in ('criacao', 'assumido', 'transferencia', 'nota_interna', 'conclusao')),
  usuario_id uuid references public.usuarios (id) on delete set null,
  texto text,
  criado_em timestamptz not null default now()
);

create table public.decisoes_agente (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid references public.conversas (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  etapa text not null,
  entrada jsonb,
  saida jsonb,
  justificativa text,
  criado_em timestamptz not null default now()
);

create table public.uso_ia (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid references public.conversas (id) on delete set null,
  modelo text not null,
  tokens_entrada int not null,
  tokens_saida int not null,
  tokens_cache_leitura int not null default 0,
  tokens_cache_escrita int not null default 0,
  custo_usd numeric(12, 6) not null,
  criado_em timestamptz not null default now()
);

create table public.auditoria_acessos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid,
  acao text not null,
  entidade text not null,
  entidade_id text,
  detalhes jsonb,
  criado_em timestamptz not null default now()
);

create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  nivel text not null check (nivel in ('critico', 'operacional', 'aviso')),
  setor_id uuid references public.setores (id) on delete cascade,
  mensagem text not null,
  criado_em timestamptz not null default now(),
  lido_em timestamptz
);

create table public.sinais_vida (
  componente text primary key,
  visto_em timestamptz not null
);

-- Visibilidade
create function public.pode_ver_chamado(p_chamado uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eh_admin() or exists (
    select 1 from chamados c
    where c.id = p_chamado and eh_usuario_ativo()
      and (c.responsavel_id = auth.uid() or c.setor_id in (select meus_setores()))
  )
$$;

create function public.pode_ver_conversa(p_conversa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eh_admin() or (eh_usuario_ativo() and (
    exists (select 1 from conversas where id = p_conversa and atendente_id = auth.uid())
    or exists (
      select 1 from chamados c where c.conversa_id = p_conversa
        and (c.responsavel_id = auth.uid() or c.setor_id in (select meus_setores()))
    )
  ))
$$;

alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;
alter table public.chamados enable row level security;
alter table public.chamado_eventos enable row level security;
alter table public.decisoes_agente enable row level security;
alter table public.uso_ia enable row level security;
alter table public.auditoria_acessos enable row level security;
alter table public.alertas enable row level security;
alter table public.sinais_vida enable row level security;

create policy leitura on public.conversas for select to authenticated using (pode_ver_conversa(id));
create policy leitura on public.mensagens for select to authenticated using (pode_ver_conversa(conversa_id));
create policy leitura on public.chamados for select to authenticated using (pode_ver_chamado(id));
create policy leitura on public.chamado_eventos for select to authenticated using (pode_ver_chamado(chamado_id));
create policy leitura on public.decisoes_agente for select to authenticated using (pode_ver_conversa(conversa_id));
create policy leitura_admin on public.uso_ia for select to authenticated using (eh_admin());
create policy leitura_admin on public.auditoria_acessos for select to authenticated using (eh_admin());
create policy leitura_admin on public.sinais_vida for select to authenticated using (eh_admin());
create policy leitura on public.alertas for select to authenticated
  using (eh_admin() or (setor_id is not null and setor_id in (select meus_setores())));

-- Navegador nunca escreve direto nestas tabelas: só pelas RPCs abaixo
revoke insert, update, delete on public.conversas, public.mensagens, public.chamados,
  public.chamado_eventos, public.decisoes_agente, public.uso_ia, public.auditoria_acessos,
  public.sinais_vida from authenticated, anon;
revoke insert, update, delete on public.alertas from authenticated, anon;

-- Marcar alerta como lido: só preenche lido_em, e só em alerta visível ao usuário
create function public.marcar_alerta_lido(p_alerta uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update alertas set lido_em = now()
  where id = p_alerta and (eh_admin() or (setor_id is not null and setor_id in (select meus_setores())));
end $$;

-- RPCs do painel
create function public.assumir_conversa(p_conversa uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pode_ver_conversa(p_conversa) then raise exception 'sem acesso a esta conversa'; end if;
  update conversas set estado = 'humano', atendente_id = auth.uid(), atualizado_em = now() where id = p_conversa;
  with alterados as (
    update chamados set responsavel_id = auth.uid(), status = 'em_andamento', atualizado_em = now()
    where conversa_id = p_conversa and status <> 'concluido' and responsavel_id is null
      and (eh_admin() or setor_id in (select meus_setores()))
    returning id, cliente_id
  )
  insert into chamado_eventos (chamado_id, cliente_id, tipo, usuario_id)
  select id, cliente_id, 'assumido', auth.uid() from alterados;
end $$;

create function public.devolver_ao_agente(p_conversa uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (eh_admin() or exists (select 1 from conversas where id = p_conversa and atendente_id = auth.uid())) then
    raise exception 'só quem assumiu a conversa pode devolvê-la';
  end if;
  update conversas set estado = 'agente', atendente_id = null, atualizado_em = now() where id = p_conversa;
end $$;

create function public.registrar_resposta(
  p_conversa uuid, p_texto text, p_arquivo_path text, p_arquivo_nome text, p_arquivo_mime text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_cliente uuid;
begin
  if not pode_ver_conversa(p_conversa) then raise exception 'sem acesso a esta conversa'; end if;
  if coalesce(trim(p_texto), '') = '' and p_arquivo_path is null then raise exception 'resposta vazia'; end if;
  perform assumir_conversa(p_conversa);
  select cliente_em_foco into v_cliente from conversas where id = p_conversa;
  insert into mensagens (conversa_id, cliente_id, direcao, autor, atendente_id, tipo, conteudo,
                         arquivo_path, arquivo_nome, arquivo_mime, status_envio)
  values (p_conversa, v_cliente, 'saida', 'atendente', auth.uid(),
          case when p_arquivo_path is null then 'texto' else 'documento' end::tipo_mensagem,
          p_texto, p_arquivo_path, p_arquivo_nome, p_arquivo_mime, 'pendente')
  returning id into v_id;
  return v_id;
end $$;

create function public.nota_interna(p_chamado uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pode_ver_chamado(p_chamado) then raise exception 'sem acesso a este chamado'; end if;
  insert into chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
  select id, cliente_id, 'nota_interna', auth.uid(), p_texto from chamados where id = p_chamado;
end $$;

create function public.transferir_chamado(p_chamado uuid, p_setor uuid, p_responsavel uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pode_ver_chamado(p_chamado) then raise exception 'sem acesso a este chamado'; end if;
  update chamados set setor_id = p_setor, responsavel_id = p_responsavel, status = 'aberto', atualizado_em = now()
  where id = p_chamado;
  insert into chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
  select id, cliente_id, 'transferencia', auth.uid(),
         (select nome from setores where id = p_setor)
  from chamados where id = p_chamado;
end $$;

create function public.concluir_chamado(p_chamado uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_conversa uuid;
begin
  if not pode_ver_chamado(p_chamado) then raise exception 'sem acesso a este chamado'; end if;
  update chamados set status = 'concluido', concluido_em = now(), atualizado_em = now()
  where id = p_chamado returning conversa_id into v_conversa;
  insert into chamado_eventos (chamado_id, cliente_id, tipo, usuario_id)
  select id, cliente_id, 'conclusao', auth.uid() from chamados where id = p_chamado;
  if v_conversa is not null and not exists (
    select 1 from chamados where conversa_id = v_conversa and status <> 'concluido'
  ) then
    update conversas set estado = 'agente', atendente_id = null, atualizado_em = now() where id = v_conversa;
  end if;
end $$;

-- Storage: bucket privado de anexos, caminho conversas/{conversa_id}/{arquivo}
insert into storage.buckets (id, name, public) values ('anexos', 'anexos', false);

create policy anexos_leitura on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and pode_ver_conversa(((storage.foldername(name))[2])::uuid));
create policy anexos_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and pode_ver_conversa(((storage.foldername(name))[2])::uuid));
