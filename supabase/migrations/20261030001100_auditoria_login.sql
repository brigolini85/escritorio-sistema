-- Auditoria 2.3: login, "esqueci a senha" e código do segundo fator saem do servidor do painel, então para o Supabase
-- Auth todo mundo tem o mesmo IP: um script que erra a senha muitas vezes tranca o escritório inteiro. O painel passa a
-- contar as tentativas por IP de quem pede, por e-mail e por pessoa, aqui no banco (vale entre processos), e recusa
-- acima do limite sem chamar o Auth.
--
-- Janela fixa: `janela` é o começo do intervalo (múltiplo de p_janela_segundos desde 1970). A chave já vem do painel
-- com o tipo do limite e resumida (hash), para não guardar IP nem e-mail em claro.
create table public.tentativas_login (
  chave text not null check (char_length(chave) between 1 and 200),
  janela timestamptz not null,
  total integer not null default 1,
  primary key (chave, janela)
);
create index tentativas_login_janela_idx on public.tentativas_login (janela);
alter table public.tentativas_login enable row level security;
revoke all on public.tentativas_login from public, anon, authenticated;
-- delete: os testes ponta a ponta zeram a contagem antes de cada login (muitos logins do mesmo 127.0.0.1).
grant select, insert, update, delete on public.tentativas_login to service_role;

-- Conta mais uma tentativa da chave na janela atual. Devolve true se ainda está dentro do limite (esta incluída) e
-- false se passou. O "on conflict ... where" trava a linha: duas tentativas ao mesmo tempo não passam do limite, e o
-- total para no limite (recusada não infla a conta).
create function public.contar_tentativa(p_chave text, p_limite integer, p_janela_segundos integer) returns boolean
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
  -- A janela mais longa usada é de 1 hora; um dia de folga basta.
  delete from public.tentativas_login where janela < now() - interval '1 day';
  insert into public.tentativas_login as t (chave, janela, total) values (p_chave, v_janela, 1)
  on conflict (chave, janela) do update set total = t.total + 1 where t.total < p_limite
  returning t.total into v_total;
  return v_total is not null;
end $$;
revoke execute on function public.contar_tentativa(text, integer, integer) from public, anon, authenticated;
grant execute on function public.contar_tentativa(text, integer, integer) to service_role;
