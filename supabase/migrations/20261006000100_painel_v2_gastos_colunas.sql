-- supabase/migrations/20261006000100_painel_v2_gastos_colunas.sql
-- Painel v2, Parte F (spec 7B.2): uso_ia registra empresa, setor, provedor e segundos de áudio. Quem grava sem
-- funcionalidade (registros antigos, trabalhador antigo) passa por uma regra só, uso_ia_classificacao (P1–P3).

alter table public.uso_ia
  add column cliente_id uuid references public.clientes (id) on delete set null,
  add column setor_id uuid references public.setores (id) on delete set null,
  add column provedor text not null default 'anthropic' check (provedor in ('anthropic', 'groq')),
  add column segundos_audio numeric(10, 2) check (segundos_audio >= 0);

-- Filtros da tela (spec 7B.2) e as chaves estrangeiras (apagar empresa/conversa/pessoa não varre a tabela).
drop index public.uso_ia_usuario_idx;
create index uso_ia_criado_idx on public.uso_ia (criado_em);
create index uso_ia_funcionalidade_idx on public.uso_ia (funcionalidade, criado_em);
create index uso_ia_usuario_idx on public.uso_ia (usuario_id, criado_em);
create index uso_ia_cliente_idx on public.uso_ia (cliente_id, criado_em);
create index uso_ia_conversa_idx on public.uso_ia (conversa_id, criado_em);
create index uso_ia_setor_idx on public.uso_ia (setor_id);

-- Com conversa: era o agente (único caminho antigo que gravava conversa). Empresa: a da última mensagem com empresa
-- até aquele momento, nunca a em foco de hoje (P2).
create function public.uso_ia_classificacao(p_conversa uuid, p_quando timestamptz)
returns table (funcionalidade text, cliente_id uuid)
language sql stable security definer set search_path = '' as $$
  select case when p_conversa is null then 'nao_identificado' else 'agente_clientes' end,
         (select m.cliente_id from public.mensagens m
           where p_conversa is not null and m.conversa_id = p_conversa and m.cliente_id is not null and m.criado_em <= p_quando
           order by m.criado_em desc limit 1)
$$;
revoke execute on function public.uso_ia_classificacao(uuid, timestamptz) from public, anon, authenticated;

-- O trabalhador novo sempre manda a funcionalidade; o antigo (porta 3001 até a troca) não: sem isto o agente pararia.
create function public.uso_ia_completar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  if new.funcionalidade is null then
    select * into c from public.uso_ia_classificacao(new.conversa_id, new.criado_em);
    new.funcionalidade := c.funcionalidade;
    new.cliente_id := coalesce(new.cliente_id, c.cliente_id);
  end if;
  return new;
end $$;
revoke execute on function public.uso_ia_completar() from public, anon, authenticated;
create trigger completar before insert on public.uso_ia for each row execute function public.uso_ia_completar();

-- Cotação para mostrar R$ e preço por minuto da transcrição (spec 7B.2, seção 9): o administrador preenche.
alter table public.configuracoes
  add column cotacao_usd_brl numeric(8, 4) check (cotacao_usd_brl > 0),
  add column custo_minuto_transcricao_usd numeric(10, 6) check (custo_minuto_transcricao_usd >= 0);

create or replace function public.configuracoes_so_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.eh_admin() then return new; end if;
  if (new.teto_ia_usd, new.alerta_ia_80_mes, new.minutos_alerta_fila, new.modelo_conversa, new.modelo_rapido, new.precos_modelos,
      new.telefone_dono, new.email_alertas, new.agente_pausado, new.cotacao_usd_brl, new.custo_minuto_transcricao_usd)
     is distinct from
     (old.teto_ia_usd, old.alerta_ia_80_mes, old.minutos_alerta_fila, old.modelo_conversa, old.modelo_rapido, old.precos_modelos,
      old.telefone_dono, old.email_alertas, old.agente_pausado, old.cotacao_usd_brl, old.custo_minuto_transcricao_usd) then
    raise exception 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.';
  end if;
  return new;
end $$;
