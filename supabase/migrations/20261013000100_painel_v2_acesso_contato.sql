-- supabase/migrations/20261013000100_painel_v2_acesso_contato.sql
-- Painel v2, Parte H2 (spec 7D.2): o que cada pessoa pode tratar em cada empresa. Só acrescenta: o contato que já existe
-- fica Básico (padrão da coluna, D2) com a nota e o preço que já tinha. Nada entra no Realtime (teste 22).

-- Cargo e e-mail são da pessoa e valem em todas as empresas dela (D8).
alter table public.contatos
  add column cargo text check (cargo is null or char_length(cargo) between 1 and 80),
  add column email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- O perfil é atalho; o que vale são as marcações (D3).
alter table public.contato_clientes
  add column perfil text not null default 'basico'
    check (perfil in ('socio', 'administrativo', 'financeiro', 'rh_dp', 'compras_vendas', 'funcionario', 'basico', 'personalizado')),
  add column ver_valores boolean not null default false,
  add column receber_documentos boolean not null default false,
  add column avisar_documento_novo text[] not null default '{}'
    check (avisar_documento_novo <@ array['whatsapp', 'email']::text[]),
  add column recebe_alertas_acesso boolean not null default false;

-- Setores que a pessoa pode tratar naquela empresa (D1). Apagar o vínculo apaga os setores.
create table public.contato_cliente_setores (
  contato_id uuid not null,
  cliente_id uuid not null,
  setor_id uuid not null references public.setores (id) on delete cascade,
  pode_ser_procurado boolean not null default false,
  primary key (contato_id, cliente_id, setor_id),
  foreign key (contato_id, cliente_id) references public.contato_clientes (contato_id, cliente_id) on delete cascade
);
create index contato_cliente_setores_setor_idx on public.contato_cliente_setores (cliente_id, setor_id);
alter table public.contato_cliente_setores enable row level security;
create policy leitura on public.contato_cliente_setores for select to authenticated using (public.eh_usuario_ativo());
-- Escrita só por salvar_acesso_contato (o padrão do Supabase daria escrita à equipe).
revoke insert, update, delete, truncate on public.contato_cliente_setores from anon, authenticated;
create trigger auditoria after insert or update or delete on public.contato_cliente_setores
  for each row execute function public.registrar_auditoria();

-- Documento de um setor e com valores (D11). Sem setor = documento da empresa (contrato social, cartão CNPJ).
alter table public.documentos_empresa
  add column setor_id uuid references public.setores (id) on delete set null,
  add column tem_valores boolean not null default false;

-- Caminhos antigos (Atendimento, vincular) que mudam nota ou preço de um perfil pronto: vira Personalizado (D6).
create function public.contato_cliente_vira_personalizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('escritorio.salvando_acesso', true), '') = '1' then return new; end if;
  if new.perfil = old.perfil and new.perfil not in ('basico', 'personalizado')
     and (new.pode_pedir_nota, new.pode_atualizar_preco) is distinct from (old.pode_pedir_nota, old.pode_atualizar_preco) then
    new.perfil := 'personalizado';
  end if;
  return new;
end $$;
create trigger vira_personalizado before update on public.contato_clientes
  for each row execute function public.contato_cliente_vira_personalizado();

-- Um SALVAR do bloco de acesso (D23): marcações, setores e, na ficha, nome/cargo/e-mail, numa transação.
create function public.salvar_acesso_contato(p_contato uuid, p_cliente uuid, p_dados jsonb) returns void
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
  select coalesce(array_agg(distinct x order by x), '{}') into v_avisar
    from jsonb_array_elements_text(coalesce(p_dados -> 'avisar_documento_novo', '[]'::jsonb)) x;

  -- O perfil vem recalculado pelo painel (core); o gatilho dos caminhos antigos não se mete (D6).
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
revoke all on function public.salvar_acesso_contato(uuid, uuid, jsonb) from public, anon;
grant execute on function public.salvar_acesso_contato(uuid, uuid, jsonb) to authenticated;

-- LGPD: corpo de 20261005000400 + cargo, e-mail e a auditoria dos setores do contato (Parte H2, D25).
create or replace function public.anonimizar_contato(p_contato uuid) returns text[]
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
  delete from assistente_mensagens a using conversas c where c.id = a.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  -- Parte E
  delete from sugestoes_resposta s using conversas c where c.id = s.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  update conversa_eventos e set texto = null from conversas c where c.id = e.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  update conversas set motivo_pessoa = null where contato_id = p_contato or telefone = v_tel;

  -- Resumos e notas dos chamados dessas conversas podem conter dados pessoais.
  update chamados ch set resumo = '[removido a pedido do titular]'
  from conversas c where c.id = ch.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  update chamado_eventos e set texto = null
  from chamados ch join conversas c on c.id = ch.conversa_id
  where ch.id = e.chamado_id and (c.contato_id = p_contato or c.telefone = v_tel);

  -- random() é avaliado por linha: cada conversa recebe um número fictício diferente (telefone é único).
  update conversas set telefone = '5500' || lpad(floor(random() * 1e9)::text, 9, '0') where contato_id = p_contato or telefone = v_tel;
  v_novo := '5500' || lpad(floor(random() * 1e9)::text, 9, '0');
  update contatos set nome = 'Contato removido', ativo = false, telefone = v_novo, cargo = null, email = null where id = p_contato;

  -- O gatilho de auditoria guardou nome e telefone originais em "antes": apagar esses registros também.
  delete from auditoria_acessos where entidade in ('contatos', 'contato_clientes', 'contato_cliente_setores')
    and (entidade_id = p_contato::text or detalhes::text like '%' || p_contato::text || '%');
  insert into auditoria_acessos (usuario_id, acao, entidade, entidade_id) values (auth.uid(), 'anonimizar', 'contatos', p_contato::text);
  return v_paths;
end $$;

-- Quantos vínculos ficaram Básico (D2): o dono confere na saída do db push.
do $$ begin
  raise notice 'Parte H2: % vínculo(s) de contato ficaram Básico (aguardando definir acesso).', (select count(*) from public.contato_clientes);
end $$;
