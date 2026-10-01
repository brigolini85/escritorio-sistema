-- supabase/migrations/20261001000100_painel_v2_identidade.sql
-- Painel v2, Parte A: recado da tela de entrada e tamanho de letra de cada pessoa.

-- Recado curto do administrador na tela de entrada (até 200 caracteres; vazio = não mostra).
alter table public.configuracoes
  add column aviso_login text not null default '' check (char_length(aviso_login) <= 200);

-- A tela de entrada é pública: devolve só o recado, nunca o resto de configuracoes.
create function public.aviso_login() returns text
language sql stable security definer set search_path = ''
as $$ select nullif(btrim(aviso_login), '') from public.configuracoes where id = 1 $$;
revoke all on function public.aviso_login() from public, anon, authenticated;
grant execute on function public.aviso_login() to anon, authenticated;

-- Tamanho da letra escolhido no menu da pessoa (Normal / Grande +1px / Maior +2px).
alter table public.usuarios
  add column tamanho_letra text not null default 'normal' check (tamanho_letra in ('normal', 'grande', 'maior'));

-- Só o administrador grava em usuarios (RLS); esta função deixa cada um mudar só o próprio tamanho.
create function public.definir_tamanho_letra(p_tamanho text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_tamanho is null or p_tamanho not in ('normal', 'grande', 'maior') then
    raise exception 'Tamanho de letra inválido.';
  end if;
  if not exists (select 1 from public.usuarios where id = auth.uid() and ativo) then
    raise exception 'Acesso desativado.';
  end if;
  update public.usuarios set tamanho_letra = p_tamanho where id = auth.uid();
end
$$;
revoke all on function public.definir_tamanho_letra(text) from public, anon, authenticated;
grant execute on function public.definir_tamanho_letra(text) to authenticated;
