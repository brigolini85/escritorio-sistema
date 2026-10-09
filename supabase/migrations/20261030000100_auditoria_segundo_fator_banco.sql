-- supabase/migrations/20261030000100_auditoria_segundo_fator_banco.sql
-- Auditoria 2.1, 2.4, 2.5, 2.8 e parte de 5.3: o segundo fator passa a valer dentro do banco. Antes ele só travava 6
-- funções; com só a senha (token aal1) o administrador lia e alterava quase tudo direto pela API.
--
-- Regra: as funções-base com a pessoa (eh_admin_de, usuario_liberado e, por ela, tem_nivel_de) só dizem "sim" para a
-- própria pessoa logada se o segundo fator estiver em dia. RLS, Realtime, Storage e funções passam por elas.
-- Para o trabalhador (chave de serviço, auth.uid() nulo) e para perguntas sobre OUTRA pessoa nada muda.
--
-- Também: escrita direta em usuarios/usuario_permissoes/usuario_setores sai (tudo pelas funções), o dono fica protegido
-- de quem não é o dono, o telefone da equipe é único e não pode ser o de um contato de cliente, e o cadastro do
-- aplicativo autenticador gera aviso ao dono.

-- ---------- Quem precisa do segundo fator ----------

-- Auditoria 2.4: o dono entra na regra (ele muda os agentes que falam com os clientes).
create function public.exige_segundo_fator_de(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios
                 where id = p_usuario and ativo and (papel = 'admin' or ver_acessos_portais or dono))
$$;
revoke execute on function public.exige_segundo_fator_de(uuid) from public, anon, authenticated;
grant execute on function public.exige_segundo_fator_de(uuid) to service_role;

create or replace function public.exige_segundo_fator() returns boolean
language sql stable security definer set search_path = '' as $$ select public.exige_segundo_fator_de(auth.uid()) $$;

-- ---------- Funções-base: a própria pessoa só passa com o fator em dia (auditoria 2.1) ----------
-- segundo_fator_ok() lê usuarios como dona da tabela (security definer): não volta para estas regras.

create or replace function public.eh_admin_de(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios where id = p_usuario and ativo and papel = 'admin')
     and (p_usuario is distinct from auth.uid() or public.segundo_fator_ok())
$$;

-- tem_nivel_de começa por usuario_liberado: herda a trava sem mudar o corpo.
create or replace function public.usuario_liberado(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.horario_permite(p_usuario, now())
     and (p_usuario is distinct from auth.uid() or public.segundo_fator_ok())
$$;

-- As duas regras da própria pessoa que iam direto ao horário (funções de gravação na própria linha, cronômetro).
create or replace function public.pode_acessar_agora() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.horario_permite(auth.uid(), now()) and public.segundo_fator_ok()
$$;

create or replace function public.exigir_acesso() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  -- Primeiro o fator: sem ele a mensagem seria "Fora do seu horário de acesso.", que engana.
  perform public.exigir_segundo_fator();
  if public.eh_admin() then return; end if;
  if not exists (select 1 from public.usuarios where id = auth.uid() and ativo) then raise exception 'Acesso desativado.'; end if;
  if not public.pode_acessar_agora() then raise exception 'Fora do seu horário de acesso.'; end if;
end $$;

-- ---------- As 6 funções do cofre e de pessoas: a trava vem primeiro ----------
-- Com as funções-base travadas, quem está em aal1 cairia antes em "Sem permissão". A trava na primeira linha mantém o
-- motivo certo ("Confirme o código...", 42501). Corpos de 20261029000100; só a linha da trava mudou de lugar.

-- revelar_acesso
create or replace function public.revelar_acesso(p_id uuid, p_acao text default 'revelar') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.cliente_acessos%rowtype;
begin
  perform public.exigir_segundo_fator();
  -- A trava de pessoa ativa e no horário fica escrita aqui também (portão do teste 25), mesmo já estando em pode_ver_acessos.
  if not (public.eh_admin() or (public.eh_usuario_ativo() and public.pode_ver_acessos())) then
    raise exception 'Sem permissão para ver acessos de portais.';
  end if;
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
  perform public.exigir_segundo_fator();
  if not (public.tem_permissao('editar_clientes') and public.pode_ver_acessos()) then
    raise exception 'Sem permissão para mudar acessos de portais.';
  end if;
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
  perform public.exigir_segundo_fator();
  if not (public.tem_permissao('editar_clientes') and public.pode_ver_acessos()) then
    raise exception 'Sem permissão para mudar acessos de portais.';
  end if;
  delete from public.cliente_acessos where id = p_id returning * into v;
  if v.id is null then raise exception 'Acesso não encontrado.'; end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'remover_acesso', 'cliente_acessos', v.id::text, jsonb_build_object('cliente_id', v.cliente_id, 'portal', v.portal));
end $$;
-- exigir_arquivar
create or replace function public.exigir_arquivar(p_tipo text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_tabela text := public.tabela_do_cadastro(p_tipo);
begin
  perform public.exigir_segundo_fator();
  if v_tabela is null then raise exception 'Tipo de cadastro inválido.'; end if;
  if p_tipo = 'usuario' and not public.eh_admin() then raise exception 'Só o administrador arquiva pessoas.'; end if;
  if not public.tem_permissao('clientes', 'arquivar') then raise exception 'Sem permissão para arquivar cadastros.'; end if;
  return v_tabela;
end $$;

-- ---------- Pessoas: só pelas funções (auditoria 2.8) ----------
-- salvar_usuario grava usuarios, usuario_setores e usuario_permissoes; arquivar_cadastro, definir_ver_acessos,
-- definir_tamanho_letra, definir_visao_demandas e situacao_acesso cuidam do resto. Nenhuma escrita direta pela API.
revoke insert, update, delete, truncate on public.usuarios, public.usuario_permissoes, public.usuario_setores from anon, authenticated;
drop policy escrita_admin on public.usuarios;
drop policy escrita_admin on public.usuario_setores;
drop policy escrita_admin on public.usuario_permissoes;

-- Dono (Banco M1): só ele mesmo muda o acesso dele. Fica fora da API.
create function interno.exigir_nao_e_o_dono(p_usuario uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.usuarios where id = p_usuario and dono) and not public.eh_dono() then
    raise exception 'Só o dono muda o próprio acesso.';
  end if;
end $$;
revoke execute on function interno.exigir_nao_e_o_dono(uuid) from public, anon, authenticated;

-- Último administrador ativo: o escritório nunca fica sem nenhum. Fica fora da API.
create function interno.exigir_outro_admin(p_usuario uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.usuarios where id = p_usuario and ativo and papel = 'admin')
     and not exists (select 1 from public.usuarios where id <> p_usuario and ativo and papel = 'admin') then
    raise exception 'O escritório precisa de pelo menos um administrador ativo.';
  end if;
end $$;
revoke execute on function interno.exigir_outro_admin(uuid) from public, anon, authenticated;

-- salvar_usuario: corpo de 20261029000100 + trava primeiro, dono protegido e último administrador.
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
    -- Auditoria 2.8 (Banco M1): papel e telefone do dono só ele muda; o nome e o resto o administrador muda.
    if v_atual.papel::text is distinct from v_papel or v_atual.telefone is distinct from v_tel then
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

-- definir_ver_acessos: corpo de 20261029000100 + trava primeiro e dono protegido.
create or replace function public.definir_ver_acessos(p_usuario uuid, p_pode boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_segundo_fator();
  if not public.eh_admin() then raise exception 'Só o administrador muda pessoas.'; end if;
  perform interno.exigir_nao_e_o_dono(p_usuario);
  update public.usuarios set ver_acessos_portais = coalesce(p_pode, false) where id = p_usuario and ativo;
  if not found then raise exception 'Pessoa não encontrada.'; end if;
end $$;

-- arquivar_cadastro: corpo de 20261002000100 + dono protegido e último administrador.
create or replace function public.arquivar_cadastro(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tabela text := public.exigir_arquivar(p_tipo); v_uso jsonb; v_n int;
begin
  if p_tipo = 'usuario' and p_id = auth.uid() then raise exception 'Você não pode arquivar o próprio acesso.'; end if;
  if p_tipo = 'usuario' then
    perform interno.exigir_nao_e_o_dono(p_id);
    perform interno.exigir_outro_admin(p_id);
  end if;
  v_uso := public.uso_do_cadastro(p_tipo, p_id);
  execute format('update public.%I set ativo = false, arquivado_em = now(), arquivado_por = $2 where id = $1 and ativo', v_tabela)
    using p_id, auth.uid();
  get diagnostics v_n = row_count;
  -- Já estava arquivado (dois cliques, duas abas): nada mudou, então a auditoria não ganha linha repetida.
  if v_n = 0 then return; end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'arquivar', v_tabela, p_id::text, v_uso);
end $$;

-- excluir_cadastro_definitivo: corpo de 20261002000100 + dono protegido e último administrador.
create or replace function public.excluir_cadastro_definitivo(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tabela text := public.tabela_do_cadastro(p_tipo); v_uso jsonb; v_linha jsonb;
begin
  if v_tabela is null then raise exception 'Tipo de cadastro inválido.'; end if;
  if not public.eh_admin() then raise exception 'Só o administrador exclui de vez.'; end if;
  if p_tipo = 'usuario' and p_id = auth.uid() then raise exception 'Você não pode excluir o próprio acesso.'; end if;
  if p_tipo = 'usuario' then
    perform interno.exigir_nao_e_o_dono(p_id);
    perform interno.exigir_outro_admin(p_id);
  end if;
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

-- ---------- salvar_agente: corpo de 20261014000100 + a trava (auditoria 2.4) ----------
-- As outras funções do dono já recusam pelo eh_dono(); aqui a recusa diz o motivo (42501, como as do cofre).
create or replace function public.salvar_agente(p_slug text, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; n public.agentes%rowtype; k text; m text[] := '{}'; v_mais text[]; v_menos text[];
begin
  perform public.exigir_segundo_fator();
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono altera os agentes.'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados do agente inválidos.'; end if;
  for k in select jsonb_object_keys(p_dados) loop
    if k not in ('nome', 'descricao', 'setor_id', 'tipos', 'estado', 'modelo', 'modo_contato', 'ferramentas') then
      raise exception 'Dados do agente inválidos.';
    end if;
  end loop;
  select * into a from public.agentes where slug = p_slug for update;
  if not found then raise exception 'Agente não encontrado.'; end if;
  n := a;
  begin
    if p_dados ? 'nome' then n.nome := trim(p_dados ->> 'nome'); end if;
    if p_dados ? 'descricao' then n.descricao := coalesce(trim(p_dados ->> 'descricao'), ''); end if;
    if p_dados ? 'setor_id' then n.setor_id := nullif(p_dados ->> 'setor_id', '')::uuid; end if;
    if p_dados ? 'tipos' then n.tipos := array(select distinct jsonb_array_elements_text(p_dados -> 'tipos') order by 1); end if;
    if p_dados ? 'estado' then n.estado := p_dados ->> 'estado'; end if;
    if p_dados ? 'modelo' then n.modelo := nullif(trim(p_dados ->> 'modelo'), ''); end if;
    if p_dados ? 'modo_contato' then n.modo_contato := nullif(p_dados ->> 'modo_contato', ''); end if;
    if p_dados ? 'ferramentas' then n.ferramentas := array(select distinct jsonb_array_elements_text(p_dados -> 'ferramentas') order by 1); end if;
  exception when invalid_text_representation or invalid_parameter_value then
    raise exception 'Dados do agente inválidos.';
  end;
  if n.nome is null or char_length(n.nome) not between 2 and 60 then raise exception 'O nome do agente tem de 2 a 60 letras.'; end if;
  if char_length(n.descricao) > 120 then raise exception 'A descrição tem até 120 letras.'; end if;
  if n.setor_id is not null and not exists (select 1 from public.setores where id = n.setor_id and ativo) then
    raise exception 'Setor não encontrado ou inativo.';
  end if;
  if cardinality(n.tipos) not between 1 and 2 or not (n.tipos <@ array['conversa', 'trabalho']) then
    raise exception 'Escolha Conversa, Trabalho ou os dois.';
  end if;
  if n.estado is null or n.estado not in ('desligado', 'teste', 'ligado') then raise exception 'Estado inválido.'; end if;
  if n.modo_contato is not null and n.modo_contato not in ('por_tras', 'mesma_voz', 'passa_conversa') then
    raise exception 'Modo de falar com o cliente inválido.';
  end if;
  if not (n.ferramentas <@ public.ferramentas_do_catalogo()) then raise exception 'Ferramenta fora do catálogo.'; end if;
  if n.modelo is not null and not exists (select 1 from public.configuracoes c where c.id = 1 and c.precos_modelos ? n.modelo) then
    raise exception 'Modelo sem preço em Configurações › Teto e modelos de IA.';
  end if;
  if a.porta_de_entrada then
    if n.estado <> 'ligado' then raise exception 'O Thiago fica sempre ligado: para parar o atendimento, use PAUSAR no Início.'; end if;
    if n.modo_contato is distinct from 'mesma_voz' then raise exception 'O Thiago é a voz do escritório: o modo dele não muda.'; end if;
    if n.setor_id is not null then raise exception 'O Thiago atende todos os setores.'; end if;
    if not (public.ferramentas_do_atendimento() <@ n.ferramentas) then raise exception 'As ferramentas do atendimento são fixas nesta etapa.'; end if;
  end if;
  if n.estado = 'teste' and not exists (select 1 from public.agente_contatos_teste where agente_id = a.id) then
    raise exception 'Em teste, escolha pelo menos um contato.';
  end if;

  if n.nome is distinct from a.nome then m := m || format('Nome: %s → %s', a.nome, n.nome); end if;
  if n.descricao is distinct from a.descricao then m := m || 'Descrição alterada'::text; end if;
  if n.setor_id is distinct from a.setor_id then
    m := m || format('Setor: %s → %s', coalesce((select nome from public.setores where id = a.setor_id), 'sem setor'),
                                        coalesce((select nome from public.setores where id = n.setor_id), 'sem setor'));
  end if;
  if n.tipos is distinct from array(select x from unnest(a.tipos) x order by 1) then
    m := m || format('Tipo: %s', replace(replace(array_to_string(n.tipos, ' e '), 'conversa', 'Conversa'), 'trabalho', 'Trabalho'));
  end if;
  if n.estado is distinct from a.estado then
    m := m || format('Estado: %s → %s', public.rotulo_agente('estado', a.estado), public.rotulo_agente('estado', n.estado));
  end if;
  if n.modelo is distinct from a.modelo then
    m := m || format('Modelo: %s → %s', public.rotulo_agente('modelo', a.modelo), public.rotulo_agente('modelo', n.modelo));
  end if;
  if n.modo_contato is distinct from a.modo_contato then
    m := m || format('Fala com o cliente: %s → %s', public.rotulo_agente('modo', a.modo_contato), public.rotulo_agente('modo', n.modo_contato));
  end if;
  v_mais := array(select x from unnest(n.ferramentas) x except select y from unnest(a.ferramentas) y order by 1);
  v_menos := array(select y from unnest(a.ferramentas) y except select x from unnest(n.ferramentas) x order by 1);
  if cardinality(v_mais) + cardinality(v_menos) > 0 then
    m := m || concat_ws(' ', 'Ferramentas:',
      case when cardinality(v_mais) > 0 then '+' || array_to_string(v_mais, ', +') end
        || case when cardinality(v_mais) > 0 and cardinality(v_menos) > 0 then ',' else '' end,
      case when cardinality(v_menos) > 0 then '−' || array_to_string(v_menos, ', −') end);
  end if;
  if cardinality(m) = 0 then return; end if;
  update public.agentes set nome = n.nome, descricao = n.descricao, setor_id = n.setor_id, tipos = n.tipos, estado = n.estado,
    modelo = n.modelo, modo_contato = n.modo_contato, ferramentas = n.ferramentas, atualizado_em = now(), atualizado_por = auth.uid()
  where id = a.id;
  perform public.mudanca_agente(a.id, x) from unnest(m) x;
end $$;

-- ---------- Telefone da equipe (auditoria 2.8 e 5.3) ----------

-- A forma única de um telefone, a mesma de normalizarTelefone + variantesTelefone (packages/core/src/telefone.ts):
-- só dígitos, 55 na frente, celular sem o nono dígito. Assim "5511999990000" e "551199990000" são o mesmo número.
create function public.telefone_canonico(p text) returns text
language sql immutable set search_path = '' as $$
  select case when char_length(d) = 13 and substr(d, 5, 1) = '9' then substr(d, 1, 4) || substr(d, 6) else d end
  from (select case when char_length(x) in (10, 11) then '55' || x
                    when char_length(x) in (12, 13) and x like '55%' then x end as d
        from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as x) bruto) normalizado
$$;
revoke execute on function public.telefone_canonico(text) from public, anon;
grant execute on function public.telefone_canonico(text) to authenticated, service_role;

-- O assistente reconhece a pessoa pelo telefone (repos.ts, usuarioDoAssistente): dois ativos com o mesmo número não.
create unique index usuarios_telefone_unico on public.usuarios (public.telefone_canonico(telefone)) where ativo and telefone is not null;
create index contatos_telefone_canonico on public.contatos (public.telefone_canonico(telefone)) where ativo;

-- Número de cliente na ficha de alguém da equipe desviaria as mensagens do cliente para o assistente interno.
create function public.telefone_usuario_nao_e_de_contato() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.ativo and new.telefone is not null and exists (
    select 1 from public.contatos c
    where c.ativo and public.telefone_canonico(c.telefone) = public.telefone_canonico(new.telefone)) then
    raise exception 'Este telefone já é de um contato de cliente.';
  end if;
  return new;
end $$;
revoke execute on function public.telefone_usuario_nao_e_de_contato() from public, anon, authenticated;
create trigger telefone_nao_e_de_contato before insert or update of telefone, ativo on public.usuarios
  for each row execute function public.telefone_usuario_nao_e_de_contato();

create function public.telefone_contato_nao_e_da_equipe() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.ativo and exists (
    select 1 from public.usuarios u
    where u.ativo and u.telefone is not null and public.telefone_canonico(u.telefone) = public.telefone_canonico(new.telefone)) then
    raise exception 'Este telefone já é de alguém da equipe.';
  end if;
  return new;
end $$;
revoke execute on function public.telefone_contato_nao_e_da_equipe() from public, anon, authenticated;
create trigger telefone_nao_e_da_equipe before insert or update of telefone, ativo on public.contatos
  for each row execute function public.telefone_contato_nao_e_da_equipe();

-- ---------- Cadastro do aplicativo autenticador vira aviso ao dono (auditoria 2.5) ----------
-- O painel chama depois de confirmar o primeiro código. Só registra os aplicativos da própria pessoa, cada um uma vez.
-- Devolve quantos registrou.
create function public.registrar_fator_cadastrado() returns int
language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_dono uuid; f record; v_n int := 0;
begin
  if auth.uid() is null then raise exception 'Entre de novo para continuar.'; end if;
  -- Duas abas ao mesmo tempo: uma espera a outra e o aviso não sai duas vezes.
  perform pg_advisory_xact_lock(hashtext('registrar_fator_cadastrado:' || auth.uid()::text));
  -- Pessoa ativa, no horário e (se precisa) com o código já confirmado: é o caso logo depois do primeiro código.
  if not public.eh_usuario_ativo() then return 0; end if;
  select nome into v_nome from public.usuarios where id = auth.uid();
  select id into v_dono from public.usuarios where dono and ativo;
  for f in
    select mf.id from auth.mfa_factors mf
    where mf.user_id = auth.uid() and mf.status = 'verified'
      and not exists (select 1 from public.auditoria_acessos a where a.acao = 'cadastrar_fator' and a.entidade_id = mf.id::text)
  loop
    insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id)
    values (auth.uid(), 'cadastrar_fator', 'mfa_factors', f.id::text);
    -- Sem dono marcado, o aviso fica para os administradores (alerta sem pessoa e sem setor).
    insert into public.alertas (nivel, usuario_id, mensagem) values ('aviso', v_dono, v_nome || ' cadastrou um aplicativo de código');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.registrar_fator_cadastrado() from public, anon;
grant execute on function public.registrar_fator_cadastrado() to authenticated;
