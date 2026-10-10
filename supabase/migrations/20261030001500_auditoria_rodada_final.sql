-- Rodada final da auditoria (revisão final da Fase 2). As migrações 0100–1400 já foram conferidas juntas; o que muda aqui
-- é redefinição, sem editar as anteriores.
--   * Item 1: ambiente_do_banco (0700) já recusa um valor fora de producao|homologacao|local (22023). A guarda nova
--     (AMBIENTE=local apontando para banco remoto não carimba) fica no trabalhador, antes de chamar a função.
--   * Item 2 (M1): pegar_lote_do_turno não conta como resposta uma saída que falhou (status_envio = 'falhou' sem
--     id_provedor, a mesma regra das tarefas e do Radar): a retomada manda o aviso "IA indisponível".
--   * Item 7 (T14): marcar_incertos_antigos devolve os ids marcados nesta rodada (o aviso que falha desfaz só esses).
--   * Item 8 (T12): contar_tentativa_janela devolve a janela da contagem e devolver_tentativa(text, timestamptz) desconta
--     nela (o acerto na virada da janela descontava da janela seguinte). As versões antigas ficam (painel antigo na troca).
--   * Item 9 (T15): anonimizar_contato limpa também o resumo de cada etapa e a subpasta do Drive das tarefas, igual ao
--     modo "anonimizar" da retenção.

-- ===== Item 2 (M1) =====
-- Corpo de 20261030000600; só v_respondeu muda. Uma saída do turno que falhou ainda conta como ação (o turno agiu e a
-- retomada não chama a IA de novo), mas não como resposta: o cliente não recebeu nada.
create or replace function public.pegar_lote_do_turno(p_conversa uuid, p_ids uuid[], p_turno text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_ativos text[];
  v_interrompidas uuid[];
  v_respondeu boolean;
begin
  select coalesce(array_agg(distinct m.turno_agente_entrada), '{}') into v_ativos
    from public.mensagens m
   where m.id = any(p_ids) and m.conversa_id = p_conversa and m.turno_agente_entrada is not null
     and (exists (select 1 from public.decisoes_agente d
                   where d.conversa_id = p_conversa and d.turno::text = m.turno_agente_entrada and d.etapa <> 'orientacoes_cortadas')
          or exists (select 1 from public.mensagens s
                      where s.conversa_id = p_conversa and s.direcao = 'saida' and s.turno_agente::text = m.turno_agente_entrada)
          or (m.turno_agente_entrada_em is not null
              and (exists (select 1 from public.chamados c
                            where c.conversa_id = p_conversa and c.origem = 'agente' and c.criado_em >= m.turno_agente_entrada_em)
                   or exists (select 1 from public.chamado_eventos e join public.chamados c on c.id = e.chamado_id
                               where c.conversa_id = p_conversa and e.tipo = 'nota_interna' and e.usuario_id is null
                                 and e.criado_em >= m.turno_agente_entrada_em))));

  select coalesce(array_agg(m.id), '{}') into v_interrompidas
    from public.mensagens m
   where m.id = any(p_ids) and m.conversa_id = p_conversa and m.turno_agente_entrada = any(v_ativos);

  -- Revisão final (M1): saída que falhou de certo (sem id do provedor) não é resposta.
  select exists (select 1 from public.mensagens s
                  where s.conversa_id = p_conversa and s.direcao = 'saida' and s.turno_agente::text = any(v_ativos)
                    and (s.status_envio is distinct from 'falhou' or s.id_provedor is not null))
    into v_respondeu;

  update public.mensagens m set turno_agente_entrada = p_turno, turno_agente_entrada_em = now()
   where m.id = any(p_ids) and m.conversa_id = p_conversa and m.direcao = 'entrada' and m.processada_em is null
     and (m.turno_agente_entrada is null or not (m.turno_agente_entrada = any(v_ativos)));

  return jsonb_build_object('interrompidas', to_jsonb(v_interrompidas), 'respondeu', v_respondeu);
end $$;
revoke execute on function public.pegar_lote_do_turno(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.pegar_lote_do_turno(uuid, uuid[], text) to service_role;

-- ===== Item 7 (T14) =====
-- Corpo de 20261030000800 + a coluna mensagens (ids marcados nesta rodada, por conversa). O tipo de retorno muda: drop e
-- create. O trabalhador antigo (na troca) lê só conversa_id e telefone, que continuam.
drop function public.marcar_incertos_antigos();
create function public.marcar_incertos_antigos() returns table (conversa_id uuid, telefone text, mensagens uuid[])
language plpgsql volatile security definer set search_path = '' as $$
begin
  return query
  with novos as (
    insert into public.avisos_unicos (chave)
    select 'incerto:' || m.id from public.mensagens m
     where m.direcao = 'saida' and m.autor in ('agente', 'sistema') and m.status_envio = 'incerto'
       and m.criado_em < now() - interval '10 minutes' and m.criado_em > now() - interval '1 day'
    on conflict do nothing
    returning chave
  )
  select c.id, c.telefone, array_agg(m.id order by m.id) from novos n
    join public.mensagens m on m.id = substring(n.chave from 9)::uuid
    join public.conversas c on c.id = m.conversa_id
   group by c.id, c.telefone;
end $$;
revoke execute on function public.marcar_incertos_antigos() from public, anon, authenticated;
grant execute on function public.marcar_incertos_antigos() to service_role;

-- ===== Item 8 (T12) =====
-- Mesma regra de contar_tentativa (20261030001100), mas devolve a janela em que contou (nulo: passou do limite). O acerto
-- devolve nessa janela, e não na de now(): na virada, descontar da janela nova deixava a velha cheia e abria uma vaga a
-- mais na nova.
create function public.contar_tentativa_janela(p_chave text, p_limite integer, p_janela_segundos integer) returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_janela timestamptz;
  v_total integer;
begin
  if p_chave is null or char_length(p_chave) not between 1 and 200 then
    raise exception 'Chave de tentativa inválida.' using errcode = '22023';
  end if;
  if p_limite is null or p_limite < 1 then raise exception 'Limite inválido: %', p_limite using errcode = '22023'; end if;
  if p_janela_segundos is null or p_janela_segundos < 1 then
    raise exception 'Janela inválida: %', p_janela_segundos using errcode = '22023';
  end if;
  v_janela := to_timestamp(floor(extract(epoch from now()) / p_janela_segundos) * p_janela_segundos);
  delete from public.tentativas_login where janela < now() - interval '1 day';
  insert into public.tentativas_login as t (chave, janela, total) values (p_chave, v_janela, 1)
  on conflict (chave, janela) do update set total = t.total + 1 where t.total < p_limite
  returning t.total into v_total;
  return case when v_total is not null then v_janela end;
end $$;
revoke execute on function public.contar_tentativa_janela(text, integer, integer) from public, anon, authenticated;
grant execute on function public.contar_tentativa_janela(text, integer, integer) to service_role;

-- Desconta uma tentativa na janela devolvida por contar_tentativa_janela. Nunca fica negativo; chave ou janela sem linha
-- não faz nada.
create function public.devolver_tentativa(p_chave text, p_janela timestamptz) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_chave is null or char_length(p_chave) not between 1 and 200 then
    raise exception 'Chave de tentativa inválida.' using errcode = '22023';
  end if;
  if p_janela is null then raise exception 'Janela inválida.' using errcode = '22023'; end if;
  update public.tentativas_login set total = greatest(total - 1, 0) where chave = p_chave and janela = p_janela;
end $$;
revoke execute on function public.devolver_tentativa(text, timestamptz) from public, anon, authenticated;
grant execute on function public.devolver_tentativa(text, timestamptz) to service_role;

-- ===== Item 9 (T15) =====
-- Corpo de 20261030001300 + o resumo de cada etapa (fica o nome da etapa) e a subpasta do Drive das tarefas, o mesmo que
-- o modo "anonimizar" da retenção limpa. Mesma assinatura e grants (20261030001400).
create or replace function public.anonimizar_contato(p_contato uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_tel text; v_paths text[]; v_paths_tarefas text[]; v_novo text; v_t text;
  v_conversas uuid[]; v_chamados uuid[]; v_tarefas uuid[];
  c_removido constant text := '[removido a pedido do titular]';
begin
  if not public.eh_admin() then raise exception 'somente administrador'; end if;
  select telefone into v_tel from public.contatos where id = p_contato;
  if v_tel is null then raise exception 'contato não encontrado'; end if;

  select coalesce(array_agg(id), '{}') into v_conversas from public.conversas where contato_id = p_contato or telefone = v_tel;
  select coalesce(array_agg(id), '{}') into v_chamados from public.chamados
   where conversa_id = any (v_conversas) or contato_id = p_contato;
  select coalesce(array_agg(id), '{}') into v_tarefas from public.agente_tarefas where chamado_id = any (v_chamados);

  select coalesce(array_agg(m.arquivo_path) filter (where m.arquivo_path is not null), '{}') into v_paths
  from public.mensagens m where m.conversa_id = any (v_conversas);

  update public.mensagens m set conteudo = c_removido, transcricao = null,
         arquivo_path = null, arquivo_nome = null, midia_url_origem = null
  where m.conversa_id = any (v_conversas);
  delete from public.decisoes_agente where conversa_id = any (v_conversas);
  delete from public.assistente_mensagens where conversa_id = any (v_conversas);
  -- Parte E
  delete from public.sugestoes_resposta where conversa_id = any (v_conversas);
  update public.conversa_eventos set texto = null where conversa_id = any (v_conversas);
  update public.conversas set motivo_pessoa = null where id = any (v_conversas);

  -- Demandas do titular (pela conversa ou só pelo contato): título, resumo e notas podem conter dados pessoais.
  -- Revisão 2 da Task 15: o pedido de venda perde os textos livres (destinatário, entrega, observações, transportadora).
  update public.chamados set titulo = c_removido, resumo = c_removido,
         pedido_venda = case when pedido_venda is null then null
                             else (pedido_venda - 'entrega' - 'observacoes' - 'transportadora')
                                  || jsonb_build_object('texto_destinatario', c_removido) end
   where id = any (v_chamados);
  update public.chamado_eventos set texto = null where chamado_id = any (v_chamados);

  -- Parte I: sugestões, pré-análise, tarefas, pendências e arquivos das tarefas.
  delete from public.agente_sugestoes where chamado_id = any (v_chamados) or conversa_id = any (v_conversas);
  delete from public.pre_analises_nota where chamado_id = any (v_chamados);
  -- Revisão final (T15): o resumo de cada etapa é texto livre (o nome vem do procedimento da skill e fica); a subpasta do
  -- Drive pode ter o nome do titular. O mesmo que a retenção (modo "anonimizar") limpa.
  update public.agente_tarefas set pedido = c_removido, anotacoes = '', resultado = null, ajustes = '[]'::jsonb,
         drive_subpasta = null,
         etapas = coalesce((select jsonb_agg(case when jsonb_typeof(e) = 'object' and e ? 'resumo'
                                                  then e || '{"resumo": null}'::jsonb else e end order by o)
                              from jsonb_array_elements(etapas) with ordinality as x(e, o)), '[]'::jsonb)
   where id = any (v_tarefas);
  update public.agente_tarefa_eventos set texto = c_removido where tarefa_id = any (v_tarefas);
  -- Auditoria 6.3: o aviso da tarefa repete o pedido.
  update public.agente_tarefa_avisos set mensagem = c_removido where tarefa_id = any (v_tarefas);
  with arquivos_do_contato as (
    update public.agente_tarefa_arquivos a set removido_em = coalesce(a.removido_em, now())
     where (a.bucket = 'anexos' and a.caminho = any (v_paths))
        or (a.bucket = 'tarefas' and a.id in (select p.arquivo_id from public.agente_pendencias p
                                             where p.contato_id = p_contato and p.arquivo_id is not null))
    returning a.bucket, a.caminho)
  select coalesce(array_agg(distinct caminho) filter (where bucket = 'tarefas'), '{}') into v_paths_tarefas from arquivos_do_contato;
  update public.agente_pendencias set pergunta = c_removido, detalhe = null, mensagem = null, pedido_texto = null, resposta = null
   where tarefa_id = any (v_tarefas) or contato_id = p_contato;

  -- Auditoria 6.3: o texto do Radar enviado ao titular (traz o nome dele) e os alertas com o telefone dele.
  update public.radar_envios set texto = c_removido where contato_id = p_contato;
  -- Revisão da Task 15: também os números antigos (conversas dele com outro telefone), antes de virarem fictícios.
  for v_t in select v_tel union select distinct telefone from public.conversas where id = any (v_conversas) loop
    update public.alertas set mensagem = replace(mensagem, v_t, '[telefone removido]') where strpos(mensagem, v_t) > 0;
  end loop;

  -- random() é avaliado por linha: cada conversa recebe um número fictício diferente (telefone é único).
  update public.conversas set telefone = '5500' || lpad(floor(random() * 1e9)::text, 9, '0') where id = any (v_conversas);
  v_novo := '5500' || lpad(floor(random() * 1e9)::text, 9, '0');
  update public.contatos set nome = 'Contato removido', ativo = false, telefone = v_novo, cargo = null, email = null where id = p_contato;

  -- O gatilho de auditoria guardou nome e telefone originais em "antes": apagar esses registros também.
  delete from public.auditoria_acessos where entidade in ('contatos', 'contato_clientes', 'contato_cliente_setores')
    and (entidade_id = p_contato::text or detalhes::text like '%' || p_contato::text || '%');
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id) values (auth.uid(), 'anonimizar', 'contatos', p_contato::text);
  return v_paths || v_paths_tarefas;
end $$;
revoke execute on function public.anonimizar_contato(uuid) from public, anon;
grant execute on function public.anonimizar_contato(uuid) to authenticated, service_role;

-- ===== Item 11 (auditoria 2.5) =====
-- O aviso ao dono saía só quando o painel chamava registrar_fator_cadastrado depois do primeiro código. Um aplicativo
-- cadastrado direto pela API do Supabase Auth (sem passar pelo painel) não avisava. Agora o próprio cadastro (fator novo já
-- confirmado, ou que passa a confirmado) avisa. A marca é a mesma do painel (auditoria_acessos 'cadastrar_fator' com o id
-- do fator) e a trava também (por pessoa): os dois caminhos juntos avisam uma vez só. Falha no aviso nunca impede o
-- cadastro do fator: só fica no log do banco.
create function public.aviso_fator_cadastrado() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_dono uuid;
begin
  begin
    perform pg_advisory_xact_lock(hashtext('registrar_fator_cadastrado:' || new.user_id::text));
    if exists (select 1 from public.auditoria_acessos a where a.acao = 'cadastrar_fator' and a.entidade_id = new.id::text) then
      return null;
    end if;
    select nome into v_nome from public.usuarios where id = new.user_id;
    select id into v_dono from public.usuarios where dono and ativo;
    insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id)
    values (new.user_id, 'cadastrar_fator', 'mfa_factors', new.id::text);
    insert into public.alertas (nivel, usuario_id, mensagem)
    values ('aviso', v_dono, coalesce(v_nome, 'Uma conta sem cadastro na equipe') || ' cadastrou um aplicativo de código');
  exception when others then
    raise warning 'aviso_fator_cadastrado: aviso não registrado (fator %): %', new.id, sqlerrm;
  end;
  return null;
end $$;
revoke execute on function public.aviso_fator_cadastrado() from public, anon, authenticated;
-- O Supabase hospedado pode recusar gatilho no schema auth: a migração nunca falha por isso (o painel continua avisando
-- pelo registrar_fator_cadastrado). Conferir depois do push:
--   select tgname from pg_trigger where tgrelid = 'auth.mfa_factors'::regclass;
do $$
begin
  create trigger aviso_fator_cadastrado after insert or update of status on auth.mfa_factors
    for each row when (new.status = 'verified') execute function public.aviso_fator_cadastrado();
exception
  when insufficient_privilege then
    raise notice 'gatilho do aviso de fator não criado; o caminho do painel continua avisando (%)', sqlerrm;
  when others then
    raise notice 'gatilho do aviso de fator não criado; o caminho do painel continua avisando (%)', sqlerrm;
end $$;
