-- supabase/migrations/20261003000200_painel_v2_restaurar_unidade.sql
-- Sobra 3 da Parte B: restaurar uma unidade cuja rede está arquivada a deixava ativa e invisível. Agora a função
-- pergunta antes (não muda nada) e, com o sim (p_com_rede), restaura a rede e a unidade numa transação só.
create function public.restaurar_unidade(p_id uuid, p_com_rede boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_grupo uuid; v_ativa boolean; v_nome text; v_tipo text;
begin
  perform public.exigir_arquivar('unidade');
  select grupo_id into v_grupo from public.parceiros_unidades where id = p_id;
  if not found then raise exception 'Cadastro não encontrado.'; end if;
  -- Trava a rede: ninguém a arquiva nem restaura entre a leitura e a restauração.
  select ativo, nome, tipo::text into v_ativa, v_nome, v_tipo from public.parceiros_grupos where id = v_grupo for update;
  if not v_ativa and not coalesce(p_com_rede, false) then
    return jsonb_build_object('restaurada', false,
      'rede_arquivada', jsonb_build_object('id', v_grupo, 'nome', v_nome, 'tipo', v_tipo));
  end if;
  if not v_ativa then perform public.restaurar_cadastro('rede', v_grupo); end if;
  perform public.restaurar_cadastro('unidade', p_id);
  return jsonb_build_object('restaurada', true, 'rede_restaurada', not v_ativa);
end $$;

revoke all on function public.restaurar_unidade(uuid, boolean) from public, anon, authenticated;
grant execute on function public.restaurar_unidade(uuid, boolean) to authenticated;
