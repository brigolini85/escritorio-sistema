-- supabase/migrations/20261015000200_painel_v2_agente_demanda.sql
-- Painel v2, Parte I2 (spec 7E.3 Ferramentas, 7E.8; D8, D9, D19): o trabalho do agente dentro da demanda. A pré-análise do
-- pedido de nota (conferência sem IA; o mesmo `resultado` vira a tarefa da I3) e as sugestões que uma pessoa do setor aprova.
-- Nada entra no Realtime (teste 22).

create table public.pre_analises_nota (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null unique references public.chamados (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  agente_id uuid references public.agentes (id) on delete set null,
  versao smallint not null default 1 check (versao = 1),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object' and jsonb_typeof(resultado -> 'linhas') = 'array'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pre_analises_nota_cliente_idx on public.pre_analises_nota (cliente_id);
create index pre_analises_nota_agente_idx on public.pre_analises_nota (agente_id);

create table public.agente_sugestoes (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  agente_id uuid not null references public.agentes (id) on delete cascade,
  conversa_id uuid references public.conversas (id) on delete set null,
  tipo text not null check (tipo in ('nota_interna', 'correcao')),
  conteudo jsonb not null check (jsonb_typeof(conteudo) = 'object'),
  estado text not null default 'aguardando' check (estado in ('aguardando', 'aprovada', 'descartada')),
  decidida_por uuid references public.usuarios (id) on delete set null,
  decidida_em timestamptz,
  criado_em timestamptz not null default clock_timestamp(),
  check ((estado = 'aguardando') = (decidida_em is null))
);
create index agente_sugestoes_chamado_idx on public.agente_sugestoes (chamado_id, criado_em);
create index agente_sugestoes_agente_idx on public.agente_sugestoes (agente_id);
create index agente_sugestoes_cliente_idx on public.agente_sugestoes (cliente_id);
create index agente_sugestoes_conversa_idx on public.agente_sugestoes (conversa_id);
create index agente_sugestoes_decidida_por_idx on public.agente_sugestoes (decidida_por);

alter table public.pre_analises_nota enable row level security;
alter table public.agente_sugestoes enable row level security;
-- O pedido de nota tem o próprio nível ("Pedidos de nota", P11): a pré-análise segue ele.
create policy leitura on public.pre_analises_nota for select to authenticated
  using (public.pode_ver_chamado(chamado_id) and public.tem_permissao('notas', 'ver'));
-- Demanda com pedido de nota: as sugestões também seguem o nível de "Pedidos de nota" (como a linha do tempo esconde o pedido).
create function public.pode_ver_sugestoes_do_chamado(p_chamado uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.pode_ver_chamado(p_chamado)
     and (public.tem_permissao('notas', 'ver') or not exists (select 1 from public.chamados where id = p_chamado and pedido_venda is not null))
$$;
revoke execute on function public.pode_ver_sugestoes_do_chamado(uuid) from public, anon, service_role;
grant execute on function public.pode_ver_sugestoes_do_chamado(uuid) to authenticated;
create policy leitura on public.agente_sugestoes for select to authenticated using (public.pode_ver_sugestoes_do_chamado(chamado_id));
revoke all on public.pre_analises_nota, public.agente_sugestoes from anon;
revoke insert, update, delete, truncate on public.pre_analises_nota, public.agente_sugestoes from authenticated, service_role;

-- ---------- O trabalhador grava (só service_role) ----------
create function public.salvar_pre_analise(p_chamado uuid, p_agente uuid, p_resultado jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid; v_setor uuid;
begin
  if jsonb_typeof(p_resultado) is distinct from 'object' or jsonb_typeof(p_resultado -> 'linhas') is distinct from 'array'
     or (p_resultado ->> 'versao') is distinct from '1' then
    raise exception 'Pré-análise inválida.';
  end if;
  select cliente_id, setor_id into v_cliente, v_setor from public.chamados where id = p_chamado and pedido_venda is not null;
  if not found then raise exception 'Esta demanda não tem pedido de nota.'; end if;
  if not exists (select 1 from public.agentes where id = p_agente and not porta_de_entrada and setor_id is not null and v_setor is not null and setor_id = v_setor) then
    raise exception 'A demanda não é do setor deste agente.';
  end if;
  insert into public.pre_analises_nota (chamado_id, cliente_id, agente_id, resultado)
  values (p_chamado, v_cliente, p_agente, p_resultado)
  on conflict (chamado_id) do update set resultado = excluded.resultado, agente_id = excluded.agente_id, atualizado_em = now();
end $$;

create function public.criar_sugestao_agente(p_chamado uuid, p_agente uuid, p_conversa uuid, p_tipo text, p_conteudo jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.chamados%rowtype; v_setor uuid; v_id uuid;
begin
  select setor_id into v_setor from public.agentes where id = p_agente and not porta_de_entrada;
  if not found then raise exception 'Agente não encontrado.'; end if;
  select * into c from public.chamados where id = p_chamado;
  if not found or c.setor_id is null or v_setor is null or c.setor_id <> v_setor then raise exception 'A demanda não é do setor deste agente.'; end if;
  if c.status = 'concluido' then raise exception 'A demanda já foi concluída.'; end if;
  if p_tipo is null or p_tipo not in ('nota_interna', 'correcao') or jsonb_typeof(p_conteudo) is distinct from 'object'
     or (p_tipo = 'nota_interna' and char_length(btrim(coalesce(p_conteudo ->> 'texto', ''))) not between 1 and 2000)
     or (p_tipo = 'correcao' and (char_length(btrim(coalesce(p_conteudo ->> 'campo', ''))) not between 1 and 60
                                  or char_length(btrim(coalesce(p_conteudo ->> 'para', ''))) not between 1 and 300
                                  or char_length(btrim(coalesce(p_conteudo ->> 'motivo', ''))) not between 1 and 500
                                  or char_length(coalesce(p_conteudo ->> 'de', '')) > 300)) then
    raise exception 'Sugestão inválida.';
  end if;
  if (select count(*) from public.agente_sugestoes where chamado_id = p_chamado and estado = 'aguardando') >= 20 then
    raise exception 'No máximo 20 sugestões aguardando por demanda.';
  end if;
  insert into public.agente_sugestoes (chamado_id, cliente_id, agente_id, conversa_id, tipo, conteudo)
  values (p_chamado, c.cliente_id, p_agente, p_conversa, p_tipo, p_conteudo) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.salvar_pre_analise(uuid, uuid, jsonb), public.criar_sugestao_agente(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.salvar_pre_analise(uuid, uuid, jsonb), public.criar_sugestao_agente(uuid, uuid, uuid, text, jsonb) to service_role;

-- ---------- Uma pessoa do setor decide (D19) ----------
create function public.decidir_sugestao(p_id uuid, p_aprovar boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare s public.agente_sugestoes%rowtype; c public.chamados%rowtype; v_agente text; v_pessoa text; v_texto text;
begin
  if not public.eh_usuario_ativo() then raise exception 'Sugestão não encontrada.'; end if;
  select * into s from public.agente_sugestoes where id = p_id for update;
  if not found or not public.pode_ver_sugestoes_do_chamado(s.chamado_id) then raise exception 'Sugestão não encontrada.'; end if;
  select * into c from public.chamados where id = s.chamado_id;
  if not (public.eh_admin() or coalesce(c.setor_id in (select public.meus_setores()), false)) then
    raise exception 'Só quem é do setor da demanda aprova as sugestões do agente.';
  end if;
  if s.estado <> 'aguardando' then raise exception 'Esta sugestão já foi decidida.'; end if;
  if p_aprovar and c.status = 'concluido' then raise exception 'A demanda já foi concluída.'; end if;
  update public.agente_sugestoes set estado = case when p_aprovar then 'aprovada' else 'descartada' end,
         decidida_por = auth.uid(), decidida_em = now()
   where id = p_id;
  if p_aprovar then
    select nome into v_agente from public.agentes where id = s.agente_id;
    select nome into v_pessoa from public.usuarios where id = auth.uid();
    v_texto := case s.tipo
      when 'nota_interna' then format('%s (sugestão aprovada por %s): %s', v_agente, v_pessoa, btrim(s.conteudo ->> 'texto'))
      else format('%s sugeriu corrigir %s: %s → %s. Motivo: %s. Aprovada por %s: aplique a correção no pedido.', v_agente,
                  btrim(s.conteudo ->> 'campo'), coalesce(nullif(btrim(s.conteudo ->> 'de'), ''), '—'), btrim(s.conteudo ->> 'para'),
                  btrim(s.conteudo ->> 'motivo'), v_pessoa) end;
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    values (s.chamado_id, s.cliente_id, 'nota_interna', auth.uid(), left(v_texto, 4000));
  end if;
  return case when p_aprovar then 'aprovada' else 'descartada' end;
end $$;
revoke execute on function public.decidir_sugestao(uuid, boolean) from public, anon, service_role;
grant execute on function public.decidir_sugestao(uuid, boolean) to authenticated;
