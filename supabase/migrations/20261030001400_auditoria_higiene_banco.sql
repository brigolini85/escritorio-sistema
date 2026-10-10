-- Auditoria 6.11, 6.12, 6.14 e 2.9: higiene do banco.
--   * 6.12: funções security definer antigas que o visitante (anon) ainda executava, conferidas no banco depois das
--     migrações 0100–1300 desta fase (as que elas já recriaram ficaram de fora). Todas recusavam ou não faziam nada sem
--     auth.uid(); o revoke fecha a porta de vez. A equipe (authenticated) mantém o grant que tinha:
--       eh_usuario_ativo, eh_admin, meus_setores, tem_permissao, pode_ver_chamado, pode_ver_conversa, marcar_alerta_lido,
--       assumir_conversa, devolver_ao_agente, registrar_resposta, nota_interna, transferir_chamado, concluir_chamado,
--       anonimizar_contato, definir_preco, vincular_contato_conversa;
--     e os gatilhos (o gatilho dispara sem conferir EXECUTE; ninguém precisa chamá-los): registrar_auditoria,
--       configuracoes_so_admin, usuario_permissoes_espelhar, usuarios_niveis_depois_inserir,
--       usuarios_permissoes_antes_alterar, orientacoes_do_agente_certo.
--     Fica executável pelo visitante só aviso_login (tela de entrar) e as funções puras sem security definer (validação
--     de cargos, horário, endereço, níveis), que não leem tabela.
--   * 6.12: as 14 funções que ainda tinham search_path = public são recriadas com search_path = '' e nomes qualificados,
--     com o corpo igual ao de hoje: alternar_orientacao, assumir_conversa, concluir_chamado, criar_simulacao,
--     custo_ia_periodo, definir_preco, devolver_ao_agente, nota_interna, registrar_auditoria, registrar_resposta,
--     restaurar_orientacao, salvar_orientacao, transferir_chamado, vincular_contato_conversa.
--   * 6.12: eh_telefone_do_assistente responde falso a quem tem sessão e não é da equipe ativa (não serve de oráculo dos
--     telefones da equipe). Sem sessão (trabalhador, views do próprio banco) e para a equipe, igual a antes. O revoke de
--     authenticated sugerido no achado não dá: as views do Atendimento chamam a função com a sessão da pessoa.
--   * 6.14: o visitante perde todo grant em tabela, view e sequência do public (a RLS já negava; uma política permissiva
--     criada por engano não abre mais nada), também nas que forem criadas depois por postgres.
--   * 6.11: índices das leituras do painel (eventos da demanda, decisões da conversa) e da retenção (por data).
--   * 2.9: papel painel_fila, sem login (o dono cria a senha e liga o login; guia da Task 20), só com o que o
--     send do pg-boss 10 usa: usage no esquema pgboss, select em pgboss.version (conferência da versão na partida),
--     select em pgboss.queue (o insert junta a fila) e insert em pgboss.job com select só da coluna id (returning id).
--     O pg-boss cria o esquema na primeira partida do trabalhador; conceder_fila_painel() aplica os grants quando ele
--     existe, e o trabalhador a chama depois de subir a fila.

-- ===== 6.12: search_path vazio e nomes qualificados (corpos iguais aos de hoje) =====

create or replace function public.alternar_orientacao(p_id uuid, p_ativo boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare o public.orientacoes_agente%rowtype;
begin
  perform public.exigir_segundo_fator();
  if not public.tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
  if p_ativo is null then raise exception 'Informe se a orientação fica ligada ou desligada.'; end if;
  select * into o from public.orientacoes_agente where id = p_id for update;
  if o.id is null then raise exception 'Orientação não encontrada.'; end if;
  if o.ativo = p_ativo then return o.ativo; end if;
  if p_ativo then perform interno.validar_orientacao(o.titulo, o.texto, o.tipo, o.cliente_id, o.setor_id); end if;
  update public.orientacoes_agente set ativo = p_ativo, atualizado_por = auth.uid(), atualizado_em = now() where id = p_id;
  perform interno.gravar_versao_orientacao(p_id, case when p_ativo then 'ligar' else 'desligar' end);
  return p_ativo;
end $$;

create or replace function public.assumir_conversa(p_conversa uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_mudou int;
begin
  if not public.pode_ver_conversa(p_conversa) then raise exception 'sem acesso a esta conversa'; end if;
  update public.conversas set estado = 'humano', atendente_id = auth.uid(), aguardando_pessoa_desde = null, motivo_pessoa = null,
         concluida_em = null, atualizado_em = now()
   where id = p_conversa and (estado <> 'humano' or atendente_id is distinct from auth.uid());
  get diagnostics v_mudou = row_count;
  if v_mudou > 0 then
    insert into public.conversa_eventos (conversa_id, tipo, usuario_id) values (p_conversa, 'assumida', auth.uid());
  end if;
  with alterados as (
    update public.chamados set responsavel_id = auth.uid(), status = 'em_andamento', atualizado_em = now()
    where conversa_id = p_conversa and status <> 'concluido' and responsavel_id is null
      and (public.eh_admin() or setor_id in (select public.meus_setores()))
    returning id, cliente_id
  )
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id)
  select id, cliente_id, 'assumido', auth.uid() from alterados;
end $$;

create or replace function public.concluir_chamado(p_chamado uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_conversa uuid; v_status public.status_chamado;
begin
  if not public.pode_ver_chamado(p_chamado) then raise exception 'sem acesso a este chamado'; end if;
  select status into v_status from public.chamados where id = p_chamado for update;
  if v_status = 'concluido' then raise exception 'Esta demanda já está concluída.'; end if;
  update public.chamados set status = 'concluido', concluido_em = now(), atualizado_em = now()
  where id = p_chamado returning conversa_id into v_conversa;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id)
  select id, cliente_id, 'conclusao', auth.uid() from public.chamados where id = p_chamado;
  if v_conversa is not null and not exists (
    select 1 from public.chamados where conversa_id = v_conversa and status <> 'concluido'
  ) then
    update public.conversas set estado = 'agente', atendente_id = null, atualizado_em = now() where id = v_conversa;
  end if;
end $$;

create or replace function public.criar_simulacao(p_mensagem text, p_cliente_id uuid default null, p_rascunho jsonb default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_rascunho jsonb; v_cliente uuid; v_setor uuid; v_orientacao uuid;
begin
  perform public.exigir_segundo_fator();
  if not public.tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
  if p_mensagem is null or length(trim(p_mensagem)) = 0 then raise exception 'Escreva a mensagem do cliente para o teste.'; end if;
  if length(trim(p_mensagem)) > 2000 then raise exception 'A mensagem de teste pode ter no máximo 2000 caracteres.'; end if;
  perform interno.validar_empresa(p_cliente_id);

  if p_rascunho is not null and jsonb_typeof(p_rascunho) <> 'null' then
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
    if v_orientacao is not null and not exists (select 1 from public.orientacoes_agente where id = v_orientacao) then
      raise exception 'Orientação não encontrada.';
    end if;
    perform interno.validar_orientacao(p_rascunho->>'titulo', p_rascunho->>'texto', p_rascunho->>'tipo', v_cliente, v_setor);
    v_rascunho := jsonb_build_object('id', v_orientacao, 'titulo', trim(p_rascunho->>'titulo'), 'texto', trim(p_rascunho->>'texto'),
      'tipo', p_rascunho->>'tipo', 'cliente_id', v_cliente, 'setor_id', v_setor);
  end if;

  -- Serializa os pedidos da mesma pessoa para dois cliques seguidos não criarem duas pendentes.
  perform pg_advisory_xact_lock(hashtextextended('simulacoes_agente:' || auth.uid()::text, 0));
  if exists (select 1 from public.simulacoes_agente where usuario_id = auth.uid() and status = 'pendente'
             and criado_em > now() - interval '5 minutes') then
    raise exception 'Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.';
  end if;
  insert into public.simulacoes_agente (usuario_id, mensagem, cliente_id, rascunho)
  values (auth.uid(), trim(p_mensagem), p_cliente_id, v_rascunho)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.custo_ia_periodo(p_inicio timestamptz, p_fim timestamptz) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(custo_usd), 0) from public.uso_ia where criado_em >= p_inicio and criado_em < p_fim
$$;

create or replace function public.definir_preco(p_grupo uuid, p_produto uuid, p_valor numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid; v_tipo public.tipo_parceiro; v_id uuid;
begin
  if not public.tem_permissao('editar_precos') then raise exception 'sem permissão para editar preços'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'valor inválido'; end if;
  select cliente_id, tipo into v_cliente, v_tipo from public.parceiros_grupos where id = p_grupo;
  if v_cliente is null then raise exception 'rede não encontrada'; end if;
  if v_tipo <> 'cliente' then raise exception 'preço só vale para clientes da empresa'; end if;
  if not exists (select 1 from public.produtos where id = p_produto and cliente_id = v_cliente) then
    raise exception 'produto não pertence à empresa';
  end if;
  update public.precos set vigente_ate = now() where grupo_id = p_grupo and produto_id = p_produto and vigente_ate is null;
  insert into public.precos (cliente_id, grupo_id, produto_id, valor, alterado_por)
  values (v_cliente, p_grupo, p_produto, round(p_valor, 2), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.devolver_ao_agente(p_conversa uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_estado public.estado_conversa; v_atendente uuid; v_esperando boolean;
begin
  perform public.exigir_acesso();
  select estado, atendente_id, aguardando_pessoa_desde is not null into v_estado, v_atendente, v_esperando
    from public.conversas where id = p_conversa for update;
  if not (public.eh_admin() or coalesce(v_atendente = auth.uid(), false)) then
    raise exception 'só quem assumiu a conversa pode devolvê-la';
  end if;
  update public.conversas set estado = 'agente', atendente_id = null, aguardando_pessoa_desde = null, motivo_pessoa = null,
         atualizado_em = now() where id = p_conversa;
  if v_estado = 'humano' or v_esperando then
    insert into public.conversa_eventos (conversa_id, tipo, usuario_id) values (p_conversa, 'devolvida', auth.uid());
  end if;
end $$;

create or replace function public.nota_interna(p_chamado uuid, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_ver_chamado(p_chamado) then raise exception 'sem acesso a este chamado'; end if;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
  select id, cliente_id, 'nota_interna', auth.uid(), p_texto from public.chamados where id = p_chamado;
end $$;

create or replace function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_linha jsonb := coalesce(to_jsonb(new), to_jsonb(old));
begin
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(v_linha->>'id', v_linha->>'data', v_linha->>'cliente_id', v_linha->>'usuario_id'),
          jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new)));
  return coalesce(new, old);
end $$;

create or replace function public.registrar_resposta(p_conversa uuid, p_texto text, p_arquivo_path text, p_arquivo_nome text, p_arquivo_mime text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_cliente uuid; v_origem uuid;
begin
  if not public.pode_ver_conversa(p_conversa) then raise exception 'sem acesso a esta conversa'; end if;
  if coalesce(trim(p_texto), '') = '' and p_arquivo_path is null then raise exception 'resposta vazia'; end if;
  if p_arquivo_path is not null then
    if p_arquivo_path ~ '^conversas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$' then
      v_origem := split_part(p_arquivo_path, '/', 2)::uuid;
    end if;
    if v_origem is null or not public.pode_ver_conversa(v_origem)
       or not exists (select 1 from storage.objects where bucket_id = 'anexos' and name = p_arquivo_path) then
      raise exception 'Arquivo não encontrado nesta conversa.';
    end if;
  end if;
  perform public.assumir_conversa(p_conversa);
  select cliente_em_foco into v_cliente from public.conversas where id = p_conversa;
  insert into public.mensagens (conversa_id, cliente_id, direcao, autor, atendente_id, tipo, conteudo,
                                arquivo_path, arquivo_nome, arquivo_mime, status_envio)
  values (p_conversa, v_cliente, 'saida', 'atendente', auth.uid(),
          case when p_arquivo_path is null then 'texto' else 'documento' end::public.tipo_mensagem,
          p_texto, p_arquivo_path, p_arquivo_nome, p_arquivo_mime, 'pendente')
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.restaurar_orientacao(p_versao_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v public.orientacoes_agente_versoes%rowtype;
begin
  perform public.exigir_segundo_fator();
  if not public.tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
  select * into v from public.orientacoes_agente_versoes where id = p_versao_id;
  if v.id is null then raise exception 'Versão não encontrada.'; end if;
  perform interno.validar_orientacao(v.titulo, v.texto, v.tipo, v.cliente_id, v.setor_id);
  update public.orientacoes_agente set titulo = v.titulo, texto = v.texto, tipo = v.tipo, cliente_id = v.cliente_id,
    setor_id = v.setor_id, atualizado_por = auth.uid(), atualizado_em = now()
  where id = v.orientacao_id;
  perform interno.gravar_versao_orientacao(v.orientacao_id, 'restaurar');
  return v.orientacao_id;
end $$;

create or replace function public.salvar_orientacao(p_id uuid, p_titulo text, p_texto text, p_tipo text, p_cliente_id uuid default null,
  p_setor_id uuid default null, p_ativo boolean default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; o public.orientacoes_agente%rowtype;
begin
  perform public.exigir_segundo_fator();
  if not public.tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
  if p_id is not null then
    select * into o from public.orientacoes_agente where id = p_id for update;
    if not found then raise exception 'Orientação não encontrada.'; end if;
    if o.titulo = trim(p_titulo) and o.texto = trim(p_texto) and o.tipo = p_tipo
       and o.cliente_id is not distinct from p_cliente_id and o.setor_id is not distinct from p_setor_id
       and o.ativo = coalesce(p_ativo, o.ativo) then
      return o.id;
    end if;
  end if;
  perform interno.validar_orientacao(p_titulo, p_texto, p_tipo, p_cliente_id, p_setor_id);
  if p_id is null then
    insert into public.orientacoes_agente (titulo, texto, tipo, cliente_id, setor_id, ativo, criado_por, atualizado_por)
    values (trim(p_titulo), trim(p_texto), p_tipo, p_cliente_id, p_setor_id, coalesce(p_ativo, false), auth.uid(), auth.uid())
    returning id into v_id;
    perform interno.gravar_versao_orientacao(v_id, 'criar');
  else
    update public.orientacoes_agente set titulo = trim(p_titulo), texto = trim(p_texto), tipo = p_tipo, cliente_id = p_cliente_id,
      setor_id = p_setor_id, ativo = coalesce(p_ativo, ativo), atualizado_por = auth.uid(), atualizado_em = now()
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Orientação não encontrada.'; end if;
    perform interno.gravar_versao_orientacao(v_id, 'editar');
  end if;
  return v_id;
end $$;

create or replace function public.transferir_chamado(p_chamado uuid, p_setor uuid, p_responsavel uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_status public.status_chamado; v_responsavel_antes uuid;
begin
  if not public.pode_ver_chamado(p_chamado) then raise exception 'sem acesso a este chamado'; end if;
  select status, responsavel_id into v_status, v_responsavel_antes from public.chamados where id = p_chamado for update;
  if v_status = 'concluido' then raise exception 'Esta demanda está concluída. Reabra antes de mudar.'; end if;
  if p_setor is not null and not exists (select 1 from public.setores where id = p_setor and ativo) then
    raise exception 'Escolha um setor ativo.';
  end if;
  if p_responsavel is not null and not public.pode_ser_responsavel(p_responsavel, p_setor) then
    raise exception 'Escolha uma pessoa ativa do setor da demanda.';
  end if;
  update public.chamados set setor_id = p_setor, responsavel_id = p_responsavel, status = 'aberto', atualizado_em = now()
  where id = p_chamado;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
  select id, cliente_id, 'transferencia', auth.uid(),
         (select nome from public.setores where id = p_setor)
  from public.chamados where id = p_chamado;
  if p_responsavel is distinct from v_responsavel_antes then
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    select id, cliente_id, 'responsavel_alterado', auth.uid(), (select nome from public.usuarios where id = p_responsavel)
    from public.chamados where id = p_chamado;
  end if;
end $$;

create or replace function public.vincular_contato_conversa(p_conversa uuid, p_contato uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.tem_permissao('editar_clientes') then raise exception 'sem permissão para editar clientes'; end if;
  if not public.pode_ver_conversa(p_conversa) then raise exception 'sem acesso a esta conversa'; end if;
  if not exists (select 1 from public.contatos c join public.conversas v on v.telefone = c.telefone where c.id = p_contato and v.id = p_conversa) then
    raise exception 'o contato não tem o telefone desta conversa';
  end if;
  update public.conversas set contato_id = p_contato, atualizado_em = now() where id = p_conversa;
end $$;

-- ===== 6.12: eh_telefone_do_assistente só responde de verdade sem sessão ou à equipe ativa =====
create or replace function public.eh_telefone_do_assistente(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (auth.uid() is null or public.eh_usuario_ativo()) and exists (
    select 1 from public.usuarios u
    where u.ativo and public.nivel_de(u.id, 'assistente') = 'site_whatsapp' and u.telefone is not null
      and (u.telefone = p
        or (length(p) = 12 and p ~ '^\d{4}[6-9]' and u.telefone = left(p, 4) || '9' || substr(p, 5))
        or (length(p) = 13 and substr(p, 5, 1) = '9' and u.telefone = left(p, 4) || substr(p, 6)))
  )
$$;

-- ===== 6.12: o visitante não executa função security definer (fora aviso_login) =====
revoke execute on function public.eh_usuario_ativo() from public, anon;
revoke execute on function public.eh_admin() from public, anon;
revoke execute on function public.meus_setores() from public, anon;
revoke execute on function public.tem_permissao(text) from public, anon;
revoke execute on function public.pode_ver_chamado(uuid) from public, anon;
revoke execute on function public.pode_ver_conversa(uuid) from public, anon;
revoke execute on function public.marcar_alerta_lido(uuid) from public, anon;
revoke execute on function public.assumir_conversa(uuid) from public, anon;
revoke execute on function public.devolver_ao_agente(uuid) from public, anon;
revoke execute on function public.registrar_resposta(uuid, text, text, text, text) from public, anon;
revoke execute on function public.nota_interna(uuid, text) from public, anon;
revoke execute on function public.transferir_chamado(uuid, uuid, uuid) from public, anon;
revoke execute on function public.concluir_chamado(uuid) from public, anon;
revoke execute on function public.anonimizar_contato(uuid) from public, anon;
revoke execute on function public.definir_preco(uuid, uuid, numeric) from public, anon;
revoke execute on function public.vincular_contato_conversa(uuid, uuid) from public, anon;
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;
revoke execute on function public.configuracoes_so_admin() from public, anon, authenticated;
revoke execute on function public.usuario_permissoes_espelhar() from public, anon, authenticated;
revoke execute on function public.usuarios_niveis_depois_inserir() from public, anon, authenticated;
revoke execute on function public.usuarios_permissoes_antes_alterar() from public, anon, authenticated;
revoke execute on function public.orientacoes_do_agente_certo() from public, anon, authenticated;

-- ===== 6.14: o visitante sem grant em tabela, view e sequência do public, agora e nas próximas =====
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- ===== 6.11: índices =====
create index if not exists chamado_eventos_chamado_idx on public.chamado_eventos (chamado_id, criado_em);
create index if not exists decisoes_agente_conversa_idx on public.decisoes_agente (conversa_id, criado_em);
create index if not exists decisoes_agente_criado_idx on public.decisoes_agente (criado_em);
create index if not exists assistente_mensagens_criado_idx on public.assistente_mensagens (criado_em);
create index if not exists alertas_setor_idx on public.alertas (setor_id) where setor_id is not null;
create index if not exists alertas_usuario_idx on public.alertas (usuario_id) where usuario_id is not null;
create index if not exists alertas_criado_idx on public.alertas (criado_em);

-- ===== 2.9: papel da fila do painel =====
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'painel_fila') then
    -- Sem senha e sem login aqui: a senha não pode ir para o repositório. O dono liga com
    -- "alter role painel_fila with login password '...'" (guia da Task 20).
    create role painel_fila nologin;
  end if;
end $$;

-- Chamada pela migração e pelo trabalhador (dono das tabelas do pg-boss) depois que a fila sobe: num banco novo o esquema
-- pgboss só aparece na primeira partida. Idempotente.
create or replace function public.conceder_fila_painel() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if to_regnamespace('pgboss') is null then return; end if;
  grant usage on schema pgboss to painel_fila;
  if to_regclass('pgboss.version') is not null then grant select on pgboss.version to painel_fila; end if;
  if to_regclass('pgboss.queue') is not null then grant select on pgboss.queue to painel_fila; end if;
  if to_regclass('pgboss.job') is not null then
    grant insert on pgboss.job to painel_fila;
    grant select (id) on pgboss.job to painel_fila;
  end if;
end $$;
revoke execute on function public.conceder_fila_painel() from public, anon, authenticated, service_role;

select public.conceder_fila_painel();
