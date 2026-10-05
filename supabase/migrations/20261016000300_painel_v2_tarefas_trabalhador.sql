-- supabase/migrations/20261016000300_painel_v2_tarefas_trabalhador.sql
-- Painel v2, Parte I3a (spec 7E.4; D5–D8, D13, D26): o que só o trabalhador grava na tarefa. Tudo por função (service_role);
-- as frases de erro voltam ao agente como resultado de ferramenta.
-- Rulings do pré-voo: F5 (pedidos ao cliente parados voltam para a fila; reserva velha é solta), F6 (só a vez dona da marca decide
-- o estado: p_desde), F22 (o envio confere "pode ser procurado" na hora). Os limites de volume da Task 3 valem também no envio.

-- A vez do agente só grava em tarefa que ainda está trabalhando (a pessoa pode ter pausado ou descartado no meio).
create function interno.tarefa_trabalhando(p_id uuid) returns public.agente_tarefas
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype;
begin
  select * into t from public.agente_tarefas where id = p_id for update;
  if not found or t.estado <> 'trabalhando' then raise exception 'A tarefa não está trabalhando.'; end if;
  return t;
end $$;
revoke execute on function interno.tarefa_trabalhando(uuid) from public, anon, authenticated, service_role;

-- D6: uma vez por tarefa; a marca vence em 35 min (a fila desiste do job em 30).
create function public.iniciar_execucao_tarefa(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.agente_tarefas set executando_desde = now(), atualizado_em = now()
   where id = p_id and estado = 'trabalhando' and (executando_desde is null or executando_desde < now() - interval '35 minutes');
  return found;
end $$;

-- D5: só na primeira vez da tarefa.
create function public.definir_etapas_tarefa(p_id uuid, p_nomes text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype;
begin
  t := interno.tarefa_trabalhando(p_id);
  if jsonb_array_length(t.etapas) > 0 then return; end if;
  if p_nomes is null or cardinality(p_nomes) not between 2 and 9
     or exists (select 1 from unnest(p_nomes) n where char_length(btrim(coalesce(n, ''))) not between 1 and 60) then
    raise exception 'Etapas inválidas.';
  end if;
  update public.agente_tarefas set etapa_atual = 1, atualizado_em = now(),
         etapas = (select jsonb_agg(jsonb_build_object('nome', btrim(e.n), 'concluida', false, 'resumo', null) order by e.i)
                     from unnest(p_nomes) with ordinality as e(n, i))
   where id = p_id;
end $$;

create function public.concluir_etapa_tarefa(p_id uuid, p_etapa int, p_resumo text) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype; v_n int;
begin
  t := interno.tarefa_trabalhando(p_id);
  v_n := jsonb_array_length(t.etapas);
  if p_etapa is null or p_etapa < 1 or p_etapa >= v_n then raise exception 'Etapa inválida: a última (Aprovação) é da pessoa.'; end if;
  if p_resumo is null or char_length(btrim(p_resumo)) not between 1 and 200 then raise exception 'Resumo da etapa: até 200 letras.'; end if;
  update public.agente_tarefas set atualizado_em = now(),
         etapas = jsonb_set(etapas, array[(p_etapa - 1)::text], (etapas -> (p_etapa - 1)) || jsonb_build_object('concluida', true, 'resumo', btrim(p_resumo))),
         etapa_atual = greatest(etapa_atual, least(p_etapa + 1, v_n))
   where id = p_id;
  perform interno.evento_tarefa(p_id, 'agente', format('concluiu "%s": %s', t.etapas -> (p_etapa - 1) ->> 'nome', btrim(p_resumo)));
end $$;

create function public.anotar_tarefa(p_id uuid, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform interno.tarefa_trabalhando(p_id);
  if char_length(coalesce(p_texto, '')) > 8000 then raise exception 'Anotações: até 8.000 letras.'; end if;
  update public.agente_tarefas set anotacoes = coalesce(p_texto, ''), atualizado_em = now() where id = p_id;
end $$;

-- D12: soma em qualquer estado (a pessoa pode ter pausado enquanto a chamada já estava paga).
create function public.somar_custo_tarefa(p_id uuid, p_custo numeric) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_custo is null or p_custo < 0 then raise exception 'Custo inválido.'; end if;
  update public.agente_tarefas set custo_usd = custo_usd + p_custo,
         custo_etapas = jsonb_set(custo_etapas, array[etapa_atual::text], to_jsonb(coalesce((custo_etapas ->> etapa_atual::text)::numeric, 0) + p_custo))
   where id = p_id;
end $$;

create function public.abrir_pendencia_tarefa(p_tarefa uuid, p_tipo text, p_pergunta text, p_detalhe text, p_opcoes text[], p_mensagem text) returns int
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype; v_n int;
begin
  t := interno.tarefa_trabalhando(p_tarefa);
  if p_tipo is null or p_tipo not in ('cliente', 'analista') then raise exception 'Tipo de pendência: cliente ou analista.'; end if;
  if p_pergunta is null or char_length(btrim(p_pergunta)) not between 3 and 300 then raise exception 'Pergunta: de 3 a 300 letras.'; end if;
  if char_length(coalesce(p_detalhe, '')) > 1000 then raise exception 'Detalhe: até 1.000 letras.'; end if;
  if cardinality(coalesce(p_opcoes, '{}')) > 4 or exists (select 1 from unnest(coalesce(p_opcoes, '{}')) o where char_length(btrim(o)) not between 1 and 60) then
    raise exception 'Respostas rápidas: até 4, com até 60 letras.';
  end if;
  if p_tipo = 'cliente' and (p_mensagem is null or char_length(btrim(p_mensagem)) not between 3 and 1000) then
    raise exception 'Pendência do cliente precisa da mensagem para o cliente.';
  end if;
  select numero into v_n from public.agente_pendencias
   where tarefa_id = p_tarefa and estado = 'aberta' and lower(btrim(pergunta)) = lower(btrim(p_pergunta));
  if found then return v_n; end if;
  if (select count(*) from public.agente_pendencias where tarefa_id = p_tarefa and estado = 'aberta') >= 20 then
    raise exception 'No máximo 20 pendências abertas por tarefa.';
  end if;
  select coalesce(max(numero), 0) + 1 into v_n from public.agente_pendencias where tarefa_id = p_tarefa;
  insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, detalhe, opcoes, mensagem)
  values (p_tarefa, v_n, p_tipo, btrim(p_pergunta), nullif(btrim(coalesce(p_detalhe, '')), ''),
          case when p_tipo = 'analista' then array(select btrim(o) from unnest(coalesce(p_opcoes, '{}')) o) else '{}' end,
          case when p_tipo = 'cliente' then btrim(p_mensagem) end);
  perform interno.evento_tarefa(p_tarefa, 'agente', format('abriu a pendência %s: %s', v_n, left(btrim(p_pergunta), 200)));
  return v_n;
end $$;

-- D9/D10: o formato; as fontes já foram conferidas pelo trabalhador (core conferirFontes).
create function public.entregar_resultado_tarefa(p_id uuid, p_resultado jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform interno.tarefa_trabalhando(p_id);
  if jsonb_typeof(p_resultado) is distinct from 'object' or (p_resultado ->> 'versao') is distinct from '1'
     or jsonb_typeof(p_resultado -> 'linhas') is distinct from 'array' or jsonb_typeof(p_resultado -> 'destaques') is distinct from 'array'
     or char_length(coalesce(p_resultado ->> 'resumo', '')) not between 1 and 2000
     or jsonb_array_length(p_resultado -> 'linhas') > 500 or jsonb_array_length(p_resultado -> 'destaques') > 6 then
    raise exception 'Resultado inválido.';
  end if;
  update public.agente_tarefas set resultado = p_resultado, ajuste_pendente = false, atualizado_em = now() where id = p_id;
  perform interno.evento_tarefa(p_id, 'agente', format('entregou o resultado (rascunho) com %s linha(s)', jsonb_array_length(p_resultado -> 'linhas')));
end $$;

create function public.marcar_arquivo_lido(p_arquivo uuid, p_detalhe text) returns void
language sql security definer set search_path = '' as $$
  update public.agente_tarefa_arquivos set lido_em = coalesce(lido_em, now()), detalhe = coalesce(left(p_detalhe, 120), detalhe) where id = p_arquivo
$$;
create function public.marcar_pendencias_vistas(p_tarefa uuid) returns void
language sql security definer set search_path = '' as $$
  update public.agente_pendencias set vista_em = now() where tarefa_id = p_tarefa and estado = 'respondida' and vista_em is null
$$;
create function public.evento_tarefa_agente(p_tarefa uuid, p_texto text) returns void
language sql security definer set search_path = '' as $$
  insert into public.agente_tarefa_eventos (tarefa_id, quem, texto) values (p_tarefa, 'agente', left(p_texto, 500))
$$;

-- D6, D8, D13: fecha a vez e decide o estado seguinte.
-- F6: com p_desde (a marca que esta vez gravou), uma vez zumbi (a fila desistiu dela e outra vez já pegou a tarefa) só soma o
-- tempo: não apaga a marca da vez nova nem decide o estado. Comparado em milissegundos (o trabalhador guarda a hora em JS).
create function public.finalizar_vez_tarefa(p_id uuid, p_segundos int, p_motivo text, p_desde timestamptz default null) returns text
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype; v_estado text; v_motivo text := p_motivo; v_abertas int;
begin
  if v_motivo is null or v_motivo not in ('fim', 'continuar', 'limite_custo', 'limite_tempo', 'teto', 'agente_desligado', 'falha', 'sem_resultado') then
    raise exception 'Motivo inválido.';
  end if;
  select * into t from public.agente_tarefas where id = p_id for update;
  if not found then raise exception 'Tarefa não encontrada.'; end if;
  if p_desde is not null
     and date_trunc('milliseconds', t.executando_desde) is distinct from date_trunc('milliseconds', p_desde) then
    update public.agente_tarefas set segundos_trabalhando = segundos_trabalhando + greatest(coalesce(p_segundos, 0), 0) where id = p_id;
    return t.estado;
  end if;
  update public.agente_tarefas set segundos_trabalhando = segundos_trabalhando + greatest(coalesce(p_segundos, 0), 0),
         executando_desde = null, atualizado_em = now()
   where id = p_id;
  if t.estado <> 'trabalhando' then return t.estado; end if;
  if v_motivo = 'continuar' then return 'trabalhando'; end if;
  select count(*) into v_abertas from public.agente_pendencias where tarefa_id = p_id and estado = 'aberta';
  if v_motivo = 'fim' then
    if v_abertas = 0 and exists (select 1 from public.agente_pendencias where tarefa_id = p_id and estado = 'respondida' and vista_em is null) then
      return 'trabalhando';   -- D8: o agente ainda não viu a resposta; o trabalhador enfileira de novo
    elsif v_abertas > 0 then v_estado := 'aguardando_pendencias';
    elsif t.resultado is not null and not t.ajuste_pendente then v_estado := 'pronta';
    else v_estado := 'pausada'; v_motivo := 'sem_resultado';
    end if;
  else
    v_estado := 'pausada';
  end if;
  update public.agente_tarefas set estado = v_estado, motivo_pausa = case when v_estado = 'pausada' then v_motivo end,
         etapa_atual = case when v_estado = 'pronta' then greatest(1, jsonb_array_length(etapas)) else etapa_atual end
   where id = p_id;
  perform interno.evento_tarefa(p_id, 'sistema', case v_estado
    when 'pronta' then 'deixou o resultado pronto para aprovar'
    when 'aguardando_pendencias' then format('parou: aguardando %s pendência(s)', v_abertas)
    else case v_motivo
      when 'limite_custo' then format('pausou: chegou ao limite de custo (US$ %s)', replace(to_char(t.limite_usd, 'FM990.00'), '.', ','))
      when 'limite_tempo' then format('pausou: chegou ao limite de tempo (%s minutos)', t.limite_minutos)
      when 'teto' then 'pausou: o teto mensal de gasto com IA foi atingido'
      when 'agente_desligado' then 'pausou: o agente foi desligado'
      when 'falha' then 'pausou: o agente não conseguiu seguir'
      else 'pausou: o agente parou sem resultado nem pendência' end end);
  return v_estado;
end $$;

-- D8: trabalhando sem vez em andamento há p_minutos (o job não entrou ou se perdeu), ou com a vez vencida.
create function public.tarefas_paradas(p_minutos int) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.agente_tarefas
   where estado = 'trabalhando'
     and ((executando_desde is null and atualizado_em < now() - make_interval(mins => greatest(p_minutos, 1)))
          or executando_desde < now() - interval '35 minutes')
   order by atualizado_em limit 20
$$;

-- ---------- Pedido ao cliente (D7): reserva antes de enviar, para não mandar duas vezes ----------
create function public.reservar_envio_pendencia(p_id uuid)
returns table (id uuid, tarefa_id uuid, numero int, cliente_id uuid, contato_id uuid, contato_nome text, telefone text, texto text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare v_contato uuid;
begin
  select contato_id into v_contato from public.agente_pendencias where id = p_id;
  -- 7E.8 / F21: os envios contam na mesma trava da Task 3 (pedir_pendencia_ao_cliente), para o volume valer também aqui
  -- (um pedido parado que sai depois não passa de 3 envios ao contato nem de 30 no escritório nas últimas 24 h).
  perform pg_advisory_xact_lock(hashtextextended('pedido_cliente:escritorio', 0));
  if (select count(*) from public.agente_pendencias
       where contato_id = v_contato and id <> p_id and pedido_enviado_em > now() - interval '1 day') >= 3
     or (select count(*) from public.agente_pendencias where id <> p_id and pedido_enviado_em > now() - interval '1 day') >= 30 then
    return;
  end if;
  -- F22: contato e empresa ainda podem ser procurados pelo setor (pode ser procurado, não Básico, sem agente pausado, ativos).
  -- Pedido de mais de 24 h sem envio não sai mais: a pessoa já pode cobrar de novo e decide.
  return query
    update public.agente_pendencias p set pedido_enviado_em = now()
      from public.agente_tarefas t, public.contatos c
     where p.id = p_id and t.id = p.tarefa_id and c.id = p.contato_id and c.ativo
       and p.estado = 'aberta' and p.pedido_em > now() - interval '24 hours' and p.pedido_enviado_em is null and p.mensagem_id is null
       and t.estado not in ('aprovada', 'descartada')
       and exists (select 1 from public.contatos_procuraveis(t.cliente_id, t.setor_id) cp where cp.contato_id = p.contato_id)
    returning p.id, p.tarefa_id, p.numero::int, t.cliente_id, p.contato_id, c.nome, c.telefone, p.pedido_texto;
end $$;
create function public.liberar_envio_pendencia(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.agente_pendencias set pedido_enviado_em = null where id = p_id and mensagem_id is null
$$;
-- F5: a reserva que ficou mais de 10 min sem envio (trabalhador caiu entre reservar e marcar) é solta; devolve os pedidos
-- aprovados há p_minutos e ainda não enviados (o batimento enfileira de novo). Só os das últimas 24 h, como na reserva.
create function public.pedidos_ao_cliente_parados(p_minutos int) returns setof uuid
language plpgsql security definer set search_path = '' as $$
begin
  update public.agente_pendencias set pedido_enviado_em = null
   where estado = 'aberta' and mensagem_id is null and pedido_enviado_em < now() - interval '10 minutes';
  return query
    select p.id from public.agente_pendencias p
      join public.agente_tarefas t on t.id = p.tarefa_id and t.estado not in ('aprovada', 'descartada')
     where p.estado = 'aberta' and p.contato_id is not null and p.pedido_enviado_em is null and p.mensagem_id is null
       and p.pedido_em < now() - make_interval(mins => greatest(p_minutos, 1)) and p.pedido_em > now() - interval '24 hours'
     order by p.pedido_em limit 20;
end $$;
create function public.marcar_pendencia_enviada(p_id uuid, p_mensagem uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.agente_pendencias%rowtype; v_nome text;
begin
  -- Uma vez só (sem evento repetido); se a reserva foi solta no meio, o envio que saiu conta como enviado.
  update public.agente_pendencias set mensagem_id = p_mensagem, pedido_enviado_em = coalesce(pedido_enviado_em, now())
   where id = p_id and mensagem_id is null returning * into p;
  if not found then return; end if;
  select nome into v_nome from public.contatos where id = p.contato_id;
  perform interno.evento_tarefa(p.tarefa_id, 'sistema', format('o Thiago mandou o pedido da pendência %s a %s', p.numero, coalesce(v_nome, 'o contato')));
end $$;

-- D26: o que o escritório pediu a este contato e ainda não chegou (últimos 14 dias).
create function public.pendencias_pedidas_ao_contato(p_contato uuid)
returns table (pendencia_id uuid, numero int, pergunta text, setor text, chamado_numero bigint, empresa text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.numero::int, p.pergunta, s.nome, ch.numero, coalesce(cl.nome_fantasia, cl.razao_social)
    from public.agente_pendencias p
    join public.agente_tarefas t on t.id = p.tarefa_id and t.estado not in ('aprovada', 'descartada')
    join public.chamados ch on ch.id = t.chamado_id
    left join public.setores s on s.id = t.setor_id
    left join public.clientes cl on cl.id = t.cliente_id
   where p.contato_id = p_contato and p.estado = 'aberta' and p.pedido_enviado_em > now() - interval '14 days'
   order by p.pedido_enviado_em
$$;
create function public.contato_respondeu_pendencias(p_contato uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v int := 0;
begin
  for r in update public.agente_pendencias p set respondeu_na_conversa_em = now()
             from public.agente_tarefas t
            where p.contato_id = p_contato and t.id = p.tarefa_id and t.estado not in ('aprovada', 'descartada')
              and p.estado = 'aberta' and p.pedido_enviado_em > now() - interval '14 days'
              and (p.respondeu_na_conversa_em is null or p.respondeu_na_conversa_em < now() - interval '1 hour')
           returning p.tarefa_id, p.numero loop
    perform interno.evento_tarefa(r.tarefa_id, 'sistema', format('o contato respondeu na conversa (pendência %s): confira e marque Já recebi', r.numero));
    v := v + 1;
  end loop;
  return v;
end $$;

revoke execute on function public.iniciar_execucao_tarefa(uuid), public.definir_etapas_tarefa(uuid, text[]), public.concluir_etapa_tarefa(uuid, int, text),
  public.anotar_tarefa(uuid, text), public.somar_custo_tarefa(uuid, numeric), public.abrir_pendencia_tarefa(uuid, text, text, text, text[], text),
  public.entregar_resultado_tarefa(uuid, jsonb), public.marcar_arquivo_lido(uuid, text), public.marcar_pendencias_vistas(uuid),
  public.evento_tarefa_agente(uuid, text), public.finalizar_vez_tarefa(uuid, int, text, timestamptz), public.tarefas_paradas(int),
  public.reservar_envio_pendencia(uuid), public.liberar_envio_pendencia(uuid), public.pedidos_ao_cliente_parados(int), public.marcar_pendencia_enviada(uuid, uuid),
  public.pendencias_pedidas_ao_contato(uuid), public.contato_respondeu_pendencias(uuid) from public, anon, authenticated;
grant execute on function public.iniciar_execucao_tarefa(uuid), public.definir_etapas_tarefa(uuid, text[]), public.concluir_etapa_tarefa(uuid, int, text),
  public.anotar_tarefa(uuid, text), public.somar_custo_tarefa(uuid, numeric), public.abrir_pendencia_tarefa(uuid, text, text, text, text[], text),
  public.entregar_resultado_tarefa(uuid, jsonb), public.marcar_arquivo_lido(uuid, text), public.marcar_pendencias_vistas(uuid),
  public.evento_tarefa_agente(uuid, text), public.finalizar_vez_tarefa(uuid, int, text, timestamptz), public.tarefas_paradas(int),
  public.reservar_envio_pendencia(uuid), public.liberar_envio_pendencia(uuid), public.pedidos_ao_cliente_parados(int), public.marcar_pendencia_enviada(uuid, uuid),
  public.pendencias_pedidas_ao_contato(uuid), public.contato_respondeu_pendencias(uuid) to service_role;
