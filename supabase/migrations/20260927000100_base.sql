-- Cadastros base: usuários, setores, clientes do escritório, contatos, configurações.

create type public.papel_usuario as enum ('admin', 'atendente');

create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique,
  telefone text check (telefone ~ '^\d{12,13}$'),
  papel public.papel_usuario not null default 'atendente',
  permissoes text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao_assuntos text not null default '',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.setores (nome, descricao_assuntos) values
  ('Pessoal', 'Folha de pagamento, holerites, admissão, demissão, férias, 13º, eSocial, FGTS, pró-labore'),
  ('Contábil', 'Balancete, balanço, DRE, extratos bancários, conciliação, livros contábeis'),
  ('Fiscal', 'Notas fiscais, guias de impostos (DAS, DARF, ICMS, ISS), apurações, SPED, certidões negativas'),
  ('Financeiro', 'Honorários do escritório, boletos e cobranças do escritório, contrato de prestação de serviços'),
  ('Legalização', 'Abertura, alteração e baixa de empresa, contrato social, alvarás, licenças, inscrições');

create table public.usuario_setores (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  setor_id uuid not null references public.setores (id) on delete cascade,
  primary key (usuario_id, setor_id)
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text,
  cnpj text not null unique check (cnpj ~ '^\d{14}$'),
  inscricao_estadual text,
  regime text,
  endereco text,
  uf char(2),
  ativo boolean not null default true,
  agente_pausado boolean not null default false,
  criado_em timestamptz not null default now()
);

create table public.cliente_responsaveis (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  setor_id uuid not null references public.setores (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  primary key (cliente_id, setor_id)
);

create table public.servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  setor_id uuid references public.setores (id),
  ativo boolean not null default true
);

create table public.cliente_servicos (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  servico_id uuid not null references public.servicos (id) on delete cascade,
  primary key (cliente_id, servico_id)
);

create table public.contatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null unique check (telefone ~ '^\d{12,13}$'),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.contato_clientes (
  contato_id uuid not null references public.contatos (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  pode_pedir_nota boolean not null default false,
  pode_atualizar_preco boolean not null default false,
  primary key (contato_id, cliente_id)
);

create table public.configuracoes (
  id int primary key default 1 check (id = 1),
  horario_inicio time not null default '08:00',
  horario_fim time not null default '18:00',
  dias_uteis int[] not null default '{1,2,3,4,5}',
  agente_pausado boolean not null default false,
  teto_ia_usd numeric(10, 2) not null default 50,
  alerta_ia_80_mes text,
  minutos_alerta_fila int not null default 30,
  telefone_dono text check (telefone_dono ~ '^\d{12,13}$'),
  email_alertas text,
  modelo_conversa text not null default 'claude-sonnet-5',
  modelo_rapido text not null default 'claude-haiku-4-5',
  precos_modelos jsonb not null default '{
    "claude-sonnet-5": {"entrada": 2, "saida": 10, "cacheLeitura": 0.2, "cacheEscrita": 2.5},
    "claude-haiku-4-5": {"entrada": 1, "saida": 5, "cacheLeitura": 0.1, "cacheEscrita": 1.25}
  }',
  mensagens jsonb not null default '{
    "aviso_lgpd": "Olá! Este atendimento é feito com apoio de inteligência artificial e a conversa fica registrada para podermos te atender melhor. Sempre que precisar, uma pessoa da nossa equipe assume.",
    "fora_do_horario": "Nossa equipe atende de segunda a sexta, das {inicio} às {fim}, e vai retornar assim que o expediente começar.",
    "agente_pausado": "Recebemos sua mensagem! Em instantes uma pessoa da nossa equipe vai te atender.",
    "ia_indisponivel": "Recebemos sua mensagem, já vamos te atender."
  }'
);
insert into public.configuracoes default values;

create table public.feriados (
  data date primary key,
  descricao text not null
);

create table public.respostas_prontas (
  id uuid primary key default gen_random_uuid(),
  pergunta text not null,
  resposta text not null,
  ativo boolean not null default true
);

-- Funções de apoio às políticas (security definer para não recursar no RLS de usuarios)
create function public.eh_usuario_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuarios where id = auth.uid() and ativo)
$$;

create function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuarios where id = auth.uid() and ativo and papel = 'admin')
$$;

create function public.tem_permissao(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuarios where id = auth.uid() and ativo and (papel = 'admin' or p = any (permissoes))
  )
$$;

create function public.meus_setores() returns setof uuid
language sql stable security definer set search_path = public as $$
  select us.setor_id from usuario_setores us
  join usuarios u on u.id = us.usuario_id
  where u.id = auth.uid() and u.ativo
$$;

-- RLS
alter table public.usuarios enable row level security;
alter table public.setores enable row level security;
alter table public.usuario_setores enable row level security;
alter table public.clientes enable row level security;
alter table public.cliente_responsaveis enable row level security;
alter table public.servicos enable row level security;
alter table public.cliente_servicos enable row level security;
alter table public.contatos enable row level security;
alter table public.contato_clientes enable row level security;
alter table public.configuracoes enable row level security;
alter table public.feriados enable row level security;
alter table public.respostas_prontas enable row level security;

-- Leitura por qualquer usuário ativo; escrita só administrador
create policy leitura on public.usuarios for select to authenticated using (eh_usuario_ativo());
create policy escrita_admin on public.usuarios for all to authenticated using (eh_admin()) with check (eh_admin());
create policy leitura on public.setores for select to authenticated using (eh_usuario_ativo());
create policy escrita_admin on public.setores for all to authenticated using (eh_admin()) with check (eh_admin());
create policy leitura on public.usuario_setores for select to authenticated using (eh_usuario_ativo());
create policy escrita_admin on public.usuario_setores for all to authenticated using (eh_admin()) with check (eh_admin());
create policy leitura on public.servicos for select to authenticated using (eh_usuario_ativo());
create policy escrita_admin on public.servicos for all to authenticated using (eh_admin()) with check (eh_admin());
create policy leitura on public.feriados for select to authenticated using (eh_usuario_ativo());
create policy escrita_admin on public.feriados for all to authenticated using (eh_admin()) with check (eh_admin());
create policy leitura on public.respostas_prontas for select to authenticated using (eh_usuario_ativo());
create policy escrita_admin on public.respostas_prontas for all to authenticated using (eh_admin()) with check (eh_admin());
create policy somente_admin on public.configuracoes for all to authenticated using (eh_admin()) with check (eh_admin());

-- Clientes e contatos: leitura por ativos; criar/editar com editar_clientes; excluir só admin
do $$
declare t text;
begin
  foreach t in array array['clientes', 'cliente_responsaveis', 'cliente_servicos', 'contatos', 'contato_clientes'] loop
    execute format('create policy leitura on public.%I for select to authenticated using (eh_usuario_ativo())', t);
    execute format('create policy inserir on public.%I for insert to authenticated with check (tem_permissao(''editar_clientes''))', t);
    execute format('create policy alterar on public.%I for update to authenticated using (tem_permissao(''editar_clientes'')) with check (tem_permissao(''editar_clientes''))', t);
    execute format('create policy excluir on public.%I for delete to authenticated using (eh_admin())', t);
  end loop;
end $$;
