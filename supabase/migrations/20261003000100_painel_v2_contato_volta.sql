-- supabase/migrations/20261003000100_painel_v2_contato_volta.sql
-- Sobra 5 da Parte B (decisão do dono, 02/10): contato arquivado cadastrado de novo volta com as empresas de antes
-- que a pessoa escolher na hora (nenhuma por padrão); a empresa da ação sempre entra (a tela grava depois).
-- A 20261002000100 já está na homologação: aqui só se troca a função e se cria a consulta da pergunta.

-- A assinatura antiga sai: com as duas, a chamada por nome sem p_manter ficaria ambígua.
drop function public.cadastrar_contato(text, text, uuid, boolean);

create function public.cadastrar_contato(p_nome text, p_telefone text, p_cliente uuid default null,
  p_agente_pausado boolean default null, p_manter uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_ativo boolean; v_mantidos uuid[]; v_removidos uuid[];
begin
  if not public.tem_permissao('editar_clientes') then raise exception 'Você não tem permissão para cadastrar contatos.'; end if;
  loop
    -- Trava a linha: outro cadastro do mesmo telefone espera, e só um deles reativa e decide os vínculos.
    select id, ativo into v_id, v_ativo from public.contatos where telefone = p_telefone for update;
    exit when found;
    insert into public.contatos (nome, telefone, agente_pausado) values (p_nome, p_telefone, coalesce(p_agente_pausado, false))
      on conflict (telefone) do nothing returning id into v_id;
    if v_id is not null then
      return jsonb_build_object('id', v_id, 'reativado', false, 'vinculos_removidos', 0, 'vinculos_mantidos', 0);
    end if;
  end loop;
  -- Contato apagado pela LGPD não volta: o telefone dele é fictício, mas pode ser digitado.
  if not v_ativo and exists (select 1 from public.auditoria_acessos
      where acao = 'anonimizar' and entidade = 'contatos' and entidade_id = v_id::text) then
    raise exception 'Os dados deste contato foram apagados (LGPD). Ele não volta.';
  end if;
  update public.contatos set nome = p_nome, ativo = true, agente_pausado = coalesce(p_agente_pausado, agente_pausado)
    where id = v_id;
  -- Contato que já estava ativo segue como estava (a lista da pergunta é ignorada).
  if v_ativo then
    return jsonb_build_object('id', v_id, 'reativado', false, 'vinculos_removidos', 0, 'vinculos_mantidos', 0);
  end if;
  -- Ficam só os escolhidos que já eram vínculo e são de empresa ativa; a empresa da ação é recriada pela tela.
  select coalesce(array_agg(cc.cliente_id), '{}') into v_mantidos
    from public.contato_clientes cc join public.clientes c on c.id = cc.cliente_id
    where cc.contato_id = v_id and c.ativo and cc.cliente_id = any (coalesce(p_manter, '{}'))
      and cc.cliente_id is distinct from p_cliente;
  with apagados as (
    delete from public.contato_clientes where contato_id = v_id and not (cliente_id = any (v_mantidos)) returning cliente_id)
  select coalesce(array_agg(cliente_id) filter (where cliente_id is distinct from p_cliente), '{}') into v_removidos from apagados;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'reativar_contato', 'contatos', v_id::text,
    jsonb_build_object('empresa_nova', p_cliente, 'mantidos', to_jsonb(v_mantidos), 'removidos', to_jsonb(v_removidos)));
  return jsonb_build_object('id', v_id, 'reativado', true,
    'vinculos_removidos', cardinality(v_removidos), 'vinculos_mantidos', cardinality(v_mantidos));
end $$;

-- Antes de cadastrar: o telefone é de um contato arquivado? A tela pergunta quais empresas de antes voltam.
create function public.contato_arquivado_do_telefone(p_telefone text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid; v_nome text; v_ativo boolean;
begin
  if not public.tem_permissao('editar_clientes') then raise exception 'Você não tem permissão para cadastrar contatos.'; end if;
  select id, nome, ativo into v_id, v_nome, v_ativo from public.contatos where telefone = p_telefone;
  if not found or v_ativo then return null; end if;
  if exists (select 1 from public.auditoria_acessos where acao = 'anonimizar' and entidade = 'contatos' and entidade_id = v_id::text) then
    return jsonb_build_object('id', v_id, 'anonimizado', true, 'vinculos', '[]'::jsonb);
  end if;
  return jsonb_build_object('id', v_id, 'nome', v_nome, 'anonimizado', false, 'vinculos', coalesce((
    select jsonb_agg(jsonb_build_object('cliente_id', c.id, 'razao_social', c.razao_social, 'nome_fantasia', c.nome_fantasia,
        'pode_pedir_nota', cc.pode_pedir_nota, 'pode_atualizar_preco', cc.pode_atualizar_preco)
      order by coalesce(c.nome_fantasia, c.razao_social))
    from public.contato_clientes cc join public.clientes c on c.id = cc.cliente_id
    where cc.contato_id = v_id and c.ativo), '[]'::jsonb));
end $$;

revoke all on function public.cadastrar_contato(text, text, uuid, boolean, uuid[]),
  public.contato_arquivado_do_telefone(text) from public, anon, authenticated;
grant execute on function public.cadastrar_contato(text, text, uuid, boolean, uuid[]),
  public.contato_arquivado_do_telefone(text) to authenticated;
