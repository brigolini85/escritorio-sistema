-- supabase/migrations/20261029000100_seguranca_segundo_fator.sql
-- Segurança do login (item 8): aplicativo autenticador (TOTP) obrigatório para administrador e para quem tem "Ver acessos
-- de portais". O painel manda essas pessoas cadastrar/conferir o código antes de qualquer tela; aqui o banco recusa as
-- ações sensíveis feitas sem o segundo fator, mesmo chamadas direto pela API.
--
-- De propósito FORA de usuario_liberado/eh_admin (as regras de visibilidade e o portão do teste 22 não mudam): só as
-- funções sensíveis chamam exigir_segundo_fator().
--
-- Regra: recusa quando o token diz aal1 e a pessoa precisa do segundo fator. Todo token emitido pelo Supabase Auth traz
-- a marca "aal"; sem a marca só há chamadas internas (chave de serviço, testes do banco montando o token à mão).
--
-- Recuperar quem perdeu o celular (rodar no SQL Editor do Supabase, com o e-mail da pessoa):
--   delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'pessoa@escritorio.com.br');
-- No próximo login ela cadastra o aplicativo de novo.

-- Pessoa logada precisa do segundo fator? (administrador ou "Ver acessos de portais", ativa)
create function public.exige_segundo_fator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios where id = auth.uid() and ativo and (papel = 'admin' or ver_acessos_portais))
$$;
revoke execute on function public.exige_segundo_fator() from public, anon;
grant execute on function public.exige_segundo_fator() to authenticated;

create function public.segundo_fator_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select not coalesce(auth.jwt() ? 'aal', false)
      or auth.jwt() ->> 'aal' = 'aal2'
      or not public.exige_segundo_fator()
$$;
revoke execute on function public.segundo_fator_ok() from public, anon;
grant execute on function public.segundo_fator_ok() to authenticated;

create function public.exigir_segundo_fator() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.segundo_fator_ok() then
    raise exception 'Confirme o código do aplicativo autenticador para continuar.' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.exigir_segundo_fator() from public, anon;
grant execute on function public.exigir_segundo_fator() to authenticated;

-- ---------- Funções sensíveis: o mesmo corpo de antes, mais a trava (create or replace mantém as permissões) ----------

-- revelar_acesso
create or replace function public.revelar_acesso(p_id uuid, p_acao text default 'revelar') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.cliente_acessos%rowtype;
begin
  -- A trava de pessoa ativa e no horário fica escrita aqui também (portão do teste 25), mesmo já estando em pode_ver_acessos.
  if not (public.eh_admin() or (public.eh_usuario_ativo() and public.pode_ver_acessos())) then
    raise exception 'Sem permissão para ver acessos de portais.';
  end if;
  perform public.exigir_segundo_fator();
  if p_acao is null or p_acao not in ('revelar', 'copiar') then raise exception 'Ação inválida.'; end if;
  select * into v from public.cliente_acessos where id = p_id;
  if v.id is null or v.senha_cifrada is null then raise exception 'Este acesso não tem senha guardada.'; end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), p_acao || '_acesso', 'cliente_acessos', v.id::text, jsonb_build_object('cliente_id', v.cliente_id, 'portal', v.portal));
  return jsonb_build_object('cliente_id', v.cliente_id, 'senha_cifrada', v.senha_cifrada);
end $$;

-- salvar_acesso
create or replace function public.salvar_acesso(p_id uuid, p_cliente uuid, p_portal text, p_usuario text, p_senha_cifrada text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_portal text := btrim(coalesce(p_portal, ''));
  v_senha text := nullif(p_senha_cifrada, '');
begin
  if not (public.tem_permissao('editar_clientes') and public.pode_ver_acessos()) then
    raise exception 'Sem permissão para mudar acessos de portais.';
  end if;
  perform public.exigir_segundo_fator();
  if char_length(v_portal) not between 1 and 80 then raise exception 'Informe o portal.'; end if;
  -- Conferidos aqui para o erro de checagem do Postgres ("Failing row contains ...") nunca levar a cifra para um log.
  if char_length(btrim(coalesce(p_usuario, ''))) > 120 then raise exception 'Usuário do portal muito longo.'; end if;
  if v_senha is not null and v_senha !~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$' then
    raise exception 'Senha em formato inválido.';
  end if;
  if v_id is null then
    if not exists (select 1 from public.clientes where id = p_cliente) then raise exception 'Cliente não encontrado.'; end if;
    insert into public.cliente_acessos (cliente_id, portal, usuario, senha_cifrada, atualizado_por)
    values (p_cliente, v_portal, nullif(btrim(p_usuario), ''), v_senha, auth.uid())
    returning id into v_id;
  else
    update public.cliente_acessos
    set portal = v_portal, usuario = nullif(btrim(p_usuario), ''),
        senha_cifrada = case when p_senha_cifrada = '' then null else coalesce(v_senha, senha_cifrada) end,
        atualizado_por = auth.uid(), atualizado_em = now()
    where id = v_id and cliente_id = p_cliente;
    if not found then raise exception 'Acesso não encontrado.'; end if;
  end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'salvar_acesso', 'cliente_acessos', v_id::text,
          jsonb_build_object('cliente_id', p_cliente, 'portal', v_portal, 'senha_trocada', p_senha_cifrada is not null));
  return v_id;
end $$;

-- remover_acesso
create or replace function public.remover_acesso(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.cliente_acessos%rowtype;
begin
  if not (public.tem_permissao('editar_clientes') and public.pode_ver_acessos()) then
    raise exception 'Sem permissão para mudar acessos de portais.';
  end if;
  perform public.exigir_segundo_fator();
  delete from public.cliente_acessos where id = p_id returning * into v;
  if v.id is null then raise exception 'Acesso não encontrado.'; end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'remover_acesso', 'cliente_acessos', v.id::text, jsonb_build_object('cliente_id', v.cliente_id, 'portal', v.portal));
end $$;

-- definir_ver_acessos
create or replace function public.definir_ver_acessos(p_usuario uuid, p_pode boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'Só o administrador muda pessoas.'; end if;
  perform public.exigir_segundo_fator();
  update public.usuarios set ver_acessos_portais = coalesce(p_pode, false) where id = p_usuario and ativo;
  if not found then raise exception 'Pessoa não encontrada.'; end if;
end $$;

-- salvar_usuario
create or replace function public.salvar_usuario(p_id uuid, p_dados jsonb) returns void
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
  perform public.exigir_segundo_fator();
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

-- exigir_arquivar
create or replace function public.exigir_arquivar(p_tipo text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_tabela text := public.tabela_do_cadastro(p_tipo);
begin
  if v_tabela is null then raise exception 'Tipo de cadastro inválido.'; end if;
  if p_tipo = 'usuario' and not public.eh_admin() then raise exception 'Só o administrador arquiva pessoas.'; end if;
  if not public.tem_permissao('clientes', 'arquivar') then raise exception 'Sem permissão para arquivar cadastros.'; end if;
  perform public.exigir_segundo_fator();
  return v_tabela;
end $$;
