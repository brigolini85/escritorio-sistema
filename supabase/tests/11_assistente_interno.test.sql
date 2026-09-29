begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Assistente interno (pedido do dono, 2026-09-29).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'dono@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'ana@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'admin_sem_permissao@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'carlos@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000a5', 'celular@pgtap.local');
insert into public.usuarios (id, nome, email, papel, telefone, permissoes) values
  ('00000000-0000-0000-0000-0000000000a1', 'Dono', 'dono@pgtap.local', 'admin', '5531988887777', '{assistente_site,assistente_whatsapp}'),
  ('00000000-0000-0000-0000-0000000000a2', 'Ana', 'ana@pgtap.local', 'atendente', null, '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'Admin Sem Permissão', 'admin_sem_permissao@pgtap.local', 'admin', null, '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'Carlos', 'carlos@pgtap.local', 'atendente', null, '{assistente_site}'),
  ('00000000-0000-0000-0000-0000000000a5', 'Celular', 'celular@pgtap.local', 'atendente', '5531932227777', '{assistente_whatsapp}');
insert into public.setores (id, nome) values
  ('30000000-0000-0000-0000-000000000001', 'Setor Fiscal');
insert into public.usuario_setores (usuario_id, setor_id) values
  ('00000000-0000-0000-0000-0000000000a2', '30000000-0000-0000-0000-000000000001');
insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo) values
  ('00000000-0000-0000-0000-0000000000a1', 'site', 'usuario', 'quais notas estão abertas?');
insert into public.conversas (id, telefone) values
  ('20000000-0000-0000-0000-000000000001', '553188887777'),   -- WhatsApp do dono, sem o 9
  ('20000000-0000-0000-0000-000000000002', '5531999990001'),  -- cliente
  ('20000000-0000-0000-0000-000000000003', '5531999990002');  -- conversa invisível para Carlos
insert into public.clientes (id, razao_social, cnpj) values
  ('40000000-0000-0000-0000-000000000001', 'Cliente Teste', '12345678901234');
insert into public.chamados (id, conversa_id, cliente_id, setor_id, titulo) values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001',
   (select id from public.setores where nome != 'Setor Fiscal' limit 1), 'Chamado Invisível para Carlos');

select ok(public.eh_telefone_do_assistente('553188887777'), 'reconhece o telefone do usuário mesmo sem o 9');
select ok(not public.eh_telefone_do_assistente('553132227777'), 'telefone fixo não se confunde com o celular da equipe');
select ok(not public.eh_telefone_do_assistente('5531999990001'), 'telefone de cliente não é do assistente');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*) from public.assistente_mensagens)::int, 1, 'o dono lê a própria conversa com o assistente');
select is((select array_agg(telefone order by telefone) from public.caixa_entrada), array['5531999990001', '5531999990002'], 'Atendimento não mostra a conversa interna do dono');
select lives_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
  values ('00000000-0000-0000-0000-0000000000a1', 'site', 'usuario', 'oi') $$, 'com assistente_site pergunta pelo site');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*) from public.assistente_mensagens)::int, 0, 'Ana não lê a conversa do dono');
select throws_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
  values ('00000000-0000-0000-0000-0000000000a2', 'site', 'usuario', 'oi') $$, '42501', null, 'sem assistente_site não pergunta');

-- Testes de segurança: SECURITY DEFINER e controle de acesso de conversa
set local role anon;
select throws_ok($$ select public.eh_telefone_do_assistente('553188887777') $$, '42501', null, 'anon não chama eh_telefone_do_assistente');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
select throws_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo, conversa_id)
  values ('00000000-0000-0000-0000-0000000000a4', 'site', 'usuario', 'oi', '20000000-0000-0000-0000-000000000003') $$, '42501', null, 'conversa_id invisível é rejeitada (RLS)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select throws_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
  values ('00000000-0000-0000-0000-0000000000a3', 'site', 'usuario', 'oi') $$, '42501', null, 'admin sem assistente_site não pergunta');

-- Revisão final (K2): a equipe logada (e o serviço) pode chamar a função, que a view caixa_entrada usa.
reset role;
select ok(has_function_privilege('authenticated', 'public.eh_telefone_do_assistente(text)', 'execute'), 'authenticated chama eh_telefone_do_assistente');
select ok(has_function_privilege('service_role', 'public.eh_telefone_do_assistente(text)', 'execute'), 'service_role chama eh_telefone_do_assistente');

-- Revisão final (N): apagar os dados do contato apaga a conversa da equipe com o assistente dentro do atendimento dele.
insert into public.contatos (id, nome, telefone) values ('60000000-0000-0000-0000-000000000001', 'Cliente LGPD', '5531999990001');
insert into public.assistente_mensagens (usuario_id, canal, conversa_id, papel, conteudo) values
  ('00000000-0000-0000-0000-0000000000a1', 'site', '20000000-0000-0000-0000-000000000002', 'usuario', 'o que o Cliente LGPD pediu?'),
  ('00000000-0000-0000-0000-0000000000a1', 'site', '20000000-0000-0000-0000-000000000002', 'assistente', 'Ele pediu 10 costelas.');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.anonimizar_contato('60000000-0000-0000-0000-000000000001');
reset role;
select is((select count(*) from public.assistente_mensagens where conversa_id = '20000000-0000-0000-0000-000000000002')::int, 0,
  'anonimizar_contato apaga as mensagens do assistente sobre a conversa do contato');
select ok((select count(*) from public.assistente_mensagens where conversa_id is null) >= 1, 'as conversas gerais com o assistente ficam');

select * from finish();
rollback;
