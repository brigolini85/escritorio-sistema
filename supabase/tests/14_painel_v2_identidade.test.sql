-- supabase/tests/14_painel_v2_identidade.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'ana14@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'bia14@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000d3', 'inativa14@pgtap.local');
insert into public.usuarios (id, nome, email, papel, ativo) values
  ('00000000-0000-0000-0000-0000000000d1', 'Ana', 'ana14@pgtap.local', 'atendente', true),
  ('00000000-0000-0000-0000-0000000000d2', 'Bia', 'bia14@pgtap.local', 'atendente', true),
  ('00000000-0000-0000-0000-0000000000d3', 'Inativa', 'inativa14@pgtap.local', 'atendente', false);

-- Aviso do login: vazio não aparece; o visitante lê só o texto, nunca a tabela.
update public.configuracoes set aviso_login = '   ' where id = 1;
set local role anon;
select is(public.aviso_login(), null, 'aviso só com espaços devolve null');
reset role;
update public.configuracoes set aviso_login = '  DCTFWeb vence dia 15.  ' where id = 1;
set local role anon;
select is(public.aviso_login(), 'DCTFWeb vence dia 15.', 'visitante lê o aviso aparado');
-- A RLS filtra sem dar erro: o visitante enxerga zero linhas de configuracoes.
select is((select count(*) from public.configuracoes), 0::bigint, 'visitante não lê configuracoes');
reset role;
select throws_ok($$ update public.configuracoes set aviso_login = repeat('x', 201) where id = 1 $$, '23514', null,
  'aviso com 201 caracteres é recusado');
select lives_ok($$ update public.configuracoes set aviso_login = repeat('x', 200) where id = 1 $$, 'aviso com 200 caracteres vale');

-- Tamanho da letra: cada um muda só o seu.
select is((select tamanho_letra from public.usuarios where id = '00000000-0000-0000-0000-0000000000d1'), 'normal', 'padrão é normal');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select lives_ok($$ select public.definir_tamanho_letra('grande') $$, 'pessoa muda o próprio tamanho');
select throws_ok($$ select public.definir_tamanho_letra('enorme') $$, 'P0001', 'Tamanho de letra inválido.', 'valor desconhecido é recusado');
-- Auditoria 2.8: escrita direta em usuarios saiu da API (só pelas funções); a linha da outra pessoa fica como estava.
select throws_ok($$ update public.usuarios set tamanho_letra = 'maior' where id = '00000000-0000-0000-0000-0000000000d2' $$,
  '42501', null, 'atendente não grava direto em usuarios');
reset role;
select is((select tamanho_letra from public.usuarios where id = '00000000-0000-0000-0000-0000000000d1'), 'grande', 'gravou na própria linha');
select is((select tamanho_letra from public.usuarios where id = '00000000-0000-0000-0000-0000000000d2'), 'normal', 'a outra pessoa não mudou');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select throws_ok($$ select public.definir_tamanho_letra('maior') $$, 'P0001', 'Acesso desativado.', 'usuário inativo não grava');
reset role;

select * from finish();
rollback;
