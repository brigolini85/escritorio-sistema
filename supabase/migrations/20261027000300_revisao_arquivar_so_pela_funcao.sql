-- Revisão geral, área 1, I3: arquivar e restaurar clientes, contatos, produtos, redes e unidades só pelas funções.
-- A política "alterar" dessas tabelas libera UPDATE de qualquer coluna com "Ver e editar"; um PATCH direto com
-- {ativo: false} arquivava sem o nível "Editar e arquivar", sem a linha na auditoria e, ao restaurar um contato, sem a
-- trava da LGPD. Agora, numa sessão de pessoa (papel authenticated/anon) a mudança de "ativo" é recusada; arquivar_cadastro,
-- restaurar_cadastro, cadastrar_contato e anonimizar_contato são security definer (rodam como o dono das funções) e seguem
-- valendo, com as conferências e a auditoria delas. Trabalhador (service_role) e ajustes por SQL também seguem.
-- usuarios fica como antes (só o administrador escreve na tabela, pela política escrita_admin).
-- Corpo de 20261002000100 + a trava; o gatilho "arquivamento" das 6 tabelas continua apontando para esta função.

create or replace function public.marcar_arquivamento() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.ativo is distinct from old.ativo then
    if tg_table_name <> 'usuarios' and current_user in ('authenticated', 'anon') then
      raise exception 'Arquive ou restaure pelo botão Arquivar/Restaurar.';
    end if;
    if new.ativo then
      new.arquivado_em := null;
      new.arquivado_por := null;
    else
      new.arquivado_em := coalesce(new.arquivado_em, now());
      new.arquivado_por := coalesce(new.arquivado_por, auth.uid());
    end if;
  end if;
  return new;
end $$;
