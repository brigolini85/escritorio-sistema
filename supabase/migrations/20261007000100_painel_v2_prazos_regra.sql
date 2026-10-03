-- supabase/migrations/20261007000100_painel_v2_prazos_regra.sql
-- Painel v2, Parte G1 (spec 7C.4): mudar o prazo de uma prioridade mostra o impacto antes (simular_mudanca_prazo, só leitura)
-- e pode valer também para as abertas (aplicar_prazo_abertas: grava a regra e recalcula na mesma transação, um evento por
-- demanda). Recalcular = andar a diferença de dias úteis (D1). Prazo escolhido à mão fica (D3); "Com o cliente" segue
-- pausada desde a mesma hora (D4).

-- Evento novo na linha do tempo: "prazo recalculado por mudança de regra (<pessoa>)" (D5).
alter table public.chamado_eventos drop constraint chamado_eventos_tipo_check;
alter table public.chamado_eventos add constraint chamado_eventos_tipo_check check (tipo in (
  'criacao', 'assumido', 'transferencia', 'nota_interna', 'conclusao',
  'status_alterado', 'prioridade_alterada', 'prazo_alterado', 'responsavel_alterado', 'editado', 'reaberto',
  'prazo_recalculado'));

-- ---------- Calendário (internas) ----------

-- Dia útil anterior a p_dia; null se não houver nenhum em um ano (todos os dias desmarcados).
create function public.dia_util_anterior(p_dia date) returns date
language plpgsql stable security definer set search_path = '' as $$
declare v date := p_dia;
begin
  for i in 1..366 loop
    v := v - 1;
    if public.eh_dia_util(v) then return v; end if;
  end loop;
  return null;
end $$;

-- Anda p_dias dias úteis (para trás se negativo), com a mesma hora de Brasília. Num prazo da regra antiga (fim do
-- expediente do N-ésimo dia útil, mais o tempo que a pausa já somou) dá o da regra nova com a mesma pausa somada.
create function public.deslocar_dias_uteis(p_prazo timestamptz, p_dias int) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hora time := (p_prazo at time zone 'America/Sao_Paulo')::time;
  v_dia date := (p_prazo at time zone 'America/Sao_Paulo')::date;
begin
  if p_prazo is null or p_dias is null or p_dias = 0 then return p_prazo; end if;
  for i in 1..abs(p_dias) loop
    v_dia := case when p_dias > 0 then public.proximo_dia_util(v_dia) else public.dia_util_anterior(v_dia) end;
    if v_dia is null then return null; end if;
  end loop;
  return (v_dia + v_hora) at time zone 'America/Sao_Paulo';
end $$;

-- A conta do calcular_prazo com o número de dias dado (exemplos da tela; o pgTAP confere que bate com calcular_prazo).
create function public.calcular_prazo_dias(p_dias int, p_inicio timestamptz) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.configuracoes%rowtype;
  v_local timestamp := p_inicio at time zone 'America/Sao_Paulo';
  v_dia date := (p_inicio at time zone 'America/Sao_Paulo')::date;
begin
  select * into c from public.configuracoes where id = 1;
  if not public.eh_dia_util(v_dia) or v_local::time >= c.horario_fim then
    v_dia := public.proximo_dia_util(v_dia);
  end if;
  for i in 1..coalesce(p_dias, 0) loop
    exit when v_dia is null;
    v_dia := public.proximo_dia_util(v_dia);
  end loop;
  if v_dia is null then return null; end if;
  return (v_dia + c.horario_fim) at time zone 'America/Sao_Paulo';
end $$;

-- O prazo é da regra se nenhuma pessoa o escolheu depois do último evento que recomeça a regra (abertura, reabertura,
-- troca de prioridade ou recálculo). O empurrão da pausa (prazo_alterado sem pessoa) não conta (D3).
create function public.prazo_segue_regra(p_chamado uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.chamado_eventos m
    where m.chamado_id = p_chamado and m.tipo = 'prazo_alterado' and m.usuario_id is not null
      and m.criado_em > coalesce((
        select max(r.criado_em) from public.chamado_eventos r
        where r.chamado_id = p_chamado and r.tipo in ('criacao', 'reaberto', 'prioridade_alterada', 'prazo_recalculado')
      ), '-infinity'::timestamptz))
$$;

revoke execute on function public.dia_util_anterior(date), public.deslocar_dias_uteis(timestamptz, int),
  public.calcular_prazo_dias(int, timestamptz), public.prazo_segue_regra(uuid) from public, anon, authenticated;

-- ---------- Para a tela de Prazos ----------

-- Impacto de mudar a regra de uma prioridade, sem gravar (stable: o Postgres recusaria qualquer gravação aqui).
create function public.simular_mudanca_prazo(p_prioridade public.prioridade_demanda, p_dias int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_atual int;
  v jsonb;
begin
  if not public.tem_permissao('configuracoes', 'sim') then
    raise exception 'Só quem tem acesso às Configurações muda os prazos.';
  end if;
  if p_prioridade is null or p_dias is null or p_dias not between 0 and 30 then
    raise exception 'O prazo precisa ser de 0 a 30 dias úteis.';
  end if;
  select case p_prioridade when 'urgente' then c.prazo_urgente_dias when 'alta' then c.prazo_alta_dias
              when 'normal' then c.prazo_normal_dias else c.prazo_baixa_dias end
    into v_atual from public.configuracoes c where c.id = 1;
  select jsonb_build_object(
    'prioridade', p_prioridade, 'dias_atuais', v_atual, 'dias_novos', p_dias,
    'abertas', count(*),
    'pela_regra', count(*) filter (where x.prazo_em is not null and x.regra),
    'a_mao', count(*) filter (where x.prazo_em is not null and not x.regra),
    'sem_prazo', count(*) filter (where x.prazo_em is null),
    'ganham', count(*) filter (where x.regra and x.novo > x.prazo_em),
    'perdem', count(*) filter (where x.regra and x.novo < x.prazo_em),
    'pausadas', count(*) filter (where x.regra and x.pausada and x.novo is distinct from x.prazo_em),
    'passam_a_vencidas', count(*) filter (where x.regra and not x.pausada and x.prazo_em >= now() and x.novo < now()),
    'ja_vencidas', count(*) filter (where not x.pausada and x.prazo_em < now()))
  into v
  from (
    select c.prazo_em, c.prazo_pausado_desde is not null as pausada, public.prazo_segue_regra(c.id) as regra,
           public.deslocar_dias_uteis(c.prazo_em, p_dias - v_atual) as novo
    from public.chamados c
    where c.prioridade = p_prioridade and c.status <> 'concluido'
  ) x;
  return v;
end $$;

-- Grava a regra nova e anda a diferença nas abertas que seguem a regra, com um evento em cada (D1–D5).
create function public.aplicar_prazo_abertas(p_prioridade public.prioridade_demanda, p_dias int) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_atual int;
  v_dif int;
  v_novo timestamptz;
  v_n int := 0;
  r record;
begin
  if not public.tem_permissao('configuracoes', 'sim') then
    raise exception 'Só quem tem acesso às Configurações muda os prazos.';
  end if;
  if p_prioridade is null or p_dias is null or p_dias not between 0 and 30 then
    raise exception 'O prazo precisa ser de 0 a 30 dias úteis.';
  end if;
  select case p_prioridade when 'urgente' then c.prazo_urgente_dias when 'alta' then c.prazo_alta_dias
              when 'normal' then c.prazo_normal_dias else c.prazo_baixa_dias end
    into v_atual from public.configuracoes c where c.id = 1 for update;
  v_dif := p_dias - v_atual;
  if v_dif = 0 then return 0; end if;
  update public.configuracoes set
    prazo_urgente_dias = case when p_prioridade = 'urgente' then p_dias else prazo_urgente_dias end,
    prazo_alta_dias = case when p_prioridade = 'alta' then p_dias else prazo_alta_dias end,
    prazo_normal_dias = case when p_prioridade = 'normal' then p_dias else prazo_normal_dias end,
    prazo_baixa_dias = case when p_prioridade = 'baixa' then p_dias else prazo_baixa_dias end
  where id = 1;
  -- A pausa de "Com o cliente" continua contando desde a mesma hora (o gatilho lê esta marca).
  perform set_config('escritorio.prazo_por_regra', 'sim', true);
  for r in
    select c.id, c.cliente_id, c.prazo_em from public.chamados c
    where c.prioridade = p_prioridade and c.status <> 'concluido' and c.prazo_em is not null and public.prazo_segue_regra(c.id)
    order by c.numero
    for update
  loop
    v_novo := public.deslocar_dias_uteis(r.prazo_em, v_dif);
    continue when v_novo is null or v_novo = r.prazo_em;
    update public.chamados set prazo_em = v_novo where id = r.id;
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (r.id, r.cliente_id, 'prazo_recalculado', auth.uid(), public.texto_prazo(v_novo));
    v_n := v_n + 1;
  end loop;
  perform set_config('escritorio.prazo_por_regra', '', true);
  return v_n;
end $$;

-- Abertas por prioridade (escritório inteiro, D7) e o vencimento com 0 a 30 dias úteis a partir de p_inicio.
create function public.prazos_resumo(p_inicio timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tem_permissao('configuracoes', 'sim') then
    raise exception 'Só quem tem acesso às Configurações muda os prazos.';
  end if;
  return jsonb_build_object(
    'abertas', (select jsonb_object_agg(p::text, (select count(*) from public.chamados c where c.prioridade = p and c.status <> 'concluido'))
                from unnest(enum_range(null::public.prioridade_demanda)) p),
    'exemplos', (select jsonb_agg(public.calcular_prazo_dias(d, coalesce(p_inicio, now())) order by d) from generate_series(0, 30) d));
end $$;

revoke execute on function public.simular_mudanca_prazo(public.prioridade_demanda, int),
  public.aplicar_prazo_abertas(public.prioridade_demanda, int), public.prazos_resumo(timestamptz) from public, anon;
grant execute on function public.simular_mudanca_prazo(public.prioridade_demanda, int),
  public.aplicar_prazo_abertas(public.prioridade_demanda, int), public.prazos_resumo(timestamptz) to authenticated;

-- ---------- Gatilho da pausa: igual ao de 20261003000400, menos o recálculo da regra (D4) ----------

create or replace function public.chamados_antes_alterar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pausa interval;
begin
  if new.status = 'aguardando_cliente' and old.status <> 'aguardando_cliente' then
    -- Entrou em "Com o cliente": o prazo para de correr.
    new.prazo_pausado_desde := now();
  elsif old.status = 'aguardando_cliente' and new.status <> 'aguardando_cliente' then
    -- Saiu: o prazo anda o tempo útil parado (concluir não mexe; prazo trocado na mesma mudança também não).
    if new.status <> 'concluido' and old.prazo_pausado_desde is not null and new.prazo_em is not null
       and new.prazo_em is not distinct from old.prazo_em then
      v_pausa := public.tempo_util_entre(old.prazo_pausado_desde, now());
      if v_pausa > interval '0' then
        new.prazo_em := public.somar_tempo_util(old.prazo_em, v_pausa);
        insert into public.chamado_eventos (chamado_id, cliente_id, tipo, texto)
          values (new.id, new.cliente_id, 'prazo_alterado', public.texto_prazo(new.prazo_em));
      end if;
    end if;
    new.prazo_pausado_desde := null;
  elsif new.status = 'aguardando_cliente' and new.prazo_em is distinct from old.prazo_em
        and coalesce(current_setting('escritorio.prazo_por_regra', true), '') <> 'sim' then
    -- Prazo trocado durante a pausa por uma pessoa: a pausa conta a partir de agora. No recálculo da regra, não.
    new.prazo_pausado_desde := now();
  end if;
  if new.prazo_em is distinct from old.prazo_em then new.alertado_vencimento_em := null; end if;
  -- Última atualização: só o que a equipe vê (marcas internas, como alertado_fila_em, não contam).
  if (new.status, new.prioridade, new.prazo_em, new.responsavel_id, new.setor_id, new.titulo, new.resumo, new.contato_id, new.pedido_venda, new.cliente_id, new.fora_do_contrato)
     is distinct from
     (old.status, old.prioridade, old.prazo_em, old.responsavel_id, old.setor_id, old.titulo, old.resumo, old.contato_id, old.pedido_venda, old.cliente_id, old.fora_do_contrato) then
    new.atualizado_em := now();
  end if;
  return new;
end $$;
