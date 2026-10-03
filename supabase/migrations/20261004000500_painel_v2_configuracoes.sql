-- supabase/migrations/20261004000500_painel_v2_configuracoes.sql
-- Painel v2, Parte D (spec 7.1, P12): "Configurações: Sim" abre Configurações para quem não é administrador. Teto de
-- IA, alertas e pausa do agente continuam só do administrador; Usuários e permissões também (a RLS de usuarios e
-- salvar_usuario já exigem administrador).

create policy leitura_configuracoes on public.configuracoes for select to authenticated
  using (public.tem_permissao('configuracoes', 'sim'));
create policy alteracao_configuracoes on public.configuracoes for update to authenticated
  using (public.tem_permissao('configuracoes', 'sim')) with check (public.tem_permissao('configuracoes', 'sim'));

do $$
declare t text;
begin
  foreach t in array array['setores', 'servicos', 'feriados', 'respostas_prontas'] loop
    execute format('create policy escrita_configuracoes on public.%I for all to authenticated '
                   'using (public.tem_permissao(''configuracoes'', ''sim'')) with check (public.tem_permissao(''configuracoes'', ''sim''))', t);
  end loop;
end $$;

-- Colunas que mexem em gasto, em quem recebe os alertas e na pausa do agente: só o administrador (e o trabalhador).
create function public.configuracoes_so_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.eh_admin() then return new; end if;
  if (new.teto_ia_usd, new.alerta_ia_80_mes, new.minutos_alerta_fila, new.modelo_conversa, new.modelo_rapido, new.precos_modelos,
      new.telefone_dono, new.email_alertas, new.agente_pausado)
     is distinct from
     (old.teto_ia_usd, old.alerta_ia_80_mes, old.minutos_alerta_fila, old.modelo_conversa, old.modelo_rapido, old.precos_modelos,
      old.telefone_dono, old.email_alertas, old.agente_pausado) then
    raise exception 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.';
  end if;
  return new;
end $$;
create trigger so_admin before update on public.configuracoes
  for each row execute function public.configuracoes_so_admin();
