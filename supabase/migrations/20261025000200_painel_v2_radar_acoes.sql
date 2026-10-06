-- supabase/migrations/20261025000200_painel_v2_radar_acoes.sql
-- Painel v2, Parte I5 (spec 7E.7, 7E.8; D11–D14, D17): o que uma pessoa faz com a novidade (demanda, aviso, descarte, mensagem
-- aos clientes) e o envio aos clientes pelo mesmo caminho dos pedidos ao cliente da I3a: aprovação de uma pessoa do setor, só
-- contatos procuráveis, as três pausas, a conversa com uma pessoa e o limite do dia, agora somando pendências e Radar.

-- ---------- Tabelas ----------
create table public.radar_envios (
  id uuid primary key default gen_random_uuid(),
  novidade_id uuid not null references public.radar_novidades (id) on delete cascade,
  setor_id uuid not null references public.setores (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  contato_id uuid not null references public.contatos (id) on delete cascade,
  texto text not null check (char_length(texto) between 3 and 1000),
  aprovado_por uuid references public.usuarios (id) on delete set null,
  aprovado_em timestamptz not null default now(),
  estado text not null default 'aguardando' check (estado in ('aguardando', 'enviado', 'nao_enviado')),
  motivo text check (motivo in ('pausado', 'nao_procuravel', 'atendimento_humano', 'limite_dia')),
  reservado_em timestamptz,
  enviado_em timestamptz,
  mensagem_id uuid references public.mensagens (id) on delete set null,
  unique (novidade_id, contato_id)
);
create index radar_envios_estado_idx on public.radar_envios (estado, aprovado_em);
create index radar_envios_contato_idx on public.radar_envios (contato_id, enviado_em);
create index radar_envios_enviado_idx on public.radar_envios (enviado_em);
create index radar_envios_setor_idx on public.radar_envios (setor_id);
create index radar_envios_cliente_idx on public.radar_envios (cliente_id);
create index radar_envios_aprovado_por_idx on public.radar_envios (aprovado_por);
create index radar_envios_mensagem_idx on public.radar_envios (mensagem_id);

-- D13: avisos ao WhatsApp do dono (impacto alto, resumo do dia): uma linha por aviso, para não mandar duas vezes.
create table public.radar_avisos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('alto', 'resumo')),
  novidade_id uuid references public.radar_novidades (id) on delete cascade,
  giro_id uuid references public.radar_giros (id) on delete cascade,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  mensagem_id uuid references public.mensagens (id) on delete set null,
  check ((tipo = 'alto') = (novidade_id is not null) and (tipo = 'resumo') = (giro_id is not null))
);
create unique index radar_avisos_alto on public.radar_avisos (novidade_id) where tipo = 'alto';
create unique index radar_avisos_resumo on public.radar_avisos (giro_id) where tipo = 'resumo';
create index radar_avisos_criado_idx on public.radar_avisos (tipo, criado_em);
create index radar_avisos_mensagem_idx on public.radar_avisos (mensagem_id);

alter table public.radar_envios enable row level security;
alter table public.radar_avisos enable row level security;
create policy leitura on public.radar_envios for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.radar_avisos for select to authenticated using (public.pode_ver_agentes());

-- ---------- Ajudantes ----------
-- A pessoa vê o Radar (D11); a novidade travada para a ação.
create function interno.novidade_da_pessoa(p_id uuid) returns public.radar_novidades
language plpgsql security definer set search_path = '' as $$
declare n public.radar_novidades%rowtype;
begin
  if not (public.eh_usuario_ativo() and public.pode_ver_agentes()) then raise exception 'Novidade não encontrada.'; end if;
  select * into n from public.radar_novidades where id = p_id for update;
  if not found then raise exception 'Novidade não encontrada.'; end if;
  return n;
end $$;
-- D11, D17: o setor tem de ser da novidade; quem age é do setor (ou administrador, ou dono). p_acao completa a frase.
create function interno.exigir_setor_da_novidade(n public.radar_novidades, p_setor uuid, p_acao text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_nome text;
begin
  if p_setor is null or not (p_setor = any (n.setores)) then raise exception 'Escolha um dos setores da novidade.'; end if;
  select nome into v_nome from public.setores where id = p_setor and ativo;
  if v_nome is null then raise exception 'Escolha um dos setores da novidade.'; end if;
  if not (public.eh_admin() or public.eh_dono() or p_setor in (select public.meus_setores())) then
    raise exception 'Só quem é do setor % %.', v_nome, p_acao;
  end if;
  return v_nome;
end $$;
revoke execute on function interno.novidade_da_pessoa(uuid), interno.exigir_setor_da_novidade(public.radar_novidades, uuid, text)
  from public, anon, authenticated, service_role;

-- ---------- Ações da pessoa ----------
-- D12: uma demanda por novidade, sem empresa, no setor escolhido; prioridade alta para impacto alto; prazo pelo gatilho de sempre.
create function public.criar_demanda_radar(p_novidade uuid, p_setor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n public.radar_novidades%rowtype; v_setor text; v_id uuid; v_numero bigint;
begin
  -- A trava de pessoa ativa e no horário também aqui (a mesma do ajudante), à vista de quem confere as funções de gravação.
  if not public.eh_usuario_ativo() then raise exception 'Novidade não encontrada.'; end if;
  n := interno.novidade_da_pessoa(p_novidade);
  if n.estado = 'demanda' then
    raise exception 'Esta novidade já virou a demanda #%.', (select numero from public.chamados where id = n.chamado_id);
  end if;
  if n.estado = 'descartada' then raise exception 'Esta novidade foi descartada.'; end if;
  v_setor := interno.exigir_setor_da_novidade(n, p_setor, 'cria a demanda');
  insert into public.chamados (cliente_id, setor_id, titulo, resumo, prioridade, origem, criado_por)
  values (null, p_setor, left('Radar: ' || n.titulo, 120),
    left(concat_ws(E'\n', n.resumo,
      format('Fonte: %s%s · %s', n.fonte_nome, case when n.selo = 'confirmar' then ' (confirmar)' else '' end,
             coalesce(to_char(n.publicado_em, 'DD/MM/YYYY'), 'sem data')),
      'Link: ' || n.url,
      case when n.vigencia_texto is not null then 'Vigência: ' || n.vigencia_texto end,
      format('Clientes possivelmente afetados: %s', n.clientes_afetados),
      'Sugestão do Radar de legislação. Confira na fonte antes de agir.'), 4000),
    (case when n.impacto = 'alto' then 'alta' else 'normal' end)::public.prioridade_demanda, 'sistema', auth.uid())
  returning id, numero into v_id, v_numero;
  update public.radar_novidades set estado = 'demanda', chamado_id = v_id, decidida_por = auth.uid(), decidida_em = now() where id = n.id;
  return jsonb_build_object('id', v_id, 'numero', v_numero);
end $$;

-- D13a: um aviso no Início de cada setor da novidade; no máximo um a cada 10 minutos por novidade.
create function public.avisar_equipe_radar(p_novidade uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n public.radar_novidades%rowtype; v int;
begin
  -- A trava de pessoa ativa e no horário também aqui (a mesma do ajudante), à vista de quem confere as funções de gravação.
  if not public.eh_usuario_ativo() then raise exception 'Novidade não encontrada.'; end if;
  n := interno.novidade_da_pessoa(p_novidade);
  if n.avisada_em is not null and n.avisada_em > now() - interval '10 minutes' then raise exception 'A equipe já foi avisada há pouco.'; end if;
  if cardinality(n.setores) = 0 then raise exception 'Esta novidade não tem setor.'; end if;
  insert into public.alertas (nivel, setor_id, mensagem)
  select 'aviso', s.id, left(format('Radar: %s · %s', n.titulo, n.fonte_nome), 500)
    from public.setores s where s.id = any (n.setores) and s.ativo;
  get diagnostics v = row_count;
  update public.radar_novidades set avisada_em = now() where id = n.id;
  return v;
end $$;

create function public.descartar_novidade_radar(p_novidade uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.radar_novidades%rowtype;
begin
  -- A trava de pessoa ativa e no horário também aqui (a mesma do ajudante), à vista de quem confere as funções de gravação.
  if not public.eh_usuario_ativo() then raise exception 'Novidade não encontrada.'; end if;
  n := interno.novidade_da_pessoa(p_novidade);
  if n.estado <> 'para_decidir' then raise exception 'Esta novidade já foi decidida.'; end if;
  update public.radar_novidades set estado = 'descartada', decidida_por = auth.uid(), decidida_em = now() where id = n.id;
end $$;

create function public.salvar_mensagem_radar(p_novidade uuid, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.radar_novidades%rowtype;
begin
  n := interno.novidade_da_pessoa(p_novidade);
  if not (public.eh_admin() or public.eh_dono() or exists (select 1 from unnest(n.setores) s where s in (select public.meus_setores()))) then
    raise exception 'Só quem é de um setor da novidade edita a mensagem.';
  end if;
  if p_texto is null or char_length(btrim(p_texto)) not between 3 and 1000 then raise exception 'Mensagem ao cliente: de 3 a 1.000 letras.'; end if;
  update public.radar_novidades set mensagem_cliente = btrim(p_texto) where id = n.id;
end $$;

-- D10: VER LISTA (até 500). Nada é salvo no cliente.
create function public.clientes_afetados_radar(p_novidade uuid)
returns table (cliente_id uuid, nome text, regime text, uf text, cidade text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v_crit jsonb;
begin
  if not (public.eh_usuario_ativo() and public.pode_ver_agentes()) then return; end if;
  select criterios into v_crit from public.radar_novidades where id = p_novidade;
  if not found then return; end if;
  return query
    select c.id, coalesce(c.nome_fantasia, c.razao_social), c.regime, c.uf::text, c.cidade from public.clientes c
     where c.ativo and interno.cliente_nos_criterios(c.id, v_crit)
     order by coalesce(c.nome_fantasia, c.razao_social) limit 500;
end $$;

-- ESCOLHER CLIENTES: quantos contatos de cada cliente afetado podem ser procurados pelo setor.
create function public.contatos_para_envio_radar(p_novidade uuid, p_setor uuid) returns table (cliente_id uuid, nome text, contatos int)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare v_crit jsonb;
begin
  if not (public.eh_usuario_ativo() and public.pode_ver_agentes()) then return; end if;
  select criterios into v_crit from public.radar_novidades where id = p_novidade;
  if not found then return; end if;
  return query
    select c.id, coalesce(c.nome_fantasia, c.razao_social), (select count(*)::int from public.contatos_procuraveis(c.id, p_setor))
      from public.clientes c where c.ativo and interno.cliente_nos_criterios(c.id, v_crit)
     order by coalesce(c.nome_fantasia, c.razao_social) limit 500;
end $$;

-- D14: a aprovação é da mensagem e da lista. Cada contato procurável recebe uma vez por novidade.
create function public.aprovar_envio_radar(p_novidade uuid, p_setor uuid, p_clientes uuid[], p_texto text) returns int
language plpgsql security definer set search_path = '' as $$
declare n public.radar_novidades%rowtype; v_setor text; v_clientes uuid[]; v_novos int; v_total int;
begin
  -- A trava de pessoa ativa e no horário também aqui (a mesma do ajudante), à vista de quem confere as funções de gravação.
  if not public.eh_usuario_ativo() then raise exception 'Novidade não encontrada.'; end if;
  n := interno.novidade_da_pessoa(p_novidade);
  if n.estado = 'descartada' then raise exception 'Esta novidade foi descartada.'; end if;
  v_setor := interno.exigir_setor_da_novidade(n, p_setor, 'aprova o envio');
  if p_texto is null or char_length(btrim(p_texto)) not between 3 and 1000 then raise exception 'Mensagem ao cliente: de 3 a 1.000 letras.'; end if;
  v_clientes := array(select distinct x from unnest(coalesce(p_clientes, '{}')) x where x is not null);
  if cardinality(v_clientes) = 0 then raise exception 'Escolha ao menos um cliente.'; end if;
  if cardinality(v_clientes) > 200 then raise exception 'Até 200 clientes por envio.'; end if;
  if exists (select 1 from unnest(v_clientes) x where not interno.cliente_nos_criterios(x, n.criterios)) then
    raise exception 'Só clientes possivelmente afetados recebem.';
  end if;
  select count(distinct p.contato_id) into v_total from unnest(v_clientes) x, public.contatos_procuraveis(x, p_setor) p;
  if v_total = 0 then raise exception 'Nenhum contato destes clientes pode ser procurado pelo setor %.', v_setor; end if;
  if v_total > 300 then raise exception 'Até 300 contatos por envio: escolha menos clientes.'; end if;
  insert into public.radar_envios (novidade_id, setor_id, cliente_id, contato_id, texto, aprovado_por)
  select distinct on (p.contato_id) n.id, p_setor, x, p.contato_id, btrim(p_texto), auth.uid()
    from unnest(v_clientes) x, public.contatos_procuraveis(x, p_setor) p
   order by p.contato_id, x
  on conflict (novidade_id, contato_id) do nothing;
  get diagnostics v_novos = row_count;
  update public.radar_novidades set mensagem_cliente = btrim(p_texto) where id = n.id;
  return v_novos;
end $$;

create function public.envios_da_novidade(p_novidade uuid) returns table (estado text, motivo text, total int)
language sql stable security definer set search_path = '' as $$
  select e.estado, e.motivo, count(*)::int from public.radar_envios e
   where e.novidade_id = p_novidade and public.eh_usuario_ativo() and public.pode_ver_agentes()
   group by e.estado, e.motivo order by e.estado, e.motivo
$$;

-- ---------- Limite do dia compartilhado (D14) ----------
-- Mensagens ativas que saíram ao contato (ou ao escritório) nas últimas 24 h: pedidos de pendência + envios do Radar.
create function interno.mensagens_ativas_24h(p_contato uuid, p_menos_pendencia uuid, p_menos_envio uuid) returns int
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.agente_pendencias x
           where (p_contato is null or x.contato_id = p_contato) and x.id is distinct from p_menos_pendencia
             and x.pedido_enviado_em > now() - interval '1 day')::int
       + (select count(*) from public.radar_envios e
           where (p_contato is null or e.contato_id = p_contato) and e.id is distinct from p_menos_envio
             and (e.enviado_em > now() - interval '1 day' or (e.reservado_em > now() - interval '1 day' and e.estado = 'aguardando')))::int
$$;
revoke execute on function interno.mensagens_ativas_24h(uuid, uuid, uuid) from public, anon, authenticated, service_role;

-- A mesma regra da I3a, com o limite do dia somando os envios do Radar (único trecho que muda; ver o relatório da Task 3).
create or replace function interno.pedido_impedido(p_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare p public.agente_pendencias%rowtype; t public.agente_tarefas%rowtype;
begin
  select * into p from public.agente_pendencias where id = p_id;
  if not found then return 'nao_encontrado'; end if;
  select * into t from public.agente_tarefas where id = p.tarefa_id;
  if interno.pedido_pausado(t.cliente_id, p.contato_id) then return 'pausado'; end if;
  if not exists (select 1 from public.contatos c where c.id = p.contato_id and c.ativo)
     or not exists (select 1 from public.contatos_procuraveis(t.cliente_id, t.setor_id) cp where cp.contato_id = p.contato_id) then
    return 'nao_procuravel';
  end if;
  if interno.contato_com_pessoa(p.contato_id) then return 'atendimento_humano'; end if;
  if interno.mensagens_ativas_24h(p.contato_id, p_id, null) >= 3 or interno.mensagens_ativas_24h(null, p_id, null) >= 30 then
    return 'limite_dia';
  end if;
  return null;
end $$;
revoke execute on function interno.pedido_impedido(uuid) from public, anon, authenticated, service_role;

-- A regra do envio do Radar: as mesmas quatro razões, na mesma ordem.
create function interno.envio_radar_impedido(p_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare e public.radar_envios%rowtype;
begin
  select * into e from public.radar_envios where id = p_id;
  if not found then return 'nao_encontrado'; end if;
  if interno.pedido_pausado(e.cliente_id, e.contato_id) then return 'pausado'; end if;
  if not exists (select 1 from public.contatos c where c.id = e.contato_id and c.ativo)
     or not exists (select 1 from public.contatos_procuraveis(e.cliente_id, e.setor_id) cp where cp.contato_id = e.contato_id) then
    return 'nao_procuravel';
  end if;
  if interno.contato_com_pessoa(e.contato_id) then return 'atendimento_humano'; end if;
  if interno.mensagens_ativas_24h(e.contato_id, null, p_id) >= 3 or interno.mensagens_ativas_24h(null, null, p_id) >= 30 then
    return 'limite_dia';
  end if;
  return null;
end $$;
revoke execute on function interno.envio_radar_impedido(uuid) from public, anon, authenticated, service_role;

-- ---------- Envio (trabalhador) ----------
-- Solta reservas velhas, vence o que esperou 3 dias e devolve os que podem sair agora (o ciclo do Radar manda).
create function public.envios_radar_para_enviar(p_limite int) returns setof uuid
language plpgsql security definer set search_path = '' as $$
declare r record; v text;
begin
  -- Reserva de mais de 10 min sem mensagem: o trabalhador caiu entre reservar e marcar (como pedidos_ao_cliente_parados, F5).
  update public.radar_envios e set reservado_em = null
   where e.estado = 'aguardando' and e.mensagem_id is null and e.reservado_em < now() - interval '10 minutes'
     and not exists (select 1 from public.mensagens m join public.conversas cv on cv.id = m.conversa_id join public.contatos ct on ct.id = e.contato_id
                      where (cv.contato_id = e.contato_id or cv.telefone = ct.telefone) and m.direcao = 'saida' and m.conteudo = e.texto
                        and m.criado_em >= e.aprovado_em and m.status_envio is not null and (m.status_envio <> 'falhou' or m.id_provedor is not null));
  for r in select e.id from public.radar_envios e where e.estado = 'aguardando' and e.reservado_em is null order by e.aprovado_em limit 500 loop
    v := interno.envio_radar_impedido(r.id);
    update public.radar_envios set motivo = v where id = r.id and motivo is distinct from v;
    update public.radar_envios set estado = 'nao_enviado' where id = r.id and v is not null and aprovado_em < now() - interval '3 days';
  end loop;
  return query select e.id from public.radar_envios e
    where e.estado = 'aguardando' and e.reservado_em is null and e.motivo is null order by e.aprovado_em limit greatest(least(p_limite, 50), 1);
end $$;

create function public.reservar_envio_radar(p_id uuid)
returns table (id uuid, novidade_id uuid, cliente_id uuid, contato_id uuid, telefone text, texto text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare v text;
begin
  -- A mesma trava dos pedidos de pendência: as duas filas contam no mesmo limite.
  perform pg_advisory_xact_lock(hashtextextended('pedido_cliente:escritorio', 0));
  v := interno.envio_radar_impedido(p_id);
  if v is not null then
    -- Só o envio que ainda espera: o já enviado (ou reservado) não ganha motivo.
    update public.radar_envios set motivo = v where id = p_id and estado = 'aguardando' and mensagem_id is null;
    return;
  end if;
  return query
    update public.radar_envios e set reservado_em = now(), motivo = null
      from public.contatos c
     where e.id = p_id and c.id = e.contato_id and e.estado = 'aguardando' and e.reservado_em is null and e.mensagem_id is null
    returning e.id, e.novidade_id, e.cliente_id, e.contato_id, c.telefone, e.texto;
end $$;
create function public.liberar_envio_radar(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.radar_envios set reservado_em = null where id = p_id and mensagem_id is null and estado = 'aguardando'
$$;
create function public.marcar_envio_radar(p_id uuid, p_mensagem uuid) returns void
language sql security definer set search_path = '' as $$
  update public.radar_envios set estado = 'enviado', enviado_em = coalesce(enviado_em, now()), mensagem_id = p_mensagem, motivo = null
   where id = p_id and mensagem_id is null
$$;

-- ---------- Avisos (D13) ----------
-- Chamado pelo trabalhador logo depois de registrar uma novidade nova. Alertas do painel e reserva do WhatsApp do impacto alto.
create function public.avisar_novidade_nova(p_novidade uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n public.radar_novidades%rowtype; c public.radar_config%rowtype; v_tel text; v_whats boolean := false;
begin
  select * into n from public.radar_novidades where id = p_novidade for update;
  if not found then return jsonb_build_object('whatsapp', false); end if;
  select * into c from public.radar_config where id = 1;
  -- Uma vez por novidade: avisada_em marca também o aviso automático.
  if n.avisada_em is null and (c.avisar_painel or (c.aviso_alto and n.impacto = 'alto')) then
    insert into public.alertas (nivel, setor_id, mensagem)
    select 'aviso', s.id, left(format('Radar: %s · %s', n.titulo, n.fonte_nome), 500) from public.setores s where s.id = any (n.setores) and s.ativo;
    update public.radar_novidades set avisada_em = now() where id = n.id;
  end if;
  select telefone_dono into v_tel from public.configuracoes where id = 1;
  if c.aviso_alto and n.impacto = 'alto' and nullif(btrim(v_tel), '') is not null
     and (select count(*) from public.radar_avisos where tipo = 'alto' and interno.dia_sp(criado_em) = interno.dia_sp(now())) < 5 then
    insert into public.radar_avisos (tipo, novidade_id) values ('alto', n.id) on conflict do nothing;
    v_whats := found;
  end if;
  return jsonb_build_object('whatsapp', v_whats, 'aviso_id', (select id from public.radar_avisos where tipo = 'alto' and novidade_id = n.id),
    'titulo', n.titulo, 'fonte', n.fonte_nome, 'vigencia', n.vigencia_texto);
end $$;

-- D13d: só o agendado, só com novidade, uma vez por giro.
create function public.reservar_resumo_radar(p_giro uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.radar_giros%rowtype; v_id uuid;
begin
  select * into g from public.radar_giros where id = p_giro;
  if not found or g.origem <> 'agenda' or g.estado <> 'concluido' or g.novidades = 0 then return null; end if;
  if not (select resumo_whatsapp from public.radar_config where id = 1) then return null; end if;
  if nullif(btrim((select telefone_dono from public.configuracoes where id = 1)), '') is null then return null; end if;
  insert into public.radar_avisos (tipo, giro_id) values ('resumo', p_giro) on conflict do nothing returning id into v_id;
  if v_id is null then return null; end if;
  return jsonb_build_object('aviso_id', v_id,
    'novidades', coalesce((select jsonb_agg(jsonb_build_object('titulo', n.titulo, 'impacto', n.impacto, 'fonte', n.fonte_nome)
                                  order by case n.impacto when 'alto' then 1 when 'medio' then 2 else 3 end, n.achado_em)
                             from public.radar_novidades n where n.giro_id = p_giro), '[]'::jsonb),
    'fontes_fora', coalesce((select jsonb_agg(e ->> 'nome') from jsonb_array_elements(g.fontes_fora) e), '[]'::jsonb));
end $$;
create function public.marcar_aviso_radar(p_aviso uuid, p_mensagem uuid) returns void
language sql security definer set search_path = '' as $$
  update public.radar_avisos set enviado_em = now(), mensagem_id = p_mensagem where id = p_aviso and enviado_em is null
$$;

revoke execute on function public.criar_demanda_radar(uuid, uuid), public.avisar_equipe_radar(uuid), public.descartar_novidade_radar(uuid),
  public.salvar_mensagem_radar(uuid, text), public.clientes_afetados_radar(uuid), public.contatos_para_envio_radar(uuid, uuid),
  public.aprovar_envio_radar(uuid, uuid, uuid[], text), public.envios_da_novidade(uuid) from public, anon;
grant execute on function public.criar_demanda_radar(uuid, uuid), public.avisar_equipe_radar(uuid), public.descartar_novidade_radar(uuid),
  public.salvar_mensagem_radar(uuid, text), public.clientes_afetados_radar(uuid), public.contatos_para_envio_radar(uuid, uuid),
  public.aprovar_envio_radar(uuid, uuid, uuid[], text), public.envios_da_novidade(uuid) to authenticated;
revoke execute on function public.envios_radar_para_enviar(int), public.reservar_envio_radar(uuid), public.liberar_envio_radar(uuid),
  public.marcar_envio_radar(uuid, uuid), public.avisar_novidade_nova(uuid), public.reservar_resumo_radar(uuid), public.marcar_aviso_radar(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.envios_radar_para_enviar(int), public.reservar_envio_radar(uuid), public.liberar_envio_radar(uuid),
  public.marcar_envio_radar(uuid, uuid), public.avisar_novidade_nova(uuid), public.reservar_resumo_radar(uuid), public.marcar_aviso_radar(uuid, uuid)
  to service_role;

-- restaurar_radar_inicial (Task 2) apaga as novidades; envios e avisos vão junto (cascade).
