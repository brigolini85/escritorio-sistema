begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000b', 'ana@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000e', 'caio@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin@pgtap.local', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'Ana', 'ana@pgtap.local', 'atendente'),
  ('00000000-0000-0000-0000-00000000000e', 'Caio', 'caio@pgtap.local', 'atendente');
insert into public.usuario_setores (usuario_id, setor_id)
  select '00000000-0000-0000-0000-00000000000b', id from public.setores where nome = 'Fiscal';
insert into public.usuario_setores (usuario_id, setor_id)
  select '00000000-0000-0000-0000-00000000000e', id from public.setores where nome = 'Pessoal';

insert into public.clientes (id, razao_social, cnpj) values ('10000000-0000-0000-0000-000000000001', 'Indústria X', '11222333000181');
insert into public.conversas (id, telefone) values
  ('20000000-0000-0000-0000-000000000001', '5531999990001'),
  ('20000000-0000-0000-0000-000000000002', '5531999990002');
insert into public.mensagens (conversa_id, cliente_id, direcao, autor, tipo, conteudo) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'texto', 'preciso da guia'),
  ('20000000-0000-0000-0000-000000000002', null, 'entrada', 'cliente', 'texto', 'oi');
insert into public.chamados (cliente_id, conversa_id, setor_id, titulo)
  select '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', id, 'Guia DAS setembro'
  from public.setores where nome = 'Fiscal';

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*) from public.conversas)::int, 1, 'Ana (Fiscal) vê só a conversa com chamado do Fiscal');
select is((select count(*) from public.mensagens)::int, 1, 'Ana vê só as mensagens dessa conversa');
select is((select count(*) from public.chamados)::int, 1, 'Ana vê o chamado do Fiscal');
select throws_ok(
  $$ update public.conversas set estado = 'humano' $$,
  null, null, 'atendente não altera conversa diretamente');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select count(*) from public.chamados)::int, 0, 'Caio (Pessoal) não vê chamado do Fiscal');
select is((select count(*) from public.conversas)::int, 0, 'Caio não vê conversas sem chamado do seu setor');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*) from public.conversas)::int, 2, 'admin vê todas as conversas, inclusive as só com o agente');

select * from finish();
rollback;
