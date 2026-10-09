-- Segurança do login (item 8): administrador e quem tem "Ver acessos de portais" só fazem as ações sensíveis com o
-- segundo fator (token aal2). A visibilidade (eh_admin, usuario_liberado) não muda: o portão do teste 22 segue igual.
-- Ajudante só deste arquivo: o token é montado com a marca "aal", como o Supabase Auth emite.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('e9800000-0000-0000-0000-00000000000a', 'admin@sf.local'),
  ('e9800000-0000-0000-0000-00000000000b', 'bia@sf.local'),
  ('e9800000-0000-0000-0000-00000000000c', 'ze@sf.local'),
  ('e9800000-0000-0000-0000-00000000000e', 'ex@sf.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e9800000-0000-0000-0000-00000000000a', 'Admin SF', 'admin@sf.local', 'admin', '{}'),
  ('e9800000-0000-0000-0000-00000000000b', 'Bia SF', 'bia@sf.local', 'atendente', '{editar_clientes}'),
  ('e9800000-0000-0000-0000-00000000000c', 'Zé SF', 'ze@sf.local', 'atendente', '{}'),
  ('e9800000-0000-0000-0000-00000000000e', 'Ex SF', 'ex@sf.local', 'admin', '{}');
update public.usuarios set ver_acessos_portais = true where id = 'e9800000-0000-0000-0000-00000000000c';
update public.usuarios set ativo = false where id = 'e9800000-0000-0000-0000-00000000000e';
insert into public.clientes (id, razao_social, cnpj) values ('e9810000-0000-0000-0000-00000000000a', 'SF Padaria Ltda', '11444777000161');
insert into public.cliente_acessos (id, cliente_id, portal, usuario, senha_cifrada) values
  ('e9820000-0000-0000-0000-000000000001', 'e9810000-0000-0000-0000-00000000000a', 'SEFAZ-MG', 'padariasol',
   'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.c2VncmVkbw');

create function pg_temp.como(p_id text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims',
    case when p_aal is null then json_build_object('sub', p_id, 'role', 'authenticated')::text
         else json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text end, true);
$$;
grant execute on function pg_temp.como(text, text) to authenticated;

-- 1–4: catálogo
select ok(not has_function_privilege('anon', 'public.exige_segundo_fator()', 'execute'), 'visitante não consulta');
select ok(has_function_privilege('authenticated', 'public.exige_segundo_fator()', 'execute'), 'o painel consulta (middleware)');
select ok(not has_function_privilege('anon', 'public.exigir_segundo_fator()', 'execute'), 'visitante não chama a trava');
select ok((select prosrc !~ 'aal' from pg_proc where oid = 'public.usuario_liberado(uuid)'::regprocedure),
  'usuario_liberado não olha o segundo fator (visibilidade intacta)');

set local role authenticated;

-- 5–8: quem precisa
select pg_temp.como('e9800000-0000-0000-0000-00000000000a', 'aal1');
select is(public.exige_segundo_fator(), true, 'administrador precisa');
select pg_temp.como('e9800000-0000-0000-0000-00000000000c', 'aal1');
select is(public.exige_segundo_fator(), true, 'quem vê acessos de portais precisa');
select pg_temp.como('e9800000-0000-0000-0000-00000000000b', 'aal1');
select is(public.exige_segundo_fator(), false, 'atendente sem a permissão não precisa');
select is(public.segundo_fator_ok(), true, 'e passa com aal1');

-- 9–15: administrador em aal1 é barrado nas ações sensíveis, mas continua vendo o que via
select pg_temp.como('e9800000-0000-0000-0000-00000000000a', 'aal1');
-- Auditoria 2.1: com só a senha deixa de ser administrador também para a visibilidade (o banco, não só a tela).
select is(public.eh_admin(), false, 'aal1: não é administrador até confirmar o código');
select throws_ok($$ select public.revelar_acesso('e9820000-0000-0000-0000-000000000001') $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: não revela senha de portal');
select throws_ok($$ select public.salvar_acesso(null, 'e9810000-0000-0000-0000-00000000000a', 'Prefeitura', 'x', '') $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: não cadastra acesso');
select throws_ok($$ select public.remover_acesso('e9820000-0000-0000-0000-000000000001') $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: não remove acesso');
select throws_ok($$ select public.definir_ver_acessos('e9800000-0000-0000-0000-00000000000b', true) $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: não dá a permissão de ver acessos');
select throws_ok($$ select public.salvar_usuario('e9800000-0000-0000-0000-00000000000b', '{"nome":"Bia SF","papel":"admin"}'::jsonb) $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: não muda pessoas (nem promove a administrador)');
select throws_ok($$ select public.arquivar_cadastro('usuario', 'e9800000-0000-0000-0000-00000000000b') $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: não arquiva pessoas');

-- 16–19: com o segundo fator (aal2) tudo volta a funcionar
select pg_temp.como('e9800000-0000-0000-0000-00000000000a', 'aal2');
select is(public.revelar_acesso('e9820000-0000-0000-0000-000000000001') ->> 'cliente_id', 'e9810000-0000-0000-0000-00000000000a', 'aal2: revela');
select lives_ok($$ select public.definir_ver_acessos('e9800000-0000-0000-0000-00000000000b', false) $$, 'aal2: muda a permissão');
select lives_ok($$ select public.salvar_usuario('e9800000-0000-0000-0000-00000000000b', '{"nome":"Bia SF Souza","papel":"atendente"}'::jsonb) $$,
  'aal2: muda pessoas');
select is((select nome from public.usuarios where id = 'e9800000-0000-0000-0000-00000000000b'), 'Bia SF Souza', 'gravou');

-- 20–22: quem vê acessos de portais
select pg_temp.como('e9800000-0000-0000-0000-00000000000c', 'aal1');
select throws_ok($$ select public.revelar_acesso('e9820000-0000-0000-0000-000000000001') $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'Zé em aal1: não revela');
select pg_temp.como('e9800000-0000-0000-0000-00000000000c', 'aal2');
select is(public.revelar_acesso('e9820000-0000-0000-0000-000000000001') ->> 'cliente_id', 'e9810000-0000-0000-0000-00000000000a', 'Zé em aal2: revela');
select pg_temp.como('e9800000-0000-0000-0000-00000000000c', null);
select is(public.segundo_fator_ok(), true, 'token sem a marca aal (montado pelo próprio banco/testes): não muda nada');

-- 23–24: arquivado não "precisa" (já não entra), e o token dele não ganha nada
select pg_temp.como('e9800000-0000-0000-0000-00000000000e', 'aal2');
select is(public.exige_segundo_fator(), false, 'arquivado: fora da regra');
select throws_ok($$ select public.revelar_acesso('e9820000-0000-0000-0000-000000000001') $$, null, null, 'arquivado continua sem revelar');

select * from finish();
rollback;
