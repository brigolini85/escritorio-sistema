-- Segurança do login (item 9): arquivar a pessoa encerra as sessões dela no Supabase Auth (o token de renovação deixa de
-- valer e o getUser do painel recusa o token de acesso que sobrou). Só depois da conferência de permissão: o gatilho roda
-- quando a mudança de "ativo" já passou pela função arquivar_cadastro.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('e9900000-0000-0000-0000-00000000000a', 'admin@ses.local'),
  ('e9900000-0000-0000-0000-00000000000b', 'bia@ses.local'),
  ('e9900000-0000-0000-0000-00000000000c', 'ze@ses.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e9900000-0000-0000-0000-00000000000a', 'Admin SES', 'admin@ses.local', 'admin', '{}'),
  ('e9900000-0000-0000-0000-00000000000b', 'Bia SES', 'bia@ses.local', 'atendente', '{}'),
  ('e9900000-0000-0000-0000-00000000000c', 'Zé SES', 'ze@ses.local', 'atendente', '{}');
insert into auth.sessions (id, user_id, created_at, updated_at, aal) values
  ('e9910000-0000-0000-0000-000000000001', 'e9900000-0000-0000-0000-00000000000b', now(), now(), 'aal1'),
  ('e9910000-0000-0000-0000-000000000002', 'e9900000-0000-0000-0000-00000000000b', now(), now(), 'aal1'),
  ('e9910000-0000-0000-0000-000000000003', 'e9900000-0000-0000-0000-00000000000c', now(), now(), 'aal1');
insert into auth.refresh_tokens (token, user_id, session_id, revoked, created_at, updated_at) values
  ('tok-bia-ses', 'e9900000-0000-0000-0000-00000000000b', 'e9910000-0000-0000-0000-000000000001', false, now(), now());

-- 1: o gatilho existe e a função dele não é chamável pela API
select ok(not has_function_privilege('authenticated', 'public.encerrar_sessoes_ao_arquivar()', 'execute'), 'a equipe não chama a função do gatilho');

-- 2–3: quem não pode arquivar não encerra nada
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9900000-0000-0000-0000-00000000000c","role":"authenticated","aal":"aal1"}', true);
select throws_ok($$ select public.arquivar_cadastro('usuario', 'e9900000-0000-0000-0000-00000000000b') $$, null, null, 'atendente não arquiva pessoas');
reset role;
select is((select count(*)::int from auth.sessions where user_id = 'e9900000-0000-0000-0000-00000000000b'), 2, 'recusado: as sessões de Bia seguem');

-- 4–6: o administrador (com o segundo fator) arquiva Bia: as sessões e os tokens de renovação dela somem; as de Zé ficam
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9900000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select lives_ok($$ select public.arquivar_cadastro('usuario', 'e9900000-0000-0000-0000-00000000000b') $$, 'arquivou');
reset role;
select is((select count(*)::int from auth.sessions where user_id = 'e9900000-0000-0000-0000-00000000000b'), 0, 'sessões de Bia encerradas');
select is((select count(*)::int from auth.refresh_tokens where user_id = 'e9900000-0000-0000-0000-00000000000b'), 0, 'token de renovação de Bia não vale mais');
select is((select count(*)::int from auth.sessions where user_id = 'e9900000-0000-0000-0000-00000000000c'), 1, 'as de Zé seguem');

-- 8: outras mudanças na pessoa não derrubam ninguém
update public.usuarios set nome = 'Zé SES Souza' where id = 'e9900000-0000-0000-0000-00000000000c';
select is((select count(*)::int from auth.sessions where user_id = 'e9900000-0000-0000-0000-00000000000c'), 1, 'mudar o nome não encerra a sessão');

select * from finish();
rollback;
