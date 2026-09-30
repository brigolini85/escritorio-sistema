-- Treinar o agente: o rascunho de um teste pode dizer qual orientação salva ele está editando ("id").
-- No teste, o rascunho entra no lugar dessa orientação (a versão salva não aparece junto).
create or replace function public.criar_simulacao(p_mensagem text, p_cliente_id uuid default null, p_rascunho jsonb default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_rascunho jsonb; v_cliente uuid; v_setor uuid; v_orientacao uuid;
begin
  if not tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
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
    if v_orientacao is not null and not exists (select 1 from orientacoes_agente where id = v_orientacao) then
      raise exception 'Orientação não encontrada.';
    end if;
    perform interno.validar_orientacao(p_rascunho->>'titulo', p_rascunho->>'texto', p_rascunho->>'tipo', v_cliente, v_setor);
    v_rascunho := jsonb_build_object('id', v_orientacao, 'titulo', trim(p_rascunho->>'titulo'), 'texto', trim(p_rascunho->>'texto'),
      'tipo', p_rascunho->>'tipo', 'cliente_id', v_cliente, 'setor_id', v_setor);
  end if;

  -- Serializa os pedidos da mesma pessoa para dois cliques seguidos não criarem duas pendentes.
  perform pg_advisory_xact_lock(hashtextextended('simulacoes_agente:' || auth.uid()::text, 0));
  if exists (select 1 from simulacoes_agente where usuario_id = auth.uid() and status = 'pendente'
             and criado_em > now() - interval '5 minutes') then
    raise exception 'Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.';
  end if;
  insert into simulacoes_agente (usuario_id, mensagem, cliente_id, rascunho)
  values (auth.uid(), trim(p_mensagem), p_cliente_id, v_rascunho)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.criar_simulacao(text, uuid, jsonb) from public, anon;
grant execute on function public.criar_simulacao(text, uuid, jsonb) to authenticated, service_role;
