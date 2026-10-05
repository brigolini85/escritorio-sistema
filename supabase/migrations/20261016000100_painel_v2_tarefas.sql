-- supabase/migrations/20261016000100_painel_v2_tarefas.sql
-- Painel v2, Parte I3a (spec 7E.4, 7E.8; D3–D14, D20): tarefas de trabalho dos agentes. Tabelas, leitura por quem vê a demanda,
-- compartimento privado "tarefas" e limites por agente. Gravação só pelas funções (20261016000200 e 20261016000300).
-- Nada entra no Realtime (teste 22).

-- D13: o dono escolhe os limites no agente; cada tarefa copia na criação.
alter table public.agentes
  add column tarefa_limite_usd numeric(8, 2) not null default 2 check (tarefa_limite_usd between 0.10 and 50),
  add column tarefa_limite_minutos int not null default 20 check (tarefa_limite_minutos between 1 and 240);

create table public.agente_tarefas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  agente_id uuid not null references public.agentes (id) on delete cascade,
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  setor_id uuid references public.setores (id) on delete set null,
  pedida_por uuid references public.usuarios (id) on delete set null,
  canal text not null default 'painel' check (canal in ('painel', 'whatsapp', 'automatico')),
  pedido text not null check (char_length(btrim(pedido)) between 3 and 2000),
  skill_nome text check (skill_nome is null or char_length(skill_nome) between 1 and 64),
  estado text not null default 'trabalhando'
    check (estado in ('trabalhando', 'aguardando_pendencias', 'pausada', 'pronta', 'aprovada', 'descartada')),
  motivo_pausa text check (motivo_pausa in ('pessoa', 'limite_custo', 'limite_tempo', 'teto', 'agente_desligado', 'falha', 'sem_resultado')),
  etapas jsonb not null default '[]' check (jsonb_typeof(etapas) = 'array'),
  etapa_atual smallint not null default 1 check (etapa_atual between 1 and 20),
  anotacoes text not null default '' check (char_length(anotacoes) <= 8000),
  resultado jsonb check (resultado is null or jsonb_typeof(resultado) = 'object'),
  ajustes jsonb not null default '[]' check (jsonb_typeof(ajustes) = 'array'),
  ajuste_pendente boolean not null default false,
  custo_usd numeric(12, 6) not null default 0 check (custo_usd >= 0),
  custo_etapas jsonb not null default '{}' check (jsonb_typeof(custo_etapas) = 'object'),
  segundos_trabalhando int not null default 0 check (segundos_trabalhando >= 0),
  limite_usd numeric(8, 2) not null check (limite_usd > 0),
  limite_minutos int not null check (limite_minutos > 0),
  executando_desde timestamptz,
  decidida_por uuid references public.usuarios (id) on delete set null,
  decidida_em timestamptz,
  criado_em timestamptz not null default clock_timestamp(),
  atualizado_em timestamptz not null default clock_timestamp(),
  check ((estado = 'pausada') = (motivo_pausa is not null)),
  check ((estado in ('aprovada', 'descartada')) = (decidida_em is not null))
);
-- D3: uma tarefa ativa por demanda.
create unique index agente_tarefas_uma_ativa on public.agente_tarefas (chamado_id) where estado not in ('aprovada', 'descartada');
create index agente_tarefas_chamado_idx on public.agente_tarefas (chamado_id, criado_em);
create index agente_tarefas_agente_idx on public.agente_tarefas (agente_id, criado_em);
create index agente_tarefas_cliente_idx on public.agente_tarefas (cliente_id);
create index agente_tarefas_setor_idx on public.agente_tarefas (setor_id);
create index agente_tarefas_pedida_por_idx on public.agente_tarefas (pedida_por);
create index agente_tarefas_decidida_por_idx on public.agente_tarefas (decidida_por);
create index agente_tarefas_trabalhando_idx on public.agente_tarefas (atualizado_em) where estado = 'trabalhando';

create table public.agente_tarefa_arquivos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.agente_tarefas (id) on delete cascade,
  origem text not null check (origem in ('enviado', 'conversa')),
  bucket text not null check (bucket in ('tarefas', 'anexos')),
  caminho text not null check (char_length(caminho) between 1 and 500),
  nome text not null check (char_length(nome) between 1 and 200),
  mime text not null check (char_length(mime) between 3 and 120),
  tamanho int not null check (tamanho between 0 and 10485760),
  enviado_por uuid references public.usuarios (id) on delete set null,
  mensagem_id uuid references public.mensagens (id) on delete set null,
  lido_em timestamptz,
  detalhe text check (char_length(detalhe) <= 120),
  criado_em timestamptz not null default clock_timestamp(),
  unique (tarefa_id, nome)
);
create index agente_tarefa_arquivos_enviado_por_idx on public.agente_tarefa_arquivos (enviado_por);
create index agente_tarefa_arquivos_mensagem_idx on public.agente_tarefa_arquivos (mensagem_id);

create table public.agente_pendencias (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.agente_tarefas (id) on delete cascade,
  numero smallint not null check (numero between 1 and 200),
  tipo text not null check (tipo in ('cliente', 'analista')),
  pergunta text not null check (char_length(btrim(pergunta)) between 3 and 300),
  detalhe text check (char_length(detalhe) <= 1000),
  opcoes text[] not null default '{}' check (cardinality(opcoes) <= 4),
  mensagem text check (char_length(mensagem) <= 1000),
  estado text not null default 'aberta' check (estado in ('aberta', 'respondida')),
  resposta text check (char_length(resposta) <= 2000),
  respondida_por uuid references public.usuarios (id) on delete set null,
  respondida_em timestamptz,
  vista_em timestamptz,
  arquivo_id uuid references public.agente_tarefa_arquivos (id) on delete set null,
  contato_id uuid references public.contatos (id) on delete set null,
  pedido_texto text check (char_length(pedido_texto) <= 1000),
  pedido_por uuid references public.usuarios (id) on delete set null,
  pedido_em timestamptz,
  pedidos smallint not null default 0 check (pedidos between 0 and 5),
  pedido_enviado_em timestamptz,
  mensagem_id uuid references public.mensagens (id) on delete set null,
  respondeu_na_conversa_em timestamptz,
  criado_em timestamptz not null default clock_timestamp(),
  unique (tarefa_id, numero),
  check ((estado = 'respondida') = (respondida_em is not null)),
  check (tipo = 'cliente' or (contato_id is null and pedidos = 0))
);
create index agente_pendencias_respondida_por_idx on public.agente_pendencias (respondida_por);
create index agente_pendencias_arquivo_idx on public.agente_pendencias (arquivo_id);
create index agente_pendencias_contato_idx on public.agente_pendencias (contato_id, pedido_em);
create index agente_pendencias_pedido_por_idx on public.agente_pendencias (pedido_por);
create index agente_pendencias_mensagem_idx on public.agente_pendencias (mensagem_id);

create table public.agente_tarefa_eventos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.agente_tarefas (id) on delete cascade,
  quem text not null check (quem in ('agente', 'pessoa', 'sistema')),
  usuario_id uuid references public.usuarios (id) on delete set null,
  texto text not null check (char_length(texto) between 1 and 500),
  criado_em timestamptz not null default clock_timestamp()
);
create index agente_tarefa_eventos_tarefa_idx on public.agente_tarefa_eventos (tarefa_id, criado_em);
create index agente_tarefa_eventos_usuario_idx on public.agente_tarefa_eventos (usuario_id);

-- D12: o gasto da tarefa (funcionalidade especialista_setor + agente_id, como na I2).
alter table public.uso_ia add column tarefa_id uuid references public.agente_tarefas (id) on delete set null;
create index uso_ia_tarefa_idx on public.uso_ia (tarefa_id);

-- ---------- Quem vê e quem mexe (D20) ----------
create function public.pode_ver_tarefa(p_tarefa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.agente_tarefas t where t.id = p_tarefa and public.pode_ver_chamado(t.chamado_id))
$$;
-- Pessoa ativa do setor da tarefa (ou administrador), com a tarefa ainda ativa: as ações e o envio de arquivo.
create function public.pode_mexer_na_tarefa(p_tarefa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_usuario_ativo() and exists (
    select 1 from public.agente_tarefas t
     where t.id = p_tarefa and t.estado not in ('aprovada', 'descartada') and public.pode_ver_chamado(t.chamado_id)
       and (public.eh_admin() or coalesce(t.setor_id in (select public.meus_setores()), false)))
$$;
-- "<tarefa>/<arquivo>" → a tarefa; qualquer outro formato → null (a regra do Storage recusa).
create function public.tarefa_do_caminho(p_nome text) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(p_nome, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              and char_length(split_part(p_nome, '/', 2)) > 0 and split_part(p_nome, '/', 3) = ''
         then split_part(p_nome, '/', 1)::uuid end
$$;
revoke execute on function public.pode_ver_tarefa(uuid), public.pode_mexer_na_tarefa(uuid), public.tarefa_do_caminho(text) from public, anon;
grant execute on function public.pode_ver_tarefa(uuid), public.pode_mexer_na_tarefa(uuid), public.tarefa_do_caminho(text) to authenticated, service_role;

alter table public.agente_tarefas enable row level security;
alter table public.agente_tarefa_arquivos enable row level security;
alter table public.agente_pendencias enable row level security;
alter table public.agente_tarefa_eventos enable row level security;
create policy leitura on public.agente_tarefas for select to authenticated using (public.pode_ver_chamado(chamado_id));
create policy leitura on public.agente_tarefa_arquivos for select to authenticated using (public.pode_ver_tarefa(tarefa_id));
create policy leitura on public.agente_pendencias for select to authenticated using (public.pode_ver_tarefa(tarefa_id));
create policy leitura on public.agente_tarefa_eventos for select to authenticated using (public.pode_ver_tarefa(tarefa_id));
revoke all on public.agente_tarefas, public.agente_tarefa_arquivos, public.agente_pendencias, public.agente_tarefa_eventos from anon;
revoke insert, update, delete, truncate on public.agente_tarefas, public.agente_tarefa_arquivos, public.agente_pendencias,
  public.agente_tarefa_eventos from authenticated, service_role;

-- ---------- Compartimento "tarefas" (D14, F7): <tarefa>/<carimbo>-<nome>; 10 MB por arquivo; só os tipos aceitos ----------
-- Sem política de select: o download passa só pela rota auditada, com URL assinada gerada no servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('tarefas', 'tarefas', false, 10485760,
  array['application/pdf', 'text/xml', 'application/xml', 'text/csv', 'text/plain', 'application/x-ofx', 'application/ofx', 'image/jpeg', 'image/png']);
create policy tarefas_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'tarefas' and public.pode_mexer_na_tarefa(public.tarefa_do_caminho(name)));

-- ---------- Demanda concluída por outro caminho: a tarefa ativa é descartada (D11) ----------
create function public.descartar_tarefas_da_demanda_concluida() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  with d as (
    update public.agente_tarefas set estado = 'descartada', motivo_pausa = null, decidida_em = now(), atualizado_em = now()
     where chamado_id = new.id and estado in ('trabalhando', 'aguardando_pendencias', 'pausada', 'pronta')
    returning id)
  insert into public.agente_tarefa_eventos (tarefa_id, quem, texto) select id, 'sistema', 'descartou a tarefa: a demanda foi concluída' from d;
  return new;
end $$;
revoke execute on function public.descartar_tarefas_da_demanda_concluida() from public, anon, authenticated, service_role;
create trigger descartar_tarefas after update of status on public.chamados
  for each row when (new.status = 'concluido' and old.status is distinct from 'concluido')
  execute function public.descartar_tarefas_da_demanda_concluida();
