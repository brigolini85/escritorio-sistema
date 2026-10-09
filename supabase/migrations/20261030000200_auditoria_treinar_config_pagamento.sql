-- supabase/migrations/20261030000200_auditoria_treinar_config_pagamento.sql
-- Auditoria 5.1 e 6.7 (decisão D3 do dono, 08/10).
-- 5.1: "Treinar o agente" mudava o atendimento de todos os clientes (inclusive Pix) só com a senha. Agora quem treina
--      precisa do segundo fator, e ligar (ou mudar) orientação geral ligada avisa o dono.
-- 6.7: "Configurações: Sim" reescrevia as mensagens automáticas enviadas aos clientes. Agora mensagens, aviso do login e
--      dados de pagamento são só do administrador, e "Configurações: Sim" também precisa do segundo fator.
-- D3:  Pix e dados bancários do escritório ficam em configuracoes.dados_pagamento (só administrador com o fator, por
--      salvar_dados_pagamento). O agente informa só esses; orientação nunca é fonte de dado de pagamento.
-- Também (revisão da Task 1): o administrador que não é o dono não muda o horário de acesso do dono.

-- ---------- Quem precisa do segundo fator ----------
-- nivel_de, e não tem_nivel_de: tem_nivel_de passa por usuario_liberado → segundo_fator_ok → exige_segundo_fator e
-- voltaria para cá sem fim.
create or replace function public.exige_segundo_fator_de(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios
                 where id = p_usuario and ativo
                   and (papel = 'admin' or ver_acessos_portais or dono
                        or public.nivel_de(p_usuario, 'treinar') = 'sim'
                        or public.nivel_de(p_usuario, 'configuracoes') = 'sim'))
$$;

-- ---------- Treinar o agente: a trava vem primeiro (5.1) ----------
-- Com as funções-base travadas (Task 1), quem está em aal1 cairia em "Você não tem permissão"; a trava na primeira linha
-- mantém o motivo certo (42501). Corpos de 20260930000100 e 20261014000100; só a linha da trava é nova.

create or replace function public.salvar_orientacao(p_id uuid, p_titulo text, p_texto text, p_tipo text,
  p_cliente_id uuid default null, p_setor_id uuid default null, p_ativo boolean default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; o orientacoes_agente%rowtype;
begin
  perform public.exigir_segundo_fator();
  if not tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
  if p_id is not null then
    select * into o from orientacoes_agente where id = p_id for update;
    if not found then raise exception 'Orientação não encontrada.'; end if;
    if o.titulo = trim(p_titulo) and o.texto = trim(p_texto) and o.tipo = p_tipo
       and o.cliente_id is not distinct from p_cliente_id and o.setor_id is not distinct from p_setor_id
       and o.ativo = coalesce(p_ativo, o.ativo) then
      return o.id;
    end if;
  end if;
  perform interno.validar_orientacao(p_titulo, p_texto, p_tipo, p_cliente_id, p_setor_id);
  if p_id is null then
    insert into orientacoes_agente (titulo, texto, tipo, cliente_id, setor_id, ativo, criado_por, atualizado_por)
    values (trim(p_titulo), trim(p_texto), p_tipo, p_cliente_id, p_setor_id, coalesce(p_ativo, false), auth.uid(), auth.uid())
    returning id into v_id;
    perform interno.gravar_versao_orientacao(v_id, 'criar');
  else
    update orientacoes_agente set titulo = trim(p_titulo), texto = trim(p_texto), tipo = p_tipo, cliente_id = p_cliente_id,
      setor_id = p_setor_id, ativo = coalesce(p_ativo, ativo), atualizado_por = auth.uid(), atualizado_em = now()
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Orientação não encontrada.'; end if;
    perform interno.gravar_versao_orientacao(v_id, 'editar');
  end if;
  return v_id;
end $$;

create or replace function public.alternar_orientacao(p_id uuid, p_ativo boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare o orientacoes_agente%rowtype;
begin
  perform public.exigir_segundo_fator();
  if not tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
  if p_ativo is null then raise exception 'Informe se a orientação fica ligada ou desligada.'; end if;
  select * into o from orientacoes_agente where id = p_id for update;
  if o.id is null then raise exception 'Orientação não encontrada.'; end if;
  if o.ativo = p_ativo then return o.ativo; end if;
  if p_ativo then perform interno.validar_orientacao(o.titulo, o.texto, o.tipo, o.cliente_id, o.setor_id); end if;
  update orientacoes_agente set ativo = p_ativo, atualizado_por = auth.uid(), atualizado_em = now() where id = p_id;
  perform interno.gravar_versao_orientacao(p_id, case when p_ativo then 'ligar' else 'desligar' end);
  return p_ativo;
end $$;

create or replace function public.restaurar_orientacao(p_versao_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v orientacoes_agente_versoes%rowtype;
begin
  perform public.exigir_segundo_fator();
  if not tem_permissao('treinar_agente') then raise exception 'Você não tem permissão para treinar o agente.'; end if;
  select * into v from orientacoes_agente_versoes where id = p_versao_id;
  if v.id is null then raise exception 'Versão não encontrada.'; end if;
  perform interno.validar_orientacao(v.titulo, v.texto, v.tipo, v.cliente_id, v.setor_id);
  update orientacoes_agente set titulo = v.titulo, texto = v.texto, tipo = v.tipo, cliente_id = v.cliente_id,
    setor_id = v.setor_id, atualizado_por = auth.uid(), atualizado_em = now()
  where id = v.orientacao_id;
  perform interno.gravar_versao_orientacao(v.orientacao_id, 'restaurar');
  return v.orientacao_id;
end $$;

-- criar_simulacao: corpo de 20260930000200 (rascunho com id).
create or replace function public.criar_simulacao(p_mensagem text, p_cliente_id uuid default null, p_rascunho jsonb default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_rascunho jsonb; v_cliente uuid; v_setor uuid; v_orientacao uuid;
begin
  perform public.exigir_segundo_fator();
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

create or replace function public.salvar_orientacao_agente(p_slug text, p_id uuid, p_titulo text, p_texto text, p_tipo text,
  p_cliente_id uuid default null, p_setor_id uuid default null, p_ativo boolean default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; v_id uuid;
begin
  perform public.exigir_segundo_fator();
  select * into a from public.agentes where slug = p_slug;
  if not found then raise exception 'Agente não encontrado.'; end if;
  if not public.pode_treinar_agente(a.id) then raise exception 'Você não tem permissão para as orientações deste agente.'; end if;
  if p_id is not null and not exists (select 1 from public.orientacoes_agente where id = p_id and agente_id = a.id) then
    raise exception 'Orientação não encontrada.';
  end if;
  perform set_config('app.agente_orientacao', a.id::text, true);
  v_id := public.salvar_orientacao(p_id, p_titulo, p_texto, p_tipo, p_cliente_id, p_setor_id, p_ativo);
  perform set_config('app.agente_orientacao', '', true);
  return v_id;
end $$;

-- ---------- Aviso ao dono (5.1, 6.7) ----------
-- O dono ativo; sem dono marcado, o aviso fica para os administradores (alerta sem pessoa e sem setor). Fora da API.
create function interno.avisar_dono(p_mensagem text) returns void
language sql security definer set search_path = '' as $$
  insert into public.alertas (nivel, usuario_id, mensagem)
  values ('aviso', (select id from public.usuarios where dono and ativo limit 1), p_mensagem)
$$;
revoke execute on function interno.avisar_dono(text) from public, anon, authenticated;

-- Orientação geral (sem empresa e sem setor) vale para todos os clientes. Avisa quando ela fica ligada (criada ligada,
-- ligada ou restaurada como geral) e quando o texto de uma já ligada muda: senão bastava ligar algo inocente e trocar
-- depois. Um gatilho cobre salvar, ligar e restaurar, pelo Thiago e pelos outros agentes. Sem pessoa (semente,
-- trabalhador, testes): sem aviso.
create function public.orientacao_geral_avisa_dono() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_geral_antes boolean;
begin
  if auth.uid() is null or not new.ativo or new.cliente_id is not null or new.setor_id is not null then return null; end if;
  select nome into v_nome from public.usuarios where id = auth.uid();
  v_geral_antes := tg_op = 'UPDATE' and old.ativo and old.cliente_id is null and old.setor_id is null;
  if not v_geral_antes then
    perform interno.avisar_dono(format('%s ligou a orientação %s (vale para todos os clientes)', v_nome, new.titulo));
  elsif (new.titulo, new.texto, new.tipo) is distinct from (old.titulo, old.texto, old.tipo) then
    perform interno.avisar_dono(format('%s mudou a orientação ligada %s (vale para todos os clientes)', v_nome, new.titulo));
  end if;
  return null;
end $$;
revoke execute on function public.orientacao_geral_avisa_dono() from public, anon, authenticated;
create trigger avisa_dono after insert or update on public.orientacoes_agente
  for each row execute function public.orientacao_geral_avisa_dono();

-- ---------- Dados de pagamento do escritório (D3) ----------
-- Chaves conhecidas, todas texto e opcionais, com os mesmos limites de salvar_dados_pagamento (120; a observação, 500).
-- A checagem segura também a escrita direta do administrador pela API.
create function public.dados_pagamento_validos(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
     and not exists (select 1 from jsonb_each(p) e
                     where e.key not in ('pix', 'banco', 'agencia', 'conta', 'favorecido', 'observacao')
                        or jsonb_typeof(e.value) <> 'string'
                        or char_length(e.value #>> '{}') > case when e.key = 'observacao' then 500 else 120 end)
$$;
revoke execute on function public.dados_pagamento_validos(jsonb) from public, anon;
grant execute on function public.dados_pagamento_validos(jsonb) to authenticated, service_role;
alter table public.configuracoes add column dados_pagamento jsonb not null default '{}'
  constraint dados_pagamento_validos check (public.dados_pagamento_validos(dados_pagamento));

-- Só o administrador com o segundo fator. Apara cada campo e tira os vazios; o aviso ao dono sai pelo gatilho.
create function public.salvar_dados_pagamento(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public.exigir_segundo_fator();
  if not public.eh_admin() then raise exception 'Só o administrador muda os dados de pagamento.'; end if;
  if jsonb_typeof(p) is distinct from 'object'
     or exists (select 1 from jsonb_each(p) e
                where e.key not in ('pix', 'banco', 'agencia', 'conta', 'favorecido', 'observacao')
                   or jsonb_typeof(e.value) not in ('string', 'null')) then
    raise exception 'Dados de pagamento inválidos.';
  end if;
  select coalesce(jsonb_object_agg(e.key, btrim(e.value)), '{}'::jsonb) into v
  from jsonb_each_text(p) e where coalesce(btrim(e.value), '') <> '';
  if exists (select 1 from jsonb_each_text(v) e
             where char_length(e.value) > case when e.key = 'observacao' then 500 else 120 end) then
    raise exception 'Cada dado de pagamento tem até 120 letras; a observação, até 500.';
  end if;
  update public.configuracoes set dados_pagamento = v where id = 1;
end $$;
revoke execute on function public.salvar_dados_pagamento(jsonb) from public, anon;
grant execute on function public.salvar_dados_pagamento(jsonb) to authenticated;

-- ---------- Só o administrador (6.7, D3) ----------
-- Corpo de 20261006000100 + a segunda conferência: mensagens, aviso_login e dados_pagamento.
create or replace function public.configuracoes_so_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.eh_admin() then return new; end if;
  if (new.teto_ia_usd, new.alerta_ia_80_mes, new.minutos_alerta_fila, new.modelo_conversa, new.modelo_rapido, new.precos_modelos,
      new.telefone_dono, new.email_alertas, new.agente_pausado, new.cotacao_usd_brl, new.custo_minuto_transcricao_usd)
     is distinct from
     (old.teto_ia_usd, old.alerta_ia_80_mes, old.minutos_alerta_fila, old.modelo_conversa, old.modelo_rapido, old.precos_modelos,
      old.telefone_dono, old.email_alertas, old.agente_pausado, old.cotacao_usd_brl, old.custo_minuto_transcricao_usd) then
    raise exception 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.';
  end if;
  -- Auditoria 6.7: o que sai para os clientes (e para a tela de entrada) e os dados de pagamento (D3).
  if (new.mensagens, new.aviso_login, new.dados_pagamento) is distinct from (old.mensagens, old.aviso_login, old.dados_pagamento) then
    raise exception 'Só o administrador muda as mensagens automáticas, o aviso do login e os dados de pagamento.';
  end if;
  return new;
end $$;

-- "a, b e c"
create function interno.lista_e(p text[]) returns text
language sql immutable set search_path = '' as $$
  select case when cardinality(p) <= 1 then coalesce(p[1], '')
              else array_to_string(p[1:cardinality(p) - 1], ', ') || ' e ' || p[cardinality(p)] end
$$;
revoke execute on function interno.lista_e(text[]) from public, anon, authenticated;

-- Mudou mensagem automática ou dado de pagamento: o dono fica sabendo quem mudou e o quê. Do Pix vai só o nome do campo,
-- nunca o valor (o aviso não pode virar o próprio golpe). Sem pessoa (trabalhador, SQL do dono): sem aviso.
create function public.configuracoes_avisa_dono() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_campos text[];
begin
  if auth.uid() is null then return null; end if;
  select nome into v_nome from public.usuarios where id = auth.uid();
  if new.mensagens is distinct from old.mensagens then
    select array_agg(format('"%s"', case k when 'aviso_lgpd' then 'Aviso de privacidade' when 'fora_do_horario' then 'Fora do horário'
                                           when 'ia_indisponivel' then 'IA indisponível' when 'agente_pausado' then 'Agente pausado'
                                           else k end) order by k)
    into v_campos
    from (select jsonb_object_keys(old.mensagens) k union select jsonb_object_keys(new.mensagens)) c
    where old.mensagens -> k is distinct from new.mensagens -> k;
    perform interno.avisar_dono(format('%s %s alterada%s por %s',
      case when cardinality(v_campos) = 1 then 'Mensagem automática' else 'Mensagens automáticas' end,
      interno.lista_e(v_campos), case when cardinality(v_campos) = 1 then '' else 's' end, v_nome));
  end if;
  if new.dados_pagamento is distinct from old.dados_pagamento then
    select array_agg(case k when 'pix' then 'Pix' when 'banco' then 'Banco' when 'agencia' then 'Agência' when 'conta' then 'Conta'
                            when 'favorecido' then 'Favorecido' when 'observacao' then 'Observação' else k end
                     order by array_position(array['pix', 'banco', 'agencia', 'conta', 'favorecido', 'observacao'], k))
    into v_campos
    from (select jsonb_object_keys(old.dados_pagamento) k union select jsonb_object_keys(new.dados_pagamento)) c
    where old.dados_pagamento -> k is distinct from new.dados_pagamento -> k;
    perform interno.avisar_dono(format('%s %s por %s (dados de pagamento do escritório)', interno.lista_e(v_campos),
      case when cardinality(v_campos) = 1 then 'alterado' else 'alterados' end, v_nome));
  end if;
  return null;
end $$;
revoke execute on function public.configuracoes_avisa_dono() from public, anon, authenticated;
create trigger avisa_dono after update on public.configuracoes
  for each row when (new.mensagens is distinct from old.mensagens or new.dados_pagamento is distinct from old.dados_pagamento)
  execute function public.configuracoes_avisa_dono();

-- ---------- salvar_usuario: o horário do dono também só ele muda (revisão da Task 1) ----------
-- Corpo de 20261030000100; só a condição do dono ganhou o horário. Zerar os dias do dono derrubava usuario_liberado e eh_dono.
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
  perform public.exigir_segundo_fator();
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
    -- Auditoria 2.8 (Banco M1): papel, telefone e horário do dono só ele muda; o nome e o resto o administrador muda.
    if v_atual.papel::text is distinct from v_papel or v_atual.telefone is distinct from v_tel
       or (p_dados ? 'horario_acesso' and v_atual.horario_acesso is distinct from v_horario) then
      perform interno.exigir_nao_e_o_dono(p_id);
    end if;
    if v_papel <> 'admin' then perform interno.exigir_outro_admin(p_id); end if;
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
