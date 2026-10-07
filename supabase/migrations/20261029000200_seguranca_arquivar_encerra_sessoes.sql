-- supabase/migrations/20261029000200_seguranca_arquivar_encerra_sessoes.sql
-- Segurança do login (item 9): arquivar a pessoa também encerra as sessões dela no Supabase Auth. Antes, o banco já
-- recusava tudo (RLS), mas o login continuava aberto no navegador até o token vencer e podia ser renovado.
--
-- Gatilho em vez de chamada do painel: vale para qualquer caminho que arquive (a função arquivar_cadastro, que confere a
-- permissão antes, é o único caminho de uma sessão de pessoa — migração 20261027000300), e roda na mesma transação.
-- Apagar a sessão apaga junto os tokens de renovação (chave estrangeira em cascata) e o getUser do painel passa a recusar
-- o token de acesso que sobrou (sessão inexistente).

create function public.encerrar_sessoes_ao_arquivar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.sessions where user_id = new.id;
  return null;
end $$;
revoke execute on function public.encerrar_sessoes_ao_arquivar() from public, anon, authenticated, service_role;

create trigger encerrar_sessoes_ao_arquivar
after update of ativo on public.usuarios
for each row when (old.ativo and not new.ativo)
execute function public.encerrar_sessoes_ao_arquivar();
