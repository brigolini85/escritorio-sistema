-- supabase/migrations/20261013000200_painel_v2_acesso_agente.sql
-- Painel v2, Parte H2 (spec 7D.2, D9): o filtro de acesso que as ferramentas do agente usam mora aqui, para o pgTAP provar
-- o mesmo filtro. Só o trabalhador (service_role) executa. Nada entra no Realtime (teste 22).

create function public.acesso_do_contato(p_contato uuid, p_cliente uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'perfil', cc.perfil,
    'pode_pedir_nota', cc.pode_pedir_nota, 'pode_atualizar_preco', cc.pode_atualizar_preco,
    'ver_valores', cc.ver_valores, 'receber_documentos', cc.receber_documentos,
    'avisar_documento_novo', to_jsonb(cc.avisar_documento_novo), 'recebe_alertas_acesso', cc.recebe_alertas_acesso,
    -- Básico nunca tem setores, mesmo com linha gravada por fora (D3).
    'setores', case when cc.perfil = 'basico' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'nome', st.nome, 'pode_ser_procurado', cs.pode_ser_procurado) order by st.nome)
        from public.contato_cliente_setores cs join public.setores st on st.id = cs.setor_id and st.ativo
       where cs.contato_id = cc.contato_id and cs.cliente_id = cc.cliente_id), '[]'::jsonb) end)
  from public.contato_clientes cc
  join public.contatos ct on ct.id = cc.contato_id and ct.ativo
  join public.clientes cl on cl.id = cc.cliente_id and cl.ativo
  where cc.contato_id = p_contato and cc.cliente_id = p_cliente
$$;

-- Documentos que o agente pode listar e enviar a este contato nesta empresa (D10, D11).
create function public.documentos_para_contato(p_contato uuid, p_cliente uuid)
returns table (id uuid, nome text, arquivo_path text, arquivo_nome text, arquivo_mime text, ia_pode_enviar boolean, setor_id uuid, tem_valores boolean)
language sql stable security invoker set search_path = '' as $$
  select d.id, d.nome, d.arquivo_path, d.arquivo_nome, d.arquivo_mime, d.ia_pode_enviar, d.setor_id, d.tem_valores
    from public.documentos_empresa d
    join public.contato_clientes cc on cc.cliente_id = d.cliente_id and cc.contato_id = p_contato
    join public.contatos ct on ct.id = cc.contato_id and ct.ativo
    join public.clientes cl on cl.id = cc.cliente_id and cl.ativo
   where d.cliente_id = p_cliente
     and cc.perfil <> 'basico' and cc.receber_documentos
     and (not d.tem_valores or cc.ver_valores)
     and (d.setor_id is null or exists (select 1 from public.contato_cliente_setores cs
           -- Setor desativado pelo escritório não libera mais nada (o painel nem mostra).
           join public.setores st on st.id = cs.setor_id and st.ativo
           where cs.contato_id = cc.contato_id and cs.cliente_id = cc.cliente_id and cs.setor_id = d.setor_id))
   order by d.nome
$$;

-- Um pedido fora do acesso por contato, empresa, setor e dia de São Paulo (D15): só o primeiro abre demanda e avisa.
create table public.pedidos_fora_do_acesso (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references public.contatos (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  setor_id uuid not null references public.setores (id) on delete cascade,
  dia date not null,
  chamado_id uuid references public.chamados (id) on delete set null,
  socios_avisados int not null default 0,
  vezes int not null default 1,
  criado_em timestamptz not null default now(),
  unique (contato_id, cliente_id, setor_id, dia)
);
alter table public.pedidos_fora_do_acesso enable row level security;
create policy leitura_admin on public.pedidos_fora_do_acesso for select to authenticated using (public.eh_admin());
revoke insert, update, delete, truncate on public.pedidos_fora_do_acesso from anon, authenticated;

-- Demandas abertas que o agente pode contar a este contato: as dos setores dele e as da Triagem abertas pela conversa dele.
create function public.demandas_para_contato(p_contato uuid, p_cliente uuid, p_conversa uuid)
returns table (id uuid, numero bigint, titulo text, status public.status_chamado, setor_id uuid, setor_nome text, criado_em timestamptz)
language sql stable security invoker set search_path = '' as $$
  select ch.id, ch.numero, ch.titulo, ch.status, ch.setor_id, st.nome, ch.criado_em
    from public.chamados ch
    join public.contato_clientes cc on cc.cliente_id = ch.cliente_id and cc.contato_id = p_contato and cc.perfil <> 'basico'
    join public.contatos ct on ct.id = cc.contato_id and ct.ativo
    join public.clientes cl on cl.id = cc.cliente_id and cl.ativo
    left join public.setores st on st.id = ch.setor_id
   where ch.cliente_id = p_cliente and ch.status <> 'concluido'
     and (exists (select 1 from public.contato_cliente_setores cs
                   join public.setores sa on sa.id = cs.setor_id and sa.ativo
                   where cs.contato_id = cc.contato_id and cs.cliente_id = cc.cliente_id and cs.setor_id = ch.setor_id)
          or (ch.setor_id is null and ch.conversa_id = p_conversa))
     -- A demanda "Fora do acesso" do próprio contato não volta para ele (a recusa por valores cai num setor dele).
     and not exists (select 1 from public.pedidos_fora_do_acesso pf where pf.chamado_id = ch.id and pf.contato_id = p_contato)
   order by ch.criado_em
$$;

create function public.registrar_pedido_fora_do_acesso(p_contato uuid, p_cliente uuid, p_setor uuid, p_dia date) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v public.pedidos_fora_do_acesso;
begin
  -- on conflict serializa dois pedidos ao mesmo tempo: só um deles é o "novo".
  insert into public.pedidos_fora_do_acesso (contato_id, cliente_id, setor_id, dia) values (p_contato, p_cliente, p_setor, p_dia)
  on conflict (contato_id, cliente_id, setor_id, dia) do update set vezes = public.pedidos_fora_do_acesso.vezes + 1
  returning * into v;
  return jsonb_build_object('id', v.id, 'novo', v.vezes = 1, 'chamado_id', v.chamado_id);
end $$;

-- Quem recebe o aviso de acesso (D7): a marcação, não o rótulo do perfil; quem pediu nunca.
create function public.socios_para_alerta(p_cliente uuid, p_exceto uuid)
returns table (contato_id uuid, nome text, telefone text)
language sql stable security invoker set search_path = '' as $$
  select ct.id, ct.nome, ct.telefone
    from public.contato_clientes cc join public.contatos ct on ct.id = cc.contato_id and ct.ativo
    join public.clientes cl on cl.id = cc.cliente_id and cl.ativo
   -- Básico ainda não foi conferido pela empresa: não recebe alerta. Sem p_exceto (null), ninguém fica de fora.
   where cc.cliente_id = p_cliente and cc.recebe_alertas_acesso and cc.perfil <> 'basico' and ct.id is distinct from p_exceto
   order by ct.nome
$$;

-- Base dos agentes ativos (Parte I, D17): só quem pode ser procurado naquele setor, com o agente ligado para ele.
create function public.contatos_procuraveis(p_cliente uuid, p_setor uuid)
returns table (contato_id uuid, nome text, telefone text)
language sql stable security invoker set search_path = '' as $$
  select ct.id, ct.nome, ct.telefone
    from public.contato_cliente_setores cs
    join public.contato_clientes cc on cc.contato_id = cs.contato_id and cc.cliente_id = cs.cliente_id and cc.perfil <> 'basico'
    join public.contatos ct on ct.id = cs.contato_id and ct.ativo and not ct.agente_pausado
    join public.clientes cl on cl.id = cs.cliente_id and cl.ativo
   where cs.cliente_id = p_cliente and cs.setor_id = p_setor and cs.pode_ser_procurado
   order by ct.nome
$$;

revoke all on function public.acesso_do_contato(uuid, uuid), public.documentos_para_contato(uuid, uuid),
  public.demandas_para_contato(uuid, uuid, uuid), public.registrar_pedido_fora_do_acesso(uuid, uuid, uuid, date),
  public.socios_para_alerta(uuid, uuid), public.contatos_procuraveis(uuid, uuid) from public, anon, authenticated;
grant execute on function public.acesso_do_contato(uuid, uuid), public.documentos_para_contato(uuid, uuid),
  public.demandas_para_contato(uuid, uuid, uuid), public.registrar_pedido_fora_do_acesso(uuid, uuid, uuid, date),
  public.socios_para_alerta(uuid, uuid), public.contatos_procuraveis(uuid, uuid) to service_role;
