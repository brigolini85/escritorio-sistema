-- supabase/migrations/20261004000300_painel_v2_horario.sql
-- Painel v2, Parte D (spec 7.1 e 7.2): horário de acesso por dia. Fora do horário a pessoa não lê nem grava nada
-- (P5), inclusive pelo Realtime; o administrador nunca é bloqueado. Vazio = sem restrição (quem já existia, P4).
-- Formato: {"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}; null num dia = bloqueado.

create function public.horario_valido(h jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when h is null then true
    when jsonb_typeof(h) <> 'object' then false
    else (select count(*) from jsonb_object_keys(h)) = 3
      and h ? 'semana' and h ? 'sabado' and h ? 'domingo'
      and (select bool_and(
             jsonb_typeof(h -> d) = 'null'
             or (jsonb_typeof(h -> d) = 'object'
                 and coalesce(h -> d ->> 'de', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                 and coalesce(h -> d ->> 'ate', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                 and (h -> d ->> 'de') < (h -> d ->> 'ate')))
           from unnest(array['semana', 'sabado', 'domingo']) d)
  end
$$;

alter table public.usuarios add column horario_acesso jsonb check (public.horario_valido(horario_acesso));

-- Pessoa ativa e dentro do horário em p_quando (fuso de Brasília; feriado segue o dia da semana, P6; o minuto final
-- entra, P7). Administrador sempre.
create function public.horario_permite(p_usuario uuid, p_quando timestamptz default now()) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select u.papel = 'admin' or u.horario_acesso is null or coalesce(
      to_char(l.t, 'HH24:MI') between (u.horario_acesso -> l.dia ->> 'de') and (u.horario_acesso -> l.dia ->> 'ate'), false)
    from public.usuarios u,
         lateral (select p_quando at time zone 'America/Sao_Paulo' as t) agora,
         lateral (select agora.t as t,
                         case extract(isodow from agora.t) when 6 then 'sabado' when 7 then 'domingo' else 'semana' end as dia) l
    where u.id = p_usuario and u.ativo
  ), false)
$$;
revoke execute on function public.horario_permite(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.horario_permite(uuid, timestamptz) to service_role;

-- Todas as regras (RLS, Realtime, funções) passam por aqui: o horário vale em todo lugar de uma vez.
create or replace function public.usuario_liberado(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select public.horario_permite(p_usuario, now()) $$;

create function public.pode_acessar_agora() returns boolean
language sql stable security definer set search_path = '' as $$ select public.horario_permite(auth.uid(), now()) $$;
revoke execute on function public.pode_acessar_agora() from public, anon;
grant execute on function public.pode_acessar_agora() to authenticated;

-- Para funções que gravam só na linha da própria pessoa: a mensagem diz o porquê.
create function public.exigir_acesso() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.eh_admin() then return; end if;
  if not exists (select 1 from public.usuarios where id = auth.uid() and ativo) then raise exception 'Acesso desativado.'; end if;
  if not public.pode_acessar_agora() then raise exception 'Fora do seu horário de acesso.'; end if;
end $$;
revoke execute on function public.exigir_acesso() from public, anon;
grant execute on function public.exigir_acesso() to authenticated;

-- Login e middleware do painel (spec 7.2): a mesma resposta nos dois. Liberado = marca o último acesso, no máximo a
-- cada 10 minutos (P8).
create function public.situacao_acesso() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare u public.usuarios%rowtype;
begin
  select * into u from public.usuarios where id = auth.uid();
  if u.id is null then return jsonb_build_object('situacao', 'sem_cadastro'); end if;
  if not u.ativo then return jsonb_build_object('situacao', 'inativo'); end if;
  if not public.horario_permite(u.id, now()) then
    return jsonb_build_object('situacao', 'fora_do_horario', 'horario', u.horario_acesso);
  end if;
  update public.usuarios set ultimo_acesso_em = now()
  where id = u.id and (ultimo_acesso_em is null or ultimo_acesso_em < now() - interval '10 minutes');
  return jsonb_build_object('situacao', 'liberado');
end $$;
revoke execute on function public.situacao_acesso() from public, anon;
grant execute on function public.situacao_acesso() to authenticated;

-- O último acesso muda a cada uso: não entra na auditoria (o resto da linha continua registrado).
drop trigger auditoria on public.usuarios;
create trigger auditoria after insert or delete on public.usuarios
  for each row execute function public.registrar_auditoria();
create trigger auditoria_alteracao after update on public.usuarios
  for each row when ((to_jsonb(old) - 'ultimo_acesso_em') is distinct from (to_jsonb(new) - 'ultimo_acesso_em'))
  execute function public.registrar_auditoria();

-- Preferência da própria pessoa: grava só dentro do horário, como o resto.
create or replace function public.definir_tamanho_letra(p_tamanho text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_tamanho is null or p_tamanho not in ('normal', 'grande', 'maior') then
    raise exception 'Tamanho de letra inválido.';
  end if;
  perform public.exigir_acesso();
  update public.usuarios set tamanho_letra = p_tamanho where id = auth.uid();
end $$;

-- ---------- Sobras da Task 2 ----------

-- Níveis de qualquer pessoa, sem passar pelo horário: fica só para o banco (gatilhos) e o trabalhador. A equipe lê os
-- próprios níveis em usuario_permissoes, cuja política já passa por usuario_liberado.
revoke execute on function public.niveis_do_usuario(uuid) from public, anon, authenticated;
grant execute on function public.niveis_do_usuario(uuid) to service_role;

-- Visitante sem login não consulta regra nenhuma.
revoke execute on function public.tem_nivel(text, text), public.tem_permissao(text, text) from public, anon;
grant execute on function public.tem_nivel(text, text), public.tem_permissao(text, text) to authenticated, service_role;

-- Os guardas pg_trigger_depth() > 1 contam com que só estes dois gatilhos escrevam permissões.
comment on function public.usuarios_permissoes_antes_alterar() is
  'Guarda pg_trigger_depth() > 1: um gatilho futuro que grave usuarios.permissoes ou usuario_permissoes pularia a sincronia entre as duas. Quem criar um, sincronize à mão.';
comment on function public.usuario_permissoes_espelhar() is
  'Guarda pg_trigger_depth() > 1: um gatilho futuro que grave usuario_permissoes ou usuarios.permissoes pularia a sincronia entre as duas. Quem criar um, sincronize à mão.';

-- ---------- Função de gravação que a trava deixava passar ----------

-- devolver_ao_agente só olhava "quem assumiu": arquivado ou fora do horário ainda devolvia a conversa. O painel chama.
create or replace function public.devolver_ao_agente(p_conversa uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.exigir_acesso();
  if not (eh_admin() or exists (select 1 from conversas where id = p_conversa and atendente_id = auth.uid())) then
    raise exception 'só quem assumiu a conversa pode devolvê-la';
  end if;
  update conversas set estado = 'agente', atendente_id = null, atualizado_em = now() where id = p_conversa;
end $$;
