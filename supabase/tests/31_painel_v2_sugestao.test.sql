-- Parte E, Task 4: Sugerir resposta (spec 7A.1 e 7A.2): só para quem usa o assistente pelo site e vê a conversa;
-- uma por pessoa em andamento; só a própria pessoa lê; custo com funcionalidade e pessoa; LGPD apaga.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('ea000000-0000-0000-0000-00000000000a', 'admin@sugestao.local'),
  ('ea000000-0000-0000-0000-00000000000b', 'ana@sugestao.local'),
  ('ea000000-0000-0000-0000-00000000000c', 'caio@sugestao.local'),
  ('ea000000-0000-0000-0000-00000000000d', 'duda@sugestao.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('ea000000-0000-0000-0000-00000000000a', 'Admin S', 'admin@sugestao.local', 'admin', '{}'),
  ('ea000000-0000-0000-0000-00000000000b', 'Ana S', 'ana@sugestao.local', 'atendente', '{assistente_site}'),
  ('ea000000-0000-0000-0000-00000000000c', 'Caio S', 'caio@sugestao.local', 'atendente', '{}'),
  ('ea000000-0000-0000-0000-00000000000d', 'Duda S', 'duda@sugestao.local', 'atendente', '{assistente_site}');
insert into public.usuario_setores (usuario_id, setor_id)
select v.u, s.id from (values ('ea000000-0000-0000-0000-00000000000b'::uuid, 'Fiscal'), ('ea000000-0000-0000-0000-00000000000c'::uuid, 'Fiscal'),
                              ('ea000000-0000-0000-0000-00000000000d'::uuid, 'Pessoal')) v(u, nome)
join public.setores s on s.nome = v.nome;
insert into public.contatos (id, nome, telefone) values ('eb000000-0000-0000-0000-000000000001', 'Carla', '5531933330001');
insert into public.conversas (id, telefone, contato_id, motivo_pessoa) values
  ('ec000000-0000-0000-0000-000000000001', '5531933330001', 'eb000000-0000-0000-0000-000000000001', 'pediu para falar com pessoa');
insert into public.chamados (conversa_id, setor_id, titulo) values
  ('ec000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'Sugestão Fiscal');

select has_table('public', 'sugestoes_resposta', 'tabela de sugestões');
select lives_ok($$ insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd, funcionalidade, usuario_id)
  values ('claude-sonnet-5', 1, 1, 0.01, 'sugerir_resposta', 'ea000000-0000-0000-0000-00000000000b') $$, 'uso_ia aceita sugerir_resposta com pessoa');
select throws_ok($$ insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd, funcionalidade) values ('x', 1, 1, 0, 'inventada') $$,
  '23514', null, 'funcionalidade fora da lista: recusa');

set local role authenticated;
-- Caio vê a conversa, mas não usa o assistente
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.pedir_sugestao_resposta('ec000000-0000-0000-0000-000000000001') $$, 'P0001',
  'Sugerir resposta usa o assistente: peça acesso ao administrador.', 'sem o assistente: recusa');
-- Duda usa o assistente, mas não vê a conversa
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select public.pedir_sugestao_resposta('ec000000-0000-0000-0000-000000000001') $$, 'P0001',
  'Sem acesso a esta conversa.', 'sem ver a conversa: recusa');
-- Administrador sem o assistente: sem passe livre (P10)
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.pedir_sugestao_resposta('ec000000-0000-0000-0000-000000000001') $$, 'P0001',
  'Sugerir resposta usa o assistente: peça acesso ao administrador.', 'administrador sem o assistente: recusa');

-- Ana pode
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select ok(public.pedir_sugestao_resposta('ec000000-0000-0000-0000-000000000001') is not null, 'Ana pede');
select is((select status from public.sugestoes_resposta), 'pendente', 'Ana vê a própria, pendente');
select throws_ok($$ select public.pedir_sugestao_resposta('ec000000-0000-0000-0000-000000000001') $$, 'P0001',
  'Já tem uma sugestão sendo preparada. Espere ela chegar.', 'uma por vez');
select throws_ok($$ insert into public.sugestoes_resposta (usuario_id, conversa_id) values (auth.uid(), 'ec000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'não grava direto');
select throws_ok($$ update public.sugestoes_resposta set texto = 'x' $$, '42501', null, 'não altera direto');

-- Pendente parada há mais de 2 minutos: libera outra
reset role;
update public.sugestoes_resposta set criado_em = now() - interval '3 minutes';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select ok(public.pedir_sugestao_resposta('ec000000-0000-0000-0000-000000000001') is not null, 'parada libera um pedido novo');
select is((select array_agg(status order by criado_em) from public.sugestoes_resposta), array['falhou', 'pendente'], 'a parada vira falhou');

-- Caio (mesma conversa) não lê as sugestões de Ana
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*) from public.sugestoes_resposta)::int, 0, 'Caio não lê a sugestão de Ana');

-- Fora do horário: recusa (foco da revisão 5)
reset role;
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'ea000000-0000-0000-0000-00000000000b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.pedir_sugestao_resposta('ec000000-0000-0000-0000-000000000001') $$, 'P0001',
  'Fora do seu horário de acesso.', 'fora do horário não pede sugestão');

-- LGPD
select set_config('request.jwt.claims', '{"sub":"ea000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.anonimizar_contato('eb000000-0000-0000-0000-000000000001') $$, 'administrador apaga os dados do contato');
reset role;
select is((select count(*) from public.sugestoes_resposta where conversa_id = 'ec000000-0000-0000-0000-000000000001')::int, 0, 'LGPD apaga as sugestões');
select is((select motivo_pessoa from public.conversas where id = 'ec000000-0000-0000-0000-000000000001'), null, 'LGPD limpa o motivo');

select * from finish();
rollback;
