-- Auditoria de alterações em cadastros e exclusão de dados a pedido do titular (LGPD).

create function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_linha jsonb := coalesce(to_jsonb(new), to_jsonb(old));
begin
  insert into auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(v_linha->>'id', v_linha->>'data', v_linha->>'cliente_id', v_linha->>'usuario_id'),
          jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new)));
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['usuarios', 'usuario_setores', 'setores', 'servicos', 'clientes', 'cliente_responsaveis',
                           'cliente_servicos', 'contatos', 'contato_clientes', 'configuracoes', 'feriados', 'respostas_prontas'] loop
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t);
  end loop;
end $$;

create function public.anonimizar_contato(p_contato uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare v_tel text; v_paths text[]; v_novo text;
begin
  if not eh_admin() then raise exception 'somente administrador'; end if;
  select telefone into v_tel from contatos where id = p_contato;
  if v_tel is null then raise exception 'contato não encontrado'; end if;

  select coalesce(array_agg(m.arquivo_path) filter (where m.arquivo_path is not null), '{}') into v_paths
  from mensagens m join conversas c on c.id = m.conversa_id
  where c.contato_id = p_contato or c.telefone = v_tel;

  update mensagens m set conteudo = '[removido a pedido do titular]', transcricao = null,
         arquivo_path = null, arquivo_nome = null, midia_url_origem = null
  from conversas c where c.id = m.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  delete from decisoes_agente d using conversas c where c.id = d.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);

  -- Resumos e notas dos chamados dessas conversas podem conter dados pessoais.
  update chamados ch set resumo = '[removido a pedido do titular]'
  from conversas c where c.id = ch.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  update chamado_eventos e set texto = null
  from chamados ch join conversas c on c.id = ch.conversa_id
  where ch.id = e.chamado_id and (c.contato_id = p_contato or c.telefone = v_tel);

  -- random() é avaliado por linha: cada conversa recebe um número fictício diferente (telefone é único).
  update conversas set telefone = '5500' || lpad(floor(random() * 1e9)::text, 9, '0') where contato_id = p_contato or telefone = v_tel;
  v_novo := '5500' || lpad(floor(random() * 1e9)::text, 9, '0');
  update contatos set nome = 'Contato removido', ativo = false, telefone = v_novo where id = p_contato;

  -- O gatilho de auditoria guardou nome e telefone originais em "antes": apagar esses registros também.
  delete from auditoria_acessos where entidade in ('contatos', 'contato_clientes')
    and (entidade_id = p_contato::text or detalhes::text like '%' || p_contato::text || '%');
  insert into auditoria_acessos (usuario_id, acao, entidade, entidade_id) values (auth.uid(), 'anonimizar', 'contatos', p_contato::text);
  return v_paths;
end $$;
