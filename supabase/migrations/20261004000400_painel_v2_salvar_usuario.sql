-- supabase/migrations/20261004000400_painel_v2_salvar_usuario.sql
-- Painel v2, Parte D (spec 7.1): a ficha da pessoa grava dados, setores e níveis numa transação só (um erro no meio
-- não deixa a pessoa pela metade). Módulo que não veio (escondido para o administrador) fica como estava.

create function public.salvar_usuario(p_id uuid, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_nome text := btrim(coalesce(p_dados ->> 'nome', ''));
  v_papel text := p_dados ->> 'papel';
  v_cargo text := nullif(btrim(coalesce(p_dados ->> 'cargo', '')), '');
  v_obs text := nullif(btrim(coalesce(p_dados ->> 'observacoes', '')), '');
  v_tel text := nullif(btrim(coalesce(p_dados ->> 'telefone', '')), '');
  v_horario jsonb := nullif(p_dados -> 'horario_acesso', 'null'::jsonb);
  v_setores uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(nullif(p_dados -> 'setores', 'null'::jsonb), '[]'::jsonb)) x), '{}');
  v_atual public.usuarios%rowtype;
  n record;
begin
  if not public.eh_admin() then raise exception 'Só o administrador muda pessoas.'; end if;
  if char_length(v_nome) < 2 then raise exception 'Informe o nome.'; end if;
  if v_papel is null or v_papel not in ('admin', 'atendente') then raise exception 'Escolha se é administrador.'; end if;
  -- P16: o escritório não fica sem administrador por engano.
  if p_id = auth.uid() and v_papel <> 'admin' then raise exception 'Você não pode tirar o seu próprio acesso de administrador.'; end if;
  if not public.horario_valido(v_horario) then raise exception 'Horário de acesso inválido.'; end if;
  if exists (select 1 from unnest(v_setores) s where not exists (select 1 from public.setores where id = s)) then
    raise exception 'Setor não encontrado.';
  end if;
  for n in select key, value from jsonb_each_text(coalesce(nullif(p_dados -> 'niveis', 'null'::jsonb), '{}'::jsonb)) loop
    if not exists (select 1 from public.permissao_niveis where modulo = n.key and nivel = n.value) then
      raise exception 'Nível inválido em %.', n.key;
    end if;
  end loop;

  select * into v_atual from public.usuarios where id = p_id;
  if v_atual.id is null then
    if coalesce(btrim(p_dados ->> 'email'), '') = '' then raise exception 'Informe o e-mail.'; end if;
    -- P4: pessoa nova começa de segunda a sexta, das 08 às 18, se o horário não veio.
    insert into public.usuarios (id, nome, email, papel, telefone, cargo, observacoes, horario_acesso)
    values (p_id, v_nome, lower(btrim(p_dados ->> 'email')), v_papel::public.papel_usuario, v_tel, v_cargo, v_obs,
            case when p_dados ? 'horario_acesso' then v_horario
                 else '{"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}'::jsonb end);
  else
    if not v_atual.ativo then raise exception 'Esta pessoa está arquivada. Restaure antes de mudar.'; end if;
    update public.usuarios
    set nome = v_nome, papel = v_papel::public.papel_usuario, telefone = v_tel, cargo = v_cargo, observacoes = v_obs,
        horario_acesso = case when p_dados ? 'horario_acesso' then v_horario else horario_acesso end
    where id = p_id;
  end if;

  delete from public.usuario_setores where usuario_id = p_id and not (setor_id = any (v_setores));
  insert into public.usuario_setores (usuario_id, setor_id)
  select distinct p_id, s from unnest(v_setores) s
  where not exists (select 1 from public.usuario_setores where usuario_id = p_id and setor_id = s);

  insert into public.usuario_permissoes as up (usuario_id, modulo, nivel)
  select p_id, key, value from jsonb_each_text(coalesce(nullif(p_dados -> 'niveis', 'null'::jsonb), '{}'::jsonb))
  on conflict (usuario_id, modulo) do update set nivel = excluded.nivel where up.nivel is distinct from excluded.nivel;

  if public.nivel_de(p_id, 'assistente') = 'site_whatsapp' and v_tel is null then
    raise exception 'Informe o telefone para usar o assistente pelo WhatsApp.';
  end if;
end $$;
revoke execute on function public.salvar_usuario(uuid, jsonb) from public, anon;
grant execute on function public.salvar_usuario(uuid, jsonb) to authenticated;

-- ---------- Sobras da Task 4 ----------

-- Fora do horário a mensagem diz o porquê ("Fora do seu horário de acesso."), não "Acesso desativado.".
create or replace function public.definir_visao_demandas(p_visao text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_visao is null or p_visao not in ('tabela', 'quadro') then raise exception 'Visão inválida.'; end if;
  perform public.exigir_acesso();
  update public.usuarios set visao_demandas = p_visao where id = auth.uid();
end $$;

create or replace function public.criar_demanda(
  p_cliente uuid, p_setor uuid, p_titulo text, p_descricao text, p_prioridade public.prioridade_demanda default 'normal',
  p_prazo timestamptz default null, p_responsavel uuid default null, p_contato uuid default null
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
  insert into public.chamados (cliente_id, setor_id, responsavel_id, contato_id, titulo, resumo, prioridade, prazo_em, origem, criado_por)
    values (p_cliente, p_setor, v_responsavel, p_contato, v_titulo, v_descricao, coalesce(p_prioridade, 'normal'), p_prazo, 'equipe', auth.uid())
    returning id, numero into v_id, v_numero;
  return jsonb_build_object('id', v_id, 'numero', v_numero);
end $$;
