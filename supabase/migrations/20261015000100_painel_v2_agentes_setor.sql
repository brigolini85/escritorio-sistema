-- supabase/migrations/20261015000100_painel_v2_agentes_setor.sql
-- Painel v2, Parte I2 (spec 7E.3 "Como fala com o cliente", 7E.8, 7E.9 item 2): o Thiago chama os agentes dos setores.
-- Nada entra no Realtime (teste 22). Só acréscimos; ferramentas_do_catalogo e uso_skills trocam o corpo (mesma assinatura).

-- ---------- Catálogo (D8, D12) ----------
create function public.ferramentas_do_setor() returns text[]
language sql immutable set search_path = '' as $$
  select array['ler_demandas_setor', 'conferir_pedido_nota', 'nota_interna', 'sugerir_correcao']::text[]
$$;
-- O core tem a mesma lista (FERRAMENTAS_DO_CATALOGO); packages/db/test/agentes.test.ts confere as duas.
create or replace function public.ferramentas_do_catalogo() returns text[]
language sql immutable set search_path = '' as $$ select public.ferramentas_do_atendimento() || public.ferramentas_do_setor() $$;
-- Gravam ou enviam sem aprovação de ninguém: só a porta de entrada usa. `responder` entra pelo modo (D8).
create function public.ferramentas_so_do_atendimento() returns text[]
language sql immutable set search_path = '' as $$
  select array['selecionar_empresa', 'abrir_chamado', 'sinalizar_nao_entendido', 'passar_para_pessoa', 'enviar_documento']::text[]
$$;
revoke execute on function public.ferramentas_do_setor(), public.ferramentas_so_do_atendimento() from public, anon;
grant execute on function public.ferramentas_do_setor(), public.ferramentas_so_do_atendimento() to authenticated, service_role;

-- Ruling F2: agentes de setor que já tinham ferramenta "só do Thiago" perdem essa ferramenta ANTES do gatilho (e fica no histórico).
do $$
declare r record; v_tirar text[];
begin
  for r in select id, ferramentas from public.agentes where not porta_de_entrada and ferramentas && public.ferramentas_so_do_atendimento() loop
    v_tirar := array(select x from unnest(r.ferramentas) x where x = any (public.ferramentas_so_do_atendimento()) order by 1);
    update public.agentes set ferramentas = array(select x from unnest(r.ferramentas) x where x <> all (public.ferramentas_so_do_atendimento()) order by 1)
     where id = r.id;
    insert into public.agente_mudancas (agente_id, usuario_id, descricao)
    values (r.id, null, left('Ferramentas: −' || array_to_string(v_tirar, ', −') || ' (só do Thiago, tiradas na troca do catálogo)', 300));
  end loop;
end $$;

-- Roda dentro de salvar_agente (o update dela passa por aqui): a frase chega ao dono como as outras.
create function public.agentes_ferramentas_do_especialista() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not new.porta_de_entrada and new.ferramentas && public.ferramentas_so_do_atendimento() then
    raise exception 'Abrir demanda, escolher empresa, avisar que não entendeu, passar para pessoa e enviar documento são só do Thiago: o agente do setor devolve a conversa a ele.';
  end if;
  if new.porta_de_entrada and new.ferramentas && public.ferramentas_do_setor() then
    raise exception 'As ferramentas do setor são dos agentes dos setores, não do Thiago.';
  end if;
  return new;
end $$;
revoke execute on function public.agentes_ferramentas_do_especialista() from public, anon, authenticated, service_role;
create trigger ferramentas_do_especialista before insert or update of ferramentas on public.agentes
  for each row execute function public.agentes_ferramentas_do_especialista();

-- ---------- Passa a conversa (D6) ----------
alter table public.conversas
  add column agente_conduzindo_id uuid references public.agentes (id) on delete set null,
  add column conduzindo_desde timestamptz;
create index conversas_agente_conduzindo_idx on public.conversas (agente_conduzindo_id) where agente_conduzindo_id is not null;

alter table public.conversa_eventos drop constraint conversa_eventos_tipo_check;
alter table public.conversa_eventos add constraint conversa_eventos_tipo_check check (tipo in (
  'passou_para_pessoa', 'assumida', 'devolvida', 'concluida', 'empresa_trocada', 'agente_assumiu', 'agente_devolveu'));

-- Só o trabalhador. Passar de novo ao mesmo agente não repete o marco.
create function public.iniciar_conducao(p_conversa uuid, p_agente uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_linhas int;
begin
  select nome into v_nome from public.agentes where id = p_agente and not porta_de_entrada;
  if v_nome is null then raise exception 'Agente não encontrado.'; end if;
  update public.conversas set agente_conduzindo_id = p_agente, conduzindo_desde = now(), atualizado_em = now()
   where id = p_conversa and agente_conduzindo_id is distinct from p_agente;
  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    insert into public.conversa_eventos (conversa_id, tipo, texto) values (p_conversa, 'agente_assumiu', left(v_nome, 300));
  end if;
  return v_linhas > 0;
end $$;

-- Devolve ao Thiago com o motivo no marco ("Agente Fiscal: assunto encerrado"). Sem condução: false, sem marco.
create function public.encerrar_conducao(p_conversa uuid, p_motivo text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  select a.nome into v_nome from public.conversas c join public.agentes a on a.id = c.agente_conduzindo_id
   where c.id = p_conversa for update of c;
  if v_nome is null then
    -- O agente pode ter sido apagado (on delete set null): limpa a data que sobrou.
    update public.conversas set conduzindo_desde = null where id = p_conversa and conduzindo_desde is not null;
    return false;
  end if;
  update public.conversas set agente_conduzindo_id = null, conduzindo_desde = null, atualizado_em = now() where id = p_conversa;
  insert into public.conversa_eventos (conversa_id, tipo, texto)
  values (p_conversa, 'agente_devolveu', left(concat_ws(': ', v_nome, nullif(btrim(coalesce(p_motivo, '')), '')), 300));
  return true;
end $$;
revoke execute on function public.iniciar_conducao(uuid, uuid), public.encerrar_conducao(uuid, text) from public, anon, authenticated;
grant execute on function public.iniciar_conducao(uuid, uuid), public.encerrar_conducao(uuid, text) to service_role;

-- ---------- Quem atende o contato (D2) ----------
create function public.agentes_para_contato(p_contato uuid)
returns table (id uuid, slug text, nome text, setor_id uuid, setor text, modelo text, modo_contato text, ferramentas text[], estado text, regras jsonb)
language sql stable security definer set search_path = '' as $$
  select a.id, a.slug, a.nome, a.setor_id, s.nome, a.modelo, a.modo_contato, a.ferramentas, a.estado,
         coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'assunto', r.assunto, 'exemplo', r.exemplo, 'modo', r.modo)
                                    order by r.criado_em, r.id)
                   from public.agente_regras_assunto r where r.agente_id = a.id), '[]'::jsonb)
  from public.agentes a join public.setores s on s.id = a.setor_id and s.ativo
  where not a.porta_de_entrada and 'conversa' = any (a.tipos) and a.modo_contato is not null
    and (a.estado = 'ligado'
         or (a.estado = 'teste' and exists (select 1 from public.agente_contatos_teste t where t.agente_id = a.id and t.contato_id = p_contato)))
  order by a.ordem, a.nome
$$;
revoke execute on function public.agentes_para_contato(uuid) from public, anon, authenticated;
grant execute on function public.agentes_para_contato(uuid) to service_role;

-- ---------- Uso no mês por agente (D11) ----------
-- As decisões do Thiago continuam sem agente (o trabalhador da I2 roda num banco só com a I1); as do agente do setor levam o dele.
alter table public.decisoes_agente add column agente_id uuid references public.agentes (id) on delete set null;
create index decisoes_agente_agente_idx on public.decisoes_agente (agente_id, etapa, criado_em);

create function public.uso_regras(p_slug text, p_de timestamptz, p_ate timestamptz) returns table (regra_id uuid, conversas bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  if not public.pode_ver_agentes() then raise exception 'Você não tem acesso aos agentes.'; end if;
  perform interno.conferir_periodo(p_de, p_ate);
  select a.id into v from public.agentes a where a.slug = p_slug;
  return query
    select (d.saida ->> 'regra_id')::uuid, count(distinct d.conversa_id)
    from public.decisoes_agente d
    where d.etapa = 'chamar_agente' and d.criado_em >= p_de and d.criado_em < p_ate
      and d.saida ->> 'agente_id' = v::text
      and d.saida ->> 'regra_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    group by 1;
end $$;
revoke execute on function public.uso_regras(text, timestamptz, timestamptz) from public, anon;
grant execute on function public.uso_regras(text, timestamptz, timestamptz) to authenticated;

-- Mesma assinatura e mesmas recusas da I1; agora pelas leituras do próprio agente (sem agente = o Thiago).
create or replace function public.uso_skills(p_slug text, p_de timestamptz, p_ate timestamptz) returns table (nome text, vezes bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  if not public.pode_ver_agentes() then raise exception 'Você não tem acesso aos agentes.'; end if;
  perform interno.conferir_periodo(p_de, p_ate);
  select a.id into v from public.agentes a where a.slug = p_slug;
  return query
    select d.entrada ->> 'nome', count(*) from public.decisoes_agente d
    where d.etapa = 'ler_skill' and d.criado_em >= p_de and d.criado_em < p_ate
      and coalesce(d.agente_id, 'a0000000-0000-4000-8000-000000000001'::uuid) = v
      and d.entrada ->> 'nome' in (select s.nome from public.agente_skills s where s.agente_id = v)
    group by 1;
end $$;
