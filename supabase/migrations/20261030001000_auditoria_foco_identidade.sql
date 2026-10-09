-- supabase/migrations/20261030001000_auditoria_foco_identidade.sql
-- Auditoria 3.8, 1.4/3.9, 1.10 e 1.9 (Task 11): a identidade do contato e a empresa em foco da conversa sempre válidas.
--   * 3.8: um contato ativo por telefone, com ou sem o nono dígito (telefone_canonico, da 20261030000100).
--   * 1.4/3.9 e 1.10: trocar o contato da conversa zera a empresa em foco e grava a hora da troca.
--   * 1.9: salvar_acesso_contato grava o perfil das marcações (perfil_das_marcas, a mesma regra do core), não o que veio.

-- ---------- 3.8: um contato ativo por telefone canônico ----------
-- Contatos ativos duplicados já gravados param a migração com os ids (nada é apagado aqui): alguém arquiva um de cada par
-- no painel e aplica de novo. Só os ids: o telefone é dado pessoal e fica fora da mensagem.
do $$
declare v_lista text;
begin
  select string_agg('[' || ids || ']', ' ') into v_lista from (
    select string_agg(id::text, ', ' order by criado_em) as ids
      from public.contatos
     where ativo and public.telefone_canonico(telefone) is not null
     group by public.telefone_canonico(telefone)
    having count(*) > 1) d;
  if v_lista is not null then
    raise exception 'Contatos ativos com o mesmo telefone (com e sem o nono dígito): %. Arquive um de cada grupo e aplique de novo.', v_lista;
  end if;
end $$;

-- O índice comum da 20261030000100 vira único: segura até a corrida entre dois cadastros ao mesmo tempo.
drop index public.contatos_telefone_canonico;
create unique index contatos_telefone_unico on public.contatos (public.telefone_canonico(telefone)) where ativo;

-- A frase para a tela (cadastro, reativação, restauração). O índice continua sendo a trava final. Como os gatilhos de
-- equipe e contato da 20261030000100: security definer para enxergar todos os contatos.
create function public.telefone_contato_unico() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.ativo and exists (
    select 1 from public.contatos c
     where c.ativo and c.id <> new.id and public.telefone_canonico(c.telefone) = public.telefone_canonico(new.telefone)) then
    raise exception 'Este telefone já é de outro contato (com ou sem o nono dígito).';
  end if;
  return new;
end $$;
revoke execute on function public.telefone_contato_unico() from public, anon, authenticated;
create trigger telefone_contato_unico before insert or update of telefone, ativo on public.contatos
  for each row execute function public.telefone_contato_unico();

-- O trabalhador acha o contato pelo canônico, no banco (o índice acima). Mais de um é erro: nunca "o primeiro de vários".
create function public.contato_ativo_do_telefone(p_telefone text) returns uuid
language plpgsql stable set search_path = '' as $$
declare v_ids uuid[];
begin
  select array_agg(id) into v_ids from public.contatos
   where ativo and public.telefone_canonico(telefone) = public.telefone_canonico(p_telefone);
  if cardinality(v_ids) > 1 then raise exception 'Mais de um contato ativo com este telefone.'; end if;
  return v_ids[1];
end $$;
revoke execute on function public.contato_ativo_do_telefone(text) from public, anon, authenticated;
grant execute on function public.contato_ativo_do_telefone(text) to service_role;

-- A conferência da tela antes de cadastrar (20261003000100) passa a recusar a outra forma do número de um contato ativo,
-- com a mesma frase do gatilho: a tela mostra a mensagem do banco antes de enviar o cadastro.
create or replace function public.contato_arquivado_do_telefone(p_telefone text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid; v_nome text; v_ativo boolean;
begin
  if not public.tem_permissao('editar_clientes') then raise exception 'Você não tem permissão para cadastrar contatos.'; end if;
  if exists (select 1 from public.contatos c
              where c.ativo and c.telefone <> p_telefone
                and public.telefone_canonico(c.telefone) = public.telefone_canonico(p_telefone)) then
    raise exception 'Este telefone já é de outro contato (com ou sem o nono dígito).';
  end if;
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

-- ---------- 1.4/3.9 e 1.10: troca de contato na conversa ----------
alter table public.conversas add column contato_trocado_em timestamptz;
comment on column public.conversas.contato_trocado_em is
  'Última troca de contato_id (auditoria 1.10): o histórico de número desconhecido não passa daqui para trás.';

-- O trabalhador grava os dois em obterOuCriarConversa; o gatilho cobre os outros caminhos (vincular_contato_conversa no
-- painel). Foco escolhido na mesma escrita vale.
create function public.conversa_troca_de_contato() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.contato_id is distinct from old.contato_id then
    if new.contato_trocado_em is not distinct from old.contato_trocado_em then new.contato_trocado_em := now(); end if;
    if new.cliente_em_foco is not distinct from old.cliente_em_foco then new.cliente_em_foco := null; end if;
  end if;
  return new;
end $$;
revoke execute on function public.conversa_troca_de_contato() from public, anon, authenticated;
create trigger troca_de_contato before update of contato_id on public.conversas
  for each row execute function public.conversa_troca_de_contato();

-- Número reciclado (revisão da 1.10): o contato arquivado, ou com o telefone trocado, deixa de ser o dono das conversas dele.
-- O contato_id fica (o painel ainda mostra quem era), mas a hora da troca corta o histórico do número que agora é
-- desconhecido e o foco sai. security definer: quem arquiva no painel não precisa poder escrever em conversas.
create function public.contato_deixou_o_numero() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (old.ativo and not new.ativo) or new.telefone is distinct from old.telefone then
    update public.conversas set contato_trocado_em = now(), cliente_em_foco = null where contato_id = old.id;
  end if;
  return null;
end $$;
revoke execute on function public.contato_deixou_o_numero() from public, anon, authenticated;
create trigger deixou_o_numero after update of ativo, telefone on public.contatos
  for each row execute function public.contato_deixou_o_numero();

-- ---------- 1.9: o perfil é o das marcações ----------
-- Porta de perfilDasMarcas + marcasDoPerfil + setoresDisponiveis (packages/core/src/acesso.ts). Mudar os perfis prontos
-- (PRESETS) lá pede mudar aqui também; o pgTAP 129 tem os mesmos casos do teste do core.
create function public.perfil_das_marcas(p_cliente uuid, p_dados jsonb) returns text
language plpgsql stable set search_path = '' as $$
declare
  v_marcas text[];
  v_nota boolean := coalesce((p_dados ->> 'pode_pedir_nota')::boolean, false);
  v_preco boolean := coalesce((p_dados ->> 'pode_atualizar_preco')::boolean, false);
  v_valores boolean := coalesce((p_dados ->> 'ver_valores')::boolean, false);
  v_docs boolean := coalesce((p_dados ->> 'receber_documentos')::boolean, false);
  v_contratados uuid[];
  v_sem_servico boolean;
  p record;
begin
  select coalesce(array_agg(x order by x), '{}') into v_marcas from (
    select (s ->> 'setor_id') || ':' || coalesce((s ->> 'pode_ser_procurado')::boolean, false)::text as x
      from jsonb_array_elements(coalesce(p_dados -> 'setores', '[]'::jsonb)) s) m;
  -- Básico = nenhum setor, sem valores e sem documentos; nota e preço não contam (D3).
  if cardinality(v_marcas) = 0 and not v_valores and not v_docs then return 'basico'; end if;
  -- Setores contratados (serviço ativo); a Direção nunca entra (D5); sem nenhum contratado, todos valem.
  select coalesce(array_agg(distinct sv.setor_id), '{}') into v_contratados
    from public.cliente_servicos cs join public.servicos sv on sv.id = cs.servico_id
   where cs.cliente_id = p_cliente and sv.ativo and sv.setor_id is not null;
  v_sem_servico := not exists (select 1 from public.setores st where st.ativo and st.nome <> 'Direção' and st.id = any (v_contratados));
  for p in
    select * from (values
      (1, 'socio', null::text[], true, true, true, true, true),
      (2, 'administrativo', array['Fiscal', 'Contábil', 'Financeiro', 'Legalização'], true, true, false, true, true),
      (3, 'financeiro', array['Financeiro', 'Contábil'], true, false, false, true, true),
      (4, 'rh_dp', array['Pessoal'], true, false, false, true, true),
      (5, 'compras_vendas', array['Fiscal'], true, true, true, false, true),
      (6, 'funcionario', array['Fiscal'], false, true, false, false, false)
    ) as t(ordem, perfil, setores, procurado, nota, preco, valores, documentos)
    order by ordem
  loop
    if (p.nota, p.preco, p.valores, p.documentos) = (v_nota, v_preco, v_valores, v_docs)
       and v_marcas = (
         select coalesce(array_agg(x order by x), '{}') from (
           select st.id::text || ':' || p.procurado::text as x
             from public.setores st
            where st.ativo and st.nome <> 'Direção'
              and (v_sem_servico or st.nome = 'Financeiro' or st.id = any (v_contratados))
              and (p.setores is null or st.nome = any (p.setores))) b) then
      return p.perfil;
    end if;
  end loop;
  return 'personalizado';
end $$;
revoke execute on function public.perfil_das_marcas(uuid, jsonb) from public, anon, authenticated;

-- Corpo da 20261013000100 com uma mudança: o perfil gravado é recalculado das marcações (o que veio só precisa estar na lista).
create or replace function public.salvar_acesso_contato(p_contato uuid, p_cliente uuid, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_perfil text := p_dados ->> 'perfil';
  v_setores jsonb := coalesce(p_dados -> 'setores', '[]'::jsonb);
  v_ids uuid[];
  v_avisar text[];
  v_linhas int;
begin
  if not public.tem_permissao('editar_clientes') then raise exception 'Você não tem permissão para editar contatos.'; end if;
  if v_perfil is null or v_perfil not in ('socio', 'administrativo', 'financeiro', 'rh_dp', 'compras_vendas', 'funcionario', 'basico', 'personalizado') then
    raise exception 'Perfil inválido.';
  end if;
  if not exists (select 1 from public.contatos where id = p_contato and ativo) then
    raise exception 'Contato arquivado: restaure para mudar as marcações.';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente and ativo) then
    raise exception 'Empresa arquivada: restaure a empresa para mudar o acesso.';
  end if;
  if jsonb_typeof(v_setores) <> 'array' then raise exception 'Setores inválidos.'; end if;
  begin
    select coalesce(array_agg((s ->> 'setor_id')::uuid), '{}') into v_ids from jsonb_array_elements(v_setores) s;
  exception when invalid_text_representation then
    raise exception 'Setor inválido ou desativado.';
  end;
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then raise exception 'Setor repetido.'; end if;
  if exists (select 1 from unnest(v_ids) x where x is null or not exists (select 1 from public.setores st where st.id = x and st.ativo)) then
    raise exception 'Setor inválido ou desativado.';
  end if;
  -- Direção recebe os assuntos sensíveis e nunca é um setor que o contato trata (D5).
  if exists (select 1 from public.setores st where st.id = any (v_ids) and st.nome = 'Direção') then
    raise exception 'A Direção não entra no acesso do contato.';
  end if;
  select coalesce(array_agg(distinct x order by x), '{}') into v_avisar
    from jsonb_array_elements_text(coalesce(p_dados -> 'avisar_documento_novo', '[]'::jsonb)) x;
  -- Auditoria 1.9: o agente usa "não Básico" como chave (cadastro da empresa). Quem chama a função direto com "Sócio" e
  -- nenhuma marcação fica Básico: vale o perfil das marcações, calculado como no painel.
  v_perfil := public.perfil_das_marcas(p_cliente, p_dados);

  -- O gatilho dos caminhos antigos não se mete (D6).
  perform set_config('escritorio.salvando_acesso', '1', true);
  update public.contato_clientes set
    perfil = v_perfil,
    pode_pedir_nota = coalesce((p_dados ->> 'pode_pedir_nota')::boolean, false),
    pode_atualizar_preco = coalesce((p_dados ->> 'pode_atualizar_preco')::boolean, false),
    ver_valores = coalesce((p_dados ->> 'ver_valores')::boolean, false),
    receber_documentos = coalesce((p_dados ->> 'receber_documentos')::boolean, false),
    avisar_documento_novo = v_avisar,
    recebe_alertas_acesso = coalesce((p_dados ->> 'recebe_alertas_acesso')::boolean, false)
  where contato_id = p_contato and cliente_id = p_cliente;
  get diagnostics v_linhas = row_count;
  perform set_config('escritorio.salvando_acesso', '', true);
  if v_linhas = 0 then raise exception 'Este contato não está mais ligado a esta empresa.'; end if;

  delete from public.contato_cliente_setores
   where contato_id = p_contato and cliente_id = p_cliente and not (setor_id = any (v_ids));
  insert into public.contato_cliente_setores (contato_id, cliente_id, setor_id, pode_ser_procurado)
  select p_contato, p_cliente, (s ->> 'setor_id')::uuid, coalesce((s ->> 'pode_ser_procurado')::boolean, false)
    from jsonb_array_elements(v_setores) s
  on conflict (contato_id, cliente_id, setor_id) do update set pode_ser_procurado = excluded.pode_ser_procurado
   where public.contato_cliente_setores.pode_ser_procurado is distinct from excluded.pode_ser_procurado;

  if p_dados ? 'contato' then
    update public.contatos set
      nome = coalesce(nullif(btrim(p_dados -> 'contato' ->> 'nome'), ''), nome),
      cargo = nullif(btrim(coalesce(p_dados -> 'contato' ->> 'cargo', '')), ''),
      email = nullif(lower(btrim(coalesce(p_dados -> 'contato' ->> 'email', ''))), '')
    where id = p_contato;
  end if;
end $$;
