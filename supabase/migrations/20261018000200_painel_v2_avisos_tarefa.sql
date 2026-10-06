-- supabase/migrations/20261018000200_painel_v2_avisos_tarefa.sql
-- Painel v2, Parte I4 (spec 7E.4, 7E.5, 7E.8; D9–D11): avisos para quem pediu a tarefa (painel e WhatsApp), as pendências do analista
-- repassadas pelo WhatsApp e a resposta por lá. Nada vai ao cliente aqui; nada é aprovado aqui. Só acréscimos; fora do Realtime.

-- D11: quando a pergunta foi mandada ao WhatsApp de quem pediu (só as do analista).
alter table public.agente_pendencias add column repassada_em timestamptz;

create table public.agente_tarefa_avisos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.agente_tarefas (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  canal text not null check (canal in ('painel', 'whatsapp')),
  tipo text not null check (tipo in ('pendencias', 'pronta', 'pausada')),
  chave text not null check (char_length(chave) between 1 and 80),
  estado text not null default 'pendente' check (estado in ('pendente', 'enviando', 'enviado', 'segurado', 'nao_enviado')),
  motivo text check (motivo in ('limite_pessoa', 'limite_escritorio', 'sem_whatsapp', 'fora_do_horario', 'vencido', 'falha')),
  mensagem text not null check (char_length(mensagem) between 1 and 500),
  pendencias int[] not null default '{}',
  criado_em timestamptz not null default now(),
  reservado_em timestamptz,
  enviado_em timestamptz,
  unique (tarefa_id, canal, chave)
);
create index agente_tarefa_avisos_usuario_idx on public.agente_tarefa_avisos (usuario_id, criado_em);
create index agente_tarefa_avisos_fila_idx on public.agente_tarefa_avisos (criado_em) where estado in ('pendente', 'segurado', 'enviando');
alter table public.agente_tarefa_avisos enable row level security;
create policy leitura on public.agente_tarefa_avisos for select to authenticated
  using (public.eh_admin() or (public.eh_usuario_ativo() and usuario_id = auth.uid()));
revoke all on public.agente_tarefa_avisos from anon;
revoke insert, update, delete, truncate on public.agente_tarefa_avisos from authenticated, service_role;

-- D9: o aviso no painel (Início › Avisos) da mesma chave, uma vez só.
create function interno.aviso_no_painel(p_tarefa uuid, p_usuario uuid, p_tipo text, p_chave text, p_mensagem text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.agente_tarefa_avisos (tarefa_id, usuario_id, canal, tipo, chave, estado, mensagem, enviado_em)
  values (p_tarefa, p_usuario, 'painel', p_tipo, p_chave, 'enviado', p_mensagem, now())
  on conflict (tarefa_id, canal, chave) do nothing
  returning id into v_id;
  if v_id is not null then insert into public.alertas (nivel, mensagem, usuario_id) values ('aviso', p_mensagem, p_usuario); end if;
end $$;

-- F6: quem pediu ainda vê a tarefa? As travas de responder_pendencia_de (demanda visível, "Pedidos de nota", setor da tarefa ou
-- administrador), lidas sem o horário de acesso (F2: fora do horário o aviso fica segurado; quem perdeu a demanda não recebe nada).
-- CÓPIA de public.pode_ver_chamado_de (20261004000200_painel_v2_visibilidade.sql) e de interno.tem_permissao_de(…,'notas','ver')
-- sem usuario_liberado: mudou a regra lá, mude aqui (o teste 56 confere que as duas concordam).
create function interno.quem_pediu_ve_a_tarefa(p_usuario uuid, p_tarefa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.agente_tarefas t
      join public.chamados c on c.id = t.chamado_id
      join public.usuarios u on u.id = p_usuario and u.ativo
     where t.id = p_tarefa
       and (u.papel = 'admin' or (
             exists (select 1 from public.usuario_setores us where us.usuario_id = p_usuario and us.setor_id = t.setor_id)
             and (c.responsavel_id = p_usuario
                  or case public.nivel_de(p_usuario, 'demandas')
                       when 'todas' then true
                       when 'meu_setor' then c.setor_id in (select us.setor_id from public.usuario_setores us where us.usuario_id = p_usuario)
                       else false
                     end)
             and (c.pedido_venda is null or coalesce((
                    select n.ordem >= (select m.ordem from public.permissao_niveis m where m.modulo = 'notas' and m.nivel = 'ver')
                      from public.permissao_niveis n where n.modulo = 'notas' and n.nivel = public.nivel_de(p_usuario, 'notas')), false)))))
$$;

-- D9 (P3): o nível "Assistente: site e WhatsApp", lido direto, sem o horário de acesso (como interno.motivo_sem_whatsapp, F2).
create function interno.tem_assistente_whatsapp(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios where id = p_usuario and ativo)
     and public.nivel_de(p_usuario, 'assistente') = 'site_whatsapp'
$$;

-- D9, D10: depois de cada vez do trabalhador. Devolve os avisos de WhatsApp a mandar; o painel é gravado aqui mesmo.
create function public.registrar_avisos_da_tarefa(p_tarefa uuid) returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare
  t record; v_tipo text; v_chave text; v_pend int[]; v_msg text; v_id uuid; v_motivo text;
  v_hoje timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  select ta.id, ta.numero, ta.estado, ta.motivo_pausa, ta.pedida_por, ta.avisar_painel, ta.avisar_whatsapp, ta.ajustes, a.nome as agente, ch.numero as chamado_numero
    into t
    from public.agente_tarefas ta join public.agentes a on a.id = ta.agente_id join public.chamados ch on ch.id = ta.chamado_id
   where ta.id = p_tarefa;
  if not found or t.pedida_por is null or not (t.avisar_painel or t.avisar_whatsapp) then return; end if;
  -- F6: quem não vê mais a demanda não recebe aviso nenhum.
  if not interno.quem_pediu_ve_a_tarefa(t.pedida_por, p_tarefa) then return; end if;
  if t.estado = 'aguardando_pendencias' then
    select array_agg(numero::int order by numero) into v_pend from public.agente_pendencias where tarefa_id = p_tarefa and estado = 'aberta';
    if v_pend is null then return; end if;
    v_tipo := 'pendencias';
    v_chave := 'pendencias:' || v_pend[cardinality(v_pend)];
    v_msg := format('Tarefa %s do %s (demanda #%s): %s pendência(s) para responder.', interno.rotulo_tarefa(t.numero), t.agente, t.chamado_numero, cardinality(v_pend));
  elsif t.estado = 'pronta' then
    v_tipo := 'pronta';
    v_chave := 'pronta:' || jsonb_array_length(t.ajustes);
    v_msg := format('Tarefa %s do %s (demanda #%s) pronta para aprovar.', interno.rotulo_tarefa(t.numero), t.agente, t.chamado_numero);
  elsif t.estado = 'pausada' and t.motivo_pausa is distinct from 'pessoa' then
    v_tipo := 'pausada';
    v_chave := 'pausada:' || (select count(*) from public.agente_tarefa_eventos e where e.tarefa_id = p_tarefa and e.quem = 'sistema' and e.texto like 'pausou:%');
    v_msg := format('Tarefa %s do %s (demanda #%s) pausou. Veja o motivo na tarefa.', interno.rotulo_tarefa(t.numero), t.agente, t.chamado_numero);
  else
    return;
  end if;

  if t.avisar_whatsapp then
    -- D10: saída rápida; a conta que vale é a da reserva (F3), sob a trava.
    v_motivo := case when interno.motivo_sem_whatsapp(t.pedida_por) is not null then 'sem_whatsapp' end;
    if v_motivo is null and (select count(*) from public.agente_tarefa_avisos where canal = 'whatsapp' and usuario_id = t.pedida_por
                               and estado in ('enviando', 'enviado') and coalesce(enviado_em, reservado_em) >= v_hoje) >= 20 then
      v_motivo := 'limite_pessoa';
    elsif v_motivo is null and (select count(*) from public.agente_tarefa_avisos where canal = 'whatsapp'
                                  and estado in ('enviando', 'enviado') and coalesce(enviado_em, reservado_em) >= v_hoje) >= 100 then
      v_motivo := 'limite_escritorio';
    end if;
    insert into public.agente_tarefa_avisos (tarefa_id, usuario_id, canal, tipo, chave, estado, motivo, mensagem, pendencias)
    values (p_tarefa, t.pedida_por, 'whatsapp', v_tipo, v_chave, case when v_motivo is null then 'pendente' else 'nao_enviado' end, v_motivo, v_msg,
            coalesce(v_pend, '{}'))
    on conflict (tarefa_id, canal, chave) do nothing
    returning id into v_id;
    if v_id is not null and v_motivo is null then return next v_id; end if;
  end if;
  -- D9: o painel recebe quando a pessoa marcou Painel, ou quando o WhatsApp não vai sair (o aviso nunca se perde).
  if t.avisar_painel or v_motivo is not null then
    perform interno.aviso_no_painel(p_tarefa, t.pedida_por, v_tipo, v_chave, v_msg);
  end if;
end $$;

-- D9: a vez do envio. Fora do horário de acesso fica segurado; passou de 24 h ou a pessoa perdeu o WhatsApp, vai ao painel.
create function public.reservar_aviso_tarefa(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.agente_tarefa_avisos%rowtype; u record; r record; v_limite text;
  v_hoje timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  -- F3: uma reserva de cada vez, para a conta dos limites do dia (D10) não correr entre duas tarefas.
  perform pg_advisory_xact_lock(hashtext('agente_tarefa_avisos:whatsapp'));
  select * into v from public.agente_tarefa_avisos where id = p_id and canal = 'whatsapp' for update;
  if not found or v.estado not in ('pendente', 'segurado') then return null; end if;
  -- F6: quem pediu não vê mais a demanda: não sai, nem no painel.
  if not interno.quem_pediu_ve_a_tarefa(v.usuario_id, v.tarefa_id) then
    update public.agente_tarefa_avisos set estado = 'nao_enviado', motivo = 'sem_whatsapp' where id = p_id;
    return null;
  end if;
  if v.criado_em < now() - interval '24 hours' or interno.motivo_sem_whatsapp(v.usuario_id) is not null then
    update public.agente_tarefa_avisos set estado = 'nao_enviado',
           motivo = case when v.criado_em < now() - interval '24 hours' then 'vencido' else 'sem_whatsapp' end where id = p_id;
    perform interno.aviso_no_painel(v.tarefa_id, v.usuario_id, v.tipo, v.chave, v.mensagem);
    return null;
  end if;
  if not public.horario_permite(v.usuario_id, now()) then
    update public.agente_tarefa_avisos set estado = 'segurado', motivo = 'fora_do_horario' where id = p_id;
    return null;
  end if;
  -- F3, D10: os limites valem na hora de mandar (avisos registrados antes ou segurados de ontem também contam aqui).
  if (select count(*) from public.agente_tarefa_avisos where canal = 'whatsapp' and usuario_id = v.usuario_id
        and estado in ('enviando', 'enviado') and coalesce(enviado_em, reservado_em) >= v_hoje) >= 20 then
    v_limite := 'limite_pessoa';
  elsif (select count(*) from public.agente_tarefa_avisos where canal = 'whatsapp'
           and estado in ('enviando', 'enviado') and coalesce(enviado_em, reservado_em) >= v_hoje) >= 100 then
    v_limite := 'limite_escritorio';
  end if;
  if v_limite is not null then
    update public.agente_tarefa_avisos set estado = 'nao_enviado', motivo = v_limite where id = p_id;
    perform interno.aviso_no_painel(v.tarefa_id, v.usuario_id, v.tipo, v.chave, v.mensagem);
    return null;
  end if;
  update public.agente_tarefa_avisos set estado = 'enviando', motivo = null, reservado_em = now() where id = p_id;
  select nome, telefone into u from public.usuarios where id = v.usuario_id;
  -- D9: "falta <responsável> aprovar" — o responsável da demanda, ativo e do setor, que não é quem pediu.
  select (select x.nome from public.usuarios x where x.id = ch.responsavel_id and x.id <> v.usuario_id and x.ativo
            and interno.pessoa_pede_no_setor(x.id, ta.setor_id)) as responsavel,
         interno.pessoa_pede_no_setor(v.usuario_id, ta.setor_id) as pede_no_setor, ta.motivo_pausa
    into r
    from public.agente_tarefas ta join public.chamados ch on ch.id = ta.chamado_id where ta.id = v.tarefa_id;
  return jsonb_build_object('id', v.id, 'tarefa_id', v.tarefa_id, 'tipo', v.tipo, 'pendencias', to_jsonb(v.pendencias), 'usuario_id', v.usuario_id,
                            'nome', u.nome, 'telefone', u.telefone, 'responsavel', r.responsavel, 'pede_no_setor', coalesce(r.pede_no_setor, false),
                            'motivo_pausa', r.motivo_pausa);
end $$;

-- D11: enviado → as perguntas do analista contam como repassadas (o Assistente passa a aceitar a resposta). Falhou → painel.
create function public.marcar_aviso_tarefa(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.agente_tarefa_avisos%rowtype;
begin
  select * into v from public.agente_tarefa_avisos where id = p_id for update;
  if not found or v.estado <> 'enviando' then return; end if;
  if p_ok then
    update public.agente_tarefa_avisos set estado = 'enviado', enviado_em = now() where id = p_id;
    update public.agente_pendencias set repassada_em = now()
     where tarefa_id = v.tarefa_id and numero = any (v.pendencias) and tipo = 'analista' and estado = 'aberta';
    perform interno.evento_tarefa(v.tarefa_id, 'sistema', format('avisou %s pelo WhatsApp', (select nome from public.usuarios where id = v.usuario_id)));
  else
    update public.agente_tarefa_avisos set estado = 'nao_enviado', motivo = 'falha' where id = p_id;
    perform interno.aviso_no_painel(v.tarefa_id, v.usuario_id, v.tipo, v.chave, v.mensagem);
  end if;
end $$;

-- Batimento: pendentes e segurados voltam à fila. F4: reserva esquecida há 10 min (o trabalhador caiu entre reservar e marcar)
-- pode já ter saído: não manda de novo (no máximo um envio); vira "não enviado" e vai ao painel.
create function public.avisos_tarefa_parados() returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  for v in update public.agente_tarefa_avisos set estado = 'nao_enviado', motivo = 'falha'
            where canal = 'whatsapp' and estado = 'enviando' and reservado_em < now() - interval '10 minutes'
           returning tarefa_id, usuario_id, tipo, chave, mensagem loop
    perform interno.aviso_no_painel(v.tarefa_id, v.usuario_id, v.tipo, v.chave, v.mensagem);
  end loop;
  return query select id from public.agente_tarefa_avisos
                where canal = 'whatsapp' and estado in ('pendente', 'segurado') and criado_em < now() - interval '2 minutes'
                order by criado_em limit 20;
end $$;

-- D11: as perguntas do analista em aberto que já foram ao WhatsApp de quem pediu (o Assistente lê para entender a resposta).
create function public.pendencias_repassadas_de(p_usuario uuid)
returns table (tarefa_id uuid, tarefa_numero bigint, agente text, empresa text, numero int, pergunta text, detalhe text, opcoes text[])
language sql stable security definer set search_path = '' as $$
  select t.id, t.numero, a.nome, coalesce(cl.nome_fantasia, cl.razao_social), p.numero::int, p.pergunta, p.detalhe, p.opcoes
    from public.agente_pendencias p
    join public.agente_tarefas t on t.id = p.tarefa_id
    join public.agentes a on a.id = t.agente_id
    left join public.clientes cl on cl.id = t.cliente_id
   where t.pedida_por = p_usuario and public.usuario_liberado(p_usuario) and p.tipo = 'analista' and p.estado = 'aberta'
     and p.repassada_em is not null and t.estado not in ('aprovada', 'descartada')
     and interno.quem_pediu_ve_a_tarefa(p_usuario, t.id) -- F6
     and interno.tem_assistente_whatsapp(p_usuario) -- revisão: só quem ainda tem o Assistente pelo WhatsApp
   order by t.numero, p.numero
   limit 20
$$;

-- D11: as travas de responder_pendencia (I3a), com a pessoa passada e só para quem pediu a tarefa.
create function public.responder_pendencia_de(p_usuario uuid, p_tarefa_numero bigint, p_pendencia int, p_resposta text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype; p public.agente_pendencias%rowtype;
begin
  select * into t from public.agente_tarefas where numero = p_tarefa_numero for update;
  if not found or t.pedida_por is distinct from p_usuario or not public.usuario_liberado(p_usuario)
     or not interno.tem_assistente_whatsapp(p_usuario) -- revisão: perdeu o Assistente pelo WhatsApp, não responde por lá
     or not public.pode_ver_chamado_de(p_usuario, t.chamado_id)
     or (exists (select 1 from public.chamados where id = t.chamado_id and pedido_venda is not null) and not interno.tem_permissao_de(p_usuario, 'notas', 'ver')) then
    raise exception 'Tarefa não encontrada.';
  end if;
  if not (public.eh_admin_de(p_usuario) or exists (select 1 from public.usuario_setores us where us.usuario_id = p_usuario and us.setor_id = t.setor_id)) then
    raise exception 'Só quem é do setor da demanda mexe na tarefa do agente.';
  end if;
  if not exists (select 1 from public.setores s where s.id = t.setor_id and s.ativo) then
    raise exception 'O setor desta demanda está desativado: não dá para mexer na tarefa.';
  end if;
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  select * into p from public.agente_pendencias where tarefa_id = t.id and numero = p_pendencia for update;
  if not found then raise exception 'Pendência não encontrada.'; end if;
  if p.tipo <> 'analista' then raise exception 'Pendência do cliente: use "Já recebi" no painel.'; end if;
  -- F5 (D11): só a pergunta que já foi ao WhatsApp dela.
  if p.repassada_em is null then raise exception 'Pendência não encontrada.'; end if;
  if p.estado <> 'aberta' then raise exception 'Esta pendência já foi respondida.'; end if;
  if p_resposta is null or char_length(btrim(p_resposta)) not between 1 and 2000 then raise exception 'Escreva a resposta (até 2.000 letras).'; end if;
  update public.agente_pendencias set estado = 'respondida', resposta = btrim(p_resposta), respondida_por = p_usuario, respondida_em = now() where id = p.id;
  insert into public.agente_tarefa_eventos (tarefa_id, quem, usuario_id, texto)
  values (t.id, 'pessoa', p_usuario, format('respondeu a pendência %s pelo WhatsApp', p.numero));
  return jsonb_build_object('tarefa_id', t.id, 'retomou', interno.retomar_se_respondida(t.id));
end $$;

revoke execute on function interno.aviso_no_painel(uuid, uuid, text, text, text), interno.quem_pediu_ve_a_tarefa(uuid, uuid),
  interno.tem_assistente_whatsapp(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.registrar_avisos_da_tarefa(uuid), public.reservar_aviso_tarefa(uuid), public.marcar_aviso_tarefa(uuid, boolean),
  public.avisos_tarefa_parados(), public.pendencias_repassadas_de(uuid), public.responder_pendencia_de(uuid, bigint, int, text)
  from public, anon, authenticated;
grant execute on function public.registrar_avisos_da_tarefa(uuid), public.reservar_aviso_tarefa(uuid), public.marcar_aviso_tarefa(uuid, boolean),
  public.avisos_tarefa_parados(), public.pendencias_repassadas_de(uuid), public.responder_pendencia_de(uuid, bigint, int, text)
  to service_role;
