-- supabase/migrations/20261002000100_painel_v2_arquivar.sql
-- Painel v2, Parte B: arquivar, restaurar e excluir de vez os cadastros.
-- Arquivar reaproveita "ativo" (o trabalhador já filtra ativo = true) e guarda quem e quando.

do $$
declare t text;
begin
  foreach t in array array['clientes', 'contatos', 'produtos', 'parceiros_grupos', 'parceiros_unidades', 'usuarios'] loop
    execute format('alter table public.%I add column arquivado_em timestamptz, '
      'add column arquivado_por uuid references public.usuarios (id) on delete set null', t);
  end loop;
end $$;

-- Qualquer mudança de ativo (função, formulário antigo, LGPD) mantém quem e quando certos; restaurar limpa.
create function public.marcar_arquivamento() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.ativo is distinct from old.ativo then
    if new.ativo then
      new.arquivado_em := null;
      new.arquivado_por := null;
    else
      new.arquivado_em := coalesce(new.arquivado_em, now());
      new.arquivado_por := coalesce(new.arquivado_por, auth.uid());
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['clientes', 'contatos', 'produtos', 'parceiros_grupos', 'parceiros_unidades', 'usuarios'] loop
    execute format('create trigger arquivamento before update of ativo on public.%I for each row execute function public.marcar_arquivamento()', t);
  end loop;
end $$;

-- Tipo de cadastro → tabela (null = tipo desconhecido). Ajudante interno das funções abaixo.
create function public.tabela_do_cadastro(p_tipo text) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo
    when 'cliente' then 'clientes' when 'contato' then 'contatos' when 'produto' then 'produtos'
    when 'rede' then 'parceiros_grupos' when 'unidade' then 'parceiros_unidades' when 'usuario' then 'usuarios'
  end
$$;

-- Quem pode arquivar/restaurar (spec 5.2): pessoas só o admin; o resto, editar_clientes (ou admin). Devolve a tabela.
create function public.exigir_arquivar(p_tipo text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_tabela text := public.tabela_do_cadastro(p_tipo);
begin
  if v_tabela is null then raise exception 'Tipo de cadastro inválido.'; end if;
  if p_tipo = 'usuario' and not public.eh_admin() then raise exception 'Só o administrador arquiva pessoas.'; end if;
  if not public.tem_permissao('editar_clientes') then raise exception 'Sem permissão para arquivar cadastros.'; end if;
  return v_tabela;
end $$;

-- O que está ligado ao cadastro: decide entre arquivar (tem histórico) e excluir de vez (nunca usado).
create function public.uso_do_cadastro(p_tipo text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tabela text := public.exigir_arquivar(p_tipo);
  v_existe boolean;
  v_contagens jsonb;
  v_abertas jsonb := '[]';
begin
  execute format('select exists (select 1 from public.%I where id = $1)', v_tabela) into v_existe using p_id;
  if not v_existe then raise exception 'Cadastro não encontrado.'; end if;

  if p_tipo = 'cliente' then
    v_contagens := jsonb_build_object(
      'demandas', (select count(*) from public.chamados where cliente_id = p_id),
      'conversas', (select count(*) from public.conversas c where c.cliente_em_foco = p_id
        or exists (select 1 from public.mensagens m where m.conversa_id = c.id and m.cliente_id = p_id)),
      'mensagens', (select count(*) from public.mensagens where cliente_id = p_id),
      'precos', (select count(*) from public.precos where cliente_id = p_id),
      'produtos', (select count(*) from public.produtos where cliente_id = p_id),
      'redes', (select count(*) from public.parceiros_grupos where cliente_id = p_id),
      'unidades', (select count(*) from public.parceiros_unidades where cliente_id = p_id),
      'documentos', (select count(*) from public.documentos_empresa where cliente_id = p_id),
      'contatos', (select count(*) from public.contato_clientes where cliente_id = p_id),
      'orientacoes', (select count(*) from public.orientacoes_agente where cliente_id = p_id));
    select coalesce(jsonb_agg(numero order by numero), '[]') into v_abertas
      from public.chamados where cliente_id = p_id and status <> 'concluido';
  elsif p_tipo = 'contato' then
    v_contagens := jsonb_build_object(
      'conversas', (select count(*) from public.conversas where contato_id = p_id),
      'demandas', (select count(*) from public.chamados ch join public.conversas c on c.id = ch.conversa_id where c.contato_id = p_id),
      'precos_alterados', (select count(*) from public.precos where alterado_por_contato = p_id));
    select coalesce(jsonb_agg(ch.numero order by ch.numero), '[]') into v_abertas
      from public.chamados ch join public.conversas c on c.id = ch.conversa_id
      where c.contato_id = p_id and ch.status <> 'concluido';
  elsif p_tipo = 'produto' then
    -- O pedido de venda guarda o código (sku), não o id: conta pelo código dentro da empresa (ou sem empresa).
    v_contagens := jsonb_build_object(
      'precos', (select count(*) from public.precos where produto_id = p_id),
      'pedidos', (select count(*) from public.chamados ch, public.produtos p
        where p.id = p_id and ch.pedido_venda is not null
          and (ch.cliente_id = p.cliente_id or ch.cliente_id is null)
          and ch.pedido_venda -> 'itens' @> jsonb_build_array(jsonb_build_object('sku', p.codigo))));
  elsif p_tipo = 'rede' then
    v_contagens := jsonb_build_object(
      'precos', (select count(*) from public.precos where grupo_id = p_id),
      'unidades', (select count(*) from public.parceiros_unidades where grupo_id = p_id),
      'pedidos', (select count(*) from public.chamados
        where pedido_venda ->> 'unidade_id' in (select id::text from public.parceiros_unidades where grupo_id = p_id)));
  elsif p_tipo = 'unidade' then
    v_contagens := jsonb_build_object(
      'pedidos', (select count(*) from public.chamados where pedido_venda ->> 'unidade_id' = p_id::text));
  else
    v_contagens := jsonb_build_object(
      'conversas', (select count(*) from public.conversas where atendente_id = p_id),
      'mensagens', (select count(*) from public.mensagens where atendente_id = p_id),
      'demandas', (select count(*) from public.chamados where responsavel_id = p_id),
      'eventos', (select count(*) from public.chamado_eventos where usuario_id = p_id),
      'precos', (select count(*) from public.precos where alterado_por = p_id),
      'assistente', (select count(*) from public.assistente_mensagens where usuario_id = p_id),
      'orientacoes', (select count(*) from public.orientacoes_agente where criado_por = p_id or atualizado_por = p_id),
      'responsabilidades', (select count(*) from public.cliente_responsaveis where usuario_id = p_id));
    select coalesce(jsonb_agg(numero order by numero), '[]') into v_abertas
      from public.chamados where responsavel_id = p_id and status <> 'concluido';
  end if;
  return jsonb_build_object('contagens', v_contagens, 'abertas', v_abertas);
end $$;

-- Arquivar: sai das listas e do agente; o histórico fica. Demanda aberta só gera aviso na tela.
create function public.arquivar_cadastro(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tabela text := public.exigir_arquivar(p_tipo); v_uso jsonb; v_n int;
begin
  if p_tipo = 'usuario' and p_id = auth.uid() then raise exception 'Você não pode arquivar o próprio acesso.'; end if;
  v_uso := public.uso_do_cadastro(p_tipo, p_id);
  execute format('update public.%I set ativo = false, arquivado_em = now(), arquivado_por = $2 where id = $1 and ativo', v_tabela)
    using p_id, auth.uid();
  get diagnostics v_n = row_count;
  -- Já estava arquivado (dois cliques, duas abas): nada mudou, então a auditoria não ganha linha repetida.
  if v_n = 0 then return; end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'arquivar', v_tabela, p_id::text, v_uso);
end $$;

-- Restaurar: volta como estava (o gatilho limpa quem e quando). Contato anonimizado pela LGPD não volta.
create function public.restaurar_cadastro(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tabela text := public.exigir_arquivar(p_tipo); v_n int;
begin
  if p_tipo = 'contato' and exists (select 1 from public.auditoria_acessos
      where acao = 'anonimizar' and entidade = 'contatos' and entidade_id = p_id::text) then
    raise exception 'Os dados deste contato foram apagados (LGPD). Ele não volta.';
  end if;
  execute format('update public.%I set ativo = true where id = $1', v_tabela) using p_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Cadastro não encontrado.'; end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id)
  values (auth.uid(), 'restaurar', v_tabela, p_id::text);
end $$;

-- Excluir de vez: só admin e só o que nunca foi usado; recusa aqui mesmo que a tela tenha deixado passar.
create function public.excluir_cadastro_definitivo(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tabela text := public.tabela_do_cadastro(p_tipo); v_uso jsonb; v_linha jsonb;
begin
  if v_tabela is null then raise exception 'Tipo de cadastro inválido.'; end if;
  if not public.eh_admin() then raise exception 'Só o administrador exclui de vez.'; end if;
  if p_tipo = 'usuario' and p_id = auth.uid() then raise exception 'Você não pode excluir o próprio acesso.'; end if;
  -- Trava a linha: quem tentar ligar algo a ela agora espera, e a contagem abaixo não fica velha.
  execute format('select to_jsonb(t) from public.%I t where id = $1 for update', v_tabela) into v_linha using p_id;
  v_uso := public.uso_do_cadastro(p_tipo, p_id);
  if exists (select 1 from jsonb_each_text(v_uso -> 'contagens') where value::bigint > 0) then
    raise exception 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.';
  end if;
  execute format('delete from public.%I where id = $1', v_tabela) using p_id;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'excluir_definitivo', v_tabela, p_id::text, jsonb_build_object('antes', v_linha));
end $$;

revoke all on function public.uso_do_cadastro(text, uuid), public.arquivar_cadastro(text, uuid),
  public.restaurar_cadastro(text, uuid), public.excluir_cadastro_definitivo(text, uuid) from public, anon, authenticated;
grant execute on function public.uso_do_cadastro(text, uuid), public.arquivar_cadastro(text, uuid),
  public.restaurar_cadastro(text, uuid), public.excluir_cadastro_definitivo(text, uuid) to authenticated;
revoke all on function public.tabela_do_cadastro(text), public.exigir_arquivar(text), public.marcar_arquivamento()
  from public, anon, authenticated;
