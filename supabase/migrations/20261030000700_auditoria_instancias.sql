-- Auditoria 4.3 e 3.13: depois de uma implantação, um contêiner antigo ligado ao mesmo banco (com outro AMBIENTE ou outro
-- código) atendia metade das conversas, e o envio bloqueado "fingia" sucesso. Agora:
--   * configuracoes.ambiente guarda o ambiente do banco: a primeira partida do trabalhador grava o seu (ambiente_do_banco);
--     a partida com AMBIENTE diferente não consome nada. Pessoa nenhuma (nem o administrador) muda pelo painel;
--   * cada processo se registra a cada minuto (registrar_instancia). Com outra instância viva de versão ou ambiente
--     diferente, a mais antiga para de consumir.

alter table public.configuracoes add column ambiente text
  constraint configuracoes_ambiente_valido check (ambiente in ('producao', 'homologacao', 'local'));

-- O ambiente é do banco: só o trabalhador (sem pessoa na sessão) ou o SQL do dono o define. Uma troca pelo painel
-- faria um banco de teste passar por produção (ou o contrário).
create function public.configuracoes_ambiente_fixo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    raise exception 'O ambiente do banco é gravado pelo trabalhador na primeira partida e não muda pelo painel.';
  end if;
  return new;
end $$;
revoke execute on function public.configuracoes_ambiente_fixo() from public, anon, authenticated;
create trigger ambiente_fixo before update on public.configuracoes
  for each row when (new.ambiente is distinct from old.ambiente)
  execute function public.configuracoes_ambiente_fixo();

-- Partida do trabalhador: banco sem ambiente grava o do processo (a primeira partida define); devolve o do banco.
-- Só o trabalhador.
create function public.ambiente_do_banco(p_ambiente text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v text;
begin
  if p_ambiente is null or p_ambiente not in ('producao', 'homologacao', 'local') then
    raise exception 'Ambiente inválido: %', p_ambiente using errcode = '22023';
  end if;
  update public.configuracoes set ambiente = p_ambiente where id = 1 and ambiente is null;
  select ambiente into v from public.configuracoes where id = 1;
  return v;
end $$;
revoke execute on function public.ambiente_do_banco(text) from public, anon, authenticated;
grant execute on function public.ambiente_do_banco(text) to service_role;

create table public.instancias_trabalhador (
  id uuid primary key,
  hostname text not null check (char_length(hostname) <= 200),
  ambiente text not null check (ambiente in ('producao', 'homologacao', 'local')),
  versao text not null check (char_length(versao) <= 100),
  iniciado_em timestamptz not null default now(),
  visto_em timestamptz not null default now()
);
alter table public.instancias_trabalhador enable row level security;
-- Sem política: só a chave de serviço (o trabalhador) lê e grava.
revoke all on public.instancias_trabalhador from public, anon, authenticated;
grant select, insert, update, delete on public.instancias_trabalhador to service_role;

-- Batimento de uma instância: grava visto_em (a primeira vez, cria a linha) e devolve as outras vistas nos últimos
-- 2 minutos. deve_parar: há outra mais nova com versão ou ambiente diferente (implantação nova; a antiga sai das filas).
-- Mesma versão e ambiente (duas réplicas): ninguém para, mas as duas aparecem em "outras" (alerta e /saude).
-- Empate no início: o id desempata, para as duas nunca concluírem a mesma coisa. Só o trabalhador.
create function public.registrar_instancia(p_id uuid, p_hostname text, p_ambiente text, p_versao text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_eu public.instancias_trabalhador;
  v_outras jsonb;
  v_parar boolean;
begin
  -- Linhas de instâncias que sumiram há mais de um dia não servem para nada.
  delete from public.instancias_trabalhador where visto_em < now() - interval '1 day';
  insert into public.instancias_trabalhador (id, hostname, ambiente, versao)
  values (p_id, left(p_hostname, 200), p_ambiente, left(p_versao, 100))
  on conflict (id) do update set visto_em = now()
  returning * into v_eu;
  select coalesce(jsonb_agg(jsonb_build_object('hostname', o.hostname, 'ambiente', o.ambiente, 'versao', o.versao,
                                               'iniciado_em', o.iniciado_em) order by o.iniciado_em, o.id), '[]'::jsonb),
         coalesce(bool_or((o.versao <> v_eu.versao or o.ambiente <> v_eu.ambiente)
                          and (o.iniciado_em, o.id) > (v_eu.iniciado_em, v_eu.id)), false)
    into v_outras, v_parar
    from public.instancias_trabalhador o
   where o.id <> v_eu.id and o.visto_em > now() - interval '2 minutes';
  return jsonb_build_object('deve_parar', v_parar, 'outras', v_outras);
end $$;
revoke execute on function public.registrar_instancia(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_instancia(uuid, text, text, text) to service_role;
