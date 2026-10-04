-- supabase/migrations/20261008000100_painel_v2_inicio.sql
-- Painel v2, Parte G2 (spec 7C.1): três leituras para o Início. Nenhuma grava e nenhuma entra no Realtime (o teste 22
-- congela a publicação; o Início relê por polling, D2).
--   estado_sistema_resumo: agente, teto, WhatsApp e trabalhador para qualquer pessoa ativa, só sim/não (D3);
--   agente_numeros_hoje: os números do dia do agente, só para o administrador (D7);
--   demandas_por_setor: as abertas por setor pela regra de leitura de quem chama (security invoker, D5).

create function public.estado_sistema_resumo() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_mes timestamp := date_trunc('month', now() at time zone 'America/Sao_Paulo');
  v_limite timestamptz := now() - interval '5 minutes';
begin
  -- Arquivada ou fora do horário: nada, como limites_espera (o painel mostra "indisponível").
  if not public.eh_usuario_ativo() then return null; end if;
  return (
    select jsonb_build_object(
      'agente_pausado', c.agente_pausado,
      -- A mesma conta do trabalhador (custo do mês de Brasília >= teto): só o sim ou não sai daqui.
      'teto_atingido', public.custo_ia_periodo(v_mes at time zone 'America/Sao_Paulo',
                                               (v_mes + interval '1 month') at time zone 'America/Sao_Paulo') >= c.teto_ia_usd,
      'whatsapp_conectado', coalesce((select s.visto_em > v_limite from public.sinais_vida s where s.componente = 'whatsapp'), false),
      'trabalhador_ok', coalesce((select s.visto_em > v_limite from public.sinais_vida s where s.componente = 'fila'), false),
      'verificado_em', now())
    from public.configuracoes c where c.id = 1);
end $$;
revoke execute on function public.estado_sistema_resumo() from public, anon;
grant execute on function public.estado_sistema_resumo() to authenticated;

create function public.agente_numeros_hoje(p_agora timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_de timestamptz := ((p_agora at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo';
  v_ate timestamptz := v_de + interval '1 day';
  r jsonb;
begin
  if not public.eh_admin() then raise exception 'Só o administrador vê os números do agente.'; end if;
  -- Conversas com mensagem do cliente no dia; resolvida pelo agente = ninguém da equipe respondeu nem assumiu e o
  -- agente não passou para pessoa no dia (D7).
  with hoje as (
    select distinct m.conversa_id
    from public.mensagens m join public.conversas c on c.id = m.conversa_id
    where m.autor = 'cliente' and m.criado_em >= v_de and m.criado_em < v_ate
      and not public.eh_telefone_do_assistente(c.telefone)
  ), com_pessoa as (
    select h.conversa_id,
           exists (select 1 from public.mensagens m where m.conversa_id = h.conversa_id and m.autor = 'atendente'
                     and m.criado_em >= v_de and m.criado_em < v_ate)
           or exists (select 1 from public.conversa_eventos e where e.conversa_id = h.conversa_id
                        and e.tipo in ('assumida', 'passou_para_pessoa') and e.criado_em >= v_de and e.criado_em < v_ate) as pessoa
    from hoje h
  )
  select jsonb_build_object('conversas', count(*), 'resolvidas_agente', count(*) filter (where not p.pessoa))
    into r from com_pessoa p;
  return r;
end $$;
revoke execute on function public.agente_numeros_hoje(timestamptz) from public, anon;
grant execute on function public.agente_numeros_hoje(timestamptz) to authenticated;

-- security invoker: cada pessoa conta só as demandas que a RLS de chamados libera para ela.
create function public.demandas_por_setor(p_agora timestamptz default now())
returns table (setor_id uuid, setor text, abertas int, no_prazo int, vencem_hoje int, vencidas int, sem_responsavel int, urgentes int)
language sql stable security invoker set search_path = '' as $$
  with abertas as (
    select c.setor_id as sid, true as conta, c.responsavel_id is null as sem_resp, c.prioridade = 'urgente' as urgente,
           coalesce(c.prazo_pausado_desde is null and c.prazo_em < p_agora, false) as vencida,
           coalesce(c.prazo_pausado_desde is null and c.prazo_em >= p_agora
                    and (c.prazo_em at time zone 'America/Sao_Paulo')::date = (p_agora at time zone 'America/Sao_Paulo')::date, false) as hoje
    from public.chamados c
    where c.status <> 'concluido'
  ), grupos as (
    select s.id as sid, s.nome, 0 as ordem from public.setores s
    where s.ativo or exists (select 1 from abertas a where a.sid = s.id)
    union all
    select null::uuid, 'Triagem', 1
  )
  select g.sid, g.nome,
         count(a.conta)::int,
         count(a.conta) filter (where not a.vencida and not a.hoje)::int,
         count(a.conta) filter (where a.hoje)::int,
         count(a.conta) filter (where a.vencida)::int,
         count(a.conta) filter (where a.sem_resp)::int,
         count(a.conta) filter (where a.urgente)::int
  from grupos g left join abertas a on a.sid is not distinct from g.sid
  group by g.sid, g.nome, g.ordem
  order by g.ordem, g.nome
$$;
revoke execute on function public.demandas_por_setor(timestamptz) from public, anon;
grant execute on function public.demandas_por_setor(timestamptz) to authenticated;
