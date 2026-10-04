-- supabase/migrations/20261012000100_painel_v2_ficha_cliente.sql
-- Painel v2, Parte H1 (spec 7D.1): ficha completa do cliente. Só acrescenta: nenhuma coluna sai, nenhum dado é apagado
-- nem reescrito. Toda coluna nova aceita vazio (clientes antigos e testes têm só razão social e CNPJ, D10).

alter table public.clientes
  add column tipo_pessoa text not null default 'juridica' check (tipo_pessoa in ('juridica', 'fisica')),
  add column inscricao_municipal text,
  add column inscricao_suframa text,
  add column isento_ie boolean not null default false,
  add column cnae_principal text,
  add column porte text check (porte in ('mei', 'me', 'epp', 'demais')),
  add column faturamento_ultimo_ano numeric(14, 2) check (faturamento_ultimo_ano >= 0),
  add column funcionarios int check (funcionarios >= 0),
  add column segmentos text[] not null default '{}' check (segmentos <@ array['comercio', 'ecommerce', 'industria', 'servicos']),
  add column cep text check (cep ~ '^\d{8}$'),
  add column logradouro text,
  add column numero text,
  add column complemento text,
  add column bairro text,
  add column cidade text,
  add column telefone text check (telefone ~ '^\d{10,13}$'),
  add column celular text check (celular ~ '^\d{10,13}$'),
  add column email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column email_cobranca text check (email_cobranca ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column site text,
  add column contrato_inicio date,
  add column contrato_fim date,
  add column honorario_mensal numeric(12, 2) check (honorario_mensal >= 0),
  add column dia_vencimento smallint check (dia_vencimento between 1 and 31),
  add column reajuste text check (reajuste in ('sem', 'anual', 'semestral')),
  add column reajuste_mes smallint check (reajuste_mes between 1 and 12),
  add column decimo_terceiro boolean,
  add column certificado_tipo text check (certificado_tipo in ('e_cnpj_a1', 'e_cnpj_a3', 'e_cpf_a1', 'e_cpf_a3', 'sem')),
  add column certificado_vencimento date,
  add column certificado_avisar_dias smallint not null default 30 check (certificado_avisar_dias between 1 and 180),
  add constraint clientes_contrato_datas check (contrato_fim is null or contrato_inicio is null or contrato_fim >= contrato_inicio);

-- UF de hoje é texto livre de duas letras: só a UF nova ou trocada é conferida (D10). Não é CHECK (nem NOT VALID): o
-- Postgres conferiria a linha inteira em todo UPDATE, e um cliente antigo com UF fora da lista não poderia mais ser
-- arquivado, pausado nem salvo, e a cópia do endereço logo abaixo falharia e desfaria a migração.
create function public.clientes_uf_na_lista() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.uf is not null and (tg_op = 'INSERT' or new.uf is distinct from old.uf) and new.uf not in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO',
    'RR', 'SC', 'SP', 'SE', 'TO') then
    raise exception 'UF inválida: %.', new.uf using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger uf_valida before insert or update of uf on public.clientes
  for each row execute function public.clientes_uf_na_lista();

-- ---------- Inscrições de substituto tributário (UF + inscrição; linha sem inscrição é pendência na tela) ----------

create table public.cliente_inscricoes_st (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  uf char(2) not null check (uf in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR',
    'SC', 'SP', 'SE', 'TO')),
  inscricao text check (inscricao is null or char_length(inscricao) between 1 and 30),
  primary key (cliente_id, uf)
);
alter table public.cliente_inscricoes_st enable row level security;
-- Mesmas regras de cliente_servicos (base + 20260928000400): ler ativo; gravar e desfazer com editar_clientes.
create policy leitura on public.cliente_inscricoes_st for select to authenticated using (public.eh_usuario_ativo());
create policy inserir on public.cliente_inscricoes_st for insert to authenticated with check (public.tem_permissao('editar_clientes'));
create policy alterar on public.cliente_inscricoes_st for update to authenticated
  using (public.tem_permissao('editar_clientes')) with check (public.tem_permissao('editar_clientes'));
create policy excluir on public.cliente_inscricoes_st for delete to authenticated using (public.tem_permissao('editar_clientes'));
create trigger auditoria after insert or update or delete on public.cliente_inscricoes_st
  for each row execute function public.registrar_auditoria();

-- ---------- Endereço: o antigo vai para Logradouro; endereco vira o por extenso (D11, D12) ----------

-- "Rua Rosa Figueiredo, 430, loja 2 - São Marcos, Conselheiro Lafaiete/MG, CEP 36404-450"; partes vazias somem.
create function public.montar_endereco(p_logradouro text, p_numero text, p_complemento text, p_bairro text, p_cidade text,
                                       p_uf text, p_cep text) returns text
language sql immutable set search_path = '' as $$
  select concat_ws(', ',
    nullif(concat_ws(' - ', nullif(concat_ws(', ', p_logradouro, p_numero, p_complemento), ''), p_bairro), ''),
    case when p_cidade is not null then p_cidade || coalesce('/' || btrim(p_uf), '') end,
    case when p_cep is not null then 'CEP ' || substr(p_cep, 1, 5) || '-' || substr(p_cep, 6) end)
$$;

-- Só quem não tem logradouro; o endereco antigo fica como estava. A migração chama uma vez (o teste 39 chama de novo).
create function public.copiar_endereco_para_logradouro() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.clientes set logradouro = btrim(endereco)
  where logradouro is null and nullif(btrim(endereco), '') is not null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.copiar_endereco_para_logradouro() from public, anon, authenticated, service_role;

do $$
begin
  raise notice 'Parte H1: % cliente(s) com o endereço antigo copiado para Logradouro (o endereço antigo continua guardado).',
    public.copiar_endereco_para_logradouro();
end $$;

-- Depois da cópia: com logradouro, endereco (o que o agente lê em consultar_cadastro) acompanha os campos novos.
-- O painel antigo grava só endereco (+ uf): o texto digitado vale e vai inteiro para Logradouro (D12), sem ser
-- trocado pelo por extenso dos campos velhos. Recalcula só quando uma parte do endereço muda de fato.
create function public.clientes_endereco_por_extenso() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.logradouro is null then
      new.logradouro := nullif(btrim(new.endereco), '');
    else
      new.endereco := public.montar_endereco(new.logradouro, new.numero, new.complemento, new.bairro, new.cidade, new.uf, new.cep);
    end if;
  elsif new.endereco is distinct from old.endereco and new.logradouro is not distinct from old.logradouro then
    new.logradouro := nullif(btrim(new.endereco), '');
  elsif (new.logradouro, new.numero, new.complemento, new.bairro, new.cidade, new.uf, new.cep)
        is distinct from (old.logradouro, old.numero, old.complemento, old.bairro, old.cidade, old.uf, old.cep)
        and (new.logradouro is not null or old.endereco is not null) then
    -- Sem logradouro (a ficha apagou), o por extenso sai do que sobrou, ou fica vazio: o agente não lê o endereço velho.
    new.endereco := nullif(public.montar_endereco(new.logradouro, new.numero, new.complemento, new.bairro, new.cidade, new.uf, new.cep), '');
  end if;
  return new;
end $$;
create trigger endereco_por_extenso before insert or update of endereco, logradouro, numero, complemento, bairro, cidade, uf, cep
  on public.clientes for each row execute function public.clientes_endereco_por_extenso();

-- ---------- Salvar a aba inteira numa transação (D13, D14) ----------

create function public.texto_da_ficha(p jsonb, k text) returns text
language sql immutable set search_path = '' as $$ select nullif(btrim(p ->> k), '') $$;

-- Roda com a regra de quem chama (a RLS de hoje vale); a permissão é conferida por escrito para um UPDATE barrado
-- pela RLS não passar calado. Listas (serviços, inscrições ST) trocam inteiras; responsáveis só nos setores enviados.
create function public.salvar_ficha_cliente(p_id uuid, p_dados jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_razao text := btrim(coalesce(p_dados ->> 'razao_social', ''));
  v_isento boolean := coalesce((p_dados ->> 'isento_ie')::boolean, false);
  v_st jsonb := coalesce(nullif(p_dados -> 'inscricoes_st', 'null'::jsonb), '[]'::jsonb);
  v_servicos uuid[] := coalesce((select array_agg(x::uuid)
    from jsonb_array_elements_text(coalesce(nullif(p_dados -> 'servicos', 'null'::jsonb), '[]'::jsonb)) x), '{}');
  r record;
begin
  if not public.tem_permissao('editar_clientes') then raise exception 'Você não tem permissão para editar clientes.'; end if;
  if char_length(v_razao) < 2 then raise exception 'Informe a razão social.'; end if;
  if exists (select 1 from jsonb_array_elements(v_st) e where nullif(btrim(e ->> 'uf'), '') is null) then
    raise exception 'Informe a UF de cada inscrição de substituto tributário.';
  end if;
  if (select count(*) <> count(distinct upper(btrim(e ->> 'uf'))) from jsonb_array_elements(v_st) e) then
    raise exception 'UF repetida nas inscrições de substituto tributário.';
  end if;

  if v_id is null then
    insert into public.clientes (razao_social, cnpj) values (v_razao, p_dados ->> 'cnpj') returning id into v_id;
  elsif not exists (select 1 from public.clientes where id = v_id) then
    raise exception 'Cliente não encontrado.';
  end if;

  update public.clientes set
    razao_social = v_razao,
    nome_fantasia = public.texto_da_ficha(p_dados, 'nome_fantasia'),
    cnpj = p_dados ->> 'cnpj',
    tipo_pessoa = coalesce(public.texto_da_ficha(p_dados, 'tipo_pessoa'), 'juridica'),
    isento_ie = v_isento,
    inscricao_estadual = case when v_isento then null else public.texto_da_ficha(p_dados, 'inscricao_estadual') end,
    inscricao_municipal = public.texto_da_ficha(p_dados, 'inscricao_municipal'),
    cnae_principal = public.texto_da_ficha(p_dados, 'cnae_principal'),
    inscricao_suframa = public.texto_da_ficha(p_dados, 'inscricao_suframa'),
    regime = public.texto_da_ficha(p_dados, 'regime'),
    porte = public.texto_da_ficha(p_dados, 'porte'),
    faturamento_ultimo_ano = public.texto_da_ficha(p_dados, 'faturamento_ultimo_ano')::numeric,
    funcionarios = public.texto_da_ficha(p_dados, 'funcionarios')::int,
    segmentos = coalesce((select array_agg(distinct s order by s)
      from jsonb_array_elements_text(coalesce(nullif(p_dados -> 'segmentos', 'null'::jsonb), '[]'::jsonb)) s), '{}'),
    cep = public.texto_da_ficha(p_dados, 'cep'),
    logradouro = public.texto_da_ficha(p_dados, 'logradouro'),
    numero = public.texto_da_ficha(p_dados, 'numero'),
    complemento = public.texto_da_ficha(p_dados, 'complemento'),
    bairro = public.texto_da_ficha(p_dados, 'bairro'),
    cidade = public.texto_da_ficha(p_dados, 'cidade'),
    uf = upper(public.texto_da_ficha(p_dados, 'uf')),
    telefone = public.texto_da_ficha(p_dados, 'telefone'),
    celular = public.texto_da_ficha(p_dados, 'celular'),
    email = public.texto_da_ficha(p_dados, 'email'),
    email_cobranca = public.texto_da_ficha(p_dados, 'email_cobranca'),
    site = public.texto_da_ficha(p_dados, 'site'),
    contrato_inicio = public.texto_da_ficha(p_dados, 'contrato_inicio')::date,
    contrato_fim = public.texto_da_ficha(p_dados, 'contrato_fim')::date,
    honorario_mensal = public.texto_da_ficha(p_dados, 'honorario_mensal')::numeric,
    dia_vencimento = public.texto_da_ficha(p_dados, 'dia_vencimento')::smallint,
    reajuste = public.texto_da_ficha(p_dados, 'reajuste'),
    reajuste_mes = public.texto_da_ficha(p_dados, 'reajuste_mes')::smallint,
    decimo_terceiro = (p_dados ->> 'decimo_terceiro')::boolean,
    certificado_tipo = public.texto_da_ficha(p_dados, 'certificado_tipo'),
    certificado_vencimento = public.texto_da_ficha(p_dados, 'certificado_vencimento')::date,
    certificado_avisar_dias = coalesce(public.texto_da_ficha(p_dados, 'certificado_avisar_dias')::smallint, 30),
    -- Pausar o agente é decisão só do administrador (spec, seção 5): de outra pessoa, a chave é ignorada.
    agente_pausado = case when p_dados ? 'agente_pausado' and public.eh_admin()
                          then coalesce((p_dados ->> 'agente_pausado')::boolean, false) else agente_pausado end
  where id = v_id;

  delete from public.cliente_inscricoes_st s
  where s.cliente_id = v_id and not exists (select 1 from jsonb_array_elements(v_st) e where upper(btrim(e ->> 'uf')) = s.uf::text);
  insert into public.cliente_inscricoes_st as s (cliente_id, uf, inscricao)
  select v_id, upper(btrim(e ->> 'uf')), nullif(btrim(e ->> 'inscricao'), '') from jsonb_array_elements(v_st) e
  on conflict (cliente_id, uf) do update set inscricao = excluded.inscricao where s.inscricao is distinct from excluded.inscricao;

  -- A tela só lista os serviços ativos: o vínculo com um serviço desativado não está no formulário e fica.
  delete from public.cliente_servicos where cliente_id = v_id and not (servico_id = any (v_servicos))
    and servico_id in (select id from public.servicos where ativo);
  insert into public.cliente_servicos (cliente_id, servico_id)
  select distinct v_id, x from unnest(v_servicos) x
  where not exists (select 1 from public.cliente_servicos where cliente_id = v_id and servico_id = x);

  for r in select key, nullif(value, '') as usuario
           from jsonb_each_text(coalesce(nullif(p_dados -> 'responsaveis', 'null'::jsonb), '{}'::jsonb)) loop
    if r.usuario is null then
      delete from public.cliente_responsaveis where cliente_id = v_id and setor_id = r.key::uuid;
    else
      insert into public.cliente_responsaveis as cr (cliente_id, setor_id, usuario_id) values (v_id, r.key::uuid, r.usuario::uuid)
      on conflict (cliente_id, setor_id) do update set usuario_id = excluded.usuario_id where cr.usuario_id is distinct from excluded.usuario_id;
    end if;
  end loop;

  return v_id;
end $$;
revoke execute on function public.salvar_ficha_cliente(uuid, jsonb) from public, anon;
grant execute on function public.salvar_ficha_cliente(uuid, jsonb) to authenticated;

-- ---------- Rodapé "Última alteração" (D24): só nome e hora, só mudanças feitas por pessoas ----------

create index if not exists auditoria_acessos_entidade_idx on public.auditoria_acessos (entidade, entidade_id, criado_em desc);

create function public.ultima_alteracao_cliente(p_cliente uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.eh_usuario_ativo() then (
    select jsonb_build_object('pessoa', u.nome, 'quando', a.criado_em)
    from public.auditoria_acessos a
    join public.usuarios u on u.id = a.usuario_id
    where a.usuario_id is not null
      and ((a.entidade in ('clientes', 'cliente_servicos', 'cliente_responsaveis', 'cliente_inscricoes_st')
            and a.entidade_id = p_cliente::text)
           -- Acessos de portais (Task 2): cadastrar e remover contam; revelar e copiar não são alteração.
           or (a.entidade = 'cliente_acessos' and a.acao in ('salvar_acesso', 'remover_acesso')
               and a.detalhes ->> 'cliente_id' = p_cliente::text))
    order by a.criado_em desc
    limit 1) end
$$;
revoke execute on function public.ultima_alteracao_cliente(uuid) from public, anon;
grant execute on function public.ultima_alteracao_cliente(uuid) to authenticated;
