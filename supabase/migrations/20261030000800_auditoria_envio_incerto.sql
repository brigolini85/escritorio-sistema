-- Auditoria 3.2, 3.3 e 3.11: o envio cujo resultado não se sabe (prazo estourado, conexão caída ou 5xx depois de a
-- requisição sair) ficava "falhou"; o eco "enviada por mim" não casava e a conversa virava "humano", a resposta do painel
-- saía duas vezes e o limitador de avisos valia só por processo. Agora:
--   * status_envio ganha "incerto": a Z-API pode ter entregado. Não é reenviado sozinho; o eco o confirma;
--   * casar_eco_saida: o eco casa com a saída pendente ou incerta da conversa pelo texto (espaços normalizados) ou, se
--     for arquivo, pelo nome (sem extensão nem maiúsculas) e, sem nome que case, com o arquivo mais antigo; nos últimos
--     10 min (criação ou envio); a mais antiga primeiro;
--   * separar_texto_enviado: resposta com texto e arquivo vira duas mensagens numa transação só (revisão anterior M10);
--   * reenviar_resposta: o "Enviar de novo" do painel (só resposta do painel incerta);
--   * reservar_envio_sistema: as vagas de avisos do sistema por minuto ficam no banco, para valer entre processos;
--   * marcar_aviso_unico e marcar_incertos_antigos: alertas uma vez só (por chave), sem corrida entre processos.

-- O valor novo não pode ser usado na mesma transação que o cria; as funções abaixo são plpgsql (o corpo só é lido ao
-- rodar), por isso podem citá-lo.
alter type public.status_envio add value if not exists 'incerto';

-- Revisão da Task 9: quando o envio da resposta do painel foi tentado pela primeira vez. Não é apagado pelo "Enviar de
-- novo" (a reserva é): o eco atrasado da primeira tentativa ainda casa. Resposta na fila que nunca foi tentada não casa.
alter table public.mensagens add column envio_tentado_em timestamptz;

-- Texto com espaços normalizados (o WhatsApp pode devolver o eco com quebras ou espaços diferentes).
create function public.texto_do_eco(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'), '')
$$;
revoke execute on function public.texto_do_eco(text) from public, anon, authenticated;
grant execute on function public.texto_do_eco(text) to service_role;

-- Nome de arquivo sem extensão e sem maiúsculas (a Z-API pode devolver "contrato.pdf" para "contrato").
create function public.nome_do_eco(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(lower(regexp_replace(btrim(coalesce(p, '')), '\.[^./\\]{1,10}$', '')), '')
$$;
revoke execute on function public.nome_do_eco(text) from public, anon, authenticated;
grant execute on function public.nome_do_eco(text) to service_role;

-- Resposta do painel com texto e arquivo: o texto que já saiu (ou saiu sem confirmação) vira mensagem própria e a
-- original fica só com o arquivo, na mesma transação. Já separada (o eco chegou antes): não faz nada e devolve nulo.
-- Reserva e tentativa do texto = agora (o momento do envio; é a janela do eco).
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
                                status_envio, criado_em, envio_reservado_em, envio_tentado_em)
  values (m.conversa_id, m.cliente_id, 'saida', m.autor, m.atendente_id, 'texto', m.conteudo, p_id_provedor,
          p_status::public.status_envio, m.criado_em - interval '1 millisecond', now(), now())
  returning id into v_id;
  update public.mensagens set conteudo = null where id = p_mensagem;
  return v_id;
end $$;
revoke execute on function public.separar_texto_enviado(uuid, text, text) from public, anon, authenticated;
grant execute on function public.separar_texto_enviado(uuid, text, text) to service_role;

-- O eco "enviada por mim" que não tem id conhecido: casa com a saída pendente ou incerta, sem id do provedor, da mesma
-- conversa, criada ou enviada nos últimos 10 min. Várias: a mais antiga. Casou: "enviada" com o id do eco; devolve o id.
--   * eco de texto: texto igual com espaços normalizados. O texto de uma resposta do painel com arquivo ainda não
--     separada vira mensagem própria (o arquivo segue pendente);
--   * eco de arquivo (p_eh_arquivo, ou com nome): primeiro pelo nome sem extensão nem maiúsculas (anexo do painel ou
--     documento da empresa); sem nome que case (ou sem nome, ex.: imagem), o arquivo mais antigo da conversa.
-- Resposta do painel só casa depois de o envio ter sido tentado (revisão da Task 9): a que ainda espera na fila e a
-- mesma frase digitada no celular não se confundem.
-- Revisão da Task 9: espera a trava da linha (no máximo 2 s) em vez de pular: o eco não cai em "humano" porque o envio
-- estava gravando a mesma mensagem; passando do prazo, o erro devolve o job à fila.
create function public.casar_eco_saida(
  p_conversa uuid, p_texto text, p_arquivo_nome text, p_id_provedor text, p_eh_arquivo boolean default false
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_texto text := public.texto_do_eco(p_texto);
  v_nome text := public.nome_do_eco(p_arquivo_nome);
  v_arquivo boolean := coalesce(p_eh_arquivo, false) or v_nome is not null;
  v_id uuid;
  m public.mensagens;
begin
  if p_id_provedor is null or (v_texto is null and not v_arquivo) then return null; end if;
  perform set_config('lock_timeout', '2s', true);
  if v_arquivo then
    -- Pelo nome; sem nome que case, o arquivo mais antigo.
    select x.id into v_id from public.mensagens x
      left join public.documentos_empresa doc on doc.id = x.documento_id
     where x.conversa_id = p_conversa and x.direcao = 'saida' and x.id_provedor is null
       and x.status_envio in ('pendente', 'incerto')
       and (x.autor <> 'atendente' or x.envio_reservado_em is not null or x.envio_tentado_em is not null)
       and greatest(x.criado_em, coalesce(x.envio_reservado_em, x.criado_em), coalesce(x.envio_tentado_em, x.criado_em))
           >= now() - interval '10 minutes'
       and (x.arquivo_path is not null or x.documento_id is not null)
     order by coalesce(v_nome is not null and public.nome_do_eco(coalesce(x.arquivo_nome, doc.arquivo_nome)) = v_nome, false) desc,
              x.criado_em, x.id
     limit 1;
    if v_id is null then return null; end if;
    select * into m from public.mensagens where id = v_id for update;
    if m.id_provedor is not null or m.status_envio not in ('pendente', 'incerto') then return null; end if;
    update public.mensagens set status_envio = 'enviada', id_provedor = p_id_provedor where id = v_id;
    return v_id;
  end if;
  select x.id into v_id from public.mensagens x
   where x.conversa_id = p_conversa and x.direcao = 'saida' and x.id_provedor is null
     and x.status_envio in ('pendente', 'incerto')
     and (x.autor <> 'atendente' or x.envio_reservado_em is not null or x.envio_tentado_em is not null)
     and greatest(x.criado_em, coalesce(x.envio_reservado_em, x.criado_em), coalesce(x.envio_tentado_em, x.criado_em))
         >= now() - interval '10 minutes'
     and public.texto_do_eco(x.conteudo) = v_texto
   order by x.criado_em, x.id
   limit 1;
  if v_id is null then return null; end if;
  select * into m from public.mensagens where id = v_id for update;
  -- Outro eco ou o envio chegou antes (trava esperada): confere de novo.
  if m.id_provedor is not null or m.status_envio not in ('pendente', 'incerto')
     or public.texto_do_eco(m.conteudo) is distinct from v_texto then
    return null;
  end if;
  if m.arquivo_path is not null then
    return public.separar_texto_enviado(m.id, p_id_provedor, 'enviada');
  end if;
  update public.mensagens set status_envio = 'enviada', id_provedor = p_id_provedor where id = v_id;
  return v_id;
end $$;
revoke execute on function public.casar_eco_saida(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.casar_eco_saida(uuid, text, text, text, boolean) to service_role;

-- "Enviar de novo" no painel: a resposta do painel que ficou sem confirmação volta a pendente (sem reserva) e o painel a
-- põe na fila. Só quem vê a conversa; só resposta do painel ("atendente") incerta. envio_tentado_em fica: o eco atrasado
-- da primeira tentativa ainda a confirma (e a fila não manda de novo).
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

-- Revisão da Task 9: alertas uma vez só por chave (ex.: "celular:<conversa>:<hora>", "incerto:<mensagem>"). A chave
-- primária decide: dois processos ao mesmo tempo, um alerta. A chave não leva telefone. Guarda 7 dias.
create table public.avisos_unicos (
  chave text primary key check (char_length(chave) <= 200),
  criado_em timestamptz not null default now()
);
alter table public.avisos_unicos enable row level security;
revoke all on public.avisos_unicos from public, anon, authenticated;
grant select, insert, delete on public.avisos_unicos to service_role;

create function public.marcar_aviso_unico(p_chave text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_linhas int;
begin
  if p_chave is null or char_length(p_chave) = 0 then raise exception 'Chave vazia' using errcode = '22023'; end if;
  delete from public.avisos_unicos where criado_em < now() - interval '7 days';
  insert into public.avisos_unicos (chave) values (p_chave) on conflict do nothing;
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end $$;
revoke execute on function public.marcar_aviso_unico(text) from public, anon, authenticated;
grant execute on function public.marcar_aviso_unico(text) to service_role;

-- Revisão da Task 9: mensagem do agente ou do sistema "incerto" há mais de 10 min (e menos de 1 dia) sem eco. Marca cada
-- mensagem uma vez e devolve uma linha por conversa com mensagem nova marcada (o batimento avisa a equipe).
-- plpgsql: o corpo cita o valor novo do enum (uma função sql seria conferida já na criação).
create function public.marcar_incertos_antigos() returns table (conversa_id uuid, telefone text)
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
  select distinct c.id, c.telefone from novos n
    join public.mensagens m on m.id = substring(n.chave from 9)::uuid
    join public.conversas c on c.id = m.conversa_id;
end $$;
revoke execute on function public.marcar_incertos_antigos() from public, anon, authenticated;
grant execute on function public.marcar_incertos_antigos() to service_role;
