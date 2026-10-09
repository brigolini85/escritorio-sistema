-- Auditoria 4.1 e 4.4: implantação ou queda no meio de uma vez deixava a conversa parada até 20 min e, depois, o lote era
-- refeito do zero (resposta e demanda em dobro). Agora:
--   * cada lote de mensagens guarda o turno do agente que o pegou (mensagens.turno_agente_entrada);
--   * a nova execução confere se aquele turno já agiu (decisão ou mensagem de saída) e, se agiu, não chama a IA de novo;
--   * a trava da vez é renovada enquanto a vez roda (renovar_trava) e, no desligamento, o processo solta as que ainda tem
--     (soltar_travas_do_dono).

-- turno_agente_entrada_em: quando o turno pegou a mensagem (revisão: a demanda aberta antes de a decisão ser gravada).
alter table public.mensagens add column turno_agente_entrada text, add column turno_agente_entrada_em timestamptz;

-- Renova a trava só se ela ainda for deste dono (a trava vencida que outro pegou não volta). Só o trabalhador.
create function public.renovar_trava(p_chave text, p_dono uuid, p_segundos int) returns boolean
language sql volatile security definer set search_path = '' as $$
  with renovada as (
    update public.travas_trabalhador set ate = now() + make_interval(secs => p_segundos)
     where chave = p_chave and dono = p_dono
    returning 1
  )
  select exists (select 1 from renovada)
$$;
revoke execute on function public.renovar_trava(text, uuid, int) from public, anon, authenticated;
grant execute on function public.renovar_trava(text, uuid, int) to service_role;

-- Desligamento: solta as travas das vezes deste processo que ainda não terminaram. Devolve quantas soltou. Só o trabalhador.
create function public.soltar_travas_do_dono(p_donos uuid[]) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare v_linhas int;
begin
  delete from public.travas_trabalhador where dono = any(p_donos);
  get diagnostics v_linhas = row_count;
  return v_linhas;
end $$;
revoke execute on function public.soltar_travas_do_dono(uuid[]) from public, anon, authenticated;
grant execute on function public.soltar_travas_do_dono(uuid[]) to service_role;

-- O lote da vez (p_ids, mensagens de entrada não processadas da conversa) e o turno desta execução (p_turno).
-- Turno anterior que já agiu (decisão do agente, mensagem de saída com aquele turno, ou demanda do agente aberta ou
-- complementada nesta conversa depois que o turno pegou a mensagem): as mensagens dele voltam em
-- "interrompidas" e não ganham o turno novo (a vez não chama a IA para elas). As outras (sem turno, ou com um turno que não
-- fez nada, como a falha da IA antes de qualquer ação) ficam com p_turno. "respondeu": alguma saída daqueles turnos.
-- Chamada dentro da trava da conversa (naVez): uma execução por vez. Só o trabalhador.
create function public.pegar_lote_do_turno(p_conversa uuid, p_ids uuid[], p_turno text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_ativos text[];
  v_interrompidas uuid[];
  v_respondeu boolean;
begin
  select coalesce(array_agg(distinct m.turno_agente_entrada), '{}') into v_ativos
    from public.mensagens m
   where m.id = any(p_ids) and m.conversa_id = p_conversa and m.turno_agente_entrada is not null
     and (exists (select 1 from public.decisoes_agente d
                   where d.conversa_id = p_conversa and d.turno::text = m.turno_agente_entrada and d.etapa <> 'orientacoes_cortadas')
          or exists (select 1 from public.mensagens s
                      where s.conversa_id = p_conversa and s.direcao = 'saida' and s.turno_agente::text = m.turno_agente_entrada)
          -- Revisão: o processo pode cair entre o insert da demanda e o registro da decisão. A demanda é a prova: aberta pelo
          -- agente (origem 'agente') ou Triagem complementada pelo agente (nota sem pessoa) depois que o turno pegou a mensagem.
          or (m.turno_agente_entrada_em is not null
              and (exists (select 1 from public.chamados c
                            where c.conversa_id = p_conversa and c.origem = 'agente' and c.criado_em >= m.turno_agente_entrada_em)
                   or exists (select 1 from public.chamado_eventos e join public.chamados c on c.id = e.chamado_id
                               where c.conversa_id = p_conversa and e.tipo = 'nota_interna' and e.usuario_id is null
                                 and e.criado_em >= m.turno_agente_entrada_em))));

  select coalesce(array_agg(m.id), '{}') into v_interrompidas
    from public.mensagens m
   where m.id = any(p_ids) and m.conversa_id = p_conversa and m.turno_agente_entrada = any(v_ativos);

  select exists (select 1 from public.mensagens s
                  where s.conversa_id = p_conversa and s.direcao = 'saida' and s.turno_agente::text = any(v_ativos))
    into v_respondeu;

  update public.mensagens m set turno_agente_entrada = p_turno, turno_agente_entrada_em = now()
   where m.id = any(p_ids) and m.conversa_id = p_conversa and m.direcao = 'entrada' and m.processada_em is null
     and (m.turno_agente_entrada is null or not (m.turno_agente_entrada = any(v_ativos)));

  return jsonb_build_object('interrompidas', to_jsonb(v_interrompidas), 'respondeu', v_respondeu);
end $$;
revoke execute on function public.pegar_lote_do_turno(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.pegar_lote_do_turno(uuid, uuid[], text) to service_role;
