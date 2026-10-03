-- supabase/migrations/20261004000100_painel_v2_niveis.sql
-- Painel v2, Parte D (spec 7.1 e 7.2): permissões por módulo com nível, no lugar das 6 marcações antigas.
-- Ninguém ganha nem perde acesso aqui: cada marcação vira o nível equivalente, e o que não era marcação (Atendimento,
-- Demandas, Prazos, Configurações) fica no nível que reproduz o comportamento de hoje.
-- usuarios.permissoes continua como cópia mantida pelo banco, nos dois sentidos: os painéis e o trabalhador antigos
-- da homologação (e os testes que gravam o array) seguem funcionando até a coluna sair numa parte futura.

-- ---------- Catálogo ----------

create table public.permissao_niveis (
  modulo text not null,
  nivel text not null,
  ordem smallint not null,
  primary key (modulo, nivel),
  unique (modulo, ordem)
);
insert into public.permissao_niveis (modulo, nivel, ordem) values
  ('atendimento', 'sem_acesso', 0), ('atendimento', 'meus_setores', 1), ('atendimento', 'todas', 2),
  ('demandas', 'minhas', 0), ('demandas', 'meu_setor', 1), ('demandas', 'todas', 2),
  ('clientes', 'ver', 0), ('clientes', 'editar', 1), ('clientes', 'arquivar', 2),
  ('precos', 'ver', 0), ('precos', 'mudar', 1),
  ('notas', 'sem_acesso', 0), ('notas', 'ver', 1), ('notas', 'corrigir', 2),
  ('assistente', 'sem_acesso', 0), ('assistente', 'site', 1), ('assistente', 'site_whatsapp', 2),
  ('treinar', 'nao', 0), ('treinar', 'sim', 1),
  ('prazos', 'nao', 0), ('prazos', 'sim', 1),
  ('configuracoes', 'nao', 0), ('configuracoes', 'sim', 1);
alter table public.permissao_niveis enable row level security;
create policy leitura on public.permissao_niveis for select to authenticated using (true);
revoke insert, update, delete on public.permissao_niveis from authenticated, anon;

-- Nível que reproduz o comportamento de hoje para quem não tem marcação nenhuma.
create function public.nivel_padrao(p_modulo text) returns text
language sql immutable set search_path = '' as $$
  select case p_modulo
    when 'atendimento' then 'meus_setores' when 'demandas' then 'meu_setor' when 'clientes' then 'ver'
    when 'precos' then 'ver' when 'notas' then 'ver' when 'assistente' then 'sem_acesso'
    when 'treinar' then 'nao' when 'prazos' then 'sim' when 'configuracoes' then 'nao'
  end
$$;

-- Os 9 módulos, com o padrão onde o parcial não diz nada.
create function public.niveis_com_padrao(p_parcial jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_object_agg(m, coalesce(p_parcial ->> m, public.nivel_padrao(m)))
  from unnest(array['atendimento', 'demandas', 'clientes', 'precos', 'notas', 'assistente', 'treinar', 'prazos', 'configuracoes']) m
$$;

-- ---------- Níveis de cada pessoa (fonte da verdade) ----------

create table public.usuario_permissoes (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  modulo text not null,
  nivel text not null,
  primary key (usuario_id, modulo),
  foreign key (modulo, nivel) references public.permissao_niveis (modulo, nivel)
);
alter table public.usuario_permissoes enable row level security;
create policy leitura on public.usuario_permissoes for select to authenticated using (public.eh_usuario_ativo());
create policy escrita_admin on public.usuario_permissoes for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create trigger auditoria after insert or update or delete on public.usuario_permissoes
  for each row execute function public.registrar_auditoria();

create function public.niveis_do_usuario(p_usuario uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.niveis_com_padrao(coalesce(
    (select jsonb_object_agg(modulo, nivel) from public.usuario_permissoes where usuario_id = p_usuario), '{}'::jsonb))
$$;
revoke execute on function public.niveis_do_usuario(uuid) from public, anon;
grant execute on function public.niveis_do_usuario(uuid) to authenticated, service_role;

create function public.nivel_de(p_usuario uuid, p_modulo text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select nivel from public.usuario_permissoes where usuario_id = p_usuario and modulo = p_modulo),
                  public.nivel_padrao(p_modulo))
$$;
revoke execute on function public.nivel_de(uuid, text) from public, anon, authenticated;
grant execute on function public.nivel_de(uuid, text) to service_role;

-- ---------- Conversão das marcações antigas ----------

-- Níveis que as marcações antigas dão. p_atual: os níveis de agora (o painel antigo não promove nem rebaixa o que
-- ele não sabe mostrar: "Ver e editar" continua "Ver e editar"; "Sem acesso" a pedidos continua "Sem acesso").
create function public.niveis_da_permissao_legada(p text[], p_atual jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'clientes', case when 'editar_clientes' = any (p)
                     then case when p_atual ->> 'clientes' in ('editar', 'arquivar') then p_atual ->> 'clientes' else 'arquivar' end
                     else 'ver' end,
    'precos', case when 'editar_precos' = any (p) then 'mudar' else 'ver' end,
    'notas', case when 'emitir_notas' = any (p) then 'corrigir'
                  when p_atual ->> 'notas' = 'sem_acesso' then 'sem_acesso' else 'ver' end,
    'assistente', case when 'assistente_whatsapp' = any (p) then 'site_whatsapp'
                       when 'assistente_site' = any (p) then 'site' else 'sem_acesso' end,
    'treinar', case when 'treinar_agente' = any (p) then 'sim' else 'nao' end)
$$;

-- A cópia antiga que os níveis dão (sempre na mesma ordem).
create function public.permissoes_dos_niveis(n jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select array_remove(array[
    case when n ->> 'clientes' in ('editar', 'arquivar') then 'editar_clientes' end,
    case when n ->> 'precos' = 'mudar' then 'editar_precos' end,
    case when n ->> 'notas' = 'corrigir' then 'emitir_notas' end,
    case when n ->> 'assistente' in ('site', 'site_whatsapp') then 'assistente_site' end,
    case when n ->> 'assistente' = 'site_whatsapp' then 'assistente_whatsapp' end,
    case when n ->> 'treinar' = 'sim' then 'treinar_agente' end
  ], null)
$$;

-- Quem já existe: os 9 módulos pelo que tem hoje.
insert into public.usuario_permissoes (usuario_id, modulo, nivel)
select u.id, n.key, n.value
from public.usuarios u,
     lateral jsonb_each_text(public.niveis_com_padrao(public.niveis_da_permissao_legada(u.permissoes, '{}'::jsonb))) n;

-- P2: quem tinha o assistente só pelo WhatsApp passa a ter também o site. Aparece no --dry-run para o dono conferir.
do $$
declare r record;
begin
  for r in select nome from public.usuarios
           where 'assistente_whatsapp' = any (permissoes) and not ('assistente_site' = any (permissoes)) loop
    raise notice 'Parte D: % tinha o assistente só pelo WhatsApp e agora tem "Site e WhatsApp".', r.nome;
  end loop;
end $$;

update public.usuarios u set permissoes = public.permissoes_dos_niveis(public.niveis_do_usuario(u.id))
where u.permissoes is distinct from public.permissoes_dos_niveis(public.niveis_do_usuario(u.id));

-- ---------- Cópia nos dois sentidos ----------

-- Pessoa nova por qualquer caminho (painel novo, painel antigo, testes): a cópia já sai normalizada...
create function public.usuarios_permissoes_antes_inserir() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.permissoes := public.permissoes_dos_niveis(public.niveis_com_padrao(public.niveis_da_permissao_legada(new.permissoes, '{}'::jsonb)));
  return new;
end $$;
create trigger permissoes_antes_inserir before insert on public.usuarios
  for each row execute function public.usuarios_permissoes_antes_inserir();

-- ... e os 9 módulos são criados.
create function public.usuarios_niveis_depois_inserir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuario_permissoes (usuario_id, modulo, nivel)
  select new.id, n.key, n.value
  from jsonb_each_text(public.niveis_com_padrao(public.niveis_da_permissao_legada(new.permissoes, '{}'::jsonb))) n
  on conflict (usuario_id, modulo) do nothing;
  return null;
end $$;
create trigger niveis_depois_inserir after insert on public.usuarios
  for each row execute function public.usuarios_niveis_depois_inserir();

-- Painel antigo (ou teste) grava o array: os níveis acompanham, sem promover "Ver e editar" a "Editar e arquivar".
create function public.usuarios_permissoes_antes_alterar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  -- Cópia escrita pelo próprio banco (gatilho de usuario_permissoes): não volta.
  if pg_trigger_depth() > 1 then return new; end if;
  v := public.niveis_da_permissao_legada(new.permissoes, public.niveis_do_usuario(new.id));
  insert into public.usuario_permissoes as up (usuario_id, modulo, nivel)
  select new.id, n.key, n.value from jsonb_each_text(v) n
  on conflict (usuario_id, modulo) do update set nivel = excluded.nivel where up.nivel is distinct from excluded.nivel;
  new.permissoes := public.permissoes_dos_niveis(public.niveis_do_usuario(new.id) || v);
  return new;
end $$;
create trigger permissoes_antes_alterar before update of permissoes on public.usuarios
  for each row when (new.permissoes is distinct from old.permissoes)
  execute function public.usuarios_permissoes_antes_alterar();

-- Nível mudado (painel novo, salvar_usuario): a cópia antiga acompanha.
create function public.usuario_permissoes_espelhar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(new.usuario_id, old.usuario_id);
begin
  -- Linhas criadas pelos gatilhos de usuarios já saem com a cópia certa.
  if pg_trigger_depth() > 1 then return null; end if;
  update public.usuarios set permissoes = public.permissoes_dos_niveis(public.niveis_do_usuario(v_id))
  where id = v_id and permissoes is distinct from public.permissoes_dos_niveis(public.niveis_do_usuario(v_id));
  return null;
end $$;
create trigger espelhar_permissoes after insert or update or delete on public.usuario_permissoes
  for each row execute function public.usuario_permissoes_espelhar();

-- ---------- Regras com a pessoa (o trabalhador usa com a chave de serviço) ----------

create function public.eh_admin_de(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios where id = p_usuario and ativo and papel = 'admin')
$$;

-- Pessoa que pode usar o sistema agora. A migração do horário troca o corpo; todas as regras passam por aqui.
create function public.usuario_liberado(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios where id = p_usuario and ativo)
$$;

create function public.tem_nivel_de(p_usuario uuid, p_modulo text, p_minimo text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_minimo smallint;
begin
  select ordem into v_minimo from public.permissao_niveis where modulo = p_modulo and nivel = p_minimo;
  if v_minimo is null then raise exception 'Nível desconhecido: %/%.', p_modulo, p_minimo; end if;
  return public.usuario_liberado(p_usuario) and coalesce((
    select n.ordem >= v_minimo from public.permissao_niveis n
    where n.modulo = p_modulo and n.nivel = public.nivel_de(p_usuario, p_modulo)), false);
end $$;

revoke execute on function public.eh_admin_de(uuid), public.usuario_liberado(uuid), public.tem_nivel_de(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.eh_admin_de(uuid), public.usuario_liberado(uuid), public.tem_nivel_de(uuid, text, text) to service_role;

-- As de sempre, agora pelas versões com a pessoa (mesmo resultado; o teste 22 confere).
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$ select public.eh_admin_de(auth.uid()) $$;

create or replace function public.eh_usuario_ativo() returns boolean
language sql stable security definer set search_path = '' as $$ select public.usuario_liberado(auth.uid()) $$;

create or replace function public.meus_setores() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select us.setor_id from public.usuario_setores us
  where us.usuario_id = auth.uid() and public.usuario_liberado(auth.uid())
$$;

-- Sem passe livre do administrador: o assistente é canal e precisa da marcação (como hoje, P3).
create function public.tem_nivel(p_modulo text, p_minimo text) returns boolean
language sql stable security definer set search_path = '' as $$ select public.tem_nivel_de(auth.uid(), p_modulo, p_minimo) $$;

create function public.tem_permissao(p_modulo text, p_minimo text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin() or public.tem_nivel(p_modulo, p_minimo)
$$;

-- Adaptador das chamadas antigas (políticas e funções de antes da Parte D).
create or replace function public.tem_permissao(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p
    when 'editar_clientes' then public.tem_permissao('clientes', 'editar')
    when 'editar_precos' then public.tem_permissao('precos', 'mudar')
    when 'emitir_notas' then public.tem_permissao('notas', 'corrigir')
    when 'treinar_agente' then public.tem_permissao('treinar', 'sim')
    when 'assistente_site' then public.tem_permissao('assistente', 'site')
    when 'assistente_whatsapp' then public.tem_permissao('assistente', 'site_whatsapp')
    else public.eh_admin()
  end
$$;

-- ---------- Ficha da pessoa (spec 7.2) ----------

alter table public.usuarios
  add column cargo text check (cargo is null or char_length(cargo) between 1 and 60),
  add column observacoes text check (observacoes is null or char_length(observacoes) <= 1000),
  add column ultimo_acesso_em timestamptz;
