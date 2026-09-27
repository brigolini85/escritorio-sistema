begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000b', 'ana@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000c', 'ex@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000d', 'bia@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin@pgtap.local', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'Ana', 'ana@pgtap.local', 'atendente');
insert into public.usuarios (id, nome, email, papel, ativo) values
  ('00000000-0000-0000-0000-00000000000c', 'Ex', 'ex@pgtap.local', 'atendente', false);
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('00000000-0000-0000-0000-00000000000d', 'Bia', 'bia@pgtap.local', 'atendente', '{editar_clientes}');
insert into public.clientes (razao_social, cnpj) values ('Indústria X', '11222333000181');

set local role authenticated;

-- atendente comum
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*) from public.clientes)::int, 1, 'atendente lê clientes');
select throws_ok(
  $$ insert into public.clientes (razao_social, cnpj) values ('Y', '99888777000166') $$,
  '42501', null, 'atendente sem permissão não cria cliente');
select is((select count(*) from public.configuracoes)::int, 0, 'atendente não vê configurações');
select is((select count(*) from public.setores)::int, 5, 'atendente vê os 5 setores iniciais');

-- atendente com permissão editar_clientes
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.clientes (razao_social, cnpj) values ('Z', '55444333000122') $$,
  'atendente com editar_clientes cria cliente');

-- usuário inativo
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*) from public.clientes)::int, 0, 'usuário inativo não vê clientes');

-- administrador
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.clientes (razao_social, cnpj) values ('Y', '99888777000166') $$,
  'admin cria cliente');
select is((select count(*) from public.configuracoes)::int, 1, 'admin vê configurações');

select * from finish();
rollback;
