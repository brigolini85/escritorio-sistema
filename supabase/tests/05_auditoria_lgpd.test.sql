begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000b', 'ana@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin@pgtap.local', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'Ana', 'ana@pgtap.local', 'atendente');
insert into public.contatos (id, nome, telefone) values ('40000000-0000-0000-0000-000000000001', 'João', '5531999990001');
insert into public.conversas (id, telefone, contato_id) values ('20000000-0000-0000-0000-000000000001', '5531999990001', '40000000-0000-0000-0000-000000000001');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, arquivo_path) values
  ('20000000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'documento', 'meu RG', 'conversas/20000000-0000-0000-0000-000000000001/rg.pdf');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

update public.contatos set nome = 'João Silva' where id = '40000000-0000-0000-0000-000000000001';
select is((select count(*) from public.auditoria_acessos where entidade = 'contatos' and acao = 'update')::int, 1, 'alteração em cadastro fica na auditoria');
select is((select usuario_id from public.auditoria_acessos where entidade = 'contatos' and acao = 'update' limit 1), '00000000-0000-0000-0000-00000000000a'::uuid, 'com o usuário que alterou');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.anonimizar_contato('40000000-0000-0000-0000-000000000001') $$, 'P0001', 'somente administrador', 'atendente não anonimiza');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(public.anonimizar_contato('40000000-0000-0000-0000-000000000001'),
  array['conversas/20000000-0000-0000-0000-000000000001/rg.pdf'], 'devolve os arquivos a remover');
select is((select conteudo from public.mensagens limit 1), '[removido a pedido do titular]', 'conteúdo apagado');
select is((select nome from public.contatos where id = '40000000-0000-0000-0000-000000000001'), 'Contato removido', 'nome apagado');
select is((select count(*) from public.auditoria_acessos where detalhes::text like '%João%')::int, 0, 'auditoria não guarda mais o nome original');

select * from finish();
rollback;
