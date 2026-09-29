begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Assistente interno (pedido do dono, 2026-09-29).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'dono@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'ana@pgtap.local');
insert into public.usuarios (id, nome, email, papel, telefone, permissoes) values
  ('00000000-0000-0000-0000-0000000000a1', 'Dono', 'dono@pgtap.local', 'admin', '5531988887777', '{assistente_site,assistente_whatsapp}'),
  ('00000000-0000-0000-0000-0000000000a2', 'Ana', 'ana@pgtap.local', 'atendente', null, '{}');
insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo) values
  ('00000000-0000-0000-0000-0000000000a1', 'site', 'usuario', 'quais notas estão abertas?');
insert into public.conversas (id, telefone) values
  ('20000000-0000-0000-0000-000000000001', '553188887777'),   -- WhatsApp do dono, sem o 9
  ('20000000-0000-0000-0000-000000000002', '5531999990001');  -- cliente

select ok(public.eh_telefone_do_assistente('553188887777'), 'reconhece o telefone do usuário mesmo sem o 9');
select ok(not public.eh_telefone_do_assistente('5531999990001'), 'telefone de cliente não é do assistente');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*) from public.assistente_mensagens)::int, 1, 'o dono lê a própria conversa com o assistente');
select is((select array_agg(telefone order by telefone) from public.caixa_entrada), array['5531999990001'], 'Atendimento não mostra a conversa interna do dono');
select lives_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
  values ('00000000-0000-0000-0000-0000000000a1', 'site', 'usuario', 'oi') $$, 'com assistente_site pergunta pelo site');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*) from public.assistente_mensagens)::int, 0, 'Ana não lê a conversa do dono');
select throws_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
  values ('00000000-0000-0000-0000-0000000000a2', 'site', 'usuario', 'oi') $$, '42501', null, 'sem assistente_site não pergunta');

select * from finish();
rollback;
