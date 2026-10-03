-- supabase/migrations/20261004000200_painel_v2_visibilidade.sql
-- Painel v2, Parte D (spec 7.2): o que cada pessoa vê e faz sai do nível. "Do meu setor" e "Conversas dos meus
-- setores" são a regra de antes, palavra por palavra: quem não teve o nível mudado vê exatamente o mesmo (teste 22).

-- ---------- Demandas ----------

create function public.pode_ver_chamado_de(p_usuario uuid, p_chamado uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin_de(p_usuario) or exists (
    select 1 from public.chamados c
    where c.id = p_chamado and public.usuario_liberado(p_usuario)
      and (c.responsavel_id = p_usuario
           or case public.nivel_de(p_usuario, 'demandas')
                when 'todas' then true
                when 'meu_setor' then c.setor_id in (select us.setor_id from public.usuario_setores us where us.usuario_id = p_usuario)
                else false
              end)
  )
$$;

-- ---------- Conversas (Atendimento) ----------

create function public.pode_ver_conversa_de(p_usuario uuid, p_conversa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin_de(p_usuario) or (public.usuario_liberado(p_usuario) and (
    case public.nivel_de(p_usuario, 'atendimento')
      when 'todas' then exists (select 1 from public.conversas where id = p_conversa)
      when 'meus_setores' then
        exists (select 1 from public.conversas where id = p_conversa and atendente_id = p_usuario)
        or exists (
          select 1 from public.chamados c
          where c.conversa_id = p_conversa
            and (c.responsavel_id = p_usuario
                 or c.setor_id in (select us.setor_id from public.usuario_setores us where us.usuario_id = p_usuario)))
      else false
    end))
$$;

revoke execute on function public.pode_ver_chamado_de(uuid, uuid), public.pode_ver_conversa_de(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pode_ver_chamado_de(uuid, uuid), public.pode_ver_conversa_de(uuid, uuid) to service_role;

-- As de sempre (políticas, Realtime, funções antigas): mesma assinatura, agora pelo nível.
create or replace function public.pode_ver_chamado(p_chamado uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select public.pode_ver_chamado_de(auth.uid(), p_chamado) $$;

create or replace function public.pode_ver_conversa(p_conversa uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select public.pode_ver_conversa_de(auth.uid(), p_conversa) $$;

-- ---------- Arquivar e restaurar (spec 5.2): "Clientes e contatos: Editar e arquivar" ----------

create or replace function public.exigir_arquivar(p_tipo text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_tabela text := public.tabela_do_cadastro(p_tipo);
begin
  if v_tabela is null then raise exception 'Tipo de cadastro inválido.'; end if;
  if p_tipo = 'usuario' and not public.eh_admin() then raise exception 'Só o administrador arquiva pessoas.'; end if;
  if not public.tem_permissao('clientes', 'arquivar') then raise exception 'Sem permissão para arquivar cadastros.'; end if;
  return v_tabela;
end $$;

-- ---------- Assistente: pelo nível, sem passe livre do administrador (como hoje) ----------

drop policy pergunta on public.assistente_mensagens;
create policy pergunta on public.assistente_mensagens for insert to authenticated
  with check (usuario_id = auth.uid() and papel = 'usuario' and canal = 'site' and processada_em is null
    and public.tem_nivel('assistente', 'site')
    and (conversa_id is null or exists (select 1 from public.conversas c where c.id = conversa_id)));

-- Telefone da equipe com "Site e WhatsApp" (com ou sem o 9). Sem horário aqui: fora do horário a mensagem continua
-- indo para o assistente (que responde "fora do horário"), nunca para o agente de clientes.
create or replace function public.eh_telefone_do_assistente(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuarios u
    where u.ativo and public.nivel_de(u.id, 'assistente') = 'site_whatsapp' and u.telefone is not null
      and (u.telefone = p
        or (length(p) = 12 and p ~ '^\d{4}[6-9]' and u.telefone = left(p, 4) || '9' || substr(p, 5))
        or (length(p) = 13 and substr(p, 5, 1) = '9' and u.telefone = left(p, 4) || substr(p, 6)))
  )
$$;

-- ---------- Nova demanda: "Só as minhas" (P9) e prazo à mão (P10) ----------

create or replace function public.criar_demanda(
  p_cliente uuid, p_setor uuid, p_titulo text, p_descricao text,
  p_prioridade public.prioridade_demanda default 'normal', p_prazo timestamptz default null,
  p_responsavel uuid default null, p_contato uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_descricao text := btrim(coalesce(p_descricao, ''));
  v_responsavel uuid := p_responsavel;
  v_id uuid;
  v_numero bigint;
begin
  if not public.eh_usuario_ativo() then raise exception 'Acesso desativado.'; end if;
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
  insert into public.chamados (cliente_id, setor_id, responsavel_id, contato_id, titulo, resumo, prioridade, prazo_em, origem, criado_por)
    values (p_cliente, p_setor, v_responsavel, p_contato, v_titulo, v_descricao, coalesce(p_prioridade, 'normal'), p_prazo, 'equipe', auth.uid())
    returning id, numero into v_id, v_numero;
  return jsonb_build_object('id', v_id, 'numero', v_numero);
end $$;

-- Prazo escolhido à mão exige "Alterar prazos"; mudar a prioridade continua recalculando o prazo para todos.
-- Se calcular_prazo não devolve prazo (sem dia útil nas Configurações), o prazo que já existe fica e não há evento.
create or replace function public.definir_prioridade_prazo(
  p_chamado uuid, p_prioridade public.prioridade_demanda default null, p_prazo timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype; v_prazo timestamptz;
begin
  v := public.demanda_para_agir(p_chamado);
  if p_prazo is not null and not public.tem_permissao('prazos', 'sim') then raise exception 'Você não tem permissão para alterar prazos.'; end if;
  if p_prazo is not null and p_prazo <= now() then raise exception 'O prazo precisa ser depois de agora.'; end if;
  if p_prioridade is not null and p_prioridade <> v.prioridade then
    v_prazo := coalesce(p_prazo, public.calcular_prazo(p_prioridade, now()), v.prazo_em);
    update public.chamados set prioridade = p_prioridade, prazo_em = v_prazo where id = p_chamado;
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (p_chamado, v.cliente_id, 'prioridade_alterada', auth.uid(), p_prioridade::text);
    if v_prazo is distinct from v.prazo_em then
      insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
        values (p_chamado, v.cliente_id, 'prazo_alterado', case when p_prazo is not null then auth.uid() end, public.texto_prazo(v_prazo));
    end if;
  elsif p_prazo is not null and p_prazo is distinct from v.prazo_em then
    update public.chamados set prazo_em = p_prazo where id = p_chamado;
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (p_chamado, v.cliente_id, 'prazo_alterado', auth.uid(), public.texto_prazo(p_prazo));
  end if;
  return (select jsonb_build_object('prioridade', c.prioridade, 'prazo_em', c.prazo_em) from public.chamados c where c.id = p_chamado);
end $$;
