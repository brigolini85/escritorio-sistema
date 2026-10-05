-- supabase/migrations/20261014000300_painel_v2_agentes_leituras.sql
-- Painel v2, Parte I1 (spec 7E.2, 7E.3 "Atividade e custo", 7E.8): números do mês por agente (dono e administrador),
-- atividade por dia, uso das skills e o bloco "Por agente" de Gastos com IA (só administrador). Antes da Parte I todo gasto
-- de agente era do Thiago (D16).

create function public.agente_do_uso(p_agente uuid, p_funcionalidade text) returns uuid
language sql immutable set search_path = '' as $$
  select coalesce(p_agente, case when p_funcionalidade in ('agente_clientes', 'testar_agente')
                                 then 'a0000000-0000-4000-8000-000000000001'::uuid end)
$$;
revoke execute on function public.agente_do_uso(uuid, text) from public, anon, authenticated;

-- Período comum das leituras (F12): ordem certa e no máximo 367 dias.
create function interno.conferir_periodo(p_de timestamptz, p_ate timestamptz) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_de is null or p_ate is null or p_ate <= p_de or p_ate - p_de > interval '367 days' then raise exception 'Período inválido.'; end if;
end $$;
revoke execute on function interno.conferir_periodo(timestamptz, timestamptz) from public, anon, authenticated;

create function public.agentes_checar_numeros(p_de timestamptz, p_ate timestamptz) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.eh_admin() or public.eh_dono()) then raise exception 'Só o dono e o administrador veem os números dos agentes.'; end if;
  perform interno.conferir_periodo(p_de, p_ate);
end $$;
revoke execute on function public.agentes_checar_numeros(timestamptz, timestamptz) from public, anon, authenticated;

-- A mesma regra de gastos_atendimentos_base (20261006000300): um atendimento por (conversa, dia de Brasília); passou para
-- pessoa = resposta humana ou assumir no dia. Só as chamadas do agente, sem os testes.
create function public.agente_atendimentos_base(p_agente uuid, p_de timestamptz, p_ate timestamptz)
returns table (conversa_id uuid, dia date, cliente_id uuid, custo_usd numeric, passou_para_pessoa boolean, ultima_em timestamptz)
language sql stable security definer set search_path = '' as $$
  with a as (
    select u.conversa_id, (u.criado_em at time zone 'America/Sao_Paulo')::date as dia,
           (array_agg(u.cliente_id order by u.criado_em desc, u.id desc) filter (where u.cliente_id is not null))[1] as cliente_id,
           sum(u.custo_usd) as custo_usd, max(u.criado_em) as ultima_em
    from public.uso_ia u
    where u.conversa_id is not null and u.funcionalidade <> 'testar_agente'
      and public.agente_do_uso(u.agente_id, u.funcionalidade) = p_agente
      and u.criado_em >= p_de and u.criado_em < p_ate
    group by 1, 2
  )
  select a.conversa_id, a.dia, a.cliente_id, a.custo_usd,
         exists (select 1 from public.mensagens m
                  where m.conversa_id = a.conversa_id and m.autor = 'atendente'
                    and m.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo')
                    and m.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo'))
         or exists (select 1 from public.conversa_eventos e
                  where e.conversa_id = a.conversa_id and e.tipo = 'assumida'
                    and e.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo')
                    and e.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo')),
         a.ultima_em
  from a
$$;
revoke execute on function public.agente_atendimentos_base(uuid, timestamptz, timestamptz) from public, anon, authenticated;

create function public.agentes_numeros(p_de timestamptz, p_ate timestamptz)
returns table (agente_id uuid, atendimentos bigint, resolvidos bigint, custo_usd numeric, custo_testes_usd numeric,
               ultima_em timestamptz, ultima_empresa text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.agentes_checar_numeros(p_de, p_ate);
  return query
    with b as (
      select g.id as agente, x.* from public.agentes g, lateral public.agente_atendimentos_base(g.id, p_de, p_ate) x
    ), c as (
      select public.agente_do_uso(u.agente_id, u.funcionalidade) as agente,
             sum(u.custo_usd) filter (where u.funcionalidade <> 'testar_agente') as custo,
             sum(u.custo_usd) filter (where u.funcionalidade = 'testar_agente') as testes
      from public.uso_ia u where u.criado_em >= p_de and u.criado_em < p_ate group by 1
    )
    select g.id,
           (select count(*) from b where b.agente = g.id),
           (select count(*) from b where b.agente = g.id and not b.passou_para_pessoa),
           coalesce((select c.custo from c where c.agente = g.id), 0),
           coalesce((select c.testes from c where c.agente = g.id), 0),
           (select max(b.ultima_em) from b where b.agente = g.id),
           (select coalesce(e.nome_fantasia, e.razao_social) from b join public.clientes e on e.id = b.cliente_id
             where b.agente = g.id order by b.ultima_em desc limit 1)
    from public.agentes g order by g.ordem;
end $$;

create function public.atividade_do_agente(p_slug text, p_de timestamptz, p_ate timestamptz)
returns table (dia date, atendimentos bigint, resolvidos bigint, custo_usd numeric, custo_testes_usd numeric)
language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  perform public.agentes_checar_numeros(p_de, p_ate);
  select id into v from public.agentes where slug = p_slug;
  if v is null then raise exception 'Agente não encontrado.'; end if;
  return query
    with b as (select * from public.agente_atendimentos_base(v, p_de, p_ate)),
    t as (
      select (u.criado_em at time zone 'America/Sao_Paulo')::date as dia, sum(u.custo_usd) as custo from public.uso_ia u
      where u.funcionalidade = 'testar_agente' and public.agente_do_uso(u.agente_id, u.funcionalidade) = v
        and u.criado_em >= p_de and u.criado_em < p_ate group by 1
    ),
    dias as (select b.dia from b union select t.dia from t)
    select d.dia, count(b.conversa_id), count(b.conversa_id) filter (where not b.passou_para_pessoa),
           coalesce(sum(b.custo_usd), 0), coalesce(max(t.custo), 0)
    from dias d left join b on b.dia = d.dia left join t on t.dia = d.dia
    group by d.dia order by d.dia;
end $$;

-- "Uso no mês" das skills (D10): leituras pelo nome das skills deste agente.
create function public.uso_skills(p_slug text, p_de timestamptz, p_ate timestamptz) returns table (nome text, vezes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pode_ver_agentes() then raise exception 'Você não tem acesso aos agentes.'; end if;
  perform interno.conferir_periodo(p_de, p_ate);
  return query
    select d.entrada ->> 'nome', count(*) from public.decisoes_agente d
    where d.etapa = 'ler_skill' and d.criado_em >= p_de and d.criado_em < p_ate
      and d.entrada ->> 'nome' in (select s.nome from public.agente_skills s join public.agentes a on a.id = s.agente_id where a.slug = p_slug)
    group by 1;
end $$;

create function public.gastos_por_agente(p_de timestamptz, p_ate timestamptz)
returns table (agente_id uuid, slug text, nome text, custo_usd numeric, chamadas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select g.id, g.slug, g.nome, sum(u.custo_usd), count(*)
    from public.uso_ia u join public.agentes g on g.id = public.agente_do_uso(u.agente_id, u.funcionalidade)
    where u.criado_em >= p_de and u.criado_em < p_ate
    group by 1, 2, 3 order by 4 desc, 3;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.agentes_numeros(timestamptz, timestamptz)', 'public.atividade_do_agente(text, timestamptz, timestamptz)',
    'public.uso_skills(text, timestamptz, timestamptz)', 'public.gastos_por_agente(timestamptz, timestamptz)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
