-- Parte G1, Task 2 (spec 7C.4 e seção 9): a lista de cargos da ficha da pessoa, editável em Configurações (D10).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('e1300000-0000-0000-0000-00000000000b', 'conf@cargos.local'), ('e1300000-0000-0000-0000-00000000000c', 'sem@cargos.local');
insert into public.usuarios (id, nome, email, papel) values
  ('e1300000-0000-0000-0000-00000000000b', 'Conf Cargos', 'conf@cargos.local', 'atendente'),
  ('e1300000-0000-0000-0000-00000000000c', 'Sem Cargos', 'sem@cargos.local', 'atendente');
update public.usuario_permissoes set nivel = 'sim' where modulo = 'configuracoes' and usuario_id = 'e1300000-0000-0000-0000-00000000000b';

select has_column('public', 'configuracoes', 'cargos', 'coluna cargos');
select is((select cargos from public.configuracoes where id = 1), array['Auxiliar', 'Analista', 'Coordenador', 'Sócio'], 'começa com os quatro de sempre');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1300000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ update public.configuracoes set cargos = array['Auxiliar', 'Estagiário'] where id = 1 $$, 'Configurações: Sim muda a lista');
select throws_ok($$ update public.configuracoes set cargos = array['Auxiliar', ''] where id = 1 $$, '23514', null, 'cargo vazio: recusa');
select throws_ok($$ update public.configuracoes set cargos = array['Analista', 'analista'] where id = 1 $$, '23514', null, 'repetido: recusa');
select throws_ok($$ update public.configuracoes set cargos = (select array_agg('Cargo ' || g) from generate_series(1, 31) g) where id = 1 $$,
  '23514', null, 'mais de 30: recusa');
select throws_ok($$ update public.configuracoes set cargos = array[repeat('a', 61)] where id = 1 $$, '23514', null, 'mais de 60 letras: recusa');
select throws_ok($$ update public.configuracoes set cargos = array[' Sócio'] where id = 1 $$, '23514', null, 'espaço na ponta: recusa');

select set_config('request.jwt.claims', '{"sub":"e1300000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$ update public.configuracoes set cargos = array['Outro'] where id = 1 $$, 'sem Configurações: a alteração não acha a linha');
reset role;
select is((select cargos from public.configuracoes where id = 1), array['Auxiliar', 'Estagiário'], 'sem Configurações: nada mudou');

select * from finish();
rollback;
