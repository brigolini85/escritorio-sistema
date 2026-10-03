-- Parte E, Task 3: trocar a empresa só entre empresas ligadas ao contato (spec 7A.2) e abrir demanda da conversa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email) values
  ('e6000000-0000-0000-0000-00000000000a', 'admin@trocar.local'),
  ('e6000000-0000-0000-0000-00000000000b', 'ana@trocar.local'),
  ('e6000000-0000-0000-0000-00000000000d', 'duda@trocar.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e6000000-0000-0000-0000-00000000000a', 'Admin T', 'admin@trocar.local', 'admin', '{}'),
  ('e6000000-0000-0000-0000-00000000000b', 'Ana T', 'ana@trocar.local', 'atendente', '{}'),
  ('e6000000-0000-0000-0000-00000000000d', 'Duda T', 'duda@trocar.local', 'atendente', '{}');
insert into public.usuario_setores (usuario_id, setor_id)
select v.u, s.id from (values ('e6000000-0000-0000-0000-00000000000b'::uuid, 'Fiscal'), ('e6000000-0000-0000-0000-00000000000d'::uuid, 'Pessoal')) v(u, nome)
join public.setores s on s.nome = v.nome;

insert into public.clientes (id, razao_social, cnpj, ativo) values
  ('e7000000-0000-0000-0000-000000000001', 'Rede Um Ltda', '11222333000181', true),
  ('e7000000-0000-0000-0000-000000000002', 'Padaria Dois ME', '11222333000262', true),
  ('e7000000-0000-0000-0000-000000000003', 'Alheia SA', '11222333000343', true),
  ('e7000000-0000-0000-0000-000000000004', 'Arquivada Ltda', '11222333000424', false);
insert into public.contatos (id, nome, telefone) values ('e8000000-0000-0000-0000-000000000001', 'Carla', '5531944440001');
insert into public.contato_clientes (contato_id, cliente_id) values
  ('e8000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001'),
  ('e8000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000002'),
  ('e8000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000004');
insert into public.conversas (id, telefone, contato_id, cliente_em_foco) values
  ('e9000000-0000-0000-0000-000000000001', '5531944440001', 'e8000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001'),
  ('e9000000-0000-0000-0000-000000000002', '5531944440002', null, null);
insert into public.chamados (conversa_id, setor_id, titulo) values
  ('e9000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'Trocar Fiscal'),
  ('e9000000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Fiscal'), 'Trocar sem contato');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select throws_ok($$ select public.trocar_empresa_conversa('e9000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000003') $$,
  'P0001', 'Esta empresa não está ligada ao contato.', 'empresa não vinculada: recusa');
select throws_ok($$ select public.trocar_empresa_conversa('e9000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000004') $$,
  'P0001', 'Esta empresa não está ligada ao contato.', 'empresa arquivada: recusa');
select throws_ok($$ select public.trocar_empresa_conversa('e9000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001') $$,
  'P0001', 'A conversa já está nesta empresa.', 'mesma empresa: recusa');
select throws_ok($$ select public.trocar_empresa_conversa('e9000000-0000-0000-0000-000000000002', 'e7000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Cadastre o contato antes de trocar a empresa.', 'conversa sem contato: recusa');
select is(public.trocar_empresa_conversa('e9000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000002'),
  '{"empresa": "Padaria Dois ME"}'::jsonb, 'troca para empresa vinculada');
select is((select cliente_em_foco from public.conversas where id = 'e9000000-0000-0000-0000-000000000001'),
  'e7000000-0000-0000-0000-000000000002'::uuid, 'empresa em foco trocada');
select is((select texto from public.conversa_eventos where tipo = 'empresa_trocada' and conversa_id = 'e9000000-0000-0000-0000-000000000001'),
  'Rede Um Ltda → Padaria Dois ME', 'marco da troca');

reset role;
select is((select count(*) from public.auditoria_acessos where acao = 'trocar_empresa' and entidade_id = 'e9000000-0000-0000-0000-000000000001')::int, 1, 'auditoria da troca');
-- Contato arquivado depois: não troca mais.
update public.contatos set ativo = false where id = 'e8000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.trocar_empresa_conversa('e9000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Contato arquivado: restaure o contato para trocar a empresa.', 'contato arquivado: recusa');
reset role;
update public.contatos set ativo = true where id = 'e8000000-0000-0000-0000-000000000001';
set local role authenticated;

-- Quem não vê a conversa
select set_config('request.jwt.claims', '{"sub":"e6000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select public.trocar_empresa_conversa('e9000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Sem acesso a esta conversa.', 'Duda (Pessoal) não troca');

-- ===== Abrir demanda da conversa =====
select set_config('request.jwt.claims', '{"sub":"e6000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select ok((public.criar_demanda('e7000000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Fiscal'),
  'Demanda da conversa', '', 'normal', null, null, 'e8000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001') ->> 'numero') is not null,
  'cria ligada à conversa');
select is((select conversa_id from public.chamados where titulo = 'Demanda da conversa'), 'e9000000-0000-0000-0000-000000000001'::uuid, 'conversa ligada');
select is((select origem from public.chamados where titulo = 'Demanda da conversa'), 'equipe', 'origem equipe');
select throws_ok($$ select public.criar_demanda('e7000000-0000-0000-0000-000000000003', (select id from public.setores where nome = 'Fiscal'),
  'Empresa alheia', '', 'normal', null, null, null, 'e9000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Escolha uma empresa desta conversa.', 'empresa fora da conversa: recusa');
select ok((public.criar_demanda('e7000000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Fiscal'),
  'Sem conversa', '', 'normal') ->> 'id') is not null, 'chamada antiga, sem conversa, continua valendo');

select set_config('request.jwt.claims', '{"sub":"e6000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select public.criar_demanda('e7000000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Pessoal'),
  'Duda tenta', '', 'normal', null, null, null, 'e9000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Sem acesso a esta conversa.', 'quem não vê a conversa não liga demanda a ela');

-- ===== Sobras da Task 2: concluir filtra no próprio UPDATE; devolver marca quando limpa uma espera =====
select set_config('request.jwt.claims', '{"sub":"e6000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.assumir_conversa('e9000000-0000-0000-0000-000000000001') $$, 'Ana assume');
reset role;
-- Outra pessoa assumiu entre a tela e o clique (corrida checar-depois-agir).
update public.conversas set atendente_id = 'e6000000-0000-0000-0000-00000000000d' where id = 'e9000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.concluir_conversa('e9000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Só quem assumiu a conversa pode concluir o atendimento.', 'Ana não conclui a assumida por outra pessoa');
reset role;
select ok((select estado = 'humano' and atendente_id = 'e6000000-0000-0000-0000-00000000000d' and concluida_em is null
           from public.conversas where id = 'e9000000-0000-0000-0000-000000000001')
          and not exists (select 1 from public.conversa_eventos
                          where conversa_id = 'e9000000-0000-0000-0000-000000000001' and tipo = 'concluida'),
  'recusa não muda a conversa nem grava marco');
update public.conversas set atendente_id = 'e6000000-0000-0000-0000-00000000000b' where id = 'e9000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.concluir_conversa('e9000000-0000-0000-0000-000000000001') $$, 'Ana conclui a dela');
select throws_ok($$ select public.concluir_conversa('e9000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Só quem assumiu a conversa pode concluir o atendimento.', 'já com o agente: Ana não conclui de novo');

-- Agente passou para pessoa; o administrador devolve ao agente sem assumir: limpa a espera e grava o marco.
reset role;
select public.marcar_aguardando_pessoa('e9000000-0000-0000-0000-000000000001', 'pediu para falar com pessoa');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.devolver_ao_agente('e9000000-0000-0000-0000-000000000001') $$, 'admin devolve a espera ao agente');
select is((select count(*) from public.conversa_eventos where tipo = 'devolvida' and conversa_id = 'e9000000-0000-0000-0000-000000000001')::int, 1,
  'limpar a espera grava o marco devolvida');
select lives_ok($$ select public.devolver_ao_agente('e9000000-0000-0000-0000-000000000001') $$, 'devolver de novo, sem espera');
select is((select count(*) from public.conversa_eventos where tipo = 'devolvida' and conversa_id = 'e9000000-0000-0000-0000-000000000001')::int, 1,
  'sem espera e com o agente: nenhum marco a mais');
select throws_ok($$ select public.concluir_conversa('e9000000-0000-0000-0000-0000000000ff') $$,
  'P0001', 'Conversa não encontrada.', 'admin: conversa inexistente');

-- Fora do horário
reset role;
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'e6000000-0000-0000-0000-00000000000b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e6000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.trocar_empresa_conversa('e9000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Fora do seu horário de acesso.', 'fora do horário não troca');

select * from finish();
rollback;
