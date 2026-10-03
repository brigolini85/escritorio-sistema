-- supabase/migrations/20261005000200_painel_v2_espera.sql
-- Painel v2, Parte E (spec 7A.2): espera e motivo da passagem, marcos da conversa, concluir o atendimento humano,
-- ligação mensagem ↔ turno do agente ↔ documento enviado, limites de espera e a caixa de entrada nova.

alter table public.conversas
  add column aguardando_pessoa_desde timestamptz,
  add column motivo_pessoa text check (char_length(motivo_pessoa) <= 300),
  add column concluida_em timestamptz;

-- "por quê?" (decisões do mesmo turno) e o link do documento que a IA mandou (download auditado).
alter table public.mensagens
  add column turno_agente uuid,
  add column documento_id uuid references public.documentos_empresa (id) on delete set null;
alter table public.decisoes_agente add column turno uuid;
create index decisoes_agente_turno_idx on public.decisoes_agente (conversa_id, turno) where turno is not null;

alter table public.configuracoes
  add column espera_verde_min int not null default 5,
  add column espera_ambar_min int not null default 15,
  add constraint limites_espera_validos
    check (espera_verde_min between 1 and 240 and espera_ambar_min > espera_verde_min and espera_ambar_min <= 480);

-- Limites do cronômetro para qualquer pessoa da equipe (configuracoes só abre com "Configurações: Sim"); dentro do horário.
create function public.limites_espera() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('verde', espera_verde_min, 'ambar', espera_ambar_min)
  from public.configuracoes where id = 1 and public.pode_acessar_agora()
$$;
revoke execute on function public.limites_espera() from public, anon;
grant execute on function public.limites_espera() to authenticated;

-- Marcos da conversa (passou para pessoa, assumiu, devolveu, concluiu, trocou a empresa). Só as funções gravam.
create table public.conversa_eventos (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  tipo text not null check (tipo in ('passou_para_pessoa', 'assumida', 'devolvida', 'concluida', 'empresa_trocada')),
  usuario_id uuid references public.usuarios (id) on delete set null,
  texto text check (char_length(texto) <= 300),
  criado_em timestamptz not null default now()
);
create index conversa_eventos_conversa_idx on public.conversa_eventos (conversa_id, criado_em);
alter table public.conversa_eventos enable row level security;
create policy leitura on public.conversa_eventos for select to authenticated using (public.pode_ver_conversa(conversa_id));
revoke insert, update, delete, truncate on public.conversa_eventos from authenticated, anon;

-- Trabalhador: o agente passou para uma pessoa. Guarda a espera mais antiga e o primeiro motivo; assumida não marca.
create function public.marcar_aguardando_pessoa(p_conversa uuid, p_motivo text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_motivo text := left(btrim(coalesce(p_motivo, '')), 300); v_linhas int;
begin
  update public.conversas
     set aguardando_pessoa_desde = now(), motivo_pessoa = v_motivo, concluida_em = null, atualizado_em = now()
   where id = p_conversa and estado = 'agente' and aguardando_pessoa_desde is null;
  get diagnostics v_linhas = row_count;
  if v_linhas > 0 then
    insert into public.conversa_eventos (conversa_id, tipo, texto) values (p_conversa, 'passou_para_pessoa', v_motivo);
  end if;
  return v_linhas > 0;
end $$;
revoke execute on function public.marcar_aguardando_pessoa(uuid, text) from public, anon, authenticated;
grant execute on function public.marcar_aguardando_pessoa(uuid, text) to service_role;

-- Assumir: corpo de 20260927000200 + limpa a espera e grava o marco só quando o estado ou a pessoa mudam
-- (registrar_resposta chama a cada resposta da equipe).
create or replace function public.assumir_conversa(p_conversa uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_mudou int;
begin
  if not pode_ver_conversa(p_conversa) then raise exception 'sem acesso a esta conversa'; end if;
  update conversas set estado = 'humano', atendente_id = auth.uid(), aguardando_pessoa_desde = null, motivo_pessoa = null,
         concluida_em = null, atualizado_em = now()
   where id = p_conversa and (estado <> 'humano' or atendente_id is distinct from auth.uid());
  get diagnostics v_mudou = row_count;
  if v_mudou > 0 then
    insert into conversa_eventos (conversa_id, tipo, usuario_id) values (p_conversa, 'assumida', auth.uid());
  end if;
  with alterados as (
    update chamados set responsavel_id = auth.uid(), status = 'em_andamento', atualizado_em = now()
    where conversa_id = p_conversa and status <> 'concluido' and responsavel_id is null
      and (eh_admin() or setor_id in (select meus_setores()))
    returning id, cliente_id
  )
  insert into chamado_eventos (chamado_id, cliente_id, tipo, usuario_id)
  select id, cliente_id, 'assumido', auth.uid() from alterados;
end $$;

-- Devolver: corpo de 20261004000300 + limpa a espera e grava o marco quando estava assumida.
create or replace function public.devolver_ao_agente(p_conversa uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_estado estado_conversa;
begin
  perform public.exigir_acesso();
  if not (eh_admin() or exists (select 1 from conversas where id = p_conversa and atendente_id = auth.uid())) then
    raise exception 'só quem assumiu a conversa pode devolvê-la';
  end if;
  select estado into v_estado from conversas where id = p_conversa;
  update conversas set estado = 'agente', atendente_id = null, aguardando_pessoa_desde = null, motivo_pessoa = null,
         atualizado_em = now() where id = p_conversa;
  if v_estado = 'humano' then
    insert into conversa_eventos (conversa_id, tipo, usuario_id) values (p_conversa, 'devolvida', auth.uid());
  end if;
end $$;

-- Concluir o atendimento humano (P6): devolve ao agente, limpa a espera e entra em "Concluídas hoje". Demandas não mudam.
create function public.concluir_conversa(p_conversa uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_acesso();
  if not (public.eh_admin()
          or exists (select 1 from public.conversas where id = p_conversa and atendente_id = auth.uid() and estado = 'humano')) then
    raise exception 'Só quem assumiu a conversa pode concluir o atendimento.';
  end if;
  update public.conversas set estado = 'agente', atendente_id = null, aguardando_pessoa_desde = null, motivo_pessoa = null,
         concluida_em = now(), atualizado_em = now()
   where id = p_conversa;
  if not found then raise exception 'Conversa não encontrada.'; end if;
  insert into public.conversa_eventos (conversa_id, tipo, usuario_id) values (p_conversa, 'concluida', auth.uid());
end $$;
revoke execute on function public.concluir_conversa(uuid) from public, anon;
grant execute on function public.concluir_conversa(uuid) to authenticated;

-- Caixa de entrada (spec 7A.2): as colunas de antes, na mesma ordem e com o mesmo sentido (testes 04 e 22), e as novas
-- no fim. security_invoker: cada pessoa vê só o que pode_ver_conversa libera; as não lidas são as dela.
-- nao_lidas só existe numa linha de conversas que passou pela RLS (pode_ver_conversa): a leitura sozinha não abre nada.
-- O visitante consulta a caixa e recebe vazio (teste 22): precisa do select na tabela; sem política para anon, nenhuma linha.
grant select on public.conversa_leituras to anon;
create or replace view public.caixa_entrada with (security_invoker = true) as
select c.id,
    c.telefone,
    coalesce(ct.nome, c.telefone) as nome_contato,
    coalesce(cl.nome_fantasia, cl.razao_social) as empresa,
    c.estado,
    c.atendente_id,
    ult.conteudo as ultima_mensagem,
    ult.criado_em as ultima_em,
    coalesce((select array_agg(distinct ch.setor_id) from public.chamados ch
              where ch.conversa_id = c.id and ch.status <> 'concluido' and ch.setor_id is not null), '{}'::uuid[]) as setores_abertos,
    exists (select 1 from public.chamados ch where ch.conversa_id = c.id and ch.status <> 'concluido' and ch.responsavel_id is null) as sem_responsavel,
    exists (select 1 from public.chamados ch where ch.conversa_id = c.id and ch.status = 'aguardando_cliente') as aguardando_cliente,
    (select count(*) from public.chamados ch where ch.conversa_id = c.id and ch.status <> 'concluido')::integer as chamados_abertos,
    -- Parte E
    c.cliente_em_foco as cliente_id,
    ult.tipo as ultima_tipo,
    ult.autor as ultima_autor,
    ult.transcricao as ultima_transcricao,
    c.aguardando_pessoa_desde,
    c.motivo_pessoa,
    c.concluida_em,
    esp.desde as espera_desde,
    (c.aguardando_pessoa_desde is not null or c.estado = 'humano') as esperando_pessoa,
    ((c.aguardando_pessoa_desde is not null or c.estado = 'humano') and (c.atendente_id is null or c.atendente_id = auth.uid())) as esperando_voce,
    (select count(*) from public.mensagens m
      where m.conversa_id = c.id and m.autor = 'cliente'
        and m.criado_em > coalesce(lei.lida_ate, sai.em, '-infinity'::timestamptz))::integer as nao_lidas,
    coalesce(ct.agente_pausado, false) as contato_pausado,
    coalesce(cl.agente_pausado, false) as empresa_pausada,
    exists (select 1 from public.mensagens m where m.conversa_id = c.id and m.direcao = 'entrada' and m.processada_em is null) as agente_respondendo
from public.conversas c
left join public.contatos ct on ct.id = c.contato_id
left join public.clientes cl on cl.id = c.cliente_em_foco
left join lateral (select m.conteudo, m.criado_em, m.tipo, m.autor, m.transcricao from public.mensagens m
                   where m.conversa_id = c.id order by m.criado_em desc limit 1) ult on true
left join lateral (select max(m.criado_em) as em from public.mensagens m where m.conversa_id = c.id and m.direcao = 'saida') sai on true
left join lateral (select l.lida_ate from public.conversa_leituras l where l.conversa_id = c.id and l.usuario_id = auth.uid()) lei on true
-- Assumida: espera desde a primeira mensagem do cliente sem resposta; passou para pessoa: desde a passagem (P1).
left join lateral (select case when c.estado = 'humano'
                               then (select min(m.criado_em) from public.mensagens m
                                     where m.conversa_id = c.id and m.autor = 'cliente' and m.criado_em > coalesce(sai.em, '-infinity'::timestamptz))
                               else c.aguardando_pessoa_desde end as desde) esp on true
where not public.eh_telefone_do_assistente(c.telefone);
grant select on public.caixa_entrada to authenticated;
