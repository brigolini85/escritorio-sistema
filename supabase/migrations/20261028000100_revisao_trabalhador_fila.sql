-- Revisão geral, área 2 (trabalhador). Só acréscimos:
--   I1: travas_trabalhador + pegar_trava/soltar_trava — uma vez por conversa (ou pergunta do assistente) sem a política
--       "stately" do pg-boss, que travava a fila de todas as conversas quando uma tinha um job esperando e outro rodando;
--   C1: mensagens.reenfileirada(_em) + conversas_com_mensagem_parada + marcar_reenfileirada — o batimento acha a mensagem
--       de cliente que ninguém processou (fila que falhou, tentativas esgotadas), devolve à fila e, depois de 2 devoluções,
--       passa a conversa à equipe.
-- (Parte do plano 2026-10-20-correcoes-confiabilidade-agente, Task 3, sem a tabela falhas_agente e o modo seguro.)

create table public.travas_trabalhador (
  chave text primary key check (char_length(chave) <= 200),
  dono uuid not null,
  ate timestamptz not null
);
alter table public.travas_trabalhador enable row level security;
-- Sem política: só a chave de serviço (o trabalhador) lê e grava.
revoke all on public.travas_trabalhador from anon, authenticated;

-- Pega (ou renova, se for o mesmo dono) a trava da chave por p_segundos. Atômica: dois consumidores, só um pega.
create function public.pegar_trava(p_chave text, p_dono uuid, p_segundos int) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_ok boolean;
begin
  insert into public.travas_trabalhador as t (chave, dono, ate) values (p_chave, p_dono, now() + make_interval(secs => p_segundos))
  on conflict (chave) do update set dono = excluded.dono, ate = excluded.ate
   where t.ate < now() or t.dono = excluded.dono
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;
revoke execute on function public.pegar_trava(text, uuid, int) from public, anon, authenticated;
grant execute on function public.pegar_trava(text, uuid, int) to service_role;

create function public.soltar_trava(p_chave text, p_dono uuid) returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.travas_trabalhador where chave = p_chave and dono = p_dono
$$;
revoke execute on function public.soltar_trava(text, uuid) from public, anon, authenticated;
grant execute on function public.soltar_trava(text, uuid) to service_role;

-- Quantas vezes o batimento já devolveu esta mensagem à fila, e quando (no máximo 2 antes de passar à equipe).
alter table public.mensagens add column reenfileirada int not null default 0, add column reenfileirada_em timestamptz;

create function public.marcar_reenfileirada(p_conversa uuid) returns void
language sql volatile security definer set search_path = '' as $$
  update public.mensagens set reenfileirada = reenfileirada + 1, reenfileirada_em = now()
   where conversa_id = p_conversa and direcao = 'entrada' and processada_em is null
$$;
revoke execute on function public.marcar_reenfileirada(uuid) from public, anon, authenticated;
grant execute on function public.marcar_reenfileirada(uuid) to service_role;

-- Conversa com o agente com mensagem de cliente não processada há entre p_de_min e p_ate_min minutos (a mais antiga decide).
-- Fica de fora a conversa com a vez em andamento (trava valendo): o agente ainda está trabalhando nela.
create function public.conversas_com_mensagem_parada(p_de_min int, p_ate_min int)
returns table (conversa_id uuid, desde timestamptz, reenvios int, ultimo_reenvio timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.conversa_id, min(m.criado_em), max(m.reenfileirada), max(m.reenfileirada_em)
    from public.mensagens m join public.conversas c on c.id = m.conversa_id
   where m.direcao = 'entrada' and m.processada_em is null and c.estado = 'agente'
     and not exists (select 1 from public.travas_trabalhador t where t.chave = 'conversa:' || m.conversa_id::text and t.ate > now())
   group by m.conversa_id
  having min(m.criado_em) <= now() - make_interval(mins => p_de_min) and min(m.criado_em) > now() - make_interval(mins => p_ate_min)
$$;
revoke execute on function public.conversas_com_mensagem_parada(int, int) from public, anon, authenticated;
grant execute on function public.conversas_com_mensagem_parada(int, int) to service_role;

-- A busca do batimento (a cada minuto) só olha as entradas ainda não processadas.
create index if not exists mensagens_entrada_nao_processada_idx on public.mensagens (criado_em)
  where direcao = 'entrada' and processada_em is null;
