-- supabase/migrations/20261009000100_painel_v2_contatos.sql
-- Painel v2, Parte G3 (spec 7C.2): a lista de Contatos ordenada pelo último contato, com busca pela empresa e contagens no
-- servidor (D1), e o resumo do WhatsApp de um contato. As duas leem com a regra de quem consulta (security invoker): quem
-- não vê a conversa (Parte D) não recebe a hora nem o estado dela (D2). Nada grava e nada entra no Realtime (teste 22).

create view public.contatos_lista with (security_invoker = true) as
select ct.id, ct.nome, ct.telefone, ct.agente_pausado, ct.ativo, ct.criado_em,
       -- Só empresas ativas (D5): a arquivada sai das listas, das contagens e dos filtros, como no agente.
       coalesce(emp.empresas, '[]'::jsonb) as empresas,
       coalesce(emp.empresa_ids, '{}'::uuid[]) as empresa_ids,
       coalesce(emp.total, 0) as n_empresas,
       coalesce(emp.busca, '') as empresas_busca,
       coalesce(emp.alguma_nota, false) as pode_pedir_nota_alguma,
       coalesce(emp.algum_preco, false) as muda_preco_alguma,
       -- A conversa é uma por telefone; a caixa_entrada já passou pela regra de leitura e tem a espera do Atendimento (D15).
       ce.id as conversa_id,
       ce.ultima_em as ultimo_contato_em,
       ce.estado as estado_conversa,
       ce.atendente_id,
       u.nome as atendente_nome,
       ce.espera_desde
from public.contatos ct
left join lateral (
  select jsonb_agg(jsonb_build_object('id', cl.id, 'nome', coalesce(nullif(cl.nome_fantasia, ''), cl.razao_social),
                                      'pode_pedir_nota', cc.pode_pedir_nota, 'pode_atualizar_preco', cc.pode_atualizar_preco)
                   order by coalesce(nullif(cl.nome_fantasia, ''), cl.razao_social)) as empresas,
         array_agg(cl.id) as empresa_ids,
         count(*)::int as total,
         string_agg(cl.razao_social || ' ' || coalesce(cl.nome_fantasia, ''), ' ') as busca,
         bool_or(cc.pode_pedir_nota) as alguma_nota,
         bool_or(cc.pode_atualizar_preco) as algum_preco
  from public.contato_clientes cc
  join public.clientes cl on cl.id = cc.cliente_id and cl.ativo
  where cc.contato_id = ct.id
) emp on true
left join public.caixa_entrada ce on ce.telefone = ct.telefone
left join public.usuarios u on u.id = ce.atendente_id;

-- Só leitura e só para a equipe (o padrão do Supabase daria escrita a anon e authenticated).
revoke all on public.contatos_lista from public, anon, authenticated;
grant select on public.contatos_lista to authenticated;

-- Atendimentos (dia de Brasília com mensagem do cliente, como na Parte F) e quantos o agente resolveu sozinho: ninguém da
-- equipe respondeu, assumiu ou recebeu a passagem no dia (a regra do Início, G2 D7). Invoker: só conversas que quem chama vê.
create function public.contato_whatsapp_resumo(p_contato uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with cv as (
    select c.id from public.conversas c
    where c.contato_id = p_contato
       or c.telefone = (select ct.telefone from public.contatos ct where ct.id = p_contato)
  ), dias as (
    select m.conversa_id, (m.criado_em at time zone 'America/Sao_Paulo')::date as dia
    from public.mensagens m
    where m.conversa_id in (select id from cv) and m.autor = 'cliente'
    group by 1, 2
  ), com_pessoa as (
    select d.conversa_id, d.dia,
           exists (select 1 from public.mensagens m
                    where m.conversa_id = d.conversa_id and m.autor = 'atendente'
                      and m.criado_em >= d.dia::timestamp at time zone 'America/Sao_Paulo'
                      and m.criado_em < (d.dia + 1)::timestamp at time zone 'America/Sao_Paulo')
           or exists (select 1 from public.conversa_eventos e
                       where e.conversa_id = d.conversa_id and e.tipo in ('assumida', 'passou_para_pessoa')
                         and e.criado_em >= d.dia::timestamp at time zone 'America/Sao_Paulo'
                         and e.criado_em < (d.dia + 1)::timestamp at time zone 'America/Sao_Paulo') as pessoa
    from dias d
  )
  select jsonb_build_object('atendimentos', count(*), 'resolvidas_agente', count(*) filter (where not p.pessoa))
  from com_pessoa p
$$;
revoke execute on function public.contato_whatsapp_resumo(uuid) from public, anon;
grant execute on function public.contato_whatsapp_resumo(uuid) to authenticated;
