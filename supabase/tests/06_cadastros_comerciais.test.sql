begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000b', 'ana@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000d', 'bia@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000f', 'paulo@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('00000000-0000-0000-0000-00000000000b', 'Ana', 'ana@pgtap.local', 'atendente', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'Bia', 'bia@pgtap.local', 'atendente', '{editar_clientes}'),
  ('00000000-0000-0000-0000-00000000000f', 'Paulo', 'paulo@pgtap.local', 'atendente', '{editar_precos}');
insert into public.clientes (id, razao_social, cnpj) values
  ('10000000-0000-0000-0000-000000000001', 'Indústria X', '11222333000181'),
  ('10000000-0000-0000-0000-000000000002', 'Indústria Y', '99888777000166');
insert into public.parceiros_grupos (id, cliente_id, tipo, nome) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'cliente', 'Supermercado Brasil'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'fornecedor', 'Frigorífico Boi Bom');
insert into public.produtos (id, cliente_id, codigo, descricao, unidade) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '12', 'Costela com Requeijão', 'PAC');

set local role authenticated;

-- atendente sem permissão: lê, não cria
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*) from public.parceiros_grupos)::int, 2, 'atendente lê os cadastros');
select throws_ok(
  $$ insert into public.parceiros_grupos (cliente_id, tipo, nome) values ('10000000-0000-0000-0000-000000000001', 'cliente', 'Rede Nova') $$,
  '42501', null, 'sem editar_clientes não cria rede');

-- editar_clientes: cria rede; não mexe em preço
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.parceiros_grupos (cliente_id, tipo, nome) values ('10000000-0000-0000-0000-000000000001', 'cliente', 'Rede Nova') $$,
  'editar_clientes cria rede');
select throws_ok(
  $$ select public.definir_preco('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 9.5) $$,
  'P0001', 'sem permissão para editar preços', 'sem editar_precos não define preço');
select throws_ok(
  $$ insert into public.parceiros_unidades (cliente_id, grupo_id, nome_unidade) values ('10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'Filial') $$,
  '23503', null, 'unidade não aceita rede de outra empresa');

-- editar_precos: define, redefine, histórico; fornecedor não tem preço
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select lives_ok($$ select public.definir_preco('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 9.5) $$, 'define preço');
select lives_ok($$ select public.definir_preco('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 10) $$, 'redefine preço');
select is((select valor from public.precos where vigente_ate is null), 10.00::numeric(12,2), 'um único preço vigente, o mais novo');
select is((select count(*) from public.precos)::int, 2, 'o anterior fica no histórico');
select throws_ok(
  $$ select public.definir_preco('50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 5) $$,
  'P0001', 'preço só vale para clientes da empresa', 'fornecedor não tem tabela de preço');

-- auditoria só é visível ao administrador: conferir fora do papel authenticated
reset role;
select ok((select count(*) from public.auditoria_acessos where entidade = 'parceiros_grupos' and acao = 'insert') >= 1,
  'criação de rede fica na auditoria');

select * from finish();
rollback;
