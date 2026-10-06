-- Revisão geral, área 1, I2: transferir_chamado segue a regra de definir_responsavel e criar_demanda.
-- O setor de destino precisa existir e estar ativo (sem setor = Triagem, como antes); o responsável, quando vem, precisa
-- ser pessoa ativa desse setor (ou administrador; na Triagem, qualquer pessoa ativa) — pode_ser_responsavel.
-- Antes, a demanda (e, pelo responsavel_id, a conversa) podia ir para uma pessoa arquivada ou de fora do setor.
-- Troca de responsável também grava "responsavel_alterado", como definir_responsavel.
-- Corpo de 20261003000600 + as conferências; mesma assinatura, security definer e search_path (os grants ficam).

create or replace function public.transferir_chamado(p_chamado uuid, p_setor uuid, p_responsavel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status status_chamado; v_responsavel_antes uuid;
begin
  if not pode_ver_chamado(p_chamado) then raise exception 'sem acesso a este chamado'; end if;
  select status, responsavel_id into v_status, v_responsavel_antes from chamados where id = p_chamado for update;
  if v_status = 'concluido' then raise exception 'Esta demanda está concluída. Reabra antes de mudar.'; end if;
  if p_setor is not null and not exists (select 1 from setores where id = p_setor and ativo) then
    raise exception 'Escolha um setor ativo.';
  end if;
  if p_responsavel is not null and not pode_ser_responsavel(p_responsavel, p_setor) then
    raise exception 'Escolha uma pessoa ativa do setor da demanda.';
  end if;
  update chamados set setor_id = p_setor, responsavel_id = p_responsavel, status = 'aberto', atualizado_em = now()
  where id = p_chamado;
  insert into chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
  select id, cliente_id, 'transferencia', auth.uid(),
         (select nome from setores where id = p_setor)
  from chamados where id = p_chamado;
  if p_responsavel is distinct from v_responsavel_antes then
    insert into chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    select id, cliente_id, 'responsavel_alterado', auth.uid(), (select nome from usuarios where id = p_responsavel)
    from chamados where id = p_chamado;
  end if;
end $$;
