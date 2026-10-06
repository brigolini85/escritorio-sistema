-- supabase/migrations/20261017000200_painel_v2_testar_guarda.sql
-- Painel v2, Parte I3b (D11, D12, D14, D15): Testar dos agentes dos setores, guarda dos arquivos das tarefas e as sobras da I3a.
-- Funções da I3a trocam o corpo com a mesma assinatura (interno.tarefa_da_pessoa, interno.retomar_se_respondida). Nada no Realtime (teste 22).

-- ---------- Testar dos agentes dos setores (D11, D12) ----------
alter table public.simulacoes_agente add column modo text check (modo is null or modo in ('por_tras', 'mesma_voz', 'passa_conversa'));

-- O rascunho de orientação, como em criar_simulacao (20260930000200), mas a orientação editada precisa ser deste agente.
create function interno.rascunho_da_simulacao(p_rascunho jsonb, p_agente uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid; v_setor uuid; v_orientacao uuid;
begin
  if p_rascunho is null or jsonb_typeof(p_rascunho) = 'null' then return null; end if;
  if jsonb_typeof(p_rascunho) <> 'object' then raise exception 'Rascunho da orientação inválido.'; end if;
  if exists (select 1 from jsonb_object_keys(p_rascunho) k where k not in ('id', 'titulo', 'texto', 'tipo', 'cliente_id', 'setor_id'))
     or exists (select 1 from jsonb_each(p_rascunho) e where jsonb_typeof(e.value) not in ('string', 'null')) then
    raise exception 'Rascunho da orientação inválido.';
  end if;
  begin
    v_cliente := nullif(p_rascunho->>'cliente_id', '')::uuid;
    v_setor := nullif(p_rascunho->>'setor_id', '')::uuid;
    v_orientacao := nullif(p_rascunho->>'id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Rascunho da orientação inválido.';
  end;
  if v_orientacao is not null and not exists (select 1 from public.orientacoes_agente where id = v_orientacao and agente_id = p_agente) then
    raise exception 'Orientação não encontrada.';
  end if;
  perform interno.validar_orientacao(p_rascunho->>'titulo', p_rascunho->>'texto', p_rascunho->>'tipo', v_cliente, v_setor);
  return jsonb_build_object('id', v_orientacao, 'titulo', btrim(p_rascunho->>'titulo'), 'texto', btrim(p_rascunho->>'texto'),
    'tipo', p_rascunho->>'tipo', 'cliente_id', v_cliente, 'setor_id', v_setor);
end $$;

create function public.criar_simulacao_agente(p_slug text, p_mensagem text, p_cliente_id uuid default null, p_rascunho jsonb default null,
  p_skill uuid default null, p_modo text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; v_rascunho jsonb; v_id uuid;
begin
  if not public.eh_usuario_ativo() then raise exception 'Agente não encontrado.'; end if;
  select * into a from public.agentes where slug = p_slug;
  if not found then raise exception 'Agente não encontrado.'; end if;
  if a.porta_de_entrada then raise exception 'Para o Thiago, use o teste de sempre.'; end if;
  if not ('conversa' = any (a.tipos)) then
    raise exception 'Este agente só faz tarefas: teste pedindo uma tarefa numa demanda de teste, com o agente em Teste.';
  end if;
  if not (public.eh_dono() or public.pode_treinar_agente(a.id)) then raise exception 'Você não tem permissão para testar este agente.'; end if;
  if p_skill is not null then
    if not public.eh_dono() then raise exception 'Só o dono testa skills.'; end if;
    if not exists (select 1 from public.agente_skills where id = p_skill and agente_id = a.id and arquivada_em is null) then
      raise exception 'Skill não encontrada neste agente.';
    end if;
  end if;
  if p_modo is not null and p_modo not in ('por_tras', 'mesma_voz', 'passa_conversa') then raise exception 'Modo inválido.'; end if;
  if p_mensagem is null or length(btrim(p_mensagem)) = 0 then raise exception 'Escreva a mensagem do cliente para o teste.'; end if;
  if length(btrim(p_mensagem)) > 2000 then raise exception 'A mensagem de teste pode ter no máximo 2000 caracteres.'; end if;
  perform interno.validar_empresa(p_cliente_id);
  v_rascunho := interno.rascunho_da_simulacao(p_rascunho, a.id);
  -- Mesmas travas de criar_simulacao: uma pendente por pessoa (o painel reconhece a frase).
  perform pg_advisory_xact_lock(hashtextextended('simulacoes_agente:' || auth.uid()::text, 0));
  if exists (select 1 from public.simulacoes_agente where usuario_id = auth.uid() and status = 'pendente'
             and criado_em > now() - interval '5 minutes') then
    raise exception 'Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.';
  end if;
  insert into public.simulacoes_agente (usuario_id, mensagem, cliente_id, rascunho, skill_id, agente_id, modo)
  values (auth.uid(), btrim(p_mensagem), p_cliente_id, v_rascunho, p_skill, a.id, p_modo)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function interno.rascunho_da_simulacao(jsonb, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.criar_simulacao_agente(text, text, uuid, jsonb, uuid, text) from public, anon, service_role;
grant execute on function public.criar_simulacao_agente(text, text, uuid, jsonb, uuid, text) to authenticated;

-- Mesmas travas de criar_simulacao (20260930000200): uma pendente por pessoa. O texto de "já existe um teste em andamento"
-- segue o de criar_simulacao: o painel o reconhece por ele, então não mude um sem o outro.
create or replace function public.criar_simulacao_skill(p_skill uuid, p_mensagem text, p_cliente_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono testa skills.'; end if;
  if not exists (select 1 from public.agente_skills s join public.agentes a on a.id = s.agente_id
                 where s.id = p_skill and s.arquivada_em is null and a.porta_de_entrada) then
    raise exception 'Nesta etapa só dá para testar skills do Thiago.';
  end if;
  if p_mensagem is null or length(trim(p_mensagem)) = 0 then raise exception 'Escreva a mensagem do cliente para o teste.'; end if;
  if length(trim(p_mensagem)) > 2000 then raise exception 'A mensagem de teste pode ter no máximo 2000 caracteres.'; end if;
  perform interno.validar_empresa(p_cliente_id);
  perform pg_advisory_xact_lock(hashtextextended('simulacoes_agente:' || auth.uid()::text, 0));
  if exists (select 1 from public.simulacoes_agente where usuario_id = auth.uid() and status = 'pendente'
             and criado_em > now() - interval '5 minutes') then
    raise exception 'Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.';
  end if;
  -- I3b (D12, minor da I1): o agente da skill vai junto (hoje é sempre o Thiago; a coluna deixa de depender do padrão).
  insert into public.simulacoes_agente (usuario_id, mensagem, cliente_id, skill_id, agente_id)
  values (auth.uid(), trim(p_mensagem), p_cliente_id, p_skill, (select agente_id from public.agente_skills where id = p_skill))
  returning id into v_id;
  return v_id;
end $$;
-- Só o dono, logado, chama (auth.uid() decide); a chave de serviço não tem usuário e não precisa.
revoke execute on function public.criar_simulacao_skill(uuid, text, uuid) from public, anon, service_role;
grant execute on function public.criar_simulacao_skill(uuid, text, uuid) to authenticated;

-- ---------- Guarda dos arquivos das tarefas (D14): o dono escolhe; o padrão é nunca apagar ----------
create table public.tarefas_guarda (
  id int primary key default 1 check (id = 1),
  dias int check (dias is null or dias in (90, 180, 365, 730)),
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz not null default now()
);
create index tarefas_guarda_atualizado_por_idx on public.tarefas_guarda (atualizado_por);
insert into public.tarefas_guarda (id) values (1);
alter table public.tarefas_guarda enable row level security;
create policy leitura on public.tarefas_guarda for select to authenticated using (public.eh_usuario_ativo());
revoke all on public.tarefas_guarda from anon;
revoke insert, update, delete, truncate on public.tarefas_guarda from authenticated, service_role;

alter table public.agente_tarefa_arquivos add column removido_em timestamptz;
create index agente_tarefa_arquivos_guarda_idx on public.agente_tarefa_arquivos (tarefa_id) where removido_em is null and bucket = 'tarefas';

create function public.salvar_guarda_tarefas(p_dias int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono muda a guarda dos arquivos das tarefas.'; end if;
  if p_dias is not null and p_dias not in (90, 180, 365, 730) then raise exception 'Escolha 90, 180, 365 ou 730 dias, ou nunca apagar.'; end if;
  update public.tarefas_guarda set dias = p_dias, atualizado_por = auth.uid(), atualizado_em = now() where id = 1;
end $$;
revoke execute on function public.salvar_guarda_tarefas(int) from public, anon, service_role;
grant execute on function public.salvar_guarda_tarefas(int) to authenticated;

-- Só objetos do compartimento "tarefas" (enviados e do Drive) de tarefa decidida há mais que o prazo; anexos da conversa nunca.
create function public.arquivos_vencidos_das_tarefas(p_limite int) returns table (id uuid, caminho text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.caminho
    from public.agente_tarefa_arquivos a
    join public.agente_tarefas t on t.id = a.tarefa_id
    cross join public.tarefas_guarda g
   where g.dias is not null and a.bucket = 'tarefas' and a.removido_em is null
     and t.estado in ('aprovada', 'descartada') and t.decidida_em < now() - make_interval(days => g.dias)
   order by t.decidida_em
   limit greatest(1, least(coalesce(p_limite, 100), 500))
$$;

-- F17 (pré-voo): os eventos saem das linhas que este update marcou, não de uma janela de tempo (chamada anterior não conta de novo).
create function public.marcar_arquivos_removidos(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int := 0; r record;
begin
  for r in
    with feitos as (
      update public.agente_tarefa_arquivos set removido_em = now()
       where id = any (coalesce(p_ids, '{}')) and bucket = 'tarefas' and removido_em is null
      returning tarefa_id)
    select tarefa_id, count(*)::int n from feitos group by 1
  loop
    v_n := v_n + r.n;
    perform interno.evento_tarefa(r.tarefa_id, 'sistema', format('apagou %s arquivo(s) pela guarda dos arquivos das tarefas', r.n));
  end loop;
  return v_n;
end $$;
revoke execute on function public.arquivos_vencidos_das_tarefas(int), public.marcar_arquivos_removidos(uuid[]) from public, anon, authenticated;
grant execute on function public.arquivos_vencidos_das_tarefas(int), public.marcar_arquivos_removidos(uuid[]) to service_role;

-- ---------- Sobras da I3a (D15b, D15c) ----------
-- F8 (pré-voo): o corpo de antes, sem a trava do setor; só Pausar e Descartar usam, para dar para parar e fechar a tarefa
-- de um setor desativado (senão ela gastaria até o limite e prenderia a vaga de tarefa ativa da demanda).
create function interno.tarefa_da_pessoa_sem_setor(p_id uuid) returns public.agente_tarefas
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype;
begin
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  select * into t from public.agente_tarefas where id = p_id for update;
  -- Demanda com pedido de nota: só quem vê "Pedidos de nota" acha a tarefa (revisão final; como pode_ver_tarefa).
  if not found or not public.pode_ver_sugestoes_do_chamado(t.chamado_id) then raise exception 'Tarefa não encontrada.'; end if;
  if not (public.eh_admin() or coalesce(t.setor_id in (select public.meus_setores()), false)) then
    raise exception 'Só quem é do setor da demanda mexe na tarefa do agente.';
  end if;
  return t;
end $$;
revoke execute on function interno.tarefa_da_pessoa_sem_setor(uuid) from public, anon, authenticated, service_role;

create or replace function interno.tarefa_da_pessoa(p_id uuid) returns public.agente_tarefas
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype;
begin
  t := interno.tarefa_da_pessoa_sem_setor(p_id);
  -- I3b (D15c, revisão final da I3a): setor desativado trava todas as ações, não só a criação (F10).
  if exists (select 1 from public.setores s where s.id = t.setor_id and not s.ativo) then
    raise exception 'O setor desta demanda está desativado: não dá para mexer na tarefa.';
  end if;
  return t;
end $$;

-- F8: Pausar e Descartar continuam com o setor desativado (mesmas assinaturas e corpos; só o ajudante muda).
create or replace function public.pausar_tarefa(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype;
begin
  -- F2: a trava de pessoa ativa vem antes de tudo (teste 25 #34).
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  t := interno.tarefa_da_pessoa_sem_setor(p_id);
  if t.estado not in ('trabalhando', 'aguardando_pendencias') then
    raise exception 'Só dá para pausar enquanto o agente trabalha ou espera pendências.';
  end if;
  update public.agente_tarefas set estado = 'pausada', motivo_pausa = 'pessoa', atualizado_em = now() where id = p_id;
  perform interno.evento_tarefa(p_id, 'pessoa', 'pausou a tarefa');
end $$;

create or replace function public.descartar_tarefa(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype;
begin
  -- F2: a trava de pessoa ativa vem antes de tudo (teste 25 #34).
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  t := interno.tarefa_da_pessoa_sem_setor(p_id);
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  update public.agente_tarefas set estado = 'descartada', motivo_pausa = null, decidida_por = auth.uid(), decidida_em = now(), atualizado_em = now()
   where id = p_id;
  perform interno.evento_tarefa(p_id, 'pessoa', 'descartou o rascunho');
end $$;

create or replace function interno.retomar_se_respondida(p_tarefa uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_provisorias int;
begin
  if exists (select 1 from public.agente_pendencias where tarefa_id = p_tarefa and estado = 'aberta') then return false; end if;
  update public.agente_tarefas set estado = 'trabalhando', atualizado_em = now() where id = p_tarefa and estado = 'aguardando_pendencias';
  if not found then return false; end if;
  perform interno.evento_tarefa(p_tarefa, 'sistema', 'retomou a tarefa: as pendências foram respondidas');
  -- I3b (D15b, revisão final da I3a): o rascunho com linha provisória precisa ser refeito com as respostas antes de ficar pronto.
  select count(*) into v_provisorias
    from public.agente_tarefas t, jsonb_array_elements(coalesce(t.resultado -> 'linhas', '[]'::jsonb)) l
   where t.id = p_tarefa and coalesce((l ->> 'provisoria')::boolean, false);
  if v_provisorias > 0 then
    -- F17 (pré-voo): o teto de 20 ajustes vale aqui também; cheio, só marca o ajuste pendente e o evento.
    update public.agente_tarefas set ajuste_pendente = true,
           ajustes = case when jsonb_array_length(ajustes) >= 20 then ajustes
                          else ajustes || jsonb_build_array(jsonb_build_object(
                            'texto', 'Refaça as linhas provisórias com as respostas das pendências e entregue de novo.', 'por', null, 'em', now())) end
     where id = p_tarefa;
    perform interno.evento_tarefa(p_tarefa, 'sistema', format('pediu ao agente para refazer %s linha(s) provisória(s)', v_provisorias));
  end if;
  return true;
end $$;
