-- Revisão geral, área 1, I1: o arquivo da resposta precisa ser um anexo de conversa que a pessoa vê.
-- Antes, qualquer p_arquivo_path era gravado e o trabalhador (chave de serviço, sem RLS) o mandava pelo WhatsApp:
-- dava para enviar ao cliente um anexo de conversa que a pessoa não vê (o caminho aparece nos arquivos da tarefa).
-- Agora: "conversas/<conversa>/<arquivo>", a pessoa vê <conversa> (a mesma regra da política anexos_leitura) e o objeto
-- existe no compartimento "anexos". Arquivo de tarefa de origem "conversa" tem esse mesmo caminho e passa pela mesma
-- conferência; os do compartimento "tarefas" nunca são enviados por aqui.
-- Mesma assinatura, security definer e search_path de antes (create or replace mantém os grants).

create or replace function public.registrar_resposta(
  p_conversa uuid, p_texto text, p_arquivo_path text, p_arquivo_nome text, p_arquivo_mime text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_cliente uuid; v_origem uuid;
begin
  if not pode_ver_conversa(p_conversa) then raise exception 'sem acesso a esta conversa'; end if;
  if coalesce(trim(p_texto), '') = '' and p_arquivo_path is null then raise exception 'resposta vazia'; end if;
  if p_arquivo_path is not null then
    if p_arquivo_path ~ '^conversas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$' then
      v_origem := split_part(p_arquivo_path, '/', 2)::uuid;
    end if;
    if v_origem is null or not pode_ver_conversa(v_origem)
       or not exists (select 1 from storage.objects where bucket_id = 'anexos' and name = p_arquivo_path) then
      raise exception 'Arquivo não encontrado nesta conversa.';
    end if;
  end if;
  perform assumir_conversa(p_conversa);
  select cliente_em_foco into v_cliente from conversas where id = p_conversa;
  insert into mensagens (conversa_id, cliente_id, direcao, autor, atendente_id, tipo, conteudo,
                         arquivo_path, arquivo_nome, arquivo_mime, status_envio)
  values (p_conversa, v_cliente, 'saida', 'atendente', auth.uid(),
          case when p_arquivo_path is null then 'texto' else 'documento' end::tipo_mensagem,
          p_texto, p_arquivo_path, p_arquivo_nome, p_arquivo_mime, 'pendente')
  returning id into v_id;
  return v_id;
end $$;
