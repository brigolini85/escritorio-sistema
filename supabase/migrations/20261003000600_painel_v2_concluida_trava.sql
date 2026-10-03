-- Painel v2, Parte C (revisão final, minor 3): concluir_chamado e transferir_chamado recusam demanda já concluída.
-- Com o quadro e o painel lateral, um cartão desatualizado concluía de novo (concluido_em reescrito, evento
-- "conclusao" duplicado, conversa devolvida ao agente) ou transferia reabrindo sem limpar concluido_em.
-- Mesmas assinaturas, mesmo security definer e search_path de antes (create or replace mantém os grants).
-- A linha é travada (for update) antes da conferência, como em demanda_para_agir.

create or replace function public.transferir_chamado(p_chamado uuid, p_setor uuid, p_responsavel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status status_chamado;
begin
  if not pode_ver_chamado(p_chamado) then raise exception 'sem acesso a este chamado'; end if;
  select status into v_status from chamados where id = p_chamado for update;
  if v_status = 'concluido' then raise exception 'Esta demanda está concluída. Reabra antes de mudar.'; end if;
  update chamados set setor_id = p_setor, responsavel_id = p_responsavel, status = 'aberto', atualizado_em = now()
  where id = p_chamado;
  insert into chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
  select id, cliente_id, 'transferencia', auth.uid(),
         (select nome from setores where id = p_setor)
  from chamados where id = p_chamado;
end $$;

create or replace function public.concluir_chamado(p_chamado uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_conversa uuid; v_status status_chamado;
begin
  if not pode_ver_chamado(p_chamado) then raise exception 'sem acesso a este chamado'; end if;
  select status into v_status from chamados where id = p_chamado for update;
  if v_status = 'concluido' then raise exception 'Esta demanda já está concluída.'; end if;
  update chamados set status = 'concluido', concluido_em = now(), atualizado_em = now()
  where id = p_chamado returning conversa_id into v_conversa;
  insert into chamado_eventos (chamado_id, cliente_id, tipo, usuario_id)
  select id, cliente_id, 'conclusao', auth.uid() from chamados where id = p_chamado;
  if v_conversa is not null and not exists (
    select 1 from chamados where conversa_id = v_conversa and status <> 'concluido'
  ) then
    update conversas set estado = 'agente', atendente_id = null, atualizado_em = now() where id = v_conversa;
  end if;
end $$;
