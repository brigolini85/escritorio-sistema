-- supabase/migrations/20261005000100_painel_v2_leituras.sql
-- Painel v2, Parte E (spec 7A.2): não lidas por pessoa. Cada pessoa só lê e grava as próprias leituras (RLS);
-- o contador da lista (caixa_entrada.nao_lidas, Task 2) conta as mensagens do cliente depois de lida_ate.

create table public.conversa_leituras (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  lida_ate timestamptz not null,
  primary key (usuario_id, conversa_id)
);
create index conversa_leituras_conversa_idx on public.conversa_leituras (conversa_id);

alter table public.conversa_leituras enable row level security;
-- Só a própria pessoa, dentro do horário (eh_usuario_ativo: usuario_liberado só roda para service_role); gravar exige ver a conversa (pode_ver_conversa já passa pelo horário).
create policy propria_leitura on public.conversa_leituras for select to authenticated
  using (usuario_id = auth.uid() and public.eh_usuario_ativo());
create policy propria_insercao on public.conversa_leituras for insert to authenticated
  with check (usuario_id = auth.uid() and public.pode_ver_conversa(conversa_id));
create policy propria_alteracao on public.conversa_leituras for update to authenticated
  using (usuario_id = auth.uid() and public.pode_ver_conversa(conversa_id))
  with check (usuario_id = auth.uid() and public.pode_ver_conversa(conversa_id));
revoke all on public.conversa_leituras from anon;
revoke delete, truncate on public.conversa_leituras from authenticated;
grant select, insert, update on public.conversa_leituras to authenticated;

-- Marca como lida até p_ate (a última mensagem que a tela mostrou): nunca no futuro, nunca para trás.
-- SECURITY INVOKER: quem decide é a RLS acima (e o horário, por pode_ver_conversa).
create function public.marcar_conversa_lida(p_conversa uuid, p_ate timestamptz) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v_ate timestamptz := least(coalesce(p_ate, now()), now()); v_linhas int;
begin
  if not public.pode_ver_conversa(p_conversa) then raise exception 'Sem acesso a esta conversa.'; end if;
  insert into public.conversa_leituras as l (usuario_id, conversa_id, lida_ate)
    values (auth.uid(), p_conversa, v_ate)
  on conflict (usuario_id, conversa_id) do update set lida_ate = excluded.lida_ate
    where l.lida_ate < excluded.lida_ate;
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end $$;
revoke execute on function public.marcar_conversa_lida(uuid, timestamptz) from public, anon;
grant execute on function public.marcar_conversa_lida(uuid, timestamptz) to authenticated;
