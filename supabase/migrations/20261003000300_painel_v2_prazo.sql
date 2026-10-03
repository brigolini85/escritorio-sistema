-- supabase/migrations/20261003000300_painel_v2_prazo.sql
-- Painel v2, Parte C (spec 6.5 e 6.6): prioridade, prazo em dias úteis, pausa em "Com o cliente",
-- contato na empresa, quem abriu e a última atualização das demandas.

create type public.prioridade_demanda as enum ('baixa', 'normal', 'alta', 'urgente');

-- criado_por sem chave estrangeira de propósito: uma segunda ligação chamados → usuarios deixaria ambíguo o
-- usuarios(nome) que o painel e o trabalhador já usam. Quem abriu também fica no evento 'criacao'.
alter table public.chamados
  add column prioridade public.prioridade_demanda not null default 'normal',
  add column prazo_em timestamptz,
  add column prazo_pausado_desde timestamptz,
  add column contato_id uuid references public.contatos (id) on delete set null,
  add column criado_por uuid,
  add column alertado_vencimento_em timestamptz;

-- Dias úteis de cada prioridade (spec 6.5), editáveis em Configurações › Prazos. 0 = no mesmo dia.
alter table public.configuracoes
  add column prazo_urgente_dias int not null default 0 check (prazo_urgente_dias between 0 and 30),
  add column prazo_alta_dias int not null default 1 check (prazo_alta_dias between 0 and 30),
  add column prazo_normal_dias int not null default 2 check (prazo_normal_dias between 0 and 30),
  add column prazo_baixa_dias int not null default 5 check (prazo_baixa_dias between 0 and 30);

alter table public.chamado_eventos drop constraint chamado_eventos_tipo_check;
alter table public.chamado_eventos add constraint chamado_eventos_tipo_check check (tipo in (
  'criacao', 'assumido', 'transferencia', 'nota_interna', 'conclusao',
  'status_alterado', 'prioridade_alterada', 'prazo_alterado', 'responsavel_alterado', 'editado', 'reaberto'));
-- Vários eventos na mesma transação (abrir grava três) ficam em ordem na linha do tempo.
alter table public.chamado_eventos alter column criado_em set default clock_timestamp();

-- ---------- Dias úteis (expediente, dias da semana e feriados de configuracoes) ----------

create function public.eh_dia_util(p_dia date) returns boolean
language sql stable security definer set search_path = '' as $$
  select extract(dow from p_dia)::int = any (c.dias_uteis)
     and not exists (select 1 from public.feriados f where f.data = p_dia)
  from public.configuracoes c where c.id = 1
$$;

-- Primeiro dia útil depois de p_dia; null se não houver nenhum em um ano (todos os dias desmarcados).
create function public.proximo_dia_util(p_dia date) returns date
language plpgsql stable security definer set search_path = '' as $$
declare v date := p_dia;
begin
  for i in 1..366 loop
    v := v + 1;
    if public.eh_dia_util(v) then return v; end if;
  end loop;
  return null;
end $$;

-- Prazo sugerido: fim do expediente do N-ésimo dia útil (N da prioridade). Chegou fora do expediente: conta do próximo dia útil.
create function public.calcular_prazo(p_prioridade public.prioridade_demanda, p_inicio timestamptz default now())
returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.configuracoes%rowtype;
  v_local timestamp := p_inicio at time zone 'America/Sao_Paulo';
  v_dia date := (p_inicio at time zone 'America/Sao_Paulo')::date;
  v_dias int;
begin
  select * into c from public.configuracoes where id = 1;
  v_dias := case p_prioridade
    when 'urgente' then c.prazo_urgente_dias when 'alta' then c.prazo_alta_dias
    when 'normal' then c.prazo_normal_dias else c.prazo_baixa_dias end;
  if not public.eh_dia_util(v_dia) or v_local::time >= c.horario_fim then
    v_dia := public.proximo_dia_util(v_dia);
  end if;
  for i in 1..v_dias loop
    exit when v_dia is null;
    v_dia := public.proximo_dia_util(v_dia);
  end loop;
  if v_dia is null then return null; end if;
  return (v_dia + c.horario_fim) at time zone 'America/Sao_Paulo';
end $$;

-- Tempo dentro do expediente entre dois instantes (fim de semana, feriado e fora do horário não contam).
create function public.tempo_util_entre(p_de timestamptz, p_ate timestamptz) returns interval
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.configuracoes%rowtype;
  v_dia date;
  v_ini timestamptz;
  v_fim timestamptz;
  v_total interval := interval '0';
begin
  if p_de is null or p_ate is null or p_ate <= p_de then return interval '0'; end if;
  select * into c from public.configuracoes where id = 1;
  v_dia := (p_de at time zone 'America/Sao_Paulo')::date;
  while v_dia <= (p_ate at time zone 'America/Sao_Paulo')::date loop
    if public.eh_dia_util(v_dia) then
      v_ini := greatest(p_de, (v_dia + c.horario_inicio) at time zone 'America/Sao_Paulo');
      v_fim := least(p_ate, (v_dia + c.horario_fim) at time zone 'America/Sao_Paulo');
      if v_fim > v_ini then v_total := v_total + (v_fim - v_ini); end if;
    end if;
    v_dia := v_dia + 1;
  end loop;
  return v_total;
end $$;

-- Anda p_tempo de expediente a partir de p_de (a retomada da pausa empurra o prazo assim). null sem dias úteis.
create function public.somar_tempo_util(p_de timestamptz, p_tempo interval) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.configuracoes%rowtype;
  v_dia date;
  v_ini timestamptz;
  v_fim timestamptz;
  v_resta interval := p_tempo;
begin
  if p_de is null then return null; end if;
  if p_tempo is null or p_tempo <= interval '0' then return p_de; end if;
  select * into c from public.configuracoes where id = 1;
  v_dia := (p_de at time zone 'America/Sao_Paulo')::date;
  for i in 1..3660 loop
    if public.eh_dia_util(v_dia) then
      v_ini := greatest(p_de, (v_dia + c.horario_inicio) at time zone 'America/Sao_Paulo');
      v_fim := (v_dia + c.horario_fim) at time zone 'America/Sao_Paulo';
      if v_fim > v_ini then
        if v_ini + v_resta <= v_fim then return v_ini + v_resta; end if;
        v_resta := v_resta - (v_fim - v_ini);
      end if;
    end if;
    v_dia := v_dia + 1;
  end loop;
  return null;
end $$;

-- Prazo como texto do evento (ISO em UTC): o painel formata no horário de Brasília.
create function public.texto_prazo(p timestamptz) returns text
language sql immutable set search_path = '' as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;

-- ---------- Gatilhos: valem para todo caminho (agente, painel novo e painel antigo da homologação) ----------

create function public.chamados_antes_inserir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.prazo_em is null then new.prazo_em := public.calcular_prazo(new.prioridade, new.criado_em); end if;
  if new.contato_id is null and new.conversa_id is not null then
    select c.contato_id into new.contato_id from public.conversas c where c.id = new.conversa_id;
  end if;
  if new.status = 'aguardando_cliente' then new.prazo_pausado_desde := coalesce(new.prazo_pausado_desde, new.criado_em); end if;
  return new;
end $$;
create trigger chamados_antes_inserir before insert on public.chamados
  for each row execute function public.chamados_antes_inserir();

-- Eventos iniciais (imagem 05): abriu, prioridade e prazo. Prazo igual ao sugerido aparece como "Sistema".
create function public.chamados_depois_inserir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    values (new.id, new.cliente_id, 'criacao', new.criado_por, nullif(new.resumo, ''));
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    values (new.id, new.cliente_id, 'prioridade_alterada', new.criado_por, new.prioridade::text);
  if new.prazo_em is not null then
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (new.id, new.cliente_id, 'prazo_alterado',
              case when new.prazo_em is distinct from public.calcular_prazo(new.prioridade, new.criado_em) then new.criado_por end,
              public.texto_prazo(new.prazo_em));
  end if;
  return null;
end $$;
create trigger chamados_depois_inserir after insert on public.chamados
  for each row execute function public.chamados_depois_inserir();

create function public.chamados_antes_alterar() returns trigger
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
  elsif new.status = 'aguardando_cliente' and new.prazo_em is distinct from old.prazo_em then
    -- Prazo trocado durante a pausa: a pausa conta a partir de agora.
    new.prazo_pausado_desde := now();
  end if;
  if new.prazo_em is distinct from old.prazo_em then new.alertado_vencimento_em := null; end if;
  -- Última atualização: só o que a equipe vê (marcas internas, como alertado_fila_em, não contam).
  if (new.status, new.prioridade, new.prazo_em, new.responsavel_id, new.setor_id, new.titulo, new.resumo, new.contato_id, new.pedido_venda)
     is distinct from
     (old.status, old.prioridade, old.prazo_em, old.responsavel_id, old.setor_id, old.titulo, old.resumo, old.contato_id, old.pedido_venda) then
    new.atualizado_em := now();
  end if;
  return new;
end $$;
create trigger chamados_antes_alterar before update on public.chamados
  for each row execute function public.chamados_antes_alterar();

-- Trabalhador antigo (homologação) ainda grava a criação depois do gatilho: a segunda é ignorada.
create function public.chamado_eventos_antes_inserir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo = 'criacao' and exists (
    select 1 from public.chamado_eventos e where e.chamado_id = new.chamado_id and e.tipo = 'criacao'
  ) then
    return null;
  end if;
  return new;
end $$;
create trigger chamado_eventos_antes_inserir before insert on public.chamado_eventos
  for each row execute function public.chamado_eventos_antes_inserir();

-- Evento novo (nota interna, por exemplo) também é atualização. Eventos gravados por outro gatilho já vêm com ela.
create function public.chamado_eventos_depois_inserir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  update public.chamados set atualizado_em = greatest(atualizado_em, new.criado_em) where id = new.chamado_id;
  return null;
end $$;
create trigger chamado_eventos_depois_inserir after insert on public.chamado_eventos
  for each row execute function public.chamado_eventos_depois_inserir();

revoke all on function public.eh_dia_util(date), public.proximo_dia_util(date),
  public.tempo_util_entre(timestamptz, timestamptz), public.somar_tempo_util(timestamptz, interval),
  public.texto_prazo(timestamptz), public.calcular_prazo(public.prioridade_demanda, timestamptz),
  public.chamados_antes_inserir(), public.chamados_depois_inserir(), public.chamados_antes_alterar(),
  public.chamado_eventos_antes_inserir(), public.chamado_eventos_depois_inserir()
  from public, anon, authenticated;
-- A nova demanda mostra o prazo sugerido antes de abrir.
grant execute on function public.calcular_prazo(public.prioridade_demanda, timestamptz) to authenticated;
