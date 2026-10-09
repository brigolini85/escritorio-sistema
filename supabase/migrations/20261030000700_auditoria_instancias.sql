-- Auditoria 4.3 e 3.13: depois de uma implantação, um contêiner antigo ligado ao mesmo banco (com outro AMBIENTE ou outro
-- código) atendia metade das conversas, e o envio bloqueado "fingia" sucesso. Agora:
--   * configuracoes.ambiente guarda o ambiente do banco: a primeira partida do trabalhador grava o seu (ambiente_do_banco);
--     a partida com AMBIENTE diferente não consome nada. Pessoa nenhuma (nem o administrador) muda pelo painel;
--   * cada processo se registra a cada minuto (registrar_instancia). Com outra instância viva de versão ou ambiente
--     diferente, a de build mais antigo para de consumir (revisão: a ordem é a do build, não a do início do processo; um
--     contêiner antigo que reinicia depois não derruba o novo).

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
  if not found then
    raise exception 'configuracoes (id = 1) não existe: o banco não está pronto para o trabalhador' using errcode = 'P0002';
  end if;
  return v;
end $$;
revoke execute on function public.ambiente_do_banco(text) from public, anon, authenticated;
grant execute on function public.ambiente_do_banco(text) to service_role;

create table public.instancias_trabalhador (
  id uuid primary key,
  hostname text not null check (char_length(hostname) <= 200),
  ambiente text not null check (ambiente in ('producao', 'homologacao', 'local')),
  versao text not null check (char_length(versao) <= 100),
  -- Quando a imagem foi gerada (arquivo build_em do Dockerfile.trabalhador); nulo fora do contêiner (conta como o mais antigo).
  build_em timestamptz,
  iniciado_em timestamptz not null default now(),
  visto_em timestamptz not null default now()
);
alter table public.instancias_trabalhador enable row level security;
-- Sem política: só a chave de serviço (o trabalhador) lê e grava.
revoke all on public.instancias_trabalhador from public, anon, authenticated;
grant select, insert, update, delete on public.instancias_trabalhador to service_role;

-- Batimento de uma instância: grava visto_em (a primeira vez, cria a linha) e devolve as outras vistas nos últimos 2 minutos.
-- Ordem das instâncias: (build_em, com nulo primeiro; iniciado_em; id), ou seja, o build manda; o início do processo e o id
-- só desempatam (as duas nunca concluem a mesma coisa).
-- deve_parar: há outra mais nova nessa ordem com versão ou ambiente diferente (implantação nova; a antiga sai das filas).
-- Mesma versão e ambiente (duas réplicas): ninguém para, mas as duas aparecem em "outras" (alerta e /saude).
-- todas: as vivas (esta inclusive), da mais antiga para a mais nova, com "para" de cada uma (o alerta diz quem ficou).
-- Só o trabalhador.
create function public.registrar_instancia(p_id uuid, p_hostname text, p_ambiente text, p_versao text, p_build_em timestamptz default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_outras jsonb;
  v_todas jsonb;
  v_parar boolean;
begin
  -- Linhas de instâncias que sumiram há mais de um dia não servem para nada.
  delete from public.instancias_trabalhador where visto_em < now() - interval '1 day';
  insert into public.instancias_trabalhador (id, hostname, ambiente, versao, build_em)
  values (p_id, left(p_hostname, 200), p_ambiente, left(p_versao, 100), p_build_em)
  on conflict (id) do update set visto_em = now();
  with vivas as (
    select i.*, coalesce(i.build_em, '-infinity'::timestamptz) as ordem_build
      from public.instancias_trabalhador i
     where i.id = p_id or i.visto_em > now() - interval '2 minutes'
  ), marcadas as (
    select v.*, exists (select 1 from vivas n
                         where (n.versao <> v.versao or n.ambiente <> v.ambiente)
                           and (n.ordem_build, n.iniciado_em, n.id) > (v.ordem_build, v.iniciado_em, v.id)) as para
      from vivas v
  )
  select coalesce(jsonb_agg(jsonb_build_object('hostname', m.hostname, 'ambiente', m.ambiente, 'versao', m.versao,
                                               'build_em', m.build_em, 'iniciado_em', m.iniciado_em)
                            order by m.ordem_build, m.iniciado_em, m.id) filter (where m.id <> p_id), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('hostname', m.hostname, 'versao', m.versao, 'ambiente', m.ambiente,
                                               'build_em', m.build_em, 'para', m.para)
                            order by m.ordem_build, m.iniciado_em, m.id), '[]'::jsonb),
         coalesce(bool_or(m.para) filter (where m.id = p_id), false)
    into v_outras, v_todas, v_parar
    from marcadas m;
  return jsonb_build_object('deve_parar', v_parar, 'outras', v_outras, 'todas', v_todas);
end $$;
revoke execute on function public.registrar_instancia(uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.registrar_instancia(uuid, text, text, text, timestamptz) to service_role;
