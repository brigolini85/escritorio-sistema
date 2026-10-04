-- Parte H1, Task 2 (spec 7D.1 item 8 e 7D.3): a cifra da senha nunca é lida sem a permissão, nem pela chave de serviço;
-- cada revelação (e cada cópia) grava auditoria sem o segredo; cadastrar exige "Ver e editar" e "Ver acessos de portais".
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

insert into auth.users (id, email) values
  ('e9100000-0000-0000-0000-00000000000a', 'admin@h1b.local'),
  ('e9100000-0000-0000-0000-00000000000b', 'bia@h1b.local'),
  ('e9100000-0000-0000-0000-00000000000c', 'ze@h1b.local'),
  ('e9100000-0000-0000-0000-00000000000d', 'duda@h1b.local'),
  ('e9100000-0000-0000-0000-00000000000e', 'ex@h1b.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e9100000-0000-0000-0000-00000000000a', 'Admin H1B', 'admin@h1b.local', 'admin', '{}'),
  ('e9100000-0000-0000-0000-00000000000b', 'Bia H1B', 'bia@h1b.local', 'atendente', '{editar_clientes}'),
  ('e9100000-0000-0000-0000-00000000000c', 'Zé H1B', 'ze@h1b.local', 'atendente', '{}'),
  ('e9100000-0000-0000-0000-00000000000d', 'Duda H1B', 'duda@h1b.local', 'atendente', '{editar_clientes}'),
  ('e9100000-0000-0000-0000-00000000000e', 'Ex H1B', 'ex@h1b.local', 'atendente', '{}');
update public.usuarios set ver_acessos_portais = true
 where id in ('e9100000-0000-0000-0000-00000000000c', 'e9100000-0000-0000-0000-00000000000d', 'e9100000-0000-0000-0000-00000000000e');
update public.usuarios set ativo = false where id = 'e9100000-0000-0000-0000-00000000000e';
insert into public.clientes (id, razao_social, cnpj) values ('e9300000-0000-0000-0000-00000000000a', 'H1B Padaria Ltda', '11222333000181');
-- Cifra de mentira no formato do painel (o banco nunca decifra; D1).
insert into public.cliente_acessos (id, cliente_id, portal, usuario, senha_cifrada) values
  ('e9400000-0000-0000-0000-000000000001', 'e9300000-0000-0000-0000-00000000000a', 'SEFAZ-MG', 'padariasol',
   'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.c2VncmVkbw');

-- 1–8: privilégios (D2)
select ok(not has_column_privilege('authenticated', 'public.cliente_acessos', 'senha_cifrada', 'select'), 'a equipe não lê a cifra');
select ok(not has_column_privilege('anon', 'public.cliente_acessos', 'senha_cifrada', 'select'), 'visitante não lê a cifra');
select ok(not has_column_privilege('service_role', 'public.cliente_acessos', 'senha_cifrada', 'select'),
  'nem a chave de serviço (trabalhador, agente, assistente) lê a cifra');
select ok(has_column_privilege('authenticated', 'public.cliente_acessos', 'tem_senha', 'select'), 'a equipe vê se tem senha');
select ok(not has_table_privilege('authenticated', 'public.cliente_acessos', 'insert'), 'escrita só pelas funções');
select ok(not has_function_privilege('service_role', 'public.revelar_acesso(uuid, text)', 'execute'), 'o trabalhador não revela');
select ok(not has_function_privilege('anon', 'public.revelar_acesso(uuid, text)', 'execute'), 'visitante não revela');
select throws_ok(
  $$ insert into public.cliente_acessos (cliente_id, portal, senha_cifrada) values ('e9300000-0000-0000-0000-00000000000a', 'Prefeitura', 'minhasenha123') $$,
  '23514', null, 'texto puro na coluna é recusado');

-- 9–13: Bia ("Ver e editar", sem a permissão)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select senha_cifrada from public.cliente_acessos $$, '42501', null, 'Bia: pedir a cifra é recusado');
select results_eq(
  $$ select portal, usuario, tem_senha from public.cliente_acessos where cliente_id = 'e9300000-0000-0000-0000-00000000000a' $$,
  $$ values ('SEFAZ-MG'::text, 'padariasol'::text, true) $$, 'Bia vê portal, usuário e que tem senha (D7)');
select is(public.pode_ver_acessos(), false, 'Bia: sem a permissão');
select throws_ok($$ select public.revelar_acesso('e9400000-0000-0000-0000-000000000001', 'revelar') $$,
  'P0001', 'Sem permissão para ver acessos de portais.', 'Bia não revela');
select throws_ok($$ select public.salvar_acesso(null, 'e9300000-0000-0000-0000-00000000000a', 'Prefeitura', 'x', null) $$,
  'P0001', 'Sem permissão para mudar acessos de portais.', 'Bia não cadastra acesso (D6)');

-- 14–17: Zé (só "Ver acessos de portais")
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.pode_ver_acessos(), true, 'Zé: com a permissão');
select is(public.revelar_acesso('e9400000-0000-0000-0000-000000000001', 'revelar') ->> 'senha_cifrada',
  'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.c2VncmVkbw', 'Zé revela (a cifra vai para o painel decifrar)');
select is(public.revelar_acesso('e9400000-0000-0000-0000-000000000001', 'copiar') ->> 'cliente_id',
  'e9300000-0000-0000-0000-00000000000a', 'copiar passa pela mesma função (D5)');
select throws_ok($$ select public.salvar_acesso(null, 'e9300000-0000-0000-0000-00000000000a', 'Prefeitura', 'x', null) $$,
  'P0001', 'Sem permissão para mudar acessos de portais.', 'Zé não cadastra sem "Ver e editar" (D6)');

-- 18: a auditoria das revelações (Bia, recusada, não deixou linha)
reset role;
select results_eq(
  $$ select acao, usuario_id, detalhes ->> 'portal', detalhes ->> 'cliente_id' from public.auditoria_acessos
     where entidade = 'cliente_acessos' and entidade_id = 'e9400000-0000-0000-0000-000000000001' order by acao desc $$,
  $$ values ('revelar_acesso'::text, 'e9100000-0000-0000-0000-00000000000c'::uuid, 'SEFAZ-MG'::text, 'e9300000-0000-0000-0000-00000000000a'::text),
            ('copiar_acesso'::text, 'e9100000-0000-0000-0000-00000000000c'::uuid, 'SEFAZ-MG'::text, 'e9300000-0000-0000-0000-00000000000a'::text) $$,
  'cada revelação e cada cópia na auditoria: quem, empresa e portal');

-- 19–26: Duda ("Ver e editar" + permissão) cadastra, edita sem senha, grava "sem senha" e remove
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_acesso(null, 'e9300000-0000-0000-0000-00000000000a', 'Prefeitura (NFS-e)', '12345678000190',
  'v1.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDDDDDDDD.b3V0cmE') $$, 'Duda cadastra acesso');
select lives_ok($$ select public.salvar_acesso('e9400000-0000-0000-0000-000000000001', 'e9300000-0000-0000-0000-00000000000a',
  'SEFAZ-MG', 'novo-usuario', null) $$, 'Duda edita sem mandar senha');
select lives_ok($$ select public.salvar_acesso(null, 'e9300000-0000-0000-0000-00000000000a', 'e-CAC', 'via certificado', '') $$,
  '"Sem senha" grava sem senha');
reset role;
select results_eq(
  $$ select portal, usuario, senha_cifrada from public.cliente_acessos
     where cliente_id = 'e9300000-0000-0000-0000-00000000000a' order by portal collate "C" $$,
  $$ values ('Prefeitura (NFS-e)'::text, '12345678000190'::text, 'v1.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDDDDDDDD.b3V0cmE'::text),
            ('SEFAZ-MG'::text, 'novo-usuario'::text, 'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.c2VncmVkbw'::text),
            ('e-CAC'::text, 'via certificado'::text, null::text) $$,
  'editar sem senha mantém a cifra; "sem senha" fica vazio');
set local role authenticated;
select lives_ok($$ select public.remover_acesso((select id from public.cliente_acessos where portal = 'e-CAC')) $$, 'Duda remove');
reset role;
select is((select count(*)::int from public.cliente_acessos where portal = 'e-CAC'), 0, 'removido');
select is((select array_agg(acao order by acao) from public.auditoria_acessos
           where entidade = 'cliente_acessos' and usuario_id = 'e9100000-0000-0000-0000-00000000000d'),
  array['remover_acesso', 'salvar_acesso', 'salvar_acesso', 'salvar_acesso'], 'cadastrar e remover também na auditoria');
select ok(not exists (select 1 from public.auditoria_acessos where detalhes::text like '%v1.%' or detalhes::text like '%senha_cifrada%'),
  'nenhuma linha da auditoria guarda a cifra');

-- 27: última alteração conta acessos cadastrados e removidos; revelar não conta
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.ultima_alteracao_cliente('e9300000-0000-0000-0000-00000000000a') ->> 'pessoa', 'Duda H1B',
  'última alteração: quem mudou acessos (revelar do Zé não conta)');

-- 28: arquivada não revela, mesmo com a marcação
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$ select public.revelar_acesso('e9400000-0000-0000-0000-000000000001', 'revelar') $$,
  'P0001', 'Sem permissão para ver acessos de portais.', 'pessoa arquivada não revela');

-- 29–33: o administrador sempre vê e é quem dá a permissão (D3)
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(public.pode_ver_acessos(), true, 'administrador sempre vê');
select lives_ok($$ select public.definir_ver_acessos('e9100000-0000-0000-0000-00000000000b', true) $$, 'admin dá a permissão à Bia');
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.definir_ver_acessos('e9100000-0000-0000-0000-00000000000b', false) $$,
  'P0001', 'Só o administrador muda pessoas.', 'só o administrador dá ou tira a permissão');
reset role;
select is((select ver_acessos_portais from public.usuarios where id = 'e9100000-0000-0000-0000-00000000000b'), true, 'Bia agora tem a permissão');
select ok(exists (select 1 from public.auditoria_acessos where entidade = 'usuarios' and acao = 'update'
                  and entidade_id = 'e9100000-0000-0000-0000-00000000000b' and usuario_id = 'e9100000-0000-0000-0000-00000000000a'),
  'quem deu a permissão fica na auditoria');

-- 34: excluir a empresa (Parte B) leva os acessos junto
delete from public.clientes where id = 'e9300000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.cliente_acessos where cliente_id = 'e9300000-0000-0000-0000-00000000000a'), 0,
  'excluir a empresa leva os acessos');

select * from finish();
rollback;
