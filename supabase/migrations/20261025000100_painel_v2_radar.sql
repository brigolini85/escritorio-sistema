-- supabase/migrations/20261025000100_painel_v2_radar.sql
-- Painel v2, Parte I5 (spec 7E.7; D1–D10, D15, D16): fontes, agenda, giros e novidades do Radar de legislação.
-- Fontes e agenda só o dono muda; lê quem vê os Agentes (D11). O trabalhador abre, pega e fecha os giros e registra as novidades.
-- O Radar nunca altera nada fora destas tabelas. Nada entra no Realtime (teste 22).

-- ---------- Ajudantes ----------
create function interno.dia_sp(p timestamptz) returns date
language sql stable set search_path = '' as $$ select (p at time zone 'America/Sao_Paulo')::date $$;

-- D2: o host sem "www." (o usuário antes do @ não engana) e o caminho, em minúsculas. As mesmas regras de fonteDaUrl do core.
create function interno.host_da_url(p_url text) returns text
language sql immutable set search_path = '' as $$
  select case when lower(btrim(p_url)) ~ '[\s\\[:cntrl:]]' then null
              else nullif(regexp_replace(substring(lower(btrim(p_url)) from '^https?://(?:[^/?#@\\]*@)?([a-z0-9.-]+)(?::[0-9]{1,5})?(?:[/?#]|$)'), '^www\.', ''), '') end
$$;
create function interno.caminho_da_url(p_url text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(substring(lower(btrim(p_url)) from '^https?://[^/?#]+(/[^?#]*)'), '/')
$$;

-- ---------- Tabelas ----------
create table public.radar_config (
  id smallint primary key default 1 check (id = 1),
  hora time not null default '07:00',
  dias smallint[] not null default '{0,1,2,3,4,5,6}' check (dias <@ '{0,1,2,3,4,5,6}' and cardinality(dias) between 1 and 7),
  assuntos text[] not null default '{"Fiscal e tributos","Trabalhista / eSocial","Societário","Contábil / CFC","Simples Nacional","Estaduais de MG","Municipais de Conselheiro Lafaiete (ISS, alvará)"}'
    check (cardinality(assuntos) <= 20),
  resumo_whatsapp boolean not null default true,
  aviso_alto boolean not null default true,
  avisar_painel boolean not null default false,
  limite_usd_giro numeric(6, 2) not null default 0.50 check (limite_usd_giro between 0.05 and 5),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id) on delete set null
);
insert into public.radar_config (id) values (1);
create index radar_config_por_idx on public.radar_config (atualizado_por);

create table public.radar_fontes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 60),
  dominio text not null check (dominio ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' and dominio !~ '^[0-9.]+$'),
  caminho text check (caminho ~ '^(/[a-z0-9._~-]+){1,2}$'),
  etiqueta text not null default 'FED' check (etiqueta ~ '^[A-Z]{2,4}$'),
  oficial boolean not null default true,
  ativa boolean not null default true,
  paginas text[] not null default '{}' check (cardinality(paginas) <= 5),
  ordem smallint not null default 100,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index radar_fontes_endereco on public.radar_fontes (dominio, coalesce(caminho, ''));

create table public.radar_giros (
  id uuid primary key default gen_random_uuid(),
  origem text not null check (origem in ('agenda', 'pedido', 'nova_tentativa', 'confirmar')),
  estado text not null default 'pendente' check (estado in ('pendente', 'rodando', 'concluido', 'falhou')),
  dia date not null,
  pedido_por uuid references public.usuarios (id) on delete set null,
  novidade_id uuid,                       -- giro "confirmar" (D7); a chave entra depois da tabela de novidades
  fontes_ids uuid[],                      -- nova tentativa (D15): só estas fontes
  criado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  terminado_em timestamptz,
  fontes int not null default 0,
  paginas int not null default 0,
  buscas int not null default 0,
  novidades int not null default 0,
  repetidas int not null default 0,
  fontes_fora jsonb not null default '[]' check (jsonb_typeof(fontes_fora) = 'array'),
  lidas jsonb not null default '[]' check (jsonb_typeof(lidas) = 'array'),
  resumo text check (char_length(resumo) <= 1000),
  erro text check (char_length(erro) <= 300),
  custo_usd numeric(12, 6) not null default 0,
  nova_tentativa_em timestamptz
);
-- D7: um giro por vez; D5: um agendado por dia; D15: uma nova tentativa por dia.
create unique index radar_um_giro_por_vez on public.radar_giros ((true)) where estado in ('pendente', 'rodando');
create unique index radar_um_agendado_por_dia on public.radar_giros (dia) where origem = 'agenda';
create unique index radar_uma_tentativa_por_dia on public.radar_giros (dia) where origem = 'nova_tentativa';
create index radar_giros_criado_idx on public.radar_giros (criado_em desc);
create index radar_giros_pedido_por_idx on public.radar_giros (pedido_por);

create table public.radar_novidades (
  id uuid primary key default gen_random_uuid(),
  giro_id uuid references public.radar_giros (id) on delete set null,
  titulo text not null check (char_length(titulo) between 3 and 200),
  url text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  url_normalizada text not null,
  fonte_id uuid references public.radar_fontes (id) on delete set null,
  fonte_nome text not null,
  selo text not null check (selo in ('oficial', 'confirmar')),
  publicado_em date,
  achado_em timestamptz not null default now(),
  resumo text not null check (char_length(resumo) between 10 and 1200),
  impacto text not null check (impacto in ('alto', 'medio', 'baixo')),
  setores uuid[] not null default '{}' check (cardinality(setores) <= 3),
  criterios jsonb not null default '{}' check (jsonb_typeof(criterios) = 'object'),
  clientes_afetados int not null default 0,
  vigencia_inicio date,
  vigencia_texto text check (char_length(vigencia_texto) <= 120),
  mensagem_cliente text check (char_length(mensagem_cliente) <= 1000),
  assunto text check (char_length(assunto) <= 60),
  estado text not null default 'para_decidir' check (estado in ('para_decidir', 'demanda', 'descartada')),
  chamado_id uuid references public.chamados (id) on delete set null,
  decidida_por uuid references public.usuarios (id) on delete set null,
  decidida_em timestamptz,
  avisada_em timestamptz
);
alter table public.radar_giros add constraint radar_giros_novidade_fk foreign key (novidade_id) references public.radar_novidades (id) on delete set null;
create index radar_novidades_estado_idx on public.radar_novidades (estado, achado_em desc);
create index radar_novidades_achado_idx on public.radar_novidades (achado_em desc);
create index radar_novidades_url_idx on public.radar_novidades (url_normalizada);
create index radar_novidades_giro_idx on public.radar_novidades (giro_id);
create index radar_novidades_fonte_idx on public.radar_novidades (fonte_id);
create index radar_novidades_chamado_idx on public.radar_novidades (chamado_id);
create index radar_novidades_decidida_idx on public.radar_novidades (decidida_por);
create index radar_giros_novidade_idx on public.radar_giros (novidade_id);

-- D4: as 9 fontes do spec; o dono tira ou acrescenta. O Radar continua Desligado.
insert into public.radar_fontes (nome, dominio, caminho, etiqueta, ordem) values
  ('Receita Federal', 'gov.br', '/receitafederal', 'FED', 1),
  ('Diário Oficial da União', 'in.gov.br', null, 'FED', 2),
  ('Portal do Simples Nacional', 'www8.receita.fazenda.gov.br', '/simplesnacional', 'FED', 3),
  ('eSocial', 'gov.br', '/esocial', 'FED', 4),
  ('CFC', 'cfc.org.br', null, 'FED', 5),
  ('CONFAZ', 'confaz.fazenda.gov.br', null, 'FED', 6),
  ('Planalto (legislação)', 'planalto.gov.br', null, 'FED', 7),
  ('SEFAZ-MG', 'fazenda.mg.gov.br', null, 'MG', 8),
  ('Prefeitura de Conselheiro Lafaiete', 'conselheirolafaiete.mg.gov.br', null, 'MUN', 9);

-- ---------- Leitura (D11) ----------
alter table public.radar_config enable row level security;
alter table public.radar_fontes enable row level security;
alter table public.radar_giros enable row level security;
alter table public.radar_novidades enable row level security;
create policy leitura on public.radar_config for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.radar_fontes for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.radar_giros for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.radar_novidades for select to authenticated using (public.pode_ver_agentes());

-- ---------- Regras (D2, D10) ----------
create function interno.fonte_da_url(p_url text) returns uuid
language sql stable security definer set search_path = '' as $$
  select f.id from public.radar_fontes f, (select interno.host_da_url(p_url) as h, interno.caminho_da_url(p_url) as c) u
   where f.ativa and u.h is not null and lower(btrim(p_url)) ~ '^https?://'
     -- Caminho com "." ou ".." (também %2e) levaria a outra pasta: não casa nenhuma fonte.
     and u.c !~* '(^|/)\.\.?(/|$)|%2e'
     -- starts_with: o "_" do domínio ou do caminho não vira curinga do like.
     and (u.h = f.dominio or right(u.h, char_length(f.dominio) + 1) = '.' || f.dominio)
     and (f.caminho is null or u.c = f.caminho or starts_with(u.c, f.caminho || '/'))
   order by char_length(f.dominio) + coalesce(char_length(f.caminho), 0) desc
   limit 1
$$;

-- A mesma regra de regimeDoCliente (core).
create function interno.regime_radar(p text) returns text
language sql immutable set search_path = '' as $$
  select case when t ~ '\mmei\M' then 'mei' when t like '%simples%' then 'simples' when t like '%presumido%' then 'presumido'
              when t like '%real%' then 'real' when t like '%imune%' or t like '%isent%' then 'imune' end
    from (select translate(lower(coalesce(p, '')), 'áàâãéêíóôõúç', 'aaaaeeiooouc') as t) x
$$;
create function interno.lista_criterio(p_c jsonb, p_chave text) returns text[]
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_c -> p_chave) = 'array'
              then array(select btrim(x) from jsonb_array_elements_text(p_c -> p_chave) x where btrim(x) <> '') else '{}'::text[] end
$$;
-- D10: todos os critérios juntos; lista vazia não filtra; cliente sem o dado não entra quando o critério existe.
create function interno.cliente_nos_criterios(p_cliente uuid, p_c jsonb) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare c public.clientes%rowtype; v text[];
begin
  select * into c from public.clientes where id = p_cliente;
  if not found or not c.ativo then return false; end if;
  v := interno.lista_criterio(p_c, 'regimes');
  if cardinality(v) > 0 and not coalesce(interno.regime_radar(c.regime) = any (v), false) then return false; end if;
  v := array(select upper(x) from unnest(interno.lista_criterio(p_c, 'ufs')) x);
  if cardinality(v) > 0 and not coalesce(upper(c.uf::text) = any (v), false) then return false; end if;
  v := array(select translate(lower(x), 'áàâãéêíóôõúç', 'aaaaeeiooouc') from unnest(interno.lista_criterio(p_c, 'municipios')) x);
  if cardinality(v) > 0 and not coalesce(translate(lower(btrim(c.cidade)), 'áàâãéêíóôõúç', 'aaaaeeiooouc') = any (v), false) then return false; end if;
  v := interno.lista_criterio(p_c, 'cnaes');
  if cardinality(v) > 0 and not exists (select 1 from unnest(v) p
        where regexp_replace(coalesce(c.cnae_principal, ''), '\D', '', 'g') <> ''
          and regexp_replace(c.cnae_principal, '\D', '', 'g') like regexp_replace(p, '\D', '', 'g') || '%') then return false; end if;
  v := interno.lista_criterio(p_c, 'segmentos');
  if cardinality(v) > 0 and not (c.segmentos && v) then return false; end if;
  if coalesce(p_c ->> 'com_funcionarios', 'false') = 'true' and coalesce(c.funcionarios, 0) <= 0 then return false; end if;
  return true;
end $$;

-- Histórico do Radar na ficha do agente (D28 da I1).
create function interno.mudanca_radar(p_texto text) returns void
language sql security definer set search_path = '' as $$
  insert into public.agente_mudancas (agente_id, usuario_id, descricao)
  select a.id, auth.uid(), left(p_texto, 300) from public.agentes a where a.slug = 'radar'
$$;
revoke execute on function interno.dia_sp(timestamptz), interno.host_da_url(text), interno.caminho_da_url(text), interno.fonte_da_url(text),
  interno.regime_radar(text), interno.lista_criterio(jsonb, text), interno.cliente_nos_criterios(uuid, jsonb), interno.mudanca_radar(text)
  from public, anon, authenticated, service_role;

-- ---------- Fontes e agenda: só o dono (7E.1) ----------
create function public.salvar_fonte_radar(p_id uuid, p_dados jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare f public.radar_fontes%rowtype; v_id uuid; v_pag text; k text;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera as fontes do Radar.'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados da fonte inválidos.'; end if;
  for k in select jsonb_object_keys(p_dados) loop
    if k not in ('nome', 'dominio', 'caminho', 'etiqueta', 'oficial', 'ativa', 'paginas') then raise exception 'Dados da fonte inválidos.'; end if;
  end loop;
  if p_id is not null then
    select * into f from public.radar_fontes where id = p_id for update;
    if not found then raise exception 'Fonte não encontrada.'; end if;
  end if;
  begin
    if p_dados ? 'nome' then f.nome := btrim(p_dados ->> 'nome'); end if;
    if p_dados ? 'dominio' then f.dominio := lower(btrim(p_dados ->> 'dominio')); end if;
    if p_dados ? 'caminho' then f.caminho := nullif(lower(btrim(p_dados ->> 'caminho')), ''); end if;
    if p_dados ? 'etiqueta' then f.etiqueta := upper(btrim(p_dados ->> 'etiqueta')); end if;
    if p_dados ? 'oficial' then f.oficial := (p_dados ->> 'oficial')::boolean; end if;
    if p_dados ? 'ativa' then f.ativa := (p_dados ->> 'ativa')::boolean; end if;
    if p_dados ? 'paginas' then
      f.paginas := array(select btrim(x) from jsonb_array_elements_text(p_dados -> 'paginas') x where btrim(x) <> '');
    end if;
  exception when invalid_text_representation or invalid_parameter_value then
    raise exception 'Dados da fonte inválidos.';
  end;
  f.etiqueta := coalesce(f.etiqueta, 'FED'); f.oficial := coalesce(f.oficial, true); f.ativa := coalesce(f.ativa, true);
  f.paginas := coalesce(f.paginas, '{}');
  if f.nome is null or char_length(f.nome) not between 2 and 60 then raise exception 'O nome da fonte tem de 2 a 60 letras.'; end if;
  if f.dominio is null or f.dominio !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' or f.dominio ~ '^[0-9.]+$' then
    raise exception 'Endereço inválido: use o nome do site, como cfc.org.br.';
  end if;
  if f.caminho is not null and f.caminho !~ '^(/[a-z0-9._~-]+){1,2}$' then raise exception 'Caminho inválido: use até duas partes, como /receitafederal.'; end if;
  if f.etiqueta !~ '^[A-Z]{2,4}$' then raise exception 'Etiqueta: de 2 a 4 letras maiúsculas (FED, MG, MUN).'; end if;
  if cardinality(f.paginas) > 5 then raise exception 'Até 5 páginas por fonte.'; end if;
  foreach v_pag in array f.paginas loop
    if interno.host_da_url(v_pag) is null
       or not (interno.host_da_url(v_pag) = f.dominio or right(interno.host_da_url(v_pag), char_length(f.dominio) + 1) = '.' || f.dominio)
       -- A mesma regra de fonte_da_url: sem "." / ".." / %2e no caminho e sem curinga do like.
       or interno.caminho_da_url(v_pag) ~* '(^|/)\.\.?(/|$)|%2e'
       or (f.caminho is not null and not (interno.caminho_da_url(v_pag) = f.caminho or starts_with(interno.caminho_da_url(v_pag), f.caminho || '/'))) then
      raise exception 'A página % não é desta fonte.', v_pag;
    end if;
  end loop;
  if f.ativa and (select count(*) from public.radar_fontes where ativa and id is distinct from p_id) >= 30 then
    raise exception 'Até 30 fontes ligadas.';
  end if;
  if exists (select 1 from public.radar_fontes where dominio = f.dominio and coalesce(caminho, '') = coalesce(f.caminho, '') and id is distinct from p_id) then
    raise exception 'Esta fonte já está cadastrada.';
  end if;
  if p_id is null then
    insert into public.radar_fontes (nome, dominio, caminho, etiqueta, oficial, ativa, paginas, ordem)
    values (f.nome, f.dominio, f.caminho, f.etiqueta, f.oficial, f.ativa, f.paginas, coalesce((select max(ordem) + 1 from public.radar_fontes), 1))
    returning id into v_id;
    perform interno.mudanca_radar(format('Fonte do Radar: + %s', f.nome));
  else
    update public.radar_fontes set nome = f.nome, dominio = f.dominio, caminho = f.caminho, etiqueta = f.etiqueta, oficial = f.oficial,
      ativa = f.ativa, paginas = f.paginas, atualizado_em = now() where id = p_id;
    v_id := p_id;
    perform interno.mudanca_radar(format('Fonte do Radar alterada: %s', f.nome));
  end if;
  return v_id;
end $$;

create function public.remover_fonte_radar(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera as fontes do Radar.'; end if;
  delete from public.radar_fontes where id = p_id returning nome into v_nome;
  if not found then raise exception 'Fonte não encontrada.'; end if;
  perform interno.mudanca_radar(format('Fonte do Radar: − %s', v_nome));
end $$;

create function public.salvar_config_radar(p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.radar_config%rowtype; n public.radar_config%rowtype; k text; v_a text;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera o Radar.'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados do Radar inválidos.'; end if;
  for k in select jsonb_object_keys(p_dados) loop
    if k not in ('hora', 'dias', 'assuntos', 'resumo_whatsapp', 'aviso_alto', 'avisar_painel', 'limite_usd_giro') then
      raise exception 'Dados do Radar inválidos.';
    end if;
  end loop;
  select * into c from public.radar_config where id = 1 for update;
  n := c;
  if p_dados ? 'hora' then
    if coalesce(p_dados ->> 'hora', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Hora inválida.'; end if;
    n.hora := (p_dados ->> 'hora')::time;
  end if;
  begin
    if p_dados ? 'dias' then n.dias := array(select distinct x::smallint from jsonb_array_elements_text(p_dados -> 'dias') x order by 1); end if;
    if p_dados ? 'assuntos' then n.assuntos := array(select btrim(x) from jsonb_array_elements_text(p_dados -> 'assuntos') x where btrim(x) <> ''); end if;
    if p_dados ? 'resumo_whatsapp' then n.resumo_whatsapp := (p_dados ->> 'resumo_whatsapp')::boolean; end if;
    if p_dados ? 'aviso_alto' then n.aviso_alto := (p_dados ->> 'aviso_alto')::boolean; end if;
    if p_dados ? 'avisar_painel' then n.avisar_painel := (p_dados ->> 'avisar_painel')::boolean; end if;
    if p_dados ? 'limite_usd_giro' then n.limite_usd_giro := round((p_dados ->> 'limite_usd_giro')::numeric, 2); end if;
  exception when invalid_text_representation or invalid_parameter_value or numeric_value_out_of_range then
    raise exception 'Dados do Radar inválidos.';
  end;
  if cardinality(n.dias) = 0 then raise exception 'Escolha ao menos um dia.'; end if;
  if not (n.dias <@ '{0,1,2,3,4,5,6}'::smallint[]) then raise exception 'Dia inválido.'; end if;
  if cardinality(n.assuntos) > 20 then raise exception 'Até 20 assuntos vigiados.'; end if;
  foreach v_a in array n.assuntos loop
    if char_length(v_a) not between 2 and 60 then raise exception 'Cada assunto vigiado tem de 2 a 60 letras.'; end if;
  end loop;
  if n.resumo_whatsapp is null or n.aviso_alto is null or n.avisar_painel is null then raise exception 'Dados do Radar inválidos.'; end if;
  if n.limite_usd_giro is null or n.limite_usd_giro not between 0.05 and 5 then raise exception 'O limite por giro vai de US$ 0,05 a US$ 5,00.'; end if;
  update public.radar_config set hora = n.hora, dias = n.dias, assuntos = n.assuntos, resumo_whatsapp = n.resumo_whatsapp,
    aviso_alto = n.aviso_alto, avisar_painel = n.avisar_painel, limite_usd_giro = n.limite_usd_giro, atualizado_em = now(),
    atualizado_por = auth.uid() where id = 1;
  -- O texto da agenda é o mesmo de textoAgenda (core); aqui só o essencial para o histórico.
  if n.hora is distinct from c.hora or n.dias is distinct from c.dias then
    perform interno.mudanca_radar(format('Radar: agenda %s, %s',
      case when cardinality(n.dias) = 7 then 'todo dia' when n.dias = '{1,2,3,4,5}'::smallint[] then 'dias úteis'
           else array_to_string(array(select (array['dom','seg','ter','qua','qui','sex','sáb'])[d + 1] from unnest(n.dias) d), ', ') end,
      case when extract(minute from n.hora) = 0 then extract(hour from n.hora)::int || 'h'
           else extract(hour from n.hora)::int || 'h' || lpad(extract(minute from n.hora)::int::text, 2, '0') end));
  end if;
  if n.assuntos is distinct from c.assuntos then perform interno.mudanca_radar('Radar: assuntos vigiados alterados'); end if;
  if (n.resumo_whatsapp, n.aviso_alto, n.avisar_painel) is distinct from (c.resumo_whatsapp, c.aviso_alto, c.avisar_painel) then
    perform interno.mudanca_radar('Radar: avisos alterados');
  end if;
  if n.limite_usd_giro is distinct from c.limite_usd_giro then
    perform interno.mudanca_radar(format('Radar: limite por giro US$ %s', replace(to_char(n.limite_usd_giro, 'FM990.00'), '.', ',')));
  end if;
end $$;

-- ---------- Pedir um giro (D7) ----------
create function interno.exigir_pode_girar() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.eh_usuario_ativo() and (public.eh_admin() or public.eh_dono())) then raise exception 'Só o dono e o administrador pedem um giro.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('radar:giro', 0));
  if (select estado from public.agentes where slug = 'radar') is distinct from 'ligado'
     and (select estado from public.agentes where slug = 'radar') is distinct from 'teste' then
    raise exception 'O Radar está desligado.';
  end if;
  if not exists (select 1 from public.radar_fontes where ativa) then raise exception 'Cadastre ao menos uma fonte ligada.'; end if;
  if exists (select 1 from public.radar_giros where estado in ('pendente', 'rodando')) then raise exception 'Já tem um giro em andamento.'; end if;
  if (select count(*) from public.radar_giros where origem in ('pedido', 'confirmar') and dia = interno.dia_sp(now())) >= 6 then
    raise exception 'Já foram 6 giros pedidos hoje. O próximo agendado roda sozinho.';
  end if;
end $$;
revoke execute on function interno.exigir_pode_girar() from public, anon, authenticated, service_role;

create function public.pedir_giro_radar() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.eh_usuario_ativo() then raise exception 'Só o dono e o administrador pedem um giro.'; end if;
  perform interno.exigir_pode_girar();
  insert into public.radar_giros (origem, estado, dia, pedido_por) values ('pedido', 'pendente', interno.dia_sp(now()), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create function public.procurar_fonte_oficial_radar(p_novidade uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare n public.radar_novidades%rowtype; v_id uuid;
begin
  if not public.eh_usuario_ativo() then raise exception 'Só o dono e o administrador pedem um giro.'; end if;
  perform interno.exigir_pode_girar();
  select * into n from public.radar_novidades where id = p_novidade;
  if not found then raise exception 'Novidade não encontrada.'; end if;
  if n.selo = 'oficial' then raise exception 'Esta novidade já é de fonte oficial.'; end if;
  if n.estado = 'descartada' then raise exception 'Esta novidade foi descartada.'; end if;
  -- D7: o giro confirmar só procura nas fontes oficiais; sem nenhuma ligada não teria onde procurar.
  if not exists (select 1 from public.radar_fontes where ativa and oficial) then raise exception 'Ligue ao menos uma fonte oficial.'; end if;
  insert into public.radar_giros (origem, estado, dia, pedido_por, novidade_id) values ('confirmar', 'pendente', interno.dia_sp(now()), auth.uid(), n.id)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- Trabalhador ----------
-- D5, D8, D15: a cada minuto. Fecha o giro travado; com o Radar Ligado, abre o agendado do dia ou a nova tentativa. Devolve o que abriu.
create function public.abrir_giros_radar(p_agora timestamptz) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.radar_config%rowtype; v_dia date := interno.dia_sp(p_agora); t record;
begin
  perform pg_advisory_xact_lock(hashtextextended('radar:giro', 0));
  update public.radar_giros set estado = 'falhou', terminado_em = p_agora, erro = 'O giro parou no meio.'
   where estado = 'rodando' and iniciado_em < p_agora - interval '40 minutes';
  update public.radar_giros set estado = 'falhou', terminado_em = p_agora, erro = 'O giro não começou: o trabalhador estava fora.'
   where estado = 'pendente' and criado_em < p_agora - interval '40 minutes';
  if exists (select 1 from public.radar_giros where estado in ('pendente', 'rodando')) then return null; end if;
  if (select estado from public.agentes where slug = 'radar') is distinct from 'ligado' then return null; end if;
  if not exists (select 1 from public.radar_fontes where ativa) then return null; end if;
  select * into c from public.radar_config where id = 1;
  if extract(dow from (p_agora at time zone 'America/Sao_Paulo'))::smallint = any (c.dias)
     and (p_agora at time zone 'America/Sao_Paulo')::time >= c.hora
     and not exists (select 1 from public.radar_giros where origem = 'agenda' and dia = v_dia) then
    insert into public.radar_giros (origem, estado, dia, criado_em) values ('agenda', 'pendente', v_dia, p_agora);
    return 'agenda';
  end if;
  select array(select f.id from public.radar_fontes f
                where f.ativa and exists (select 1 from jsonb_array_elements(g.fontes_fora) e where e ->> 'fonte_id' = f.id::text)) as ids into t
    from public.radar_giros g
   where g.origem = 'agenda' and g.dia = v_dia and g.nova_tentativa_em is not null and g.nova_tentativa_em <= p_agora
     and (p_agora at time zone 'America/Sao_Paulo')::time < '20:00'
     and not exists (select 1 from public.radar_giros x where x.origem = 'nova_tentativa' and x.dia = v_dia)
   limit 1;
  if found and cardinality(t.ids) > 0 then
    insert into public.radar_giros (origem, estado, dia, criado_em, fontes_ids) values ('nova_tentativa', 'pendente', v_dia, p_agora, t.ids);
    return 'nova_tentativa';
  end if;
  return null;
end $$;

create function public.pegar_giro_radar() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.radar_giros%rowtype;
begin
  update public.radar_giros set estado = 'rodando', iniciado_em = now()
   where id = (select id from public.radar_giros where estado = 'pendente' order by criado_em limit 1 for update skip locked)
  returning * into g;
  if not found then return null; end if;
  return jsonb_build_object(
    'giro', jsonb_build_object('id', g.id, 'origem', g.origem, 'pedido_por', g.pedido_por, 'novidade_id', g.novidade_id),
    'config', (select jsonb_build_object('hora', to_char(c.hora, 'HH24:MI'), 'dias', c.dias, 'assuntos', c.assuntos,
                 'resumo_whatsapp', c.resumo_whatsapp, 'aviso_alto', c.aviso_alto, 'avisar_painel', c.avisar_painel,
                 'limite_usd_giro', c.limite_usd_giro) from public.radar_config c where c.id = 1),
    'fontes', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'dominio', f.dominio, 'caminho', f.caminho,
                 'etiqueta', f.etiqueta, 'oficial', f.oficial, 'ativa', f.ativa, 'paginas', to_jsonb(f.paginas)) order by f.ordem, f.nome)
               from public.radar_fontes f where f.ativa and (g.fontes_ids is null or f.id = any (g.fontes_ids))), '[]'::jsonb),
    'setores', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.nome) from public.setores s where s.ativo), '[]'::jsonb),
    'recentes', coalesce((select jsonb_agg(x.titulo order by x.achado_em desc) from (
                 select n.titulo, n.achado_em from public.radar_novidades n where n.achado_em > now() - interval '30 days'
                  order by n.achado_em desc limit 60) x), '[]'::jsonb),
    'novidade', (select jsonb_build_object('id', n.id, 'titulo', n.titulo, 'url', n.url, 'resumo', n.resumo)
                   from public.radar_novidades n where n.id = g.novidade_id));
end $$;

-- D1–D2, D7, D9, D10: o trabalhador manda o que o Claude achou; o banco decide fonte, selo, repetida e quantos clientes.
create function public.registrar_novidade_radar(p_giro uuid, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g public.radar_giros%rowtype;
  v_titulo text := btrim(coalesce(p_dados ->> 'titulo', ''));
  v_url text := btrim(coalesce(p_dados ->> 'url', ''));
  v_norm text := btrim(coalesce(p_dados ->> 'url_normalizada', ''));
  v_resumo text := btrim(coalesce(p_dados ->> 'resumo', ''));
  v_impacto text := p_dados ->> 'impacto';
  v_crit jsonb := case when jsonb_typeof(p_dados -> 'criterios') = 'object' then p_dados -> 'criterios' else '{}'::jsonb end;
  v_pub date; v_vig date; v_fonte uuid; v_oficial boolean; v_nome text; v_setores uuid[]; v_id uuid; v_n int;
begin
  select * into g from public.radar_giros where id = p_giro for update;
  if not found or g.estado <> 'rodando' then raise exception 'O giro não está rodando.'; end if;
  if char_length(v_titulo) not between 3 and 200 then raise exception 'Título da novidade: de 3 a 200 letras.'; end if;
  if v_url !~* '^https?://' or char_length(v_url) > 2000 or interno.host_da_url(v_url) is null or v_norm = '' then raise exception 'Link inválido.'; end if;
  if char_length(v_resumo) not between 10 and 1200 then raise exception 'Resumo: de 10 a 1.200 letras.'; end if;
  if v_impacto is null or v_impacto not in ('alto', 'medio', 'baixo') then raise exception 'Impacto inválido.'; end if;
  if char_length(coalesce(p_dados ->> 'mensagem_cliente', '')) > 1000 then raise exception 'Mensagem ao cliente: até 1.000 letras.'; end if;
  if char_length(coalesce(p_dados ->> 'vigencia_texto', '')) > 120 then raise exception 'Vigência: até 120 letras.'; end if;
  begin
    v_pub := nullif(p_dados ->> 'publicado_em', '')::date;
    v_vig := nullif(p_dados ->> 'vigencia_inicio', '')::date;
  exception when others then
    v_pub := null; v_vig := null;   -- data que o modelo escreveu errado não derruba a novidade
  end;
  v_fonte := interno.fonte_da_url(v_url);
  select f.oficial, f.nome into v_oficial, v_nome from public.radar_fontes f where f.id = v_fonte;
  if g.origem = 'confirmar' then
    if not coalesce(v_oficial, false) then return jsonb_build_object('situacao', 'nao_oficial'); end if;
    update public.radar_novidades set url = v_url, url_normalizada = v_norm, fonte_id = v_fonte, fonte_nome = v_nome, selo = 'oficial',
      publicado_em = coalesce(v_pub, publicado_em) where id = g.novidade_id and selo = 'confirmar';
    update public.radar_giros set novidades = novidades + 1 where id = p_giro;
    return jsonb_build_object('situacao', 'confirmada', 'id', g.novidade_id, 'selo', 'oficial');
  end if;
  if exists (select 1 from public.radar_novidades n where n.achado_em > now() - interval '30 days'
              and (n.url_normalizada = v_norm or lower(n.titulo) = lower(v_titulo))) then
    update public.radar_giros set repetidas = repetidas + 1 where id = p_giro;
    return jsonb_build_object('situacao', 'repetida');
  end if;
  v_setores := array(select s.id from public.setores s
                      where s.ativo and s.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(p_dados -> 'setores') = 'array'
                                                                                        then p_dados -> 'setores' else '[]'::jsonb end))
                      order by s.nome limit 3);
  v_n := (select count(*) from public.clientes c where c.ativo and interno.cliente_nos_criterios(c.id, v_crit));
  insert into public.radar_novidades (giro_id, titulo, url, url_normalizada, fonte_id, fonte_nome, selo, publicado_em, resumo, impacto, setores,
    criterios, clientes_afetados, vigencia_inicio, vigencia_texto, mensagem_cliente, assunto)
  values (p_giro, v_titulo, v_url, v_norm, v_fonte, coalesce(v_nome, interno.host_da_url(v_url)),
    case when coalesce(v_oficial, false) then 'oficial' else 'confirmar' end, v_pub, v_resumo, v_impacto, v_setores, v_crit, v_n, v_vig,
    nullif(btrim(p_dados ->> 'vigencia_texto'), ''), nullif(btrim(p_dados ->> 'mensagem_cliente'), ''), nullif(left(btrim(p_dados ->> 'assunto'), 60), ''))
  returning id into v_id;
  update public.radar_giros set novidades = novidades + 1 where id = p_giro;
  return jsonb_build_object('situacao', 'nova', 'id', v_id, 'selo', case when coalesce(v_oficial, false) then 'oficial' else 'confirmar' end, 'clientes', v_n);
end $$;

create function public.somar_custo_giro(p_giro uuid, p_usd numeric) returns void
language sql security definer set search_path = '' as $$
  update public.radar_giros set custo_usd = custo_usd + greatest(coalesce(p_usd, 0), 0) where id = p_giro
$$;

-- D15: o agendado com fonte fora do ar marca uma nova tentativa em 5 h, se ela cair antes das 20 h do mesmo dia em São Paulo.
create function public.concluir_giro_radar(p_giro uuid, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_fim timestamptz := coalesce(nullif(p_dados ->> 'terminado_em', '')::timestamptz, now());
        v_fora jsonb := case when jsonb_typeof(p_dados -> 'fontes_fora') = 'array' then p_dados -> 'fontes_fora' else '[]'::jsonb end;
begin
  update public.radar_giros g set
    estado = case when p_dados ->> 'estado' = 'falhou' then 'falhou' else 'concluido' end,
    terminado_em = v_fim,
    fontes = coalesce((p_dados ->> 'fontes')::int, 0), paginas = coalesce((p_dados ->> 'paginas')::int, 0),
    buscas = coalesce((p_dados ->> 'buscas')::int, 0), fontes_fora = v_fora,
    lidas = case when jsonb_typeof(p_dados -> 'lidas') = 'array' then p_dados -> 'lidas' else '[]'::jsonb end,
    resumo = left(nullif(btrim(p_dados ->> 'resumo'), ''), 1000), erro = left(nullif(btrim(p_dados ->> 'erro'), ''), 300),
    nova_tentativa_em = case
      when g.origem = 'agenda' and exists (select 1 from jsonb_array_elements(v_fora) e join public.radar_fontes f on f.id::text = e ->> 'fonte_id')
       and interno.dia_sp(v_fim + interval '5 hours') = g.dia
       and ((v_fim + interval '5 hours') at time zone 'America/Sao_Paulo')::time < '20:00'
      then v_fim + interval '5 hours' end
  where g.id = p_giro and g.estado = 'rodando';
end $$;

-- Para limparBanco (testes): o Radar volta às sementes.
create function public.restaurar_radar_inicial() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.radar_novidades;
  delete from public.radar_giros;
  delete from public.radar_fontes;
  insert into public.radar_fontes (nome, dominio, caminho, etiqueta, ordem) values
    ('Receita Federal', 'gov.br', '/receitafederal', 'FED', 1), ('Diário Oficial da União', 'in.gov.br', null, 'FED', 2),
    ('Portal do Simples Nacional', 'www8.receita.fazenda.gov.br', '/simplesnacional', 'FED', 3), ('eSocial', 'gov.br', '/esocial', 'FED', 4),
    ('CFC', 'cfc.org.br', null, 'FED', 5), ('CONFAZ', 'confaz.fazenda.gov.br', null, 'FED', 6),
    ('Planalto (legislação)', 'planalto.gov.br', null, 'FED', 7), ('SEFAZ-MG', 'fazenda.mg.gov.br', null, 'MG', 8),
    ('Prefeitura de Conselheiro Lafaiete', 'conselheirolafaiete.mg.gov.br', null, 'MUN', 9);
  delete from public.radar_config;
  insert into public.radar_config (id) values (1);
end $$;

revoke execute on function public.salvar_fonte_radar(uuid, jsonb), public.remover_fonte_radar(uuid), public.salvar_config_radar(jsonb),
  public.pedir_giro_radar(), public.procurar_fonte_oficial_radar(uuid) from public, anon, service_role;
grant execute on function public.salvar_fonte_radar(uuid, jsonb), public.remover_fonte_radar(uuid), public.salvar_config_radar(jsonb),
  public.pedir_giro_radar(), public.procurar_fonte_oficial_radar(uuid) to authenticated;
revoke execute on function public.abrir_giros_radar(timestamptz), public.pegar_giro_radar(), public.registrar_novidade_radar(uuid, jsonb),
  public.somar_custo_giro(uuid, numeric), public.concluir_giro_radar(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.abrir_giros_radar(timestamptz), public.pegar_giro_radar(), public.registrar_novidade_radar(uuid, jsonb),
  public.somar_custo_giro(uuid, numeric), public.concluir_giro_radar(uuid, jsonb) to service_role;
revoke execute on function public.restaurar_radar_inicial() from public, anon, authenticated, service_role;
