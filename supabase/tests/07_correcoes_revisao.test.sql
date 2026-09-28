begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- Revisão 2026-09-28, item 6: quem tem editar_clientes (sem ser admin) consegue desfazer vínculos da ficha.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'bia@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('00000000-0000-0000-0000-00000000000d', 'Bia', 'bia@pgtap.local', 'atendente', '{editar_clientes}');
insert into public.clientes (id, razao_social, cnpj) values ('10000000-0000-0000-0000-000000000001', 'Indústria X', '11222333000181');
insert into public.servicos (id, nome) values ('70000000-0000-0000-0000-000000000001', 'Folha');
insert into public.cliente_servicos (cliente_id, servico_id) values ('10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001');
insert into public.cliente_responsaveis (cliente_id, setor_id, usuario_id)
  select '10000000-0000-0000-0000-000000000001', id, '00000000-0000-0000-0000-00000000000d' from public.setores where nome = 'Fiscal';
insert into public.contatos (id, nome, telefone) values ('40000000-0000-0000-0000-000000000001', 'João', '5531999990001');
insert into public.contato_clientes (contato_id, cliente_id) values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
delete from public.cliente_servicos where cliente_id = '10000000-0000-0000-0000-000000000001';
delete from public.cliente_responsaveis where cliente_id = '10000000-0000-0000-0000-000000000001';
delete from public.contato_clientes where cliente_id = '10000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*) from public.cliente_servicos)::int, 0, 'editar_clientes desmarca serviço');
select is((select count(*) from public.cliente_responsaveis)::int, 0, 'editar_clientes troca responsável');
select is((select count(*) from public.contato_clientes)::int, 0, 'editar_clientes remove contato da empresa');

select * from finish();
rollback;
