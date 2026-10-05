-- supabase/migrations/20261013000300_painel_v2_acesso_so_pela_funcao.sql
-- Painel v2, Parte H2 (revisão das Tasks 1–2, decidido na Task 9): as marcações novas do acesso (perfil, ver valores,
-- receber documentos, avisos, alertas) mudam só por salvar_acesso_contato. Só acrescenta um gatilho: nenhuma permissão
-- de hoje muda (a equipe com editar_clientes continua gravando nota e preço e vinculando, como no Atendimento e na ficha).
-- O gatilho olha o papel de quem grava: a equipe (authenticated) não muda essas colunas direto; a função (security definer,
-- dona do banco), o trabalhador e os testes (service_role/postgres) seguem como antes. De quebra, o vínculo criado pela
-- equipe por qualquer caminho nasce Básico (D6).

create function public.contato_cliente_acesso_so_pela_funcao() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if (new.perfil, new.ver_valores, new.receber_documentos, new.avisar_documento_novo, new.recebe_alertas_acesso)
       is distinct from ('basico'::text, false, false, '{}'::text[], false) then
      raise exception 'Contato novo nasce Básico: defina o acesso no bloco de acesso.' using errcode = '42501';
    end if;
  elsif (new.perfil, new.ver_valores, new.receber_documentos, new.avisar_documento_novo, new.recebe_alertas_acesso)
        is distinct from (old.perfil, old.ver_valores, old.receber_documentos, old.avisar_documento_novo, old.recebe_alertas_acesso) then
    raise exception 'O acesso do contato muda pelo bloco de acesso.' using errcode = '42501';
  end if;
  return new;
end $$;

-- O nome começa por "a" para rodar antes de vira_personalizado (os gatilhos "before" rodam pela ordem do nome): assim ele
-- compara o que a equipe mandou, e a troca para Personalizado feita por aquele gatilho continua valendo.
create trigger acesso_so_pela_funcao before insert or update on public.contato_clientes
  for each row execute function public.contato_cliente_acesso_so_pela_funcao();
