-- Auditoria 4.8, 4.9, 4.13 e 4.15: monitoramento que mostra o que importa.
--   * indicadores_saude: o /saude passa a medir mensagens de cliente atrasadas (mais de 5 min e menos de 24 h), envios com
--     falha na última hora e, para o alerta diário, as mensagens esquecidas há mais de 24 h. Conversa com pessoa (atendente
--     assumiu ou esperando pessoa) fica de fora: ali a demora é da equipe, não do sistema.
--   * ia_falhas_seguidas + registrar_resultado_ia: 3 falhas seguidas da IA, de conversas diferentes, em 10 min = falha
--     geral. Contada no banco para valer entre processos; um sucesso no meio zera.
--   * uso_ia.turno: liga a chamada ao modelo à vez (decisões e saídas já têm o turno).

alter table public.uso_ia add column turno text check (char_length(turno) <= 100);

-- Uma linha por chamada à IA que falhou desde o último sucesso (no máximo 10 min). Só o trabalhador.
create table public.ia_falhas_seguidas (
  id bigint generated always as identity primary key,
  conversa_id uuid,
  criado_em timestamptz not null default now()
);
alter table public.ia_falhas_seguidas enable row level security;
revoke all on public.ia_falhas_seguidas from public, anon, authenticated;
grant select, insert, delete on public.ia_falhas_seguidas to service_role;

-- p_ok: a chamada deu certo (zera a conta). Falha: guarda e devolve true se, nos últimos 10 min e sem sucesso no meio, já
-- houve falhas de 3 conversas diferentes. Só o trabalhador.
create function public.registrar_resultado_ia(p_conversa uuid, p_ok boolean) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_conversas int;
begin
  if p_ok then
    -- "where true": o PostgREST (pg_safeupdate) recusa delete sem where.
    delete from public.ia_falhas_seguidas where true;
    return false;
  end if;
  delete from public.ia_falhas_seguidas where criado_em < now() - interval '10 minutes';
  insert into public.ia_falhas_seguidas (conversa_id) values (p_conversa);
  select count(distinct conversa_id) into v_conversas from public.ia_falhas_seguidas;
  return v_conversas >= 3;
end $$;
revoke execute on function public.registrar_resultado_ia(uuid, boolean) from public, anon, authenticated;
grant execute on function public.registrar_resultado_ia(uuid, boolean) to service_role;

-- O que o /saude e o alerta diário olham. Contagens só (nada de telefone ou texto). plpgsql: o corpo cita o valor
-- 'incerto' do enum, criado noutra migração. Só o trabalhador.
create function public.indicadores_saude() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_atrasadas int;
  v_esquecidas int;
  v_falhas int;
begin
  select count(distinct m.conversa_id) into v_atrasadas
    from public.mensagens m join public.conversas c on c.id = m.conversa_id
   where m.direcao = 'entrada' and m.processada_em is null
     and m.criado_em <= now() - interval '5 minutes' and m.criado_em > now() - interval '24 hours'
     and c.estado = 'agente' and c.aguardando_pessoa_desde is null;

  select count(*) into v_esquecidas
    from public.mensagens m join public.conversas c on c.id = m.conversa_id
   where m.direcao = 'entrada' and m.processada_em is null and m.criado_em <= now() - interval '24 hours'
     and c.estado = 'agente' and c.aguardando_pessoa_desde is null;

  select count(*) into v_falhas
    from public.mensagens m
   where m.direcao = 'saida' and m.status_envio in ('falhou', 'incerto') and m.criado_em > now() - interval '1 hour';

  return jsonb_build_object('conversas_atrasadas', v_atrasadas, 'envios_com_falha', v_falhas, 'entradas_esquecidas', v_esquecidas);
end $$;
revoke execute on function public.indicadores_saude() from public, anon, authenticated;
grant execute on function public.indicadores_saude() to service_role;

-- As saídas com falha da última hora (o índice de entrada não processada já existe: mensagens_entrada_nao_processada_idx).
create index if not exists mensagens_saida_falha_idx on public.mensagens (criado_em)
  where direcao = 'saida' and status_envio in ('falhou', 'incerto');
