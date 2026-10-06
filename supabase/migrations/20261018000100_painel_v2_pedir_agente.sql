-- supabase/migrations/20261018000100_painel_v2_pedir_agente.sql
-- Painel v2, Parte I4 (spec 7E.5; D4–D7, D13, D15): PEDIR AO AGENTE pelo painel e pelo WhatsApp da equipe. Os dois caminhos passam
-- por interno.pedir_ao_agente (a mesma tarefa). Só acréscimos: criar_tarefa_agente (I3a) fica como está (testes 50/51).
-- Nada entra no Realtime (teste 22).

-- D7: o que a pessoa pediu além do texto.
alter table public.agente_tarefas
  add column prazo_desejado timestamptz,
  add column avisar_painel boolean not null default true,
  add column avisar_whatsapp boolean not null default false,
  add column ler_drive boolean not null default true,
  add column drive_subpasta text check (drive_subpasta is null or char_length(drive_subpasta) between 1 and 310),
  -- Revisão final (Important 1): a chave do pedido pelo Assistente (a mensagem que ele está respondendo + agente + empresa/demanda).
  -- A nova tentativa do job manda a mesma chave e recebe a tarefa já criada, sem outra tarefa nem outra demanda.
  add column chave_pedido text check (chave_pedido is null or char_length(chave_pedido) between 1 and 200);
create unique index agente_tarefas_chave_pedido on public.agente_tarefas (pedida_por, chave_pedido) where chave_pedido is not null;

-- ---------- Ajudantes com a pessoa (o trabalhador passa quem é; o painel passa auth.uid()) ----------
create function interno.rotulo_tarefa(p_numero bigint) returns text
language sql immutable set search_path = '' as $$ select 'T-' || lpad(p_numero::text, 4, '0') $$;

-- D5, D15: do setor ou administradora. O dono que não é administrador segue os setores dele (F7): fora deles não
-- enviaria arquivo nem aprovaria a tarefa (tarefa_da_pessoa_sem_setor, I3a).
create function interno.pessoa_pede_no_setor(p_usuario uuid, p_setor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.usuario_liberado(p_usuario) and (public.eh_admin_de(p_usuario)
    or exists (select 1 from public.usuario_setores us where us.usuario_id = p_usuario and us.setor_id = p_setor))
$$;

create function interno.tem_permissao_de(p_usuario uuid, p_modulo text, p_minimo text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin_de(p_usuario) or public.tem_nivel_de(p_usuario, p_modulo, p_minimo)
$$;

-- D5: null = pode pedir; senão a frase para a pessoa.
create function interno.pode_pedir_ao_agente(p_usuario uuid, p_agente public.agentes) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_agente.id is null or p_agente.porta_de_entrada or not ('trabalho' = any (p_agente.tipos)) then return 'Este agente não faz tarefas.'; end if;
  if p_agente.estado = 'desligado' then return 'O agente está desligado.'; end if;
  if not exists (select 1 from public.setores s where s.id = p_agente.setor_id and s.ativo) then return 'O setor deste agente está desativado.'; end if;
  if not interno.pessoa_pede_no_setor(p_usuario, p_agente.setor_id) then return 'Você só pede aos agentes dos seus setores.'; end if;
  if p_agente.estado = 'teste' and not (public.eh_admin_de(p_usuario) or public.eh_dono_de(p_usuario)) then
    return 'O agente está em teste: só o dono e o administrador pedem tarefas.';
  end if;
  return null;
end $$;

-- D9: o WhatsApp de quem pediu recebe avisos se a pessoa tem telefone e o Assistente pelo WhatsApp (sem passe livre do administrador, P3).
-- F2: sem o horário de acesso (lido direto, não por usuario_liberado/tem_nivel_de): fora do horário o aviso fica segurado, não se perde.
create function interno.motivo_sem_whatsapp(p_usuario uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when not exists (select 1 from public.usuarios where id = p_usuario and ativo) then 'Acesso desativado.'
    when (select telefone from public.usuarios where id = p_usuario) is null then 'Cadastre seu WhatsApp em Usuários para receber avisos.'
    when public.nivel_de(p_usuario, 'assistente') is distinct from 'site_whatsapp' then 'Seu acesso ao Assistente não inclui o WhatsApp.'
  end
$$;

-- D13: a faixa do meio das tarefas recentes do agente (com 3 ou mais).
create function interno.estimativa_tarefa(p_agente uuid) returns table (n int, min numeric, max numeric)
language sql stable security definer set search_path = '' as $$
  select count(*)::int,
         case when count(*) >= 3 then round((percentile_cont(0.25) within group (order by custo_usd))::numeric, 2) end,
         case when count(*) >= 3 then round((percentile_cont(0.75) within group (order by custo_usd))::numeric, 2) end
    from public.agente_tarefas
   where agente_id = p_agente and estado in ('pronta', 'aprovada', 'descartada') and custo_usd > 0
     and criado_em > now() - interval '180 days'
$$;

-- ---------- Os agentes que a pessoa pode pedir (a janela e o Assistente) ----------
create function interno.agentes_para_pedir(p_usuario uuid, p_chamado uuid)
returns table (id uuid, slug text, nome text, descricao text, setor_id uuid, setor text, estado text, destino text, procedimentos jsonb,
               custo_n int, custo_min numeric, custo_max numeric, limite_usd numeric)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare c public.chamados%rowtype; v_ativa boolean := false;
begin
  if p_usuario is null or not public.usuario_liberado(p_usuario) then return; end if;
  if p_chamado is not null then
    select * into c from public.chamados ch where ch.id = p_chamado;
    if not found or not public.pode_ver_chamado_de(p_usuario, p_chamado) then return; end if;
    if c.pedido_venda is not null and not interno.tem_permissao_de(p_usuario, 'notas', 'ver') then return; end if;
    v_ativa := exists (select 1 from public.agente_tarefas t where t.chamado_id = p_chamado and t.estado not in ('aprovada', 'descartada'));
  end if;
  return query
    select a.id, a.slug, a.nome, a.descricao, a.setor_id, st.nome, a.estado,
           case when p_chamado is not null and a.setor_id = c.setor_id and c.status <> 'concluido' and not v_ativa then 'esta_demanda' else 'nova' end,
           coalesce((select jsonb_agg(jsonb_build_object('nome', s.nome, 'titulo', s.titulo, 'descricao', s.descricao) order by s.nome)
                       from public.skills_do_agente(a.id) s where s.tipo = 'procedimento'), '[]'::jsonb),
           e.n, e.min, e.max, a.tarefa_limite_usd
      from public.agentes a
      join public.setores st on st.id = a.setor_id and st.ativo
      cross join lateral interno.estimativa_tarefa(a.id) e
     where interno.pode_pedir_ao_agente(p_usuario, a) is null
     order by a.ordem, a.nome;
end $$;

create function public.agentes_para_pedir(p_chamado uuid default null)
returns table (id uuid, slug text, nome text, descricao text, setor_id uuid, setor text, estado text, destino text, procedimentos jsonb,
               custo_n int, custo_min numeric, custo_max numeric, limite_usd numeric)
language sql stable security definer set search_path = '' as $$ select * from interno.agentes_para_pedir(auth.uid(), p_chamado) $$;

create function public.agentes_para_pedir_de(p_usuario uuid, p_chamado uuid default null)
returns table (id uuid, slug text, nome text, descricao text, setor_id uuid, setor text, estado text, destino text, procedimentos jsonb,
               custo_n int, custo_min numeric, custo_max numeric, limite_usd numeric)
language sql stable security definer set search_path = '' as $$ select * from interno.agentes_para_pedir(p_usuario, p_chamado) $$;

create function public.meu_whatsapp_para_avisos() returns text
language sql stable security definer set search_path = '' as $$
  select case when not public.eh_usuario_ativo() then 'Acesso desativado.' else interno.motivo_sem_whatsapp(auth.uid()) end
$$;

-- ---------- Pedir (D4, D6, D7) ----------
-- p_so_esta: o WhatsApp citou "demanda #N" — usa só aquela ou diz por que não.
create function interno.pedir_ao_agente(p_usuario uuid, p_origem text, p_so_esta boolean, p_agente uuid, p_chamado uuid, p_cliente uuid,
  p_pedido text, p_skill text, p_prazo timestamptz, p_avisar_painel boolean, p_avisar_whatsapp boolean, p_ler_drive boolean, p_subpasta text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.agentes%rowtype; c public.chamados%rowtype; v_motivo text; v_chamado uuid; v_numero bigint; v_nova boolean := false;
  v_cliente uuid := p_cliente; v_resp uuid; v_id uuid; v_tnum bigint; v_ativa boolean := false;
  v_pedido text := btrim(coalesce(p_pedido, '')); v_sub text := nullif(btrim(coalesce(p_subpasta, '')), '');
begin
  if p_usuario is null or not public.usuario_liberado(p_usuario) then raise exception 'Acesso desativado.'; end if;
  if p_origem not in ('painel', 'assistente', 'whatsapp') then raise exception 'Origem inválida.'; end if;
  select * into a from public.agentes where id = p_agente;
  if not found then raise exception 'Agente não encontrado.'; end if;
  v_motivo := interno.pode_pedir_ao_agente(p_usuario, a);
  if v_motivo is not null then raise exception '%', v_motivo; end if;
  if char_length(v_pedido) not between 3 and 2000 then raise exception 'Escreva o que você quer (de 3 a 2.000 letras).'; end if;
  if p_skill is not null and not exists (select 1 from public.skills_do_agente(a.id) s where s.nome = p_skill and s.tipo = 'procedimento') then
    raise exception 'Procedimento não encontrado neste agente.';
  end if;
  if p_prazo is not null and (p_prazo <= now() or p_prazo > now() + interval '90 days') then
    raise exception 'O prazo desejado precisa ser depois de agora e em até 90 dias.';
  end if;
  -- A mesma regra do core (lerSubpasta): nomes separados por /, até 3 níveis, sem "." nem "..".
  if v_sub is not null and (v_sub !~ '^[^/]{1,100}(/[^/]{1,100}){0,2}$' or v_sub ~ '(^|/)\.{1,2}(/|$)') then
    raise exception 'Subpasta inválida: use nomes separados por /, até 3 níveis.';
  end if;

  if p_chamado is not null then
    select * into c from public.chamados where id = p_chamado for update;
    if not found or not public.pode_ver_chamado_de(p_usuario, p_chamado) then raise exception 'Demanda não encontrada.'; end if;
    if c.pedido_venda is not null and not interno.tem_permissao_de(p_usuario, 'notas', 'ver') then
      raise exception 'Só quem vê os pedidos de nota pede tarefa nesta demanda.';
    end if;
    v_cliente := coalesce(c.cliente_id, p_cliente);
    v_ativa := exists (select 1 from public.agente_tarefas where chamado_id = c.id and estado not in ('aprovada', 'descartada'));
    if a.setor_id = c.setor_id and c.status <> 'concluido' and not v_ativa then
      v_chamado := c.id; v_numero := c.numero;
    elsif p_so_esta then
      if c.status = 'concluido' then raise exception 'A demanda já foi concluída.'; end if;
      if v_ativa then raise exception 'Esta demanda já tem uma tarefa do agente em andamento.'; end if;
      raise exception 'A demanda #% é de outro setor. Peça sem o número para abrir uma demanda nova no %.', c.numero,
        (select nome from public.setores where id = a.setor_id);
    end if;
  end if;

  -- D6: demanda nova no setor do agente, para a mesma empresa; o prazo vem da regra (gatilho chamados_antes_inserir).
  if v_chamado is null then
    if v_cliente is null or not exists (select 1 from public.clientes where id = v_cliente and ativo) then raise exception 'Escolha a empresa.'; end if;
    -- Como criar_demanda: com "Só as minhas", a pessoa fica responsável (senão a demanda some da tela dela).
    v_resp := case when not public.eh_admin_de(p_usuario) and public.nivel_de(p_usuario, 'demandas') = 'minhas' then p_usuario end;
    insert into public.chamados (cliente_id, setor_id, responsavel_id, titulo, resumo, prioridade, origem, criado_por)
    values (v_cliente, a.setor_id, v_resp, left(format('%s: %s', a.nome, split_part(v_pedido, E'\n', 1)), 120), left(v_pedido, 4000),
            'normal', 'equipe', p_usuario)
    returning id, numero into v_chamado, v_numero;
    v_nova := true;
    if c.id is not null then
      insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (c.id, c.cliente_id, 'nota_interna', p_usuario, format('Pedido ao %s na demanda nova #%s.', a.nome, v_numero));
    end if;
  end if;

  begin
    insert into public.agente_tarefas (agente_id, chamado_id, cliente_id, setor_id, pedida_por, canal, pedido, skill_nome, limite_usd, limite_minutos,
                                       prazo_desejado, avisar_painel, avisar_whatsapp, ler_drive, drive_subpasta)
    select a.id, ch.id, ch.cliente_id, ch.setor_id, p_usuario, case when p_origem = 'whatsapp' then 'whatsapp' else 'painel' end, v_pedido, p_skill,
           a.tarefa_limite_usd, a.tarefa_limite_minutos, p_prazo, coalesce(p_avisar_painel, true),
           coalesce(p_avisar_whatsapp, false) and interno.motivo_sem_whatsapp(p_usuario) is null, coalesce(p_ler_drive, true), v_sub
      from public.chamados ch where ch.id = v_chamado
    returning id, numero into v_id, v_tnum;
  exception when unique_violation then
    raise exception 'Esta demanda já tem uma tarefa do agente em andamento.';
  end;
  insert into public.agente_tarefa_eventos (tarefa_id, quem, usuario_id, texto)
  values (v_id, 'pessoa', p_usuario, case p_origem when 'painel' then 'pediu a tarefa pelo painel' when 'assistente' then 'pediu a tarefa pelo Assistente'
                                                   else 'pediu a tarefa pelo WhatsApp (Assistente)' end);
  return jsonb_build_object('tarefa_id', v_id, 'tarefa_numero', v_tnum, 'chamado_id', v_chamado, 'chamado_numero', v_numero, 'demanda_nova', v_nova);
end $$;

create function public.pedir_ao_agente(p_agente uuid, p_pedido text, p_chamado uuid default null, p_cliente uuid default null,
  p_skill text default null, p_prazo timestamptz default null, p_avisar_painel boolean default true, p_avisar_whatsapp boolean default false,
  p_ler_drive boolean default true, p_subpasta text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_usuario_ativo() then raise exception 'Acesso desativado.'; end if;
  return interno.pedir_ao_agente(auth.uid(), 'painel', false, p_agente, p_chamado, p_cliente, p_pedido, p_skill, p_prazo,
                                 p_avisar_painel, p_avisar_whatsapp, p_ler_drive, p_subpasta);
end $$;

-- O trabalhador: Assistente do painel (avisa no painel) ou WhatsApp (avisa no WhatsApp e, se não der, no painel).
create function public.pedir_ao_agente_de(p_usuario uuid, p_origem text, p_agente uuid, p_pedido text, p_cliente uuid default null,
  p_chamado_numero bigint default null, p_prazo timestamptz default null, p_chave text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_chamado uuid; v_chave text := nullif(btrim(coalesce(p_chave, '')), ''); v_r jsonb;
begin
  if p_origem is null or p_origem not in ('assistente', 'whatsapp') then raise exception 'Origem inválida.'; end if;
  -- F8: o banco também confere o nível do Assistente da origem (o trabalhador já confere; aqui é a segunda trava).
  if not public.tem_nivel_de(p_usuario, 'assistente', case p_origem when 'whatsapp' then 'site_whatsapp' else 'site' end) then
    raise exception 'Acesso desativado.';
  end if;
  -- Revisão final (Important 1): a mesma chave devolve a tarefa já criada (a nova tentativa do job não duplica).
  if v_chave is not null then
    perform pg_advisory_xact_lock(hashtext('pedir_ao_agente_de:' || p_usuario::text || ':' || v_chave));
    select jsonb_build_object('tarefa_id', t.id, 'tarefa_numero', t.numero, 'chamado_id', t.chamado_id, 'chamado_numero', c.numero,
                              'demanda_nova', false, 'ja_criada', true)
      into v_r
      from public.agente_tarefas t join public.chamados c on c.id = t.chamado_id
     where t.pedida_por = p_usuario and t.chave_pedido = v_chave;
    if v_r is not null then return v_r; end if;
  end if;
  if p_chamado_numero is not null then
    select id into v_chamado from public.chamados where numero = p_chamado_numero;
    if not found then raise exception 'Demanda não encontrada.'; end if;
  end if;
  v_r := interno.pedir_ao_agente(p_usuario, p_origem, p_chamado_numero is not null, p_agente, v_chamado, p_cliente, p_pedido, null, p_prazo,
                                 true, p_origem = 'whatsapp', true, null);
  if v_chave is not null then
    update public.agente_tarefas set chave_pedido = left(v_chave, 200) where id = (v_r ->> 'tarefa_id')::uuid;
  end if;
  return v_r;
end $$;

revoke execute on function interno.rotulo_tarefa(bigint), interno.pessoa_pede_no_setor(uuid, uuid), interno.tem_permissao_de(uuid, text, text),
  interno.pode_pedir_ao_agente(uuid, public.agentes), interno.motivo_sem_whatsapp(uuid), interno.estimativa_tarefa(uuid),
  interno.agentes_para_pedir(uuid, uuid),
  interno.pedir_ao_agente(uuid, text, boolean, uuid, uuid, uuid, text, text, timestamptz, boolean, boolean, boolean, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.agentes_para_pedir(uuid), public.meu_whatsapp_para_avisos(),
  public.pedir_ao_agente(uuid, text, uuid, uuid, text, timestamptz, boolean, boolean, boolean, text) from public, anon, service_role;
grant execute on function public.agentes_para_pedir(uuid), public.meu_whatsapp_para_avisos(),
  public.pedir_ao_agente(uuid, text, uuid, uuid, text, timestamptz, boolean, boolean, boolean, text) to authenticated;
revoke execute on function public.agentes_para_pedir_de(uuid, uuid), public.pedir_ao_agente_de(uuid, text, uuid, text, uuid, bigint, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.agentes_para_pedir_de(uuid, uuid), public.pedir_ao_agente_de(uuid, text, uuid, text, uuid, bigint, timestamptz, text)
  to service_role;
