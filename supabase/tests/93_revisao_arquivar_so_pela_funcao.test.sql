-- Revisão geral, área 1, I3: arquivar e restaurar clientes, contatos, produtos, redes e unidades só pelas funções
-- (arquivar_cadastro / restaurar_cadastro), que exigem "Clientes e contatos: Editar e arquivar", gravam a auditoria e não
-- trazem de volta contato anonimizado. Mudar "ativo" direto pela tabela (PATCH do navegador) é recusado.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('93000000-0000-0000-0000-00000000000a', 'bia93@pgtap.local'),
  ('93000000-0000-0000-0000-00000000000b', 'caio93@pgtap.local'),
  ('93000000-0000-0000-0000-00000000000c', 'adm93@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('93000000-0000-0000-0000-00000000000a', 'Bia 93', 'bia93@pgtap.local', 'atendente', '{editar_clientes}'),
  ('93000000-0000-0000-0000-00000000000b', 'Caio 93', 'caio93@pgtap.local', 'atendente', '{editar_clientes}'),
  ('93000000-0000-0000-0000-00000000000c', 'Adm 93', 'adm93@pgtap.local', 'admin', '{}');
-- Bia: "Ver e editar". Caio: "Editar e arquivar".
update public.usuario_permissoes set nivel = 'editar' where modulo = 'clientes' and usuario_id = '93000000-0000-0000-0000-00000000000a';
update public.usuario_permissoes set nivel = 'arquivar' where modulo = 'clientes' and usuario_id = '93000000-0000-0000-0000-00000000000b';

insert into public.clientes (id, razao_social, cnpj) values ('93100000-0000-0000-0000-000000000001', 'Empresa 93', '93930000000101');
insert into public.contatos (id, nome, telefone) values
  ('93200000-0000-0000-0000-000000000001', 'Contato 93', '5531999999301'),
  ('93200000-0000-0000-0000-000000000002', 'Contato LGPD 93', '5531999999302');
insert into public.produtos (id, cliente_id, codigo, descricao) values
  ('93300000-0000-0000-0000-000000000001', '93100000-0000-0000-0000-000000000001', '1', 'Produto 93');
insert into public.parceiros_grupos (id, cliente_id, tipo, nome) values
  ('93400000-0000-0000-0000-000000000001', '93100000-0000-0000-0000-000000000001', 'cliente', 'Rede 93');
insert into public.parceiros_unidades (id, cliente_id, grupo_id, nome_unidade) values
  ('93500000-0000-0000-0000-000000000001', '93100000-0000-0000-0000-000000000001', '93400000-0000-0000-0000-000000000001', 'Unidade 93');

set local role authenticated;
-- 1 a 5. "Ver e editar" não arquiva pela tabela.
select set_config('request.jwt.claims', '{"sub":"93000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ update public.clientes set ativo = false where id = '93100000-0000-0000-0000-000000000001' $$,
  'P0001', 'Arquive ou restaure pelo botão Arquivar/Restaurar.', 'editar: cliente não é arquivado pela tabela');
select throws_ok($$ update public.contatos set ativo = false where id = '93200000-0000-0000-0000-000000000001' $$,
  'P0001', 'Arquive ou restaure pelo botão Arquivar/Restaurar.', 'editar: contato não é arquivado pela tabela');
select throws_ok($$ update public.produtos set ativo = false where id = '93300000-0000-0000-0000-000000000001' $$,
  'P0001', 'Arquive ou restaure pelo botão Arquivar/Restaurar.', 'editar: produto não é arquivado pela tabela');
select throws_ok($$ update public.parceiros_grupos set ativo = false where id = '93400000-0000-0000-0000-000000000001' $$,
  'P0001', 'Arquive ou restaure pelo botão Arquivar/Restaurar.', 'editar: rede não é arquivada pela tabela');
select throws_ok($$ update public.parceiros_unidades set ativo = false where id = '93500000-0000-0000-0000-000000000001' $$,
  'P0001', 'Arquive ou restaure pelo botão Arquivar/Restaurar.', 'editar: unidade não é arquivada pela tabela');
-- 6. Editar os outros campos continua valendo (inclusive mandando o mesmo "ativo", como um formulário inteiro).
select lives_ok($$ update public.produtos set descricao = 'Produto 93 novo', ativo = true where id = '93300000-0000-0000-0000-000000000001' $$,
  'editar: os outros campos (com o mesmo ativo) continuam valendo');
-- 7. E pela função continua recusado sem o nível.
select throws_ok($$ select public.arquivar_cadastro('produto', '93300000-0000-0000-0000-000000000001') $$,
  'P0001', 'Sem permissão para arquivar cadastros.', 'editar: a função também recusa');

-- 8 a 10. "Editar e arquivar": pela função passa; pela tabela também é recusado (a auditoria só nasce na função).
select set_config('request.jwt.claims', '{"sub":"93000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ update public.produtos set ativo = false where id = '93300000-0000-0000-0000-000000000001' $$,
  'P0001', 'Arquive ou restaure pelo botão Arquivar/Restaurar.', 'arquivar: pela tabela também não (sem auditoria)');
select lives_ok($$ select public.arquivar_cadastro('produto', '93300000-0000-0000-0000-000000000001') $$, 'arquivar: pela função passa');
select lives_ok($$ select public.restaurar_cadastro('produto', '93300000-0000-0000-0000-000000000001') $$, 'arquivar: restaurar pela função passa');

-- 11 a 12. Contato anonimizado não volta pela tabela nem pela função.
select set_config('request.jwt.claims', '{"sub":"93000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$ select public.anonimizar_contato('93200000-0000-0000-0000-000000000002') $$, 'admin anonimiza (continua valendo)');
select throws_ok($$ update public.contatos set ativo = true where id = '93200000-0000-0000-0000-000000000002' $$,
  'P0001', 'Arquive ou restaure pelo botão Arquivar/Restaurar.', 'contato anonimizado não volta pela tabela (nem o admin)');

reset role;
-- 13 a 16.
select ok((select ativo from public.clientes where id = '93100000-0000-0000-0000-000000000001')
  and (select ativo from public.contatos where id = '93200000-0000-0000-0000-000000000001')
  and (select ativo from public.parceiros_grupos where id = '93400000-0000-0000-0000-000000000001')
  and (select ativo from public.parceiros_unidades where id = '93500000-0000-0000-0000-000000000001'), 'nada foi arquivado pela tabela');
select ok((select ativo and descricao = 'Produto 93 novo' from public.produtos where id = '93300000-0000-0000-0000-000000000001'),
  'produto restaurado e com a descrição nova');
select is((select array_agg(acao order by acao) from public.auditoria_acessos where entidade = 'produtos'
  and entidade_id = '93300000-0000-0000-0000-000000000001' and acao in ('arquivar', 'restaurar')), array['arquivar', 'restaurar'],
  'arquivar e restaurar pela função ficam na auditoria');
-- O trabalhador e os ajustes do sistema (chave de serviço / postgres) continuam mudando "ativo".
select lives_ok($$ update public.produtos set ativo = false where id = '93300000-0000-0000-0000-000000000001' $$,
  'fora da sessão de uma pessoa (postgres) o ativo continua mudando');

set local role service_role;
select lives_ok($$ update public.produtos set ativo = true where id = '93300000-0000-0000-0000-000000000001' $$,
  'a chave de serviço (trabalhador) continua mudando o ativo');
reset role;

select * from finish();
rollback;
