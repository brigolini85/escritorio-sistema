-- supabase/migrations/20261005000300_painel_v2_trocar_empresa.sql
-- Painel v2, Parte E (spec 7A.1 e 7A.2): trocar a empresa da conversa (contato que fala por várias) e abrir demanda
-- a partir da conversa (painel "Nova demanda" da Parte C já ligado à conversa). Mais as sobras da Task 2 em
-- concluir_conversa e devolver_ao_agente.

-- Trocar a empresa (P9): quem vê a conversa, no horário, sem assumir; só empresas ativas ligadas ao contato ativo.
create function public.trocar_empresa_conversa(p_conversa uuid, p_cliente uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.conversas%rowtype; v_contato_ativo boolean; v_de text; v_para text;
begin
  perform public.exigir_acesso();
  if not public.pode_ver_conversa(p_conversa) then raise exception 'Sem acesso a esta conversa.'; end if;
  -- Trava a linha: duas trocas ao mesmo tempo não gravam marcos com o "de" errado.
  select * into v from public.conversas where id = p_conversa for update;
  if v.contato_id is null then raise exception 'Cadastre o contato antes de trocar a empresa.'; end if;
  select ativo into v_contato_ativo from public.contatos where id = v.contato_id;
  if not coalesce(v_contato_ativo, false) then raise exception 'Contato arquivado: restaure o contato para trocar a empresa.'; end if;
  if not exists (select 1 from public.contato_clientes cc join public.clientes cl on cl.id = cc.cliente_id
                 where cc.contato_id = v.contato_id and cc.cliente_id = p_cliente and cl.ativo) then
    raise exception 'Esta empresa não está ligada ao contato.';
  end if;
  if v.cliente_em_foco is not distinct from p_cliente then raise exception 'A conversa já está nesta empresa.'; end if;
  select coalesce(nome_fantasia, razao_social) into v_de from public.clientes where id = v.cliente_em_foco;
  select coalesce(nome_fantasia, razao_social) into v_para from public.clientes where id = p_cliente;
  update public.conversas set cliente_em_foco = p_cliente, atualizado_em = now() where id = p_conversa;
  insert into public.conversa_eventos (conversa_id, tipo, usuario_id, texto)
    values (p_conversa, 'empresa_trocada', auth.uid(), left(coalesce(v_de, 'sem empresa') || ' → ' || v_para, 300));
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
    values (auth.uid(), 'trocar_empresa', 'conversas', p_conversa::text, jsonb_build_object('de', v.cliente_em_foco, 'para', p_cliente));
  return jsonb_build_object('empresa', v_para);
end $$;
revoke execute on function public.trocar_empresa_conversa(uuid, uuid) from public, anon;
grant execute on function public.trocar_empresa_conversa(uuid, uuid) to authenticated;

-- Nova demanda a partir da conversa: corpo de 20261004000400 (a versão mais nova) + p_conversa (quem vê a conversa;
-- só empresa da conversa). A assinatura antiga (8 parâmetros, com padrões) fica, agora só repassando com p_conversa nulo:
-- o teste 19 (Parte C) confere a permissão dela. A nova não tem padrões, então nenhuma chamada casa com as duas
-- (nem no Postgres nem no PostgREST): com p_conversa vai para a nova; sem, para a antiga.
create function public.criar_demanda(
  p_cliente uuid, p_setor uuid, p_titulo text, p_descricao text, p_prioridade public.prioridade_demanda,
  p_prazo timestamptz, p_responsavel uuid, p_contato uuid, p_conversa uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_descricao text := btrim(coalesce(p_descricao, ''));
  v_responsavel uuid := p_responsavel;
  v_id uuid;
  v_numero bigint;
begin
  perform public.exigir_acesso();
  if char_length(v_titulo) not between 3 and 120 then raise exception 'O título precisa ter de 3 a 120 caracteres.'; end if;
  if char_length(v_descricao) > 4000 then raise exception 'A descrição pode ter até 4000 caracteres.'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente and ativo) then raise exception 'Escolha uma empresa ativa.'; end if;
  if not exists (select 1 from public.setores where id = p_setor and ativo) then raise exception 'Escolha o setor.'; end if;
  if not public.eh_admin() and p_setor not in (select public.meus_setores()) then raise exception 'Escolha um dos seus setores.'; end if;
  if p_prazo is not null and not public.tem_permissao('prazos', 'sim') then raise exception 'Você não tem permissão para alterar prazos.'; end if;
  if p_prazo is not null and p_prazo <= now() then raise exception 'O prazo precisa ser depois de agora.'; end if;
  -- Quem só vê as próprias demandas fica responsável pela que cria; senão ela sumiria da tela dele.
  if not public.eh_admin() and public.nivel_de(auth.uid(), 'demandas') = 'minhas' then
    if v_responsavel is not null and v_responsavel <> auth.uid() then
      raise exception 'Com "Só as minhas", a demanda que você cria fica com você.';
    end if;
    v_responsavel := auth.uid();
  end if;
  if v_responsavel is not null and not public.pode_ser_responsavel(v_responsavel, p_setor) then
    raise exception 'Escolha uma pessoa ativa do setor da demanda.';
  end if;
  if p_contato is not null and not public.contato_da_empresa(p_contato, p_cliente) then raise exception 'Escolha um contato desta empresa.'; end if;
  -- Demanda da conversa (P22): só quem vê a conversa, e só com a empresa em foco ou uma ligada ao contato dela.
  if p_conversa is not null then
    if not public.pode_ver_conversa(p_conversa) then raise exception 'Sem acesso a esta conversa.'; end if;
    if not exists (select 1 from public.conversas cv
                   where cv.id = p_conversa
                     and (cv.cliente_em_foco = p_cliente
                          or exists (select 1 from public.contato_clientes cc where cc.contato_id = cv.contato_id and cc.cliente_id = p_cliente))) then
      raise exception 'Escolha uma empresa desta conversa.';
    end if;
  end if;
  insert into public.chamados (cliente_id, setor_id, responsavel_id, contato_id, conversa_id, titulo, resumo, prioridade, prazo_em, origem, criado_por)
    values (p_cliente, p_setor, v_responsavel, p_contato, p_conversa, v_titulo, v_descricao, coalesce(p_prioridade, 'normal'), p_prazo, 'equipe', auth.uid())
    returning id, numero into v_id, v_numero;
  return jsonb_build_object('id', v_id, 'numero', v_numero);
end $$;
revoke execute on function public.criar_demanda(uuid, uuid, text, text, public.prioridade_demanda, timestamptz, uuid, uuid, uuid) from public, anon;
grant execute on function public.criar_demanda(uuid, uuid, text, text, public.prioridade_demanda, timestamptz, uuid, uuid, uuid) to authenticated;

-- A chamada antiga, sem conversa, continua valendo e passa pelas mesmas conferências (a nova roda como definer).
create or replace function public.criar_demanda(
  p_cliente uuid, p_setor uuid, p_titulo text, p_descricao text, p_prioridade public.prioridade_demanda default 'normal',
  p_prazo timestamptz default null, p_responsavel uuid default null, p_contato uuid default null
) returns jsonb
language sql security invoker set search_path = '' as $$
  select public.criar_demanda(p_cliente, p_setor, p_titulo, p_descricao, p_prioridade, p_prazo, p_responsavel, p_contato, null::uuid);
$$;
revoke execute on function public.criar_demanda(uuid, uuid, text, text, public.prioridade_demanda, timestamptz, uuid, uuid) from public, anon;
grant execute on function public.criar_demanda(uuid, uuid, text, text, public.prioridade_demanda, timestamptz, uuid, uuid) to authenticated;

-- Concluir (sobra da Task 2): corpo de 20261005000200 com o filtro de quem assumiu no próprio UPDATE, para outra
-- pessoa que assumiu entre a conferência e a gravação não ter o atendimento dela concluído.
create or replace function public.concluir_conversa(p_conversa uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_acesso();
  update public.conversas set estado = 'agente', atendente_id = null, aguardando_pessoa_desde = null, motivo_pessoa = null,
         concluida_em = now(), atualizado_em = now()
   where id = p_conversa
     and (public.eh_admin() or (atendente_id = auth.uid() and estado = 'humano'));
  if not found then
    if public.eh_admin() then raise exception 'Conversa não encontrada.'; end if;
    raise exception 'Só quem assumiu a conversa pode concluir o atendimento.';
  end if;
  insert into public.conversa_eventos (conversa_id, tipo, usuario_id) values (p_conversa, 'concluida', auth.uid());
end $$;

-- Devolver (sobra da Task 2): corpo de 20261005000200 + o marco "devolvida" também quando limpa a espera de uma
-- conversa ainda com o agente. A linha fica travada entre a conferência e a gravação.
create or replace function public.devolver_ao_agente(p_conversa uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_estado estado_conversa; v_atendente uuid; v_esperando boolean;
begin
  perform public.exigir_acesso();
  select estado, atendente_id, aguardando_pessoa_desde is not null into v_estado, v_atendente, v_esperando
    from conversas where id = p_conversa for update;
  if not (eh_admin() or coalesce(v_atendente = auth.uid(), false)) then
    raise exception 'só quem assumiu a conversa pode devolvê-la';
  end if;
  update conversas set estado = 'agente', atendente_id = null, aguardando_pessoa_desde = null, motivo_pessoa = null,
         atualizado_em = now() where id = p_conversa;
  if v_estado = 'humano' or v_esperando then
    insert into conversa_eventos (conversa_id, tipo, usuario_id) values (p_conversa, 'devolvida', auth.uid());
  end if;
end $$;
