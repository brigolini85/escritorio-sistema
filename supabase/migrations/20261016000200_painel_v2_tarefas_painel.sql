-- supabase/migrations/20261016000200_painel_v2_tarefas_painel.sql
-- Painel v2, Parte I3a (spec 7E.4; D3, D7, D8, D11, D13, D14, D20): o que uma pessoa do setor faz na tarefa do agente.
-- Toda ação confere a pessoa (ativa, vê a demanda, é do setor da tarefa ou administrador). As frases vão direto para a tela.
-- Rulings do pré-voo: F2 (trava de pessoa ativa no começo de cada gravação; teste 25 #34), F3 (anexo só de conversa que a
-- pessoa vê), F10 (setor inativo não recebe tarefa), F21 (teto de 30 pedidos a clientes por dia no escritório), F25 (ajuste
-- numa pausa por limite soma o limite como CONTINUAR). Pedido de nota: só quem vê "Pedidos de nota" pede tarefa (ruling da Task 2).

-- ---------- Ajudantes (internos) ----------
create function interno.tarefa_da_pessoa(p_id uuid) returns public.agente_tarefas
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype;
begin
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  select * into t from public.agente_tarefas where id = p_id for update;
  if not found or not public.pode_ver_chamado(t.chamado_id) then raise exception 'Tarefa não encontrada.'; end if;
  if not (public.eh_admin() or coalesce(t.setor_id in (select public.meus_setores()), false)) then
    raise exception 'Só quem é do setor da demanda mexe na tarefa do agente.';
  end if;
  return t;
end $$;

create function interno.evento_tarefa(p_tarefa uuid, p_quem text, p_texto text) returns void
language sql security definer set search_path = '' as $$
  insert into public.agente_tarefa_eventos (tarefa_id, quem, usuario_id, texto)
  values (p_tarefa, p_quem, case when p_quem = 'pessoa' then auth.uid() end, left(p_texto, 500))
$$;

-- D8: a última pendência respondida volta a tarefa ao trabalho; true = o painel enfileira.
create function interno.retomar_se_respondida(p_tarefa uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.agente_pendencias where tarefa_id = p_tarefa and estado = 'aberta') then return false; end if;
  update public.agente_tarefas set estado = 'trabalhando', atualizado_em = now() where id = p_tarefa and estado = 'aguardando_pendencias';
  if not found then return false; end if;
  perform interno.evento_tarefa(p_tarefa, 'sistema', 'retomou a tarefa: as pendências foram respondidas');
  return true;
end $$;

-- D14: a mesma lista do core (EXTENSOES_TAREFA).
create function interno.extensao_aceita(p_nome text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(lower(p_nome) ~ '\.(pdf|xml|csv|txt|ofx|jpe?g|png)$', false)
$$;

-- Nome repetido na tarefa ganha " (2)" antes da extensão.
create function interno.nome_livre_na_tarefa(p_tarefa uuid, p_nome text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_base text := left(btrim(coalesce(p_nome, '')), 180); v text; n int := 2;
begin
  if v_base = '' then v_base := 'arquivo'; end if;
  v := v_base;
  while exists (select 1 from public.agente_tarefa_arquivos where tarefa_id = p_tarefa and lower(nome) = lower(v)) loop
    v := regexp_replace(v_base, '(\.[A-Za-z0-9]{1,5})?$', format(' (%s)\1', n));
    n := n + 1;
  end loop;
  return v;
end $$;

-- D7: anexo que o cliente mandou (últimos 30 dias), numa conversa de um contato desta empresa; referência, sem cópia.
-- F3: só de conversa que a pessoa vê (a rota de download assina com service_role e passaria por cima de anexos_leitura).
create function interno.anexar_da_conversa(p_tarefa uuid, p_mensagem uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype; m record; v_id uuid;
begin
  select * into t from public.agente_tarefas where id = p_tarefa;
  select x.id, x.arquivo_path, x.arquivo_nome, x.arquivo_mime into m
    from public.mensagens x join public.conversas cv on cv.id = x.conversa_id
   where x.id = p_mensagem and x.direcao = 'entrada' and x.arquivo_path is not null and x.criado_em > now() - interval '30 days'
     and public.pode_ver_conversa(cv.id)
     and (x.cliente_id = t.cliente_id or exists (select 1 from public.contatos ct join public.contato_clientes cc on cc.contato_id = ct.id
                                                   where ct.telefone = cv.telefone and cc.cliente_id = t.cliente_id));
  if not found then raise exception 'Arquivo da conversa não encontrado para esta empresa.'; end if;
  if not interno.extensao_aceita(m.arquivo_nome) then raise exception 'O agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.'; end if;
  select id into v_id from public.agente_tarefa_arquivos where tarefa_id = p_tarefa and mensagem_id = p_mensagem;
  if found then return v_id; end if;
  if (select count(*) from public.agente_tarefa_arquivos where tarefa_id = p_tarefa) >= 30 then raise exception 'No máximo 30 arquivos por tarefa.'; end if;
  insert into public.agente_tarefa_arquivos (tarefa_id, origem, bucket, caminho, nome, mime, tamanho, enviado_por, mensagem_id)
  values (p_tarefa, 'conversa', 'anexos', m.arquivo_path, interno.nome_livre_na_tarefa(p_tarefa, m.arquivo_nome),
          coalesce(m.arquivo_mime, 'application/octet-stream'), 0, auth.uid(), p_mensagem)
  returning id into v_id;
  return v_id;
end $$;

-- O agente ainda faz tarefas com quem está pedindo (D3).
create function interno.exigir_agente_de_trabalho(p_agente uuid) returns public.agentes
language plpgsql stable security definer set search_path = '' as $$
declare a public.agentes%rowtype;
begin
  select * into a from public.agentes where id = p_agente;
  if not found or a.estado = 'desligado' or not ('trabalho' = any (a.tipos)) then raise exception 'O agente está desligado.'; end if;
  if a.estado = 'teste' and not (public.eh_admin() or public.eh_dono()) then
    raise exception 'O agente está em teste: só o dono e o administrador pedem tarefas.';
  end if;
  return a;
end $$;
revoke execute on function interno.tarefa_da_pessoa(uuid), interno.evento_tarefa(uuid, text, text), interno.retomar_se_respondida(uuid),
  interno.extensao_aceita(text), interno.nome_livre_na_tarefa(uuid, text), interno.anexar_da_conversa(uuid, uuid),
  interno.exigir_agente_de_trabalho(uuid) from public, anon, authenticated, service_role;

-- ---------- Leituras da criação (a RLS de agentes esconde o agente da pessoa do setor) ----------
create function public.agentes_de_trabalho_da_demanda(p_chamado uuid)
returns table (id uuid, nome text, estado text, pode_pedir boolean, procedimentos jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare c public.chamados%rowtype;
begin
  if not public.eh_usuario_ativo() then return; end if;
  select * into c from public.chamados ch where ch.id = p_chamado;
  if not found or c.setor_id is null or c.status = 'concluido' or not public.pode_ver_chamado(p_chamado) then return; end if;
  if not (public.eh_admin() or c.setor_id in (select public.meus_setores())) then return; end if;
  -- Demanda com pedido de nota: só quem vê "Pedidos de nota" (criar_tarefa_agente recusa os outros).
  if c.pedido_venda is not null and not public.tem_permissao('notas', 'ver') then return; end if;
  return query
    select a.id, a.nome, a.estado,
           a.estado = 'ligado' or (a.estado = 'teste' and (public.eh_admin() or public.eh_dono())),
           coalesce((select jsonb_agg(jsonb_build_object('nome', s.nome, 'titulo', s.titulo, 'descricao', s.descricao) order by s.nome)
                       from public.skills_do_agente(a.id) s where s.tipo = 'procedimento'), '[]'::jsonb)
      from public.agentes a
      -- F10: setor inativo, o agente não atende.
      join public.setores st on st.id = a.setor_id and st.ativo
     where a.setor_id = c.setor_id and not a.porta_de_entrada and 'trabalho' = any (a.tipos) and a.estado <> 'desligado'
     order by a.ordem, a.nome;
end $$;

-- ---------- Criar (D3) ----------
create function public.criar_tarefa_agente(p_chamado uuid, p_agente uuid, p_pedido text, p_skill text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.chamados%rowtype; a public.agentes%rowtype; v_id uuid;
begin
  if not public.eh_usuario_ativo() then raise exception 'Demanda não encontrada.'; end if;
  select * into c from public.chamados where id = p_chamado for update;
  if not found or not public.pode_ver_chamado(p_chamado) then raise exception 'Demanda não encontrada.'; end if;
  if c.setor_id is null or not (public.eh_admin() or c.setor_id in (select public.meus_setores())) then
    raise exception 'Só quem é do setor da demanda pede tarefa ao agente.';
  end if;
  if c.status = 'concluido' then raise exception 'A demanda já foi concluída.'; end if;
  -- Ruling da Task 2: demanda com pedido de nota segue "Pedidos de nota" (a regra completa vem na I6).
  if c.pedido_venda is not null and not public.tem_permissao('notas', 'ver') then
    raise exception 'Só quem vê os pedidos de nota pede tarefa nesta demanda.';
  end if;
  select * into a from public.agentes where id = p_agente;
  -- F10: setor inativo, o agente não atende.
  if not found or a.porta_de_entrada or not ('trabalho' = any (a.tipos)) or a.setor_id is distinct from c.setor_id
     or not exists (select 1 from public.setores st where st.id = a.setor_id and st.ativo) then
    raise exception 'Este agente não faz tarefas deste setor.';
  end if;
  perform interno.exigir_agente_de_trabalho(p_agente);
  if p_pedido is null or char_length(btrim(p_pedido)) not between 3 and 2000 then
    raise exception 'Escreva o que o agente deve fazer (até 2.000 letras).';
  end if;
  if p_skill is not null and not exists (select 1 from public.skills_do_agente(a.id) s where s.nome = p_skill and s.tipo = 'procedimento') then
    raise exception 'Procedimento não encontrado neste agente.';
  end if;
  if exists (select 1 from public.agente_tarefas where chamado_id = p_chamado and estado not in ('aprovada', 'descartada')) then
    raise exception 'Esta demanda já tem uma tarefa do agente em andamento.';
  end if;
  insert into public.agente_tarefas (agente_id, chamado_id, cliente_id, setor_id, pedida_por, canal, pedido, skill_nome, limite_usd, limite_minutos)
  values (a.id, c.id, c.cliente_id, c.setor_id, auth.uid(), 'painel', btrim(p_pedido), p_skill, a.tarefa_limite_usd, a.tarefa_limite_minutos)
  returning id into v_id;
  perform interno.evento_tarefa(v_id, 'pessoa', 'pediu a tarefa pelo painel');
  return v_id;
end $$;

-- ---------- Pausar e continuar (D4, D13) ----------
create function public.pausar_tarefa(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype;
begin
  -- F2: a trava de pessoa ativa vem antes de tudo (teste 25 #34).
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  t := interno.tarefa_da_pessoa(p_id);
  if t.estado not in ('trabalhando', 'aguardando_pendencias') then
    raise exception 'Só dá para pausar enquanto o agente trabalha ou espera pendências.';
  end if;
  update public.agente_tarefas set estado = 'pausada', motivo_pausa = 'pessoa', atualizado_em = now() where id = p_id;
  perform interno.evento_tarefa(p_id, 'pessoa', 'pausou a tarefa');
end $$;

create function public.continuar_tarefa(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype; a public.agentes%rowtype; v_custo boolean; v_tempo boolean;
begin
  -- F2: a trava de pessoa ativa vem antes de tudo (teste 25 #34).
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  t := interno.tarefa_da_pessoa(p_id);
  if t.estado <> 'pausada' then raise exception 'A tarefa não está pausada.'; end if;
  a := interno.exigir_agente_de_trabalho(t.agente_id);
  v_custo := t.custo_usd >= t.limite_usd;
  v_tempo := t.segundos_trabalhando >= t.limite_minutos * 60;
  update public.agente_tarefas set estado = 'trabalhando', motivo_pausa = null, atualizado_em = now(),
         limite_usd = case when v_custo then t.limite_usd + a.tarefa_limite_usd else t.limite_usd end,
         limite_minutos = case when v_tempo then t.limite_minutos + a.tarefa_limite_minutos else t.limite_minutos end
   where id = p_id;
  perform interno.evento_tarefa(p_id, 'pessoa', case when v_custo or v_tempo
    then format('continuou a tarefa com mais US$ %s e %s minutos',
                replace(to_char(case when v_custo then a.tarefa_limite_usd else 0 end, 'FM990.00'), '.', ','),
                case when v_tempo then a.tarefa_limite_minutos else 0 end)
    else 'continuou a tarefa' end);
  return true;
end $$;

-- ---------- Pendências (D7, D8) ----------
create function public.responder_pendencia(p_id uuid, p_resposta text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare p public.agente_pendencias%rowtype; t public.agente_tarefas%rowtype;
begin
  -- F2: a trava de pessoa ativa vem antes de tudo (teste 25 #34).
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  select * into p from public.agente_pendencias where id = p_id;
  if not found then raise exception 'Pendência não encontrada.'; end if;
  t := interno.tarefa_da_pessoa(p.tarefa_id);
  select * into p from public.agente_pendencias where id = p_id for update;
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  if p.tipo <> 'analista' then raise exception 'Pendência do cliente: use "Já recebi".'; end if;
  if p.estado <> 'aberta' then raise exception 'Esta pendência já foi respondida.'; end if;
  if p_resposta is null or char_length(btrim(p_resposta)) not between 1 and 2000 then raise exception 'Escreva a resposta (até 2.000 letras).'; end if;
  update public.agente_pendencias set estado = 'respondida', resposta = btrim(p_resposta), respondida_por = auth.uid(), respondida_em = now()
   where id = p_id;
  perform interno.evento_tarefa(t.id, 'pessoa', format('respondeu a pendência %s', p.numero));
  return interno.retomar_se_respondida(t.id);
end $$;

create function public.receber_pendencia(p_id uuid, p_observacao text, p_arquivo uuid default null, p_mensagem uuid default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare p public.agente_pendencias%rowtype; t public.agente_tarefas%rowtype; v_arquivo uuid := p_arquivo; v_nome text;
begin
  -- F2: a trava de pessoa ativa vem antes de tudo (teste 25 #34).
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  select * into p from public.agente_pendencias where id = p_id;
  if not found then raise exception 'Pendência não encontrada.'; end if;
  t := interno.tarefa_da_pessoa(p.tarefa_id);
  select * into p from public.agente_pendencias where id = p_id for update;
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  if p.tipo <> 'cliente' then raise exception 'Pendência para o analista: responda com o texto.'; end if;
  if p.estado <> 'aberta' then raise exception 'Esta pendência já foi respondida.'; end if;
  if p_arquivo is not null and p_mensagem is not null then raise exception 'Escolha um arquivo só.'; end if;
  if char_length(coalesce(p_observacao, '')) > 2000 then raise exception 'A observação tem até 2.000 letras.'; end if;
  if p_mensagem is not null then v_arquivo := interno.anexar_da_conversa(t.id, p_mensagem); end if;
  if v_arquivo is not null then
    select nome into v_nome from public.agente_tarefa_arquivos where id = v_arquivo and tarefa_id = t.id;
    if not found then raise exception 'Arquivo não encontrado nesta tarefa.'; end if;
  end if;
  update public.agente_pendencias set estado = 'respondida', respondida_por = auth.uid(), respondida_em = now(), arquivo_id = v_arquivo,
         resposta = coalesce(nullif(concat_ws(' · ', nullif(btrim(p_observacao), ''), 'arquivo: ' || v_nome), ''), 'Recebido.')
   where id = p_id;
  perform interno.evento_tarefa(t.id, 'pessoa', format('marcou a pendência %s como recebida', p.numero));
  return interno.retomar_se_respondida(t.id);
end $$;

create function public.contatos_para_pendencia(p_id uuid) returns table (contato_id uuid, nome text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare p public.agente_pendencias%rowtype; t public.agente_tarefas%rowtype;
begin
  select * into p from public.agente_pendencias x where x.id = p_id;
  if not found or p.tipo <> 'cliente' then return; end if;
  t := interno.tarefa_da_pessoa(p.tarefa_id);
  if t.cliente_id is null or t.setor_id is null then return; end if;
  return query select c.contato_id, c.nome from public.contatos_procuraveis(t.cliente_id, t.setor_id) c;
end $$;

create function public.arquivos_da_conversa_para_pendencia(p_id uuid)
returns table (mensagem_id uuid, nome text, mime text, criado_em timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare p public.agente_pendencias%rowtype; t public.agente_tarefas%rowtype;
begin
  select * into p from public.agente_pendencias x where x.id = p_id;
  if not found then return; end if;
  t := interno.tarefa_da_pessoa(p.tarefa_id);
  return query
    select m.id, coalesce(m.arquivo_nome, 'arquivo'), coalesce(m.arquivo_mime, 'application/octet-stream'), m.criado_em
      from public.mensagens m join public.conversas cv on cv.id = m.conversa_id
     where m.direcao = 'entrada' and m.arquivo_path is not null and m.criado_em > now() - interval '30 days'
       and interno.extensao_aceita(m.arquivo_nome)
       -- F3: só conversa que a pessoa vê.
       and public.pode_ver_conversa(cv.id)
       and (m.cliente_id = t.cliente_id or exists (select 1 from public.contatos ct join public.contato_clientes cc on cc.contato_id = ct.id
                                                     where ct.telefone = cv.telefone and cc.cliente_id = t.cliente_id))
     order by m.criado_em desc limit 30;
end $$;

-- D7: a pessoa aprova a mensagem e o contato; o trabalhador manda (fila pendencia_cliente). Devolve a vez do pedido.
create function public.pedir_pendencia_ao_cliente(p_id uuid, p_contato uuid, p_texto text) returns int
language plpgsql security definer set search_path = '' as $$
declare p public.agente_pendencias%rowtype; t public.agente_tarefas%rowtype;
begin
  -- F2: a trava de pessoa ativa vem antes de tudo (teste 25 #34).
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  select * into p from public.agente_pendencias where id = p_id;
  if not found then raise exception 'Pendência não encontrada.'; end if;
  t := interno.tarefa_da_pessoa(p.tarefa_id);
  select * into p from public.agente_pendencias where id = p_id for update;
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  if p.tipo <> 'cliente' then raise exception 'Só pendência do cliente vai ao cliente.'; end if;
  if p.estado <> 'aberta' then raise exception 'Esta pendência já foi respondida.'; end if;
  if t.cliente_id is null or t.setor_id is null then raise exception 'A demanda não tem empresa: fale com o cliente pela conversa.'; end if;
  if p_contato is null or not exists (select 1 from public.contatos_procuraveis(t.cliente_id, t.setor_id) c where c.contato_id = p_contato) then
    raise exception 'Este contato não pode ser procurado pelo agente deste setor.';
  end if;
  if p_texto is null or char_length(btrim(p_texto)) not between 3 and 1000 then raise exception 'Escreva a mensagem (até 1.000 letras).'; end if;
  if p.pedido_em is not null and p.pedido_em > now() - interval '24 hours' then
    raise exception 'Já foi pedido há menos de 24 horas. Cobre de novo amanhã.';
  end if;
  if p.pedidos >= 5 then raise exception 'Esta pendência já foi pedida 5 vezes. Fale com o cliente pela conversa.'; end if;
  -- 7E.8: volume de mensagens ativas por contato e no escritório (Z-API; F21). Cada pendência é pedida no máximo uma vez
  -- a cada 24 h, então contar as pendências com pedido_em nas últimas 24 h conta exatamente os pedidos do período.
  perform pg_advisory_xact_lock(hashtextextended('pedido_cliente:escritorio', 0));
  if (select count(*) from public.agente_pendencias where contato_id = p_contato and pedido_em > now() - interval '1 day') >= 3 then
    raise exception 'Este contato já recebeu 3 pedidos hoje. Tente amanhã.';
  end if;
  if (select count(*) from public.agente_pendencias where pedido_em > now() - interval '1 day') >= 30 then
    raise exception 'O escritório já fez 30 pedidos a clientes hoje. Tente amanhã.';
  end if;
  update public.agente_pendencias set contato_id = p_contato, pedido_texto = btrim(p_texto), pedido_por = auth.uid(), pedido_em = now(),
         pedidos = p.pedidos + 1, pedido_enviado_em = null, mensagem_id = null
   where id = p_id;
  perform interno.evento_tarefa(t.id, 'pessoa', case when p.pedidos = 0
    then format('pediu ao cliente a pendência %s', p.numero) else format('cobrou de novo a pendência %s', p.numero) end);
  return p.pedidos + 1;
end $$;

-- ---------- Arquivo enviado pelo painel (D14) ----------
create function public.registrar_arquivo_tarefa(p_tarefa uuid, p_caminho text, p_nome text, p_mime text, p_tamanho int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype; v_id uuid; v_nome text;
begin
  -- F2: a trava de pessoa ativa vem antes de tudo (teste 25 #34).
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  t := interno.tarefa_da_pessoa(p_tarefa);
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  if p_caminho is null or public.tarefa_do_caminho(p_caminho) is distinct from t.id
     or not exists (select 1 from storage.objects where bucket_id = 'tarefas' and name = p_caminho) then
    raise exception 'Arquivo não encontrado no envio.';
  end if;
  if exists (select 1 from public.agente_tarefa_arquivos where tarefa_id = t.id and bucket = 'tarefas' and caminho = p_caminho) then
    raise exception 'Este arquivo já está na tarefa.';
  end if;
  if not interno.extensao_aceita(p_nome) then raise exception 'O agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.'; end if;
  if p_tamanho is null or p_tamanho < 1 then raise exception 'O arquivo está vazio.'; end if;
  if p_tamanho > 10485760 then raise exception 'O arquivo passa de 10 MB.'; end if;
  if (select count(*) from public.agente_tarefa_arquivos where tarefa_id = t.id) >= 30 then raise exception 'No máximo 30 arquivos por tarefa.'; end if;
  v_nome := interno.nome_livre_na_tarefa(t.id, p_nome);
  insert into public.agente_tarefa_arquivos (tarefa_id, origem, bucket, caminho, nome, mime, tamanho, enviado_por)
  values (t.id, 'enviado', 'tarefas', p_caminho, v_nome, left(coalesce(nullif(p_mime, ''), 'application/octet-stream'), 120), p_tamanho, auth.uid())
  returning id into v_id;
  perform interno.evento_tarefa(t.id, 'pessoa', format('enviou o arquivo %s', v_nome));
  return v_id;
end $$;

-- ---------- Aprovar, pedir ajuste, descartar (D11) ----------
create function public.aprovar_tarefa(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype; v_agente text; v_pessoa text; v_n int;
begin
  -- F2: a trava de pessoa ativa vem antes de tudo (teste 25 #34).
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  t := interno.tarefa_da_pessoa(p_id);
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  -- Antes do estado: com pendência aberta a frase é esta (spec 7E.4, "travado enquanto houver pendência").
  if exists (select 1 from public.agente_pendencias where tarefa_id = p_id and estado = 'aberta') then
    raise exception 'Responda as pendências antes de aprovar.';
  end if;
  if t.estado <> 'pronta' or t.resultado is null then raise exception 'A tarefa ainda não está pronta para aprovar.'; end if;
  v_n := jsonb_array_length(t.etapas);
  update public.agente_tarefas set estado = 'aprovada', decidida_por = auth.uid(), decidida_em = now(), atualizado_em = now(),
         etapa_atual = greatest(1, v_n),
         etapas = case when v_n > 0 then jsonb_set(etapas, array[(v_n - 1)::text], (etapas -> (v_n - 1)) || '{"concluida": true}'::jsonb) else etapas end
   where id = p_id;
  perform interno.evento_tarefa(p_id, 'pessoa', 'aprovou o resultado');
  select nome into v_agente from public.agentes where id = t.agente_id;
  select nome into v_pessoa from public.usuarios where id = auth.uid();
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
  values (t.chamado_id, t.cliente_id, 'nota_interna', auth.uid(),
          left(format('Resultado da tarefa do %s, aprovado por %s: %s', v_agente, v_pessoa, t.resultado ->> 'resumo'), 4000));
  if (select status from public.chamados where id = t.chamado_id) <> 'concluido' then perform public.concluir_chamado(t.chamado_id); end if;
end $$;

create function public.pedir_ajuste_tarefa(p_id uuid, p_texto text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype; a public.agentes%rowtype; v_custo boolean := false; v_tempo boolean := false;
begin
  -- F2: a trava de pessoa ativa vem antes de tudo (teste 25 #34).
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  t := interno.tarefa_da_pessoa(p_id);
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  if t.estado = 'trabalhando' then raise exception 'O agente está trabalhando: peça o ajuste quando ele parar.'; end if;
  a := interno.exigir_agente_de_trabalho(t.agente_id);
  if p_texto is null or char_length(btrim(p_texto)) not between 3 and 1000 then raise exception 'Escreva o ajuste (até 1.000 letras).'; end if;
  if jsonb_array_length(t.ajustes) >= 20 then raise exception 'No máximo 20 ajustes por tarefa.'; end if;
  -- F25: saindo de uma pausa com o limite estourado, soma uma vez o limite do agente, como CONTINUAR (senão pausaria de novo na hora).
  if t.estado = 'pausada' then
    v_custo := t.custo_usd >= t.limite_usd;
    v_tempo := t.segundos_trabalhando >= t.limite_minutos * 60;
  end if;
  update public.agente_tarefas set estado = 'trabalhando', motivo_pausa = null, ajuste_pendente = true, atualizado_em = now(),
         limite_usd = case when v_custo then t.limite_usd + a.tarefa_limite_usd else t.limite_usd end,
         limite_minutos = case when v_tempo then t.limite_minutos + a.tarefa_limite_minutos else t.limite_minutos end,
         ajustes = ajustes || jsonb_build_array(jsonb_build_object('texto', btrim(p_texto),
                     'por', (select nome from public.usuarios where id = auth.uid()), 'em', now()))
   where id = p_id;
  perform interno.evento_tarefa(p_id, 'pessoa', format('pediu ajuste: %s', left(btrim(p_texto), 200)));
  if v_custo or v_tempo then
    perform interno.evento_tarefa(p_id, 'pessoa', format('somou ao limite mais US$ %s e %s minutos',
      replace(to_char(case when v_custo then a.tarefa_limite_usd else 0 end, 'FM990.00'), '.', ','),
      case when v_tempo then a.tarefa_limite_minutos else 0 end));
  end if;
  return true;
end $$;

create function public.descartar_tarefa(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype;
begin
  -- F2: a trava de pessoa ativa vem antes de tudo (teste 25 #34).
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  t := interno.tarefa_da_pessoa(p_id);
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  update public.agente_tarefas set estado = 'descartada', motivo_pausa = null, decidida_por = auth.uid(), decidida_em = now(), atualizado_em = now()
   where id = p_id;
  perform interno.evento_tarefa(p_id, 'pessoa', 'descartou o rascunho');
end $$;

-- ---------- Limites das tarefas: só o dono (D13) ----------
create function public.salvar_limites_tarefa(p_slug text, p_usd numeric, p_minutos int) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype;
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera os limites das tarefas.'; end if;
  select * into a from public.agentes where slug = p_slug for update;
  if not found then raise exception 'Agente não encontrado.'; end if;
  if not ('trabalho' = any (a.tipos)) then raise exception 'Só agentes do tipo Trabalho têm limites de tarefa.'; end if;
  if p_usd is null or p_usd < 0.10 or p_usd > 50 then raise exception 'O limite de custo vai de US$ 0,10 a US$ 50,00.'; end if;
  if p_minutos is null or p_minutos < 1 or p_minutos > 240 then raise exception 'O limite de tempo vai de 1 a 240 minutos.'; end if;
  if a.tarefa_limite_usd = round(p_usd, 2) and a.tarefa_limite_minutos = p_minutos then return; end if;
  update public.agentes set tarefa_limite_usd = round(p_usd, 2), tarefa_limite_minutos = p_minutos, atualizado_em = now(), atualizado_por = auth.uid()
   where id = a.id;
  perform public.mudanca_agente(a.id, format('Limites das tarefas: US$ %s e %s minutos', replace(to_char(round(p_usd, 2), 'FM990.00'), '.', ','), p_minutos));
end $$;

revoke execute on function public.agentes_de_trabalho_da_demanda(uuid), public.criar_tarefa_agente(uuid, uuid, text, text),
  public.pausar_tarefa(uuid), public.continuar_tarefa(uuid), public.responder_pendencia(uuid, text),
  public.receber_pendencia(uuid, text, uuid, uuid), public.contatos_para_pendencia(uuid), public.arquivos_da_conversa_para_pendencia(uuid),
  public.pedir_pendencia_ao_cliente(uuid, uuid, text), public.registrar_arquivo_tarefa(uuid, text, text, text, int),
  public.aprovar_tarefa(uuid), public.pedir_ajuste_tarefa(uuid, text), public.descartar_tarefa(uuid), public.salvar_limites_tarefa(text, numeric, int)
  from public, anon, service_role;
grant execute on function public.agentes_de_trabalho_da_demanda(uuid), public.criar_tarefa_agente(uuid, uuid, text, text),
  public.pausar_tarefa(uuid), public.continuar_tarefa(uuid), public.responder_pendencia(uuid, text),
  public.receber_pendencia(uuid, text, uuid, uuid), public.contatos_para_pendencia(uuid), public.arquivos_da_conversa_para_pendencia(uuid),
  public.pedir_pendencia_ao_cliente(uuid, uuid, text), public.registrar_arquivo_tarefa(uuid, text, text, text, int),
  public.aprovar_tarefa(uuid), public.pedir_ajuste_tarefa(uuid, text), public.descartar_tarefa(uuid), public.salvar_limites_tarefa(text, numeric, int)
  to authenticated;
