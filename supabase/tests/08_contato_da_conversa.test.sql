begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- Cadastrar/vincular o contato a partir da conversa (pedido do dono, 2026-09-28).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000b', 'ana@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000d', 'bia@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('00000000-0000-0000-0000-00000000000b', 'Ana', 'ana@pgtap.local', 'atendente', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'Bia', 'bia@pgtap.local', 'atendente', '{editar_clientes}');
insert into public.usuario_setores (usuario_id, setor_id)
  select u, s.id from public.setores s, unnest(array['00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000d']::uuid[]) u where s.nome = 'Fiscal';
insert into public.conversas (id, telefone) values ('20000000-0000-0000-0000-000000000001', '5531999990001');
insert into public.chamados (conversa_id, setor_id, titulo) select '20000000-0000-0000-0000-000000000001', id, 'Guia' from public.setores where nome = 'Fiscal';
insert into public.contatos (id, nome, telefone) values ('40000000-0000-0000-0000-000000000001', 'João', '5531999990001');

select is((select agente_pausado from public.contatos where id = '40000000-0000-0000-0000-000000000001'), false, 'por padrão o agente atende o contato');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.vincular_contato_conversa('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001') $$,
  'P0001', 'sem permissão para editar clientes', 'sem editar_clientes não vincula');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$ select public.vincular_contato_conversa('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001') $$, 'editar_clientes vincula');
reset role;
select is((select contato_id from public.conversas where id = '20000000-0000-0000-0000-000000000001'), '40000000-0000-0000-0000-000000000001'::uuid, 'conversa ligada ao contato');

select * from finish();
rollback;
