-- Agente por contato e cadastro do contato a partir da conversa (pedido do dono, 2026-09-28).

-- Com o agente desligado para o contato, nada é enviado automaticamente e a conversa vira triagem,
-- mesmo com o agente ligado para o resto (mesma regra da pausa geral).
alter table public.contatos add column agente_pausado boolean not null default false;

-- Liga a conversa ao contato recém-cadastrado pelo painel (a tabela conversas não aceita escrita direta do navegador).
create function public.vincular_contato_conversa(p_conversa uuid, p_contato uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('editar_clientes') then raise exception 'sem permissão para editar clientes'; end if;
  if not pode_ver_conversa(p_conversa) then raise exception 'sem acesso a esta conversa'; end if;
  if not exists (select 1 from contatos c join conversas v on v.telefone = c.telefone where c.id = p_contato and v.id = p_conversa) then
    raise exception 'o contato não tem o telefone desta conversa';
  end if;
  update conversas set contato_id = p_contato, atualizado_em = now() where id = p_conversa;
end $$;
