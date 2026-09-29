-- Assistente interno para o dono e a equipe (pedido do dono, 2026-09-29), pelo painel e pelo WhatsApp.
create table public.assistente_mensagens (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  canal text not null check (canal in ('site', 'whatsapp')),
  conversa_id uuid references public.conversas (id) on delete cascade,   -- contexto: a caixa dentro de um atendimento
  papel text not null check (papel in ('usuario', 'assistente')),
  conteudo text not null,
  arquivo jsonb,                                                         -- {"tipo":"csv_bling","chamados":[...],"nome":"..."}
  processada_em timestamptz,
  criado_em timestamptz not null default now()
);
create index assistente_mensagens_conversa_idx on public.assistente_mensagens (usuario_id, canal, conversa_id, criado_em);

alter table public.assistente_mensagens enable row level security;
create policy leitura on public.assistente_mensagens for select to authenticated
  using (usuario_id = auth.uid() and eh_usuario_ativo());
create policy pergunta on public.assistente_mensagens for insert to authenticated
  with check (usuario_id = auth.uid() and papel = 'usuario' and canal = 'site' and processada_em is null
    and exists (select 1 from usuarios u where u.id = auth.uid() and u.ativo and 'assistente_site' = any (u.permissoes))
    and (conversa_id is null or exists (select 1 from public.conversas c where c.id = conversa_id)));
alter publication supabase_realtime add table public.assistente_mensagens;

-- Telefone de usuário ativo com o assistente pelo WhatsApp (com ou sem o 9: compara DDI+DDD e os 8 últimos dígitos).
create function public.eh_telefone_do_assistente(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuarios u
    where u.ativo and 'assistente_whatsapp' = any (u.permissoes) and u.telefone is not null
      and (u.telefone = p or (left(u.telefone, 4) = left(p, 4) and right(u.telefone, 8) = right(p, 8)))
  )
$$;
revoke execute on function public.eh_telefone_do_assistente(text) from public, anon;

-- As conversas internas (WhatsApp do assistente) não aparecem no Atendimento.
create or replace view public.caixa_entrada with (security_invoker = true) as
SELECT c.id,
    c.telefone,
    COALESCE(ct.nome, c.telefone) AS nome_contato,
    COALESCE(cl.nome_fantasia, cl.razao_social) AS empresa,
    c.estado,
    c.atendente_id,
    ( SELECT m.conteudo FROM mensagens m WHERE (m.conversa_id = c.id) ORDER BY m.criado_em DESC LIMIT 1) AS ultima_mensagem,
    ( SELECT max(m.criado_em) AS max FROM mensagens m WHERE (m.conversa_id = c.id)) AS ultima_em,
    COALESCE(( SELECT array_agg(DISTINCT ch.setor_id) AS array_agg FROM chamados ch
          WHERE ((ch.conversa_id = c.id) AND (ch.status <> 'concluido'::status_chamado) AND (ch.setor_id IS NOT NULL))), '{}'::uuid[]) AS setores_abertos,
    (EXISTS ( SELECT 1 FROM chamados ch WHERE ((ch.conversa_id = c.id) AND (ch.status <> 'concluido'::status_chamado) AND (ch.responsavel_id IS NULL)))) AS sem_responsavel,
    (EXISTS ( SELECT 1 FROM chamados ch WHERE ((ch.conversa_id = c.id) AND (ch.status = 'aguardando_cliente'::status_chamado)))) AS aguardando_cliente,
    (( SELECT count(*) AS count FROM chamados ch WHERE ((ch.conversa_id = c.id) AND (ch.status <> 'concluido'::status_chamado))))::integer AS chamados_abertos
   FROM ((conversas c
     LEFT JOIN contatos ct ON ((ct.id = c.contato_id)))
     LEFT JOIN clientes cl ON ((cl.id = c.cliente_em_foco)))
  WHERE NOT public.eh_telefone_do_assistente(c.telefone);
