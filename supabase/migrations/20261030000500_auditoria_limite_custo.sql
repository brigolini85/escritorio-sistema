-- supabase/migrations/20261030000500_auditoria_limite_custo.sql
-- Auditoria 4.2 e 5.2 (decisão D2): qualquer número esgotava o teto do mês e desligava o agente para todos. Agora há um
-- limite de gasto com IA por telefone por dia (dia de São Paulo): US$ 2,00 para contato cadastrado e US$ 0,30 para número
-- desconhecido, que só o administrador muda. Auditoria 4.12: o alerta de 80% do mês é marcado por uma chamada só.

alter table public.configuracoes
  add column limite_dia_contato_usd numeric not null default 2 check (limite_dia_contato_usd >= 0),
  add column limite_dia_desconhecido_usd numeric not null default 0.30 check (limite_dia_desconhecido_usd >= 0);

-- Gasto de hoje (desde a meia-noite de São Paulo) do atendimento automático de todas as conversas com este telefone. Só o
-- trabalhador. Só conta o que o número provoca (agente, agente do setor, transcrição): a sugestão de resposta e a simulação
-- são gasto da equipe e não podem tirar o atendimento do cliente (revisão da Task 6).
create function public.custo_ia_do_telefone_hoje(p_telefone text) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(u.custo_usd), 0)
  from public.uso_ia u
  join public.conversas c on c.id = u.conversa_id
  where c.telefone = p_telefone
    and u.funcionalidade in ('agente_clientes', 'especialista_setor', 'transcricao_audio')
    and u.criado_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
$$;
revoke execute on function public.custo_ia_do_telefone_hoje(text) from public, anon, authenticated;
grant execute on function public.custo_ia_do_telefone_hoje(text) to service_role;

-- D2: o aviso do limite do dia sai uma vez por dia (São Paulo) por telefone. A chave é o hash do telefone inteiro (o texto do
-- aviso mostra só o final, e dois números com o mesmo final não podem se juntar). Só o trabalhador.
create table public.avisos_limite_dia (
  telefone_hash text not null,
  dia date not null,
  primary key (telefone_hash, dia)
);
alter table public.avisos_limite_dia enable row level security;
revoke all on table public.avisos_limite_dia from public, anon, authenticated;

create function public.marcar_aviso_limite_dia(p_telefone text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_dia date := (now() at time zone 'America/Sao_Paulo')::date; v_linhas int;
begin
  -- Guarda só os últimos dias: a tabela não cresce.
  delete from public.avisos_limite_dia where dia < v_dia - 2;
  insert into public.avisos_limite_dia (telefone_hash, dia) values (md5(p_telefone), v_dia) on conflict do nothing;
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end $$;
revoke execute on function public.marcar_aviso_limite_dia(text) from public, anon, authenticated;
grant execute on function public.marcar_aviso_limite_dia(text) to service_role;

-- Auditoria 4.12: quatro vezes terminando juntas mandavam quatro alertas. Só quem conseguiu marcar o mês envia.
create function public.marcar_alerta_ia80(p_mes text) returns boolean
language sql volatile security definer set search_path = '' as $$
  with marcou as (
    update public.configuracoes set alerta_ia_80_mes = p_mes
    where id = 1 and alerta_ia_80_mes is distinct from p_mes
    returning 1
  )
  select exists (select 1 from marcou)
$$;
revoke execute on function public.marcar_alerta_ia80(text) from public, anon, authenticated;
grant execute on function public.marcar_alerta_ia80(text) to service_role;

-- Os dois limites entram na lista do administrador (a mesma mensagem de antes).
create or replace function public.configuracoes_so_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.eh_admin() then return new; end if;
  if (new.teto_ia_usd, new.alerta_ia_80_mes, new.minutos_alerta_fila, new.modelo_conversa, new.modelo_rapido, new.precos_modelos,
      new.telefone_dono, new.email_alertas, new.agente_pausado, new.cotacao_usd_brl, new.custo_minuto_transcricao_usd,
      new.limite_dia_contato_usd, new.limite_dia_desconhecido_usd)
     is distinct from
     (old.teto_ia_usd, old.alerta_ia_80_mes, old.minutos_alerta_fila, old.modelo_conversa, old.modelo_rapido, old.precos_modelos,
      old.telefone_dono, old.email_alertas, old.agente_pausado, old.cotacao_usd_brl, old.custo_minuto_transcricao_usd,
      old.limite_dia_contato_usd, old.limite_dia_desconhecido_usd) then
    raise exception 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.';
  end if;
  -- Auditoria 6.7: o que sai para os clientes (e para a tela de entrada) e os dados de pagamento (D3).
  if (new.mensagens, new.aviso_login, new.dados_pagamento) is distinct from (old.mensagens, old.aviso_login, old.dados_pagamento) then
    raise exception 'Só o administrador muda as mensagens automáticas, o aviso do login e os dados de pagamento.';
  end if;
  return new;
end $$;
