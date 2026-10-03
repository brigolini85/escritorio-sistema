-- supabase/migrations/20261006000300_painel_v2_gastos_funcoes.sql
-- Painel v2, Parte F (spec 7B.2): leituras da tela Gastos com IA, só do administrador (spec 7: não é permissão
-- configurável). "Atendimento" = mensagens de um telefone num mesmo dia de Brasília (conversas é uma por telefone).

create function public.gastos_checar(p_de timestamptz, p_ate timestamptz) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'Só o administrador vê os gastos com IA.'; end if;
  if p_de is null or p_ate is null or p_ate <= p_de or p_ate - p_de > interval '367 days' then
    raise exception 'Período inválido.';
  end if;
end $$;
revoke execute on function public.gastos_checar(timestamptz, timestamptz) from public, anon, authenticated;

-- Base interna: um atendimento por (conversa, dia, empresa). Passou para pessoa: resposta humana ou assumir no dia.
create function public.gastos_atendimentos_base(p_de timestamptz, p_ate timestamptz)
returns table (conversa_id uuid, dia date, cliente_id uuid, custo_usd numeric, chamadas bigint, passou_para_pessoa boolean)
language sql stable security definer set search_path = '' as $$
  with a as (
    select u.conversa_id, (u.criado_em at time zone 'America/Sao_Paulo')::date as dia, u.cliente_id,
           sum(u.custo_usd) as custo_usd, count(*) as chamadas
    from public.uso_ia u
    where u.conversa_id is not null and u.criado_em >= p_de and u.criado_em < p_ate
    group by 1, 2, 3
  )
  select a.conversa_id, a.dia, a.cliente_id, a.custo_usd, a.chamadas,
         exists (select 1 from public.mensagens m
                  where m.conversa_id = a.conversa_id and m.autor = 'atendente'
                    and m.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo')
                    and m.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo'))
         or exists (select 1 from public.conversa_eventos e
                  where e.conversa_id = a.conversa_id and e.tipo = 'assumida'
                    and e.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo')
                    and e.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo'))
  from a
$$;
revoke execute on function public.gastos_atendimentos_base(timestamptz, timestamptz) from public, anon, authenticated;

create function public.gastos_resumo(p_de timestamptz, p_ate timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.gastos_checar(p_de, p_ate);
  with precos as (
    select k.key as modelo, (k.value ->> 'entrada')::numeric as entrada,
           (k.value ->> 'cacheLeitura')::numeric as cache_leitura, (k.value ->> 'cacheEscrita')::numeric as cache_escrita
    from public.configuracoes c, jsonb_each(c.precos_modelos) k where c.id = 1
  )
  select jsonb_build_object(
    'total_usd', coalesce(sum(u.custo_usd), 0),
    'chamadas', count(*),
    'atendimentos', count(distinct (u.conversa_id, (u.criado_em at time zone 'America/Sao_Paulo')::date)) filter (where u.conversa_id is not null),
    'custo_atendimentos_usd', coalesce(sum(u.custo_usd) filter (where u.conversa_id is not null), 0),
    'segundos_audio', coalesce(sum(u.segundos_audio) filter (where u.funcionalidade = 'transcricao_audio'), 0),
    'custo_audio_usd', coalesce(sum(u.custo_usd) filter (where u.funcionalidade = 'transcricao_audio'), 0),
    'economia_cache_usd', coalesce(sum((u.tokens_cache_leitura * (p.entrada - p.cache_leitura)
                                        - u.tokens_cache_escrita * (p.cache_escrita - p.entrada)) / 1000000.0), 0),
    'nao_identificado', count(*) filter (where u.funcionalidade = 'nao_identificado'))
  into r
  from public.uso_ia u left join precos p on p.modelo = u.modelo
  where u.criado_em >= p_de and u.criado_em < p_ate;
  return r;
end $$;

create function public.gastos_por_funcionalidade(p_de timestamptz, p_ate timestamptz)
returns table (funcionalidade text, custo_usd numeric, chamadas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select u.funcionalidade, sum(u.custo_usd), count(*)
    from public.uso_ia u where u.criado_em >= p_de and u.criado_em < p_ate
    group by 1 order by 2 desc, 1;
end $$;

create function public.gastos_por_dia(p_de timestamptz, p_ate timestamptz)
returns table (dia date, custo_usd numeric, chamadas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    with u as (
      select (x.criado_em at time zone 'America/Sao_Paulo')::date as dia, x.custo_usd
      from public.uso_ia x where x.criado_em >= p_de and x.criado_em < p_ate
    )
    select d::date, coalesce(sum(u.custo_usd), 0), count(u.custo_usd)
    from generate_series((p_de at time zone 'America/Sao_Paulo')::date,
                         ((p_ate - interval '1 microsecond') at time zone 'America/Sao_Paulo')::date, interval '1 day') d
    left join u on u.dia = d::date
    group by 1 order by 1;
end $$;

create function public.gastos_dia_mais_caro(p_de timestamptz, p_ate timestamptz)
returns table (dia date, custo_dia numeric, dias_com_gasto bigint, funcionalidade text, usuario_id uuid, pessoa text, custo numeric, chamadas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    with u as (
      select (x.criado_em at time zone 'America/Sao_Paulo')::date as dia, x.funcionalidade, x.usuario_id, x.custo_usd
      from public.uso_ia x where x.criado_em >= p_de and x.criado_em < p_ate
    ),
    dias as (select u.dia, sum(u.custo_usd) as total from u group by 1),
    topo as (select d.dia, d.total from dias d order by d.total desc, d.dia desc limit 1)
    select t.dia, t.total, (select count(*) from dias), u.funcionalidade, u.usuario_id, us.nome, sum(u.custo_usd), count(*)
    from topo t join u on u.dia = t.dia left join public.usuarios us on us.id = u.usuario_id
    group by t.dia, t.total, u.funcionalidade, u.usuario_id, us.nome
    order by 7 desc limit 1;
end $$;

create function public.gastos_por_pessoa(p_de timestamptz, p_ate timestamptz)
returns table (usuario_id uuid, nome text, funcionalidade text, custo_usd numeric, chamadas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select u.usuario_id, us.nome, u.funcionalidade, sum(u.custo_usd), count(*)
    from public.uso_ia u join public.usuarios us on us.id = u.usuario_id
    where u.usuario_id is not null and u.criado_em >= p_de and u.criado_em < p_ate
    group by 1, 2, 3;
end $$;

create function public.gastos_por_cliente(p_de timestamptz, p_ate timestamptz, p_busca text default null)
returns table (cliente_id uuid, nome text, atendimentos bigint, custo_usd numeric, resolvidos bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select a.cliente_id, coalesce(c.nome_fantasia, c.razao_social, 'Sem empresa identificada'),
           count(*), sum(a.custo_usd), count(*) filter (where not a.passou_para_pessoa)
    from public.gastos_atendimentos_base(p_de, p_ate) a left join public.clientes c on c.id = a.cliente_id
    where coalesce(trim(p_busca), '') = ''
       or strpos(lower(coalesce(c.nome_fantasia, '') || ' ' || coalesce(c.razao_social, '')), lower(trim(p_busca))) > 0
    group by 1, 2 order by 4 desc, 2 limit 200;
end $$;

create function public.gastos_atendimentos_do_cliente(p_cliente uuid, p_de timestamptz, p_ate timestamptz)
returns table (conversa_id uuid, dia date, inicio timestamptz, contato text, mensagens bigint, resultado text, custo_usd numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select a.conversa_id, a.dia,
           (select min(m.criado_em) from public.mensagens m where m.conversa_id = a.conversa_id
              and m.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo') and m.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo')),
           coalesce(ct.nome, 'Contato não cadastrado'),
           (select count(*) from public.mensagens m where m.conversa_id = a.conversa_id and m.autor <> 'sistema'
              and m.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo') and m.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo')),
           case when a.passou_para_pessoa then 'passou_para_pessoa' else 'resolvido_pelo_agente' end,
           a.custo_usd
    from public.gastos_atendimentos_base(p_de, p_ate) a
    left join public.conversas cv on cv.id = a.conversa_id
    left join public.contatos ct on ct.id = cv.contato_id
    where a.cliente_id is not distinct from p_cliente
    order by a.dia desc, 3 desc limit 500;
end $$;

create function public.gastos_chamadas(p_de timestamptz, p_ate timestamptz, p_usuario uuid default null, p_cliente uuid default null,
                                       p_funcionalidade text default null, p_limite int default 200)
returns table (id uuid, criado_em timestamptz, funcionalidade text, usuario_id uuid, pessoa text, cliente_id uuid, empresa text,
               conversa_id uuid, modelo text, provedor text, tokens_entrada int, tokens_saida int, tokens_cache_leitura int,
               tokens_cache_escrita int, segundos_audio numeric, custo_usd numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select u.id, u.criado_em, u.funcionalidade, u.usuario_id, us.nome, u.cliente_id, coalesce(c.nome_fantasia, c.razao_social),
           u.conversa_id, u.modelo, u.provedor, u.tokens_entrada, u.tokens_saida, u.tokens_cache_leitura, u.tokens_cache_escrita,
           u.segundos_audio, u.custo_usd
    from public.uso_ia u
    left join public.usuarios us on us.id = u.usuario_id
    left join public.clientes c on c.id = u.cliente_id
    where u.criado_em >= p_de and u.criado_em < p_ate
      and (p_usuario is null or u.usuario_id = p_usuario)
      and (p_cliente is null or u.cliente_id = p_cliente)
      and (p_funcionalidade is null or u.funcionalidade = p_funcionalidade)
    order by u.criado_em desc, u.id
    limit least(greatest(coalesce(p_limite, 200), 1), 100000);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.gastos_resumo(timestamptz, timestamptz)', 'public.gastos_por_funcionalidade(timestamptz, timestamptz)',
    'public.gastos_por_dia(timestamptz, timestamptz)', 'public.gastos_dia_mais_caro(timestamptz, timestamptz)',
    'public.gastos_por_pessoa(timestamptz, timestamptz)', 'public.gastos_por_cliente(timestamptz, timestamptz, text)',
    'public.gastos_atendimentos_do_cliente(uuid, timestamptz, timestamptz)',
    'public.gastos_chamadas(timestamptz, timestamptz, uuid, uuid, text, int)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
