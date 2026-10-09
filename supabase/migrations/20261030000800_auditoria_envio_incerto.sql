-- Auditoria 3.2, 3.3 e 3.11: o envio cujo resultado não se sabe (prazo estourado, conexão caída ou 5xx depois de a
-- requisição sair) ficava "falhou"; o eco "enviada por mim" não casava e a conversa virava "humano", a resposta do painel
-- saía duas vezes e o limitador de avisos valia só por processo. Agora:
--   * status_envio ganha "incerto": a Z-API pode ter entregado. Não é reenviado sozinho; o eco o confirma;
--   * casar_eco_saida: o eco casa com a saída pendente ou incerta da conversa pelo texto (espaços normalizados) ou pelo
--     nome do arquivo, nos últimos 10 min (criação ou envio); a mais antiga primeiro;
--   * separar_texto_enviado: resposta com texto e arquivo vira duas mensagens numa transação só (revisão anterior M10);
--   * reenviar_resposta: o "Enviar de novo" do painel (só resposta do painel incerta);
--   * reservar_envio_sistema: as vagas de avisos do sistema por minuto ficam no banco, para valer entre processos.

-- O valor novo não pode ser usado na mesma transação que o cria; as funções abaixo são plpgsql (o corpo só é lido ao
-- rodar), por isso podem citá-lo.
alter type public.status_envio add value if not exists 'incerto';

-- Texto com espaços normalizados (o WhatsApp pode devolver o eco com quebras ou espaços diferentes).
create function public.texto_do_eco(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'), '')
$$;
revoke execute on function public.texto_do_eco(text) from public, anon, authenticated;
grant execute on function public.texto_do_eco(text) to service_role;

-- Resposta do painel com texto e arquivo: o texto que já saiu (ou saiu sem confirmação) vira mensagem própria e a
-- original fica só com o arquivo, na mesma transação. Já separada (o eco chegou antes): não faz nada e devolve nulo.
-- envio_reservado_em do texto = agora (o momento do envio; é a janela do eco).
create function public.separar_texto_enviado(p_mensagem uuid, p_id_provedor text, p_status text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  m public.mensagens;
  v_id uuid;
begin
  if p_status is null or p_status not in ('enviada', 'incerto') then
    raise exception 'Status inválido para o texto separado: %', p_status using errcode = '22023';
  end if;
  select * into m from public.mensagens where id = p_mensagem for update;
  if not found or m.direcao <> 'saida' or m.conteudo is null or m.arquivo_path is null then return null; end if;
  insert into public.mensagens (conversa_id, cliente_id, direcao, autor, atendente_id, tipo, conteudo, id_provedor,
                                status_envio, criado_em, envio_reservado_em)
  values (m.conversa_id, m.cliente_id, 'saida', m.autor, m.atendente_id, 'texto', m.conteudo, p_id_provedor,
          p_status::public.status_envio, m.criado_em - interval '1 millisecond', now())
  returning id into v_id;
  update public.mensagens set conteudo = null where id = p_mensagem;
  return v_id;
end $$;
revoke execute on function public.separar_texto_enviado(uuid, text, text) from public, anon, authenticated;
grant execute on function public.separar_texto_enviado(uuid, text, text) to service_role;

-- O eco "enviada por mim" que não tem id conhecido: casa com a saída pendente ou incerta, sem id do provedor, da mesma
-- conversa, criada ou enviada nos últimos 10 min. Texto: igual com espaços normalizados. Arquivo: o nome (do anexo do
-- painel ou do documento da empresa). Várias: a mais antiga. Casou: "enviada" com o id do eco; devolve o id da mensagem.
-- O texto de uma resposta do painel com arquivo ainda não separada vira mensagem própria (o arquivo segue pendente).
create function public.casar_eco_saida(p_conversa uuid, p_texto text, p_arquivo_nome text, p_id_provedor text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_texto text := public.texto_do_eco(p_texto);
  v_nome text := nullif(btrim(coalesce(p_arquivo_nome, '')), '');
  m public.mensagens;
  v_casou_texto boolean;
begin
  if p_id_provedor is null or (v_texto is null and v_nome is null) then return null; end if;
  select x.* into m from public.mensagens x
    left join public.documentos_empresa doc on doc.id = x.documento_id
   where x.conversa_id = p_conversa and x.direcao = 'saida' and x.id_provedor is null
     and x.status_envio in ('pendente', 'incerto')
     and greatest(x.criado_em, coalesce(x.envio_reservado_em, x.criado_em)) >= now() - interval '10 minutes'
     and ((v_texto is not null and public.texto_do_eco(x.conteudo) = v_texto)
       or (v_nome is not null and (x.arquivo_path is not null or x.documento_id is not null)
           and coalesce(x.arquivo_nome, doc.arquivo_nome) = v_nome))
   order by x.criado_em, x.id
   limit 1
   for update of x skip locked;
  if not found then return null; end if;
  v_casou_texto := v_texto is not null and public.texto_do_eco(m.conteudo) = v_texto;
  if v_casou_texto and m.arquivo_path is not null then
    return public.separar_texto_enviado(m.id, p_id_provedor, 'enviada');
  end if;
  update public.mensagens set status_envio = 'enviada', id_provedor = p_id_provedor where id = m.id;
  return m.id;
end $$;
revoke execute on function public.casar_eco_saida(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.casar_eco_saida(uuid, text, text, text) to service_role;

-- "Enviar de novo" no painel: a resposta do painel que ficou sem confirmação volta a pendente (sem reserva) e o painel a
-- põe na fila. Só quem vê a conversa; só resposta do painel ("atendente") incerta.
create function public.reenviar_resposta(p_mensagem uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_conversa uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre no painel para reenviar.' using errcode = '42501'; end if;
  select conversa_id into v_conversa from public.mensagens where id = p_mensagem;
  if v_conversa is null or not public.pode_ver_conversa(v_conversa) then
    raise exception 'sem acesso a esta conversa' using errcode = '42501';
  end if;
  update public.mensagens set status_envio = 'pendente', envio_reservado_em = null
   where id = p_mensagem and direcao = 'saida' and autor = 'atendente' and status_envio = 'incerto'
  returning id into v_id;
  if v_id is null then raise exception 'Esta mensagem não está esperando confirmação.'; end if;
  return v_id;
end $$;
revoke execute on function public.reenviar_resposta(uuid) from public, anon;
grant execute on function public.reenviar_resposta(uuid) to authenticated, service_role;

-- Vagas de avisos do sistema por minuto (janela fixa), contadas no banco: dois processos não dobram o limite.
create table public.limite_envio_sistema (
  minuto timestamptz primary key,
  total integer not null check (total >= 0)
);
alter table public.limite_envio_sistema enable row level security;
-- Sem política: só a chave de serviço (o trabalhador).
revoke all on public.limite_envio_sistema from public, anon, authenticated;
grant select, insert, update, delete on public.limite_envio_sistema to service_role;

-- Reserva uma vaga no minuto atual; sem vaga devolve false (o aviso vai para a fila e sai no minuto seguinte).
-- O "on conflict ... where" trava a linha do minuto: duas reservas ao mesmo tempo não passam do limite.
create function public.reservar_envio_sistema(p_max integer) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_minuto timestamptz := date_trunc('minute', now());
  v_total integer;
begin
  if p_max is null or p_max < 1 then raise exception 'Limite inválido: %', p_max using errcode = '22023'; end if;
  delete from public.limite_envio_sistema where minuto < v_minuto - interval '1 hour';
  insert into public.limite_envio_sistema as l (minuto, total) values (v_minuto, 1)
  on conflict (minuto) do update set total = l.total + 1 where l.total < p_max
  returning l.total into v_total;
  return v_total is not null;
end $$;
revoke execute on function public.reservar_envio_sistema(integer) from public, anon, authenticated;
grant execute on function public.reservar_envio_sistema(integer) to service_role;
