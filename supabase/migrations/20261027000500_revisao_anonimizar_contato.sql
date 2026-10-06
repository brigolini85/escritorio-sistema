-- Revisão geral, área 1, I5: anonimizar_contato (LGPD) alcança o que as Partes C e I passaram a guardar.
-- Corpo de 20261013000100 + :
--   * demandas do titular = as das conversas dele E as ligadas só por chamados.contato_id (criar_demanda com p_contato):
--     título, resumo e notas (chamado_eventos.texto) apagados;
--   * tarefas dessas demandas: pedido, anotações, resultado, ajustes e a linha do tempo;
--   * pendências dessas tarefas ou com o contato (contato_id): pergunta, detalhe, mensagem, pedido e resposta;
--   * sugestões e pré-análise de nota dessas demandas: apagadas (como sugestoes_resposta);
--   * arquivos das tarefas: os anexos da conversa (mesmo caminho das mensagens) e os do compartimento "tarefas" que
--     respondem a uma pendência do contato ficam marcados como removidos, e os do compartimento "tarefas" entram no
--     retorno. O retorno mistura os dois compartimentos; o formato separa: "conversas/..." é de "anexos" e
--     "<tarefa>/<arquivo>" é de "tarefas" (o trabalhador apaga cada um no seu).
-- Mesma assinatura, security definer e search_path de antes (os grants ficam).

create or replace function public.anonimizar_contato(p_contato uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  v_tel text; v_paths text[]; v_paths_tarefas text[]; v_novo text;
  v_conversas uuid[]; v_chamados uuid[]; v_tarefas uuid[];
  c_removido constant text := '[removido a pedido do titular]';
begin
  if not eh_admin() then raise exception 'somente administrador'; end if;
  select telefone into v_tel from contatos where id = p_contato;
  if v_tel is null then raise exception 'contato não encontrado'; end if;

  select coalesce(array_agg(id), '{}') into v_conversas from conversas where contato_id = p_contato or telefone = v_tel;
  select coalesce(array_agg(id), '{}') into v_chamados from chamados
   where conversa_id = any (v_conversas) or contato_id = p_contato;
  select coalesce(array_agg(id), '{}') into v_tarefas from agente_tarefas where chamado_id = any (v_chamados);

  select coalesce(array_agg(m.arquivo_path) filter (where m.arquivo_path is not null), '{}') into v_paths
  from mensagens m where m.conversa_id = any (v_conversas);

  update mensagens m set conteudo = c_removido, transcricao = null,
         arquivo_path = null, arquivo_nome = null, midia_url_origem = null
  where m.conversa_id = any (v_conversas);
  delete from decisoes_agente where conversa_id = any (v_conversas);
  delete from assistente_mensagens where conversa_id = any (v_conversas);
  -- Parte E
  delete from sugestoes_resposta where conversa_id = any (v_conversas);
  update conversa_eventos set texto = null where conversa_id = any (v_conversas);
  update conversas set motivo_pessoa = null where id = any (v_conversas);

  -- Demandas do titular (pela conversa ou só pelo contato): título, resumo e notas podem conter dados pessoais.
  update chamados set titulo = c_removido, resumo = c_removido where id = any (v_chamados);
  update chamado_eventos set texto = null where chamado_id = any (v_chamados);

  -- Parte I: sugestões, pré-análise, tarefas, pendências e arquivos das tarefas.
  delete from agente_sugestoes where chamado_id = any (v_chamados) or conversa_id = any (v_conversas);
  delete from pre_analises_nota where chamado_id = any (v_chamados);
  update agente_tarefas set pedido = c_removido, anotacoes = '', resultado = null, ajustes = '[]'::jsonb
   where id = any (v_tarefas);
  update agente_tarefa_eventos set texto = c_removido where tarefa_id = any (v_tarefas);
  with arquivos_do_contato as (
    update agente_tarefa_arquivos a set removido_em = coalesce(a.removido_em, now())
     where (a.bucket = 'anexos' and a.caminho = any (v_paths))
        or (a.bucket = 'tarefas' and a.id in (select p.arquivo_id from agente_pendencias p
                                             where p.contato_id = p_contato and p.arquivo_id is not null))
    returning a.bucket, a.caminho)
  select coalesce(array_agg(distinct caminho) filter (where bucket = 'tarefas'), '{}') into v_paths_tarefas from arquivos_do_contato;
  update agente_pendencias set pergunta = c_removido, detalhe = null, mensagem = null, pedido_texto = null, resposta = null
   where tarefa_id = any (v_tarefas) or contato_id = p_contato;

  -- random() é avaliado por linha: cada conversa recebe um número fictício diferente (telefone é único).
  update conversas set telefone = '5500' || lpad(floor(random() * 1e9)::text, 9, '0') where id = any (v_conversas);
  v_novo := '5500' || lpad(floor(random() * 1e9)::text, 9, '0');
  update contatos set nome = 'Contato removido', ativo = false, telefone = v_novo, cargo = null, email = null where id = p_contato;

  -- O gatilho de auditoria guardou nome e telefone originais em "antes": apagar esses registros também.
  delete from auditoria_acessos where entidade in ('contatos', 'contato_clientes', 'contato_cliente_setores')
    and (entidade_id = p_contato::text or detalhes::text like '%' || p_contato::text || '%');
  insert into auditoria_acessos (usuario_id, acao, entidade, entidade_id) values (auth.uid(), 'anonimizar', 'contatos', p_contato::text);
  return v_paths || v_paths_tarefas;
end $$;
