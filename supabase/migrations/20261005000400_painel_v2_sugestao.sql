-- supabase/migrations/20261005000400_painel_v2_sugestao.sql
-- Painel v2, Parte E (spec 7A.1 e 7A.2): "Sugerir resposta". O pedido nasce aqui; o trabalhador (fila sugerir_resposta)
-- preenche o texto; só quem pediu lê (o painel consulta a linha). Nada vai para a conversa. Custo com funcionalidade e pessoa (spec 3.1).

-- A Parte F completa os outros caminhos e preenche os registros antigos (P13); a lista é a do spec 7B.2.
alter table public.uso_ia
  add column funcionalidade text check (funcionalidade in ('agente_clientes', 'assistente_site', 'assistente_whatsapp', 'sugerir_resposta',
                                                            'testar_agente', 'transcricao_audio', 'especialista_setor', 'nao_identificado')),
  add column usuario_id uuid references public.usuarios (id) on delete set null;

create table public.sugestoes_resposta (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'pronta', 'falhou')),
  texto text check (char_length(texto) <= 4000),
  erro text check (char_length(erro) <= 300),
  criado_em timestamptz not null default now(),
  concluida_em timestamptz
);
-- Uma sugestão em andamento por pessoa (spec 7A.2).
create unique index sugestoes_uma_pendente on public.sugestoes_resposta (usuario_id) where status = 'pendente';
create index sugestoes_criado_idx on public.sugestoes_resposta (criado_em);
alter table public.sugestoes_resposta enable row level security;
create policy propria on public.sugestoes_resposta for select to authenticated
  using (usuario_id = auth.uid() and public.pode_ver_conversa(conversa_id));
revoke insert, update, delete, truncate on public.sugestoes_resposta from authenticated, anon;
-- Fora do Realtime (o portão 22 fixa a lista publicada): o painel consulta a linha pelo id enquanto estiver 'pendente'.

create function public.pedir_sugestao_resposta(p_conversa uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.exigir_acesso();
  if not public.tem_nivel('assistente', 'site') then raise exception 'Sugerir resposta usa o assistente: peça acesso ao administrador.'; end if;
  if not public.pode_ver_conversa(p_conversa) then raise exception 'Sem acesso a esta conversa.'; end if;
  -- Pedido parado há mais de 2 minutos (trabalhador fora do ar): vira falhou e libera um novo.
  update public.sugestoes_resposta set status = 'falhou', erro = 'Demorou demais. Tente de novo.', concluida_em = now()
   where usuario_id = auth.uid() and status = 'pendente' and criado_em < now() - interval '2 minutes';
  begin
    insert into public.sugestoes_resposta (usuario_id, conversa_id) values (auth.uid(), p_conversa) returning id into v_id;
  exception when unique_violation then
    raise exception 'Já tem uma sugestão sendo preparada. Espere ela chegar.';
  end;
  return v_id;
end $$;
revoke execute on function public.pedir_sugestao_resposta(uuid) from public, anon;
grant execute on function public.pedir_sugestao_resposta(uuid) to authenticated;

-- LGPD: corpo de 20260929000400 + sugestões, texto dos marcos e o motivo da passagem.
create or replace function public.anonimizar_contato(p_contato uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare v_tel text; v_paths text[]; v_novo text;
begin
  if not eh_admin() then raise exception 'somente administrador'; end if;
  select telefone into v_tel from contatos where id = p_contato;
  if v_tel is null then raise exception 'contato não encontrado'; end if;

  select coalesce(array_agg(m.arquivo_path) filter (where m.arquivo_path is not null), '{}') into v_paths
  from mensagens m join conversas c on c.id = m.conversa_id
  where c.contato_id = p_contato or c.telefone = v_tel;

  update mensagens m set conteudo = '[removido a pedido do titular]', transcricao = null,
         arquivo_path = null, arquivo_nome = null, midia_url_origem = null
  from conversas c where c.id = m.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  delete from decisoes_agente d using conversas c where c.id = d.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  delete from assistente_mensagens a using conversas c where c.id = a.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  -- Parte E
  delete from sugestoes_resposta s using conversas c where c.id = s.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  update conversa_eventos e set texto = null from conversas c where c.id = e.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  update conversas set motivo_pessoa = null where contato_id = p_contato or telefone = v_tel;

  -- Resumos e notas dos chamados dessas conversas podem conter dados pessoais.
  update chamados ch set resumo = '[removido a pedido do titular]'
  from conversas c where c.id = ch.conversa_id and (c.contato_id = p_contato or c.telefone = v_tel);
  update chamado_eventos e set texto = null
  from chamados ch join conversas c on c.id = ch.conversa_id
  where ch.id = e.chamado_id and (c.contato_id = p_contato or c.telefone = v_tel);

  -- random() é avaliado por linha: cada conversa recebe um número fictício diferente (telefone é único).
  update conversas set telefone = '5500' || lpad(floor(random() * 1e9)::text, 9, '0') where contato_id = p_contato or telefone = v_tel;
  v_novo := '5500' || lpad(floor(random() * 1e9)::text, 9, '0');
  update contatos set nome = 'Contato removido', ativo = false, telefone = v_novo where id = p_contato;

  -- O gatilho de auditoria guardou nome e telefone originais em "antes": apagar esses registros também.
  delete from auditoria_acessos where entidade in ('contatos', 'contato_clientes')
    and (entidade_id = p_contato::text or detalhes::text like '%' || p_contato::text || '%');
  insert into auditoria_acessos (usuario_id, acao, entidade, entidade_id) values (auth.uid(), 'anonimizar', 'contatos', p_contato::text);
  return v_paths;
end $$;
