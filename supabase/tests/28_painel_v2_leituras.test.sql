-- Parte E, Task 1: não lidas por pessoa (spec 7A.2). Cada pessoa só lê e grava as próprias leituras.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('e1000000-0000-0000-0000-00000000000a', 'ana@leituras.local'),
  ('e1000000-0000-0000-0000-00000000000b', 'caio@leituras.local'),
  ('e1000000-0000-0000-0000-00000000000c', 'duda@leituras.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e1000000-0000-0000-0000-00000000000a', 'Ana L', 'ana@leituras.local', 'atendente', '{}'),
  ('e1000000-0000-0000-0000-00000000000b', 'Caio L', 'caio@leituras.local', 'atendente', '{}'),
  ('e1000000-0000-0000-0000-00000000000c', 'Duda L', 'duda@leituras.local', 'atendente', '{}');
insert into public.usuario_setores (usuario_id, setor_id)
select v.u, s.id from (values ('e1000000-0000-0000-0000-00000000000a'::uuid, 'Fiscal'),
                              ('e1000000-0000-0000-0000-00000000000b'::uuid, 'Fiscal'),
                              ('e1000000-0000-0000-0000-00000000000c'::uuid, 'Pessoal')) v(u, nome)
join public.setores s on s.nome = v.nome;

insert into public.conversas (id, telefone) values ('e2000000-0000-0000-0000-000000000001', '5531966660001');
insert into public.chamados (conversa_id, setor_id, titulo)
  values ('e2000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'Leituras Fiscal');
insert into public.mensagens (conversa_id, direcao, autor, conteudo, criado_em) values
  ('e2000000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'um', now() - interval '10 minutes'),
  ('e2000000-0000-0000-0000-000000000001', 'saida', 'agente', 'resposta', now() - interval '9 minutes'),
  ('e2000000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'dois', now() - interval '5 minutes'),
  ('e2000000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'três', now() - interval '1 minute');

select has_table('public', 'conversa_leituras', 'tabela conversa_leituras existe');
select ok((select relrowsecurity from pg_class where oid = 'public.conversa_leituras'::regclass), 'RLS ligada');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(public.marcar_conversa_lida('e2000000-0000-0000-0000-000000000001', now() - interval '3 minutes'), true, 'Ana marca até 3 min atrás');
select is((select count(*) from public.conversa_leituras)::int, 1, 'Ana vê a própria leitura');
select is(public.marcar_conversa_lida('e2000000-0000-0000-0000-000000000001', now() - interval '8 minutes'), false, 'leitura nunca volta para trás');
select ok((select lida_ate > now() - interval '4 minutes' from public.conversa_leituras), 'lida_ate continua a mais nova');
select ok(public.marcar_conversa_lida('e2000000-0000-0000-0000-000000000001', now() + interval '1 day')
  and (select lida_ate <= now() from public.conversa_leituras), 'nunca no futuro');

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*) from public.conversa_leituras)::int, 0, 'Caio não vê a leitura de Ana');
select throws_ok($$ insert into public.conversa_leituras values ('e1000000-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000001', now()) $$,
  '42501', null, 'Caio não grava leitura em nome de Ana');
select is((select count(*) from public.conversa_leituras where usuario_id = 'e1000000-0000-0000-0000-00000000000a')::int, 0, 'nem pelo filtro');
select throws_ok($$ delete from public.conversa_leituras $$, '42501', null, 'ninguém apaga leitura pela API');

select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.marcar_conversa_lida('e2000000-0000-0000-0000-000000000001', now()) $$,
  'P0001', 'Sem acesso a esta conversa.', 'Duda (Pessoal) não marca conversa que não vê');

-- Fora do horário: nada lê nem grava (P5 da Parte D).
reset role;
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'e1000000-0000-0000-0000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*) from public.conversa_leituras)::int, 0, 'fora do horário Ana não lê nem a própria leitura');
select throws_ok($$ select public.marcar_conversa_lida('e2000000-0000-0000-0000-000000000001', now()) $$,
  'P0001', 'Sem acesso a esta conversa.', 'fora do horário Ana não marca');

select * from finish();
rollback;
