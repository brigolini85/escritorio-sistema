-- Auditoria 6.3 e 6.4: a retenção passa a ser a que o manual promete, e os arquivos sem dono no Storage aparecem.
--   * retencao_apagar(regra, agora, lote): um lote de cada regra por chamada (o trabalhador repete até acabar), para a
--     primeira rodada (um ano de atraso) não segurar as tabelas. Regras e prazos:
--       conversas          parada há mais de 1 ano e sem nenhuma mensagem (as mensagens de mais de 1 ano, com os arquivos,
--                          já saíram na etapa anterior; por isso apagar a conversa nunca deixa arquivo para trás);
--       conversa_eventos   mais de 1 ano;
--       demandas           concluída há mais de 1 ano, com os eventos, as tarefas (já descartadas ou aprovadas), sugestões e
--                          pré-análises (cascata). Fica a demanda cuja tarefa ainda tem arquivo vivo no compartimento
--                          "tarefas": esse arquivo segue a guarda escolhida pelo dono (padrão "Nunca apagar");
--       alertas            mais de 1 ano;
--       auditoria          auditoria_acessos com mais de 5 anos (evidência);
--       fora_do_acesso     pedidos_fora_do_acesso com mais de 1 ano;
--       radar_envios       enviados ou não enviados há mais de 1 ano (os que aguardam ficam).
--     Nenhuma chave estrangeira bloqueia: as que apontam para conversas e demandas são "cascade" (dados da própria conversa
--     ou demanda) ou "set null" (uso_ia, avisos de certificado, novidades do Radar, pedidos fora do acesso).
--     auditoria_acessos não aponta para elas.
--   * caminhos_referenciados: todas as colunas que apontam para um objeto do Storage, num lugar só. O pgTAP 132 falha se
--     aparecer coluna com cara de caminho de arquivo fora dela (catálogo, tarefas, Radar...).
--   * listar_objetos_storage e caminhos_sem_referencia: a varredura semanal (6.4) lista os objetos em páginas e pergunta
--     quais não têm linha. Só o trabalhador.
--   * configuracoes.varredura_orfaos_apagar: começa falsa (só relata). Só o administrador liga.
--   * anonimizar_contato alcança alertas (telefone no texto), envios do Radar e avisos de tarefa (6.3).

alter table public.configuracoes add column varredura_orfaos_apagar boolean not null default false;

-- Fora da lista de configuracoes_so_admin (que outras tasks redefinem): gatilho próprio, mesma regra.
create function public.configuracoes_varredura_so_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.eh_admin() then
    raise exception 'Só o administrador liga a remoção dos arquivos sem dono.';
  end if;
  return new;
end $$;
revoke execute on function public.configuracoes_varredura_so_admin() from public, anon, authenticated;
create trigger varredura_orfaos_so_admin before update of varredura_orfaos_apagar on public.configuracoes
  for each row when (new.varredura_orfaos_apagar is distinct from old.varredura_orfaos_apagar)
  execute function public.configuracoes_varredura_so_admin();

-- Toda referência a objeto do Storage. Coluna nova que guarda caminho de arquivo entra aqui (o pgTAP 132 cobra).
-- Arquivo de tarefa marcado como removido (guarda ou LGPD) não segura o objeto.
create view public.caminhos_referenciados with (security_invoker = true) as
  select 'anexos'::text as bucket, m.arquivo_path as caminho, 'mensagens.arquivo_path'::text as origem
    from public.mensagens m where m.arquivo_path is not null
  union all
  select 'documentos', d.arquivo_path, 'documentos_empresa.arquivo_path'
    from public.documentos_empresa d where d.arquivo_path is not null
  union all
  select a.bucket, a.caminho, 'agente_tarefa_arquivos.caminho'
    from public.agente_tarefa_arquivos a where a.removido_em is null;
revoke all on public.caminhos_referenciados from public, anon, authenticated;
grant select on public.caminhos_referenciados to service_role;

-- Uma página dos objetos de um dos três compartimentos, em ordem de nome (até 1000). p_depois = último nome da página anterior.
create function public.listar_objetos_storage(p_bucket text, p_depois text default null, p_limite int default 1000)
returns table (nome text, criado_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.name, o.created_at
    from storage.objects o
   where p_bucket in ('anexos', 'documentos', 'tarefas')
     and o.bucket_id = p_bucket and o.name > coalesce(p_depois, '')
   order by o.name
   limit least(greatest(coalesce(p_limite, 1000), 1), 1000)
$$;
revoke execute on function public.listar_objetos_storage(text, text, int) from public, anon, authenticated;
grant execute on function public.listar_objetos_storage(text, text, int) to service_role;

-- Dos nomes recebidos, os que nenhuma linha aponta naquele compartimento.
create function public.caminhos_sem_referencia(p_bucket text, p_nomes text[]) returns setof text
language sql stable security definer set search_path = '' as $$
  select n from unnest(p_nomes) n
   where not exists (select 1 from public.caminhos_referenciados r where r.bucket = p_bucket and r.caminho = n)
$$;
revoke execute on function public.caminhos_sem_referencia(text, text[]) from public, anon, authenticated;
grant execute on function public.caminhos_sem_referencia(text, text[]) to service_role;

-- Um lote de uma regra; devolve quantas linhas saíram. "skip locked": linha em uso agora fica para a próxima volta.
create function public.retencao_apagar(p_regra text, p_agora timestamptz default now(), p_lote int default 1000) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_ano timestamptz := p_agora - interval '1 year';
  v_cinco timestamptz := p_agora - interval '5 years';
  v_lote int := least(greatest(coalesce(p_lote, 1000), 1), 5000);
  v_n int;
begin
  if p_regra = 'conversas' then
    delete from public.conversas c where c.id in (
      select c2.id from public.conversas c2
       where greatest(c2.criado_em, c2.atualizado_em) < v_ano
         and not exists (select 1 from public.mensagens m where m.conversa_id = c2.id)
       limit v_lote for update skip locked);
  elsif p_regra = 'conversa_eventos' then
    delete from public.conversa_eventos e where e.id in (
      select e2.id from public.conversa_eventos e2 where e2.criado_em < v_ano limit v_lote for update skip locked);
  elsif p_regra = 'demandas' then
    delete from public.chamados ch where ch.id in (
      select c2.id from public.chamados c2
       where c2.status = 'concluido' and coalesce(c2.concluido_em, c2.atualizado_em) < v_ano
         and not exists (select 1 from public.agente_tarefas t
                          where t.chamado_id = c2.id and t.estado not in ('aprovada', 'descartada'))
         and not exists (select 1 from public.agente_tarefas t join public.agente_tarefa_arquivos a on a.tarefa_id = t.id
                          where t.chamado_id = c2.id and a.bucket = 'tarefas' and a.removido_em is null)
       limit v_lote for update skip locked);
  elsif p_regra = 'alertas' then
    delete from public.alertas a where a.id in (
      select a2.id from public.alertas a2 where a2.criado_em < v_ano limit v_lote for update skip locked);
  elsif p_regra = 'auditoria' then
    delete from public.auditoria_acessos a where a.id in (
      select a2.id from public.auditoria_acessos a2 where a2.criado_em < v_cinco limit v_lote for update skip locked);
  elsif p_regra = 'fora_do_acesso' then
    delete from public.pedidos_fora_do_acesso p where p.id in (
      select p2.id from public.pedidos_fora_do_acesso p2 where p2.criado_em < v_ano limit v_lote for update skip locked);
  elsif p_regra = 'radar_envios' then
    delete from public.radar_envios r where r.id in (
      select r2.id from public.radar_envios r2
       where r2.estado in ('enviado', 'nao_enviado') and coalesce(r2.enviado_em, r2.reservado_em, r2.aprovado_em) < v_ano
       limit v_lote for update skip locked);
  else
    raise exception 'regra de retenção desconhecida: %', p_regra;
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.retencao_apagar(text, timestamptz, int) from public, anon, authenticated;
grant execute on function public.retencao_apagar(text, timestamptz, int) to service_role;

-- anonimizar_contato: corpo de 20261027000500 (nomes qualificados, search_path vazio) + alertas, envios do Radar e
-- avisos de tarefa. Mesma assinatura e grants.
create or replace function public.anonimizar_contato(p_contato uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_tel text; v_paths text[]; v_paths_tarefas text[]; v_novo text;
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
  update public.chamados set titulo = c_removido, resumo = c_removido where id = any (v_chamados);
  update public.chamado_eventos set texto = null where chamado_id = any (v_chamados);

  -- Parte I: sugestões, pré-análise, tarefas, pendências e arquivos das tarefas.
  delete from public.agente_sugestoes where chamado_id = any (v_chamados) or conversa_id = any (v_conversas);
  delete from public.pre_analises_nota where chamado_id = any (v_chamados);
  update public.agente_tarefas set pedido = c_removido, anotacoes = '', resultado = null, ajustes = '[]'::jsonb
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
  update public.alertas set mensagem = replace(mensagem, v_tel, '[telefone removido]') where strpos(mensagem, v_tel) > 0;

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
