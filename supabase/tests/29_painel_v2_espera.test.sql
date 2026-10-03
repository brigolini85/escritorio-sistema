-- Parte E, Task 2: espera e motivo da passagem (spec 7A.2), marcos, concluir e a caixa nova.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

insert into auth.users (id, email) values
  ('e3000000-0000-0000-0000-00000000000a', 'admin@espera.local'),
  ('e3000000-0000-0000-0000-00000000000b', 'ana@espera.local'),
  ('e3000000-0000-0000-0000-00000000000c', 'caio@espera.local'),
  ('e3000000-0000-0000-0000-00000000000d', 'duda@espera.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e3000000-0000-0000-0000-00000000000a', 'Admin E', 'admin@espera.local', 'admin', '{}'),
  ('e3000000-0000-0000-0000-00000000000b', 'Ana E', 'ana@espera.local', 'atendente', '{}'),
  ('e3000000-0000-0000-0000-00000000000c', 'Caio E', 'caio@espera.local', 'atendente', '{}'),
  ('e3000000-0000-0000-0000-00000000000d', 'Duda E', 'duda@espera.local', 'atendente', '{}');
insert into public.usuario_setores (usuario_id, setor_id)
select v.u, s.id from (values ('e3000000-0000-0000-0000-00000000000b'::uuid, 'Fiscal'),
                              ('e3000000-0000-0000-0000-00000000000c'::uuid, 'Fiscal'),
                              ('e3000000-0000-0000-0000-00000000000d'::uuid, 'Pessoal')) v(u, nome)
join public.setores s on s.nome = v.nome;

insert into public.clientes (id, razao_social, cnpj, agente_pausado) values ('e4000000-0000-0000-0000-000000000001', 'Espera Ltda', '11222333000181', true);
insert into public.conversas (id, telefone, cliente_em_foco) values
  ('e5000000-0000-0000-0000-000000000001', '5531955550001', 'e4000000-0000-0000-0000-000000000001'),
  ('e5000000-0000-0000-0000-000000000002', '5531955550002', null);
insert into public.chamados (conversa_id, setor_id, titulo) values
  ('e5000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'Espera Fiscal'),
  ('e5000000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Fiscal'), 'Espera Fiscal 2');
insert into public.mensagens (conversa_id, direcao, autor, conteudo, criado_em, processada_em) values
  ('e5000000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'oi', now() - interval '20 minutes', now()),
  ('e5000000-0000-0000-0000-000000000001', 'saida', 'agente', 'olá', now() - interval '19 minutes', null),
  ('e5000000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'quero falar com alguém', now() - interval '18 minutes', null);

-- ===== Estrutura =====
select has_column('public', 'conversas', 'aguardando_pessoa_desde', 'conversas.aguardando_pessoa_desde');
select has_column('public', 'conversas', 'motivo_pessoa', 'conversas.motivo_pessoa');
select has_column('public', 'mensagens', 'turno_agente', 'mensagens.turno_agente');
select has_column('public', 'mensagens', 'documento_id', 'mensagens.documento_id');
select has_column('public', 'decisoes_agente', 'turno', 'decisoes_agente.turno');
select has_table('public', 'conversa_eventos', 'conversa_eventos existe');

-- ===== Trabalhador marca a passagem =====
select ok(public.marcar_aguardando_pessoa('e5000000-0000-0000-0000-000000000001', 'pediu para falar com pessoa'), 'marca a passagem');
select is((select motivo_pessoa from public.conversas where id = 'e5000000-0000-0000-0000-000000000001'), 'pediu para falar com pessoa', 'motivo gravado');
select ok((select aguardando_pessoa_desde is not null from public.conversas where id = 'e5000000-0000-0000-0000-000000000001'), 'espera gravada');
select ok(not public.marcar_aguardando_pessoa('e5000000-0000-0000-0000-000000000001', 'falha no agente de IA'), 'segunda passagem não sobrescreve');
select is((select motivo_pessoa from public.conversas where id = 'e5000000-0000-0000-0000-000000000001'), 'pediu para falar com pessoa', 'fica o primeiro motivo');
select is((select count(*) from public.conversa_eventos where conversa_id = 'e5000000-0000-0000-0000-000000000001' and tipo = 'passou_para_pessoa')::int, 1, 'um marco de passagem');

-- ===== Caixa: o que Ana (Fiscal) vê =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select esperando_pessoa from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'), true, 'esperando pessoa');
select is((select esperando_voce from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'), true, 'esperando você (ninguém assumiu)');
select ok((select espera_desde = aguardando_pessoa_desde from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'), 'espera desde a passagem');
select is((select nao_lidas from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'), 1, 'sem leitura: conta só depois da última resposta (P8)');
select is((select empresa_pausada from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'), true, 'pausa da empresa na caixa');
select is((select agente_respondendo from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'), true, 'mensagem não processada = respondendo');
select is((select ultima_autor::text from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'), 'cliente', 'autor da última');
select ok(public.marcar_conversa_lida('e5000000-0000-0000-0000-000000000001', now()), 'Ana lê');
select is((select nao_lidas from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'), 0, 'não lidas de Ana zeram');
select is((select count(*) from public.conversa_eventos where conversa_id = 'e5000000-0000-0000-0000-000000000001')::int, 1, 'Ana vê o marco');

-- ===== Assumir limpa a espera, uma vez só =====
select lives_ok($$ select public.assumir_conversa('e5000000-0000-0000-0000-000000000001') $$, 'Ana assume');
select ok((select aguardando_pessoa_desde is null and motivo_pessoa is null and estado = 'humano' from public.conversas where id = 'e5000000-0000-0000-0000-000000000001'), 'assumir limpa a espera');
select lives_ok($$ select public.assumir_conversa('e5000000-0000-0000-0000-000000000001') $$, 'assumir de novo (cada resposta da equipe chama)');
select is((select count(*) from public.conversa_eventos where tipo = 'assumida' and conversa_id = 'e5000000-0000-0000-0000-000000000001')::int, 1, 'só um marco de assumir');
select ok((select esperando_pessoa and espera_desde is not null from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'),
  'assumida continua esperando pessoa, desde a mensagem sem resposta (P1)');

-- ===== Caio (mesmo setor) não está "esperando você" numa conversa de Ana =====
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select esperando_voce from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'), false, 'assumida por outra pessoa não conta para Caio (P2)');
select throws_ok($$ select public.concluir_conversa('e5000000-0000-0000-0000-000000000001') $$, 'P0001',
  'Só quem assumiu a conversa pode concluir o atendimento.', 'Caio não conclui a de Ana');

-- ===== Ana conclui =====
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.concluir_conversa('e5000000-0000-0000-0000-000000000001') $$, 'Ana conclui');
select ok((select estado = 'agente' and atendente_id is null and concluida_em is not null from public.conversas where id = 'e5000000-0000-0000-0000-000000000001'), 'concluída volta ao agente com data');
select is((select cliente_apos_concluir from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'), false, 'concluída sem mensagem nova do cliente');
reset role;
insert into public.mensagens (conversa_id, direcao, autor, conteudo, criado_em, processada_em) values
  ('e5000000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'mais uma coisa', now() + interval '1 second', now());
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select cliente_apos_concluir from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000001'), true,
  'cliente escreveu depois de concluir: retomada (não volta para Concluídas hoje)');

-- ===== Escritas diretas e função do trabalhador =====
select throws_ok($$ insert into public.conversa_eventos (conversa_id, tipo) values ('e5000000-0000-0000-0000-000000000001', 'assumida') $$, '42501', null, 'equipe não grava marco direto');
select throws_ok($$ select public.marcar_aguardando_pessoa('e5000000-0000-0000-0000-000000000002', 'x') $$, '42501', null, 'equipe não marca passagem');

-- ===== Assumida pelo celular (estado humano, sem pessoa): "esperando você" só com o cliente esperando =====
reset role;
update public.conversas set estado = 'humano', atendente_id = null where id = 'e5000000-0000-0000-0000-000000000002';
insert into public.mensagens (conversa_id, direcao, autor, conteudo, criado_em, processada_em) values
  ('e5000000-0000-0000-0000-000000000002', 'entrada', 'cliente', 'bom dia', now() - interval '10 minutes', now()),
  ('e5000000-0000-0000-0000-000000000002', 'saida', 'atendente', 'bom dia, já vejo', now() - interval '9 minutes', null);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select esperando_voce from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000002'), false,
  'assumida pelo celular com a equipe por último não está esperando você');
select is((select esperando_pessoa from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000002'), true,
  'mas continua no grupo Esperando pessoa (P1)');
reset role;
insert into public.mensagens (conversa_id, direcao, autor, conteudo, criado_em, processada_em) values
  ('e5000000-0000-0000-0000-000000000002', 'entrada', 'cliente', 'e aí?', now() - interval '2 minutes', now());
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select esperando_voce from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000002'), true,
  'cliente escreveu e ninguém respondeu: esperando você (Ana)');
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select esperando_voce from public.caixa_entrada where id = 'e5000000-0000-0000-0000-000000000002'), true,
  'sem pessoa: também para Caio');
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

-- ===== Limites de espera e o horário =====
select is(public.limites_espera(), '{"verde": 5, "ambar": 15}'::jsonb, 'limites padrão');
reset role;
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'e3000000-0000-0000-0000-00000000000b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.limites_espera(), null, 'fora do horário não lê os limites');

select * from finish();
rollback;
