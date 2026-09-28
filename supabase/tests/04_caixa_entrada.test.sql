begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000b', 'ana@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000e', 'caio@pgtap.local');
insert into public.usuarios (id, nome, email) values
  ('00000000-0000-0000-0000-00000000000b', 'Ana', 'ana@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000e', 'Caio', 'caio@pgtap.local');
insert into public.usuario_setores (usuario_id, setor_id)
  select '00000000-0000-0000-0000-00000000000b', id from public.setores where nome = 'Fiscal';
insert into public.conversas (id, telefone) values ('20000000-0000-0000-0000-000000000001', '5531999990001');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo)
  values ('20000000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'texto', 'preciso da guia');
insert into public.chamados (id, conversa_id, setor_id, titulo)
  select '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', id, 'Guia'
  from public.setores where nome = 'Fiscal';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select ultima_mensagem from public.caixa_entrada), 'preciso da guia', 'Ana vê a conversa com a última mensagem');
select lives_ok($$ select public.alterar_status_chamado('30000000-0000-0000-0000-000000000001', 'aguardando_cliente') $$, 'Ana muda o status');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select count(*) from public.caixa_entrada)::int, 0, 'Caio não vê a conversa (a view respeita o RLS)');

select * from finish();
rollback;
