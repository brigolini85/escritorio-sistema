-- supabase/tests/15_painel_v2_arquivar.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(60);

-- Pessoas: admin, Bia (editar_clientes), Ana (sem permissão), Inativa (tinha editar_clientes), Zeca (responsável por demanda aberta), Novo (nunca usou).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000015a1', 'admin15@pgtap.local'),
  ('00000000-0000-0000-0000-0000000015a2', 'bia15@pgtap.local'),
  ('00000000-0000-0000-0000-0000000015a3', 'ana15@pgtap.local'),
  ('00000000-0000-0000-0000-0000000015a4', 'inativa15@pgtap.local'),
  ('00000000-0000-0000-0000-0000000015a5', 'zeca15@pgtap.local'),
  ('00000000-0000-0000-0000-0000000015a6', 'novo15@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes, ativo) values
  ('00000000-0000-0000-0000-0000000015a1', 'Admin', 'admin15@pgtap.local', 'admin', '{}', true),
  ('00000000-0000-0000-0000-0000000015a2', 'Bia', 'bia15@pgtap.local', 'atendente', '{editar_clientes}', true),
  ('00000000-0000-0000-0000-0000000015a3', 'Ana', 'ana15@pgtap.local', 'atendente', '{}', true),
  ('00000000-0000-0000-0000-0000000015a4', 'Inativa', 'inativa15@pgtap.local', 'atendente', '{editar_clientes}', false),
  ('00000000-0000-0000-0000-0000000015a5', 'Zeca', 'zeca15@pgtap.local', 'atendente', '{}', true),
  ('00000000-0000-0000-0000-0000000015a6', 'Novo', 'novo15@pgtap.local', 'atendente', '{}', true);
insert into public.usuario_setores (usuario_id, setor_id)
  select '00000000-0000-0000-0000-0000000015a4', id from public.setores where nome = 'Fiscal';

-- Cliente X com histórico; cliente Y nunca usado.
insert into public.clientes (id, razao_social, cnpj) values
  ('15000000-0000-0000-0000-000000000001', 'Indústria X', '15150000000101'),
  ('15000000-0000-0000-0000-000000000002', 'Indústria Y', '15150000000202');
insert into public.contatos (id, nome, telefone) values
  ('15200000-0000-0000-0000-000000000001', 'Contato Usado', '5531999991501'),
  ('15200000-0000-0000-0000-000000000002', 'Contato Novo', '5531999991502'),
  ('15200000-0000-0000-0000-000000000003', 'Contato LGPD', '5531999991503');
insert into public.contato_clientes (contato_id, cliente_id) values
  ('15200000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001');
insert into public.conversas (id, telefone, contato_id, cliente_em_foco) values
  ('15100000-0000-0000-0000-000000000001', '5531999991501', '15200000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001');
insert into public.produtos (id, cliente_id, codigo, descricao) values
  ('15300000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', '12', 'Costela com preço'),
  ('15300000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', '77', 'Frango só no pedido'),
  ('15300000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000001', '99', 'Nunca usado');
insert into public.parceiros_grupos (id, cliente_id, tipo, nome) values
  ('15400000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'cliente', 'Supermercado Brasil'),
  ('15400000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'cliente', 'Rede Vazia');
insert into public.parceiros_unidades (id, cliente_id, grupo_id, nome_unidade) values
  ('15500000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', '15400000-0000-0000-0000-000000000001', 'Santa Efigênia'),
  ('15500000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', '15400000-0000-0000-0000-000000000001', 'Santa Matilde');
insert into public.precos (cliente_id, grupo_id, produto_id, valor) values
  ('15000000-0000-0000-0000-000000000001', '15400000-0000-0000-0000-000000000001', '15300000-0000-0000-0000-000000000001', 9.5);
-- Demanda aberta (pela conversa do contato, responsável Zeca) e pedido de venda concluído que usa a unidade e o produto 77.
insert into public.chamados (id, cliente_id, conversa_id, responsavel_id, titulo) values
  ('15600000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', '15100000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000015a5', 'Aberta');
insert into public.chamados (id, cliente_id, titulo, status, pedido_venda) values
  ('15600000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'Venda', 'concluido',
   jsonb_build_object('unidade_id', '15500000-0000-0000-0000-000000000001', 'itens', jsonb_build_array(jsonb_build_object('sku', '77'))));

-- 1. Colunas nas 6 tabelas.
select is((select count(*) from information_schema.columns where table_schema = 'public'
  and column_name in ('arquivado_em', 'arquivado_por')
  and table_name in ('clientes', 'contatos', 'produtos', 'parceiros_grupos', 'parceiros_unidades', 'usuarios'))::int, 12,
  'as 6 tabelas têm arquivado_em e arquivado_por');
-- 2 a 7. Fechadas ao público; o ajudante interno nem para quem entrou.
select ok(not has_function_privilege('anon', 'public.uso_do_cadastro(text, uuid)', 'execute'), 'visitante não consulta o uso');
select ok(not has_function_privilege('anon', 'public.arquivar_cadastro(text, uuid)', 'execute'), 'visitante não arquiva');
select ok(not has_function_privilege('anon', 'public.restaurar_cadastro(text, uuid)', 'execute'), 'visitante não restaura');
select ok(not has_function_privilege('anon', 'public.excluir_cadastro_definitivo(text, uuid)', 'execute'), 'visitante não exclui');
select ok(has_function_privilege('authenticated', 'public.excluir_cadastro_definitivo(text, uuid)', 'execute'), 'quem entrou chama a função (ela confere o papel)');
select ok(not has_function_privilege('authenticated', 'public.tabela_do_cadastro(text)', 'execute'), 'ajudante interno fechado');
-- 7b. O ajudante que confere a permissão também fica fechado (revisão final).
select ok(not (has_function_privilege('anon', 'public.exigir_arquivar(text)', 'execute')
  or has_function_privilege('authenticated', 'public.exigir_arquivar(text)', 'execute')
  or has_function_privilege('public', 'public.exigir_arquivar(text)', 'execute')), 'exigir_arquivar fechado para visitante, quem entrou e público');

set local role authenticated;

-- 8 a 10. Usuário inativo não tem permissões nem setores (spec 5.3) e não arquiva.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a4","role":"authenticated"}', true);
select is(public.tem_permissao('editar_clientes'), false, 'inativo não tem permissões');
select is((select count(*) from public.meus_setores())::int, 0, 'inativo não tem setores');
select throws_ok($$ select public.arquivar_cadastro('cliente', '15000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Sem permissão para arquivar cadastros.', 'inativo não arquiva');

-- 11 e 12. Atendente sem Editar clientes.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a3","role":"authenticated"}', true);
select throws_ok($$ select public.arquivar_cadastro('cliente', '15000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Sem permissão para arquivar cadastros.', 'sem editar_clientes não arquiva');
select throws_ok($$ select public.uso_do_cadastro('cliente', '15000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Sem permissão para arquivar cadastros.', 'sem editar_clientes não consulta o uso');

-- 13 a 21. Bia (editar_clientes).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a2","role":"authenticated"}', true);
select is(public.uso_do_cadastro('cliente', '15000000-0000-0000-0000-000000000001') -> 'contagens',
  '{"demandas":2,"conversas":1,"mensagens":0,"precos":1,"produtos":3,"redes":2,"unidades":2,"documentos":0,"contatos":1,"orientacoes":0}'::jsonb,
  'uso do cliente conta tudo o que está ligado');
select is(public.uso_do_cadastro('contato', '15200000-0000-0000-0000-000000000001') -> 'contagens',
  '{"conversas":1,"demandas":1,"precos_alterados":0}'::jsonb, 'uso do contato: conversas e demandas delas');
select is(public.uso_do_cadastro('produto', '15300000-0000-0000-0000-000000000002') -> 'contagens',
  '{"precos":0,"pedidos":1}'::jsonb, 'produto que só aparece num pedido de venda conta o pedido');
select is(public.uso_do_cadastro('rede', '15400000-0000-0000-0000-000000000001') -> 'contagens',
  '{"precos":1,"unidades":2,"pedidos":1}'::jsonb, 'rede: preços, unidades e pedidos das unidades');
select is(public.uso_do_cadastro('unidade', '15500000-0000-0000-0000-000000000001') -> 'contagens',
  '{"pedidos":1}'::jsonb, 'unidade: pedidos que a usam');
select throws_ok($$ select public.arquivar_cadastro('usuario', '00000000-0000-0000-0000-0000000015a6') $$,
  'P0001', 'Só o administrador arquiva pessoas.', 'editor não arquiva pessoas');
select throws_ok($$ select public.excluir_cadastro_definitivo('cliente', '15000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Só o administrador exclui de vez.', 'editor não exclui de vez');
select lives_ok($$ select public.arquivar_cadastro('cliente', '15000000-0000-0000-0000-000000000001') $$,
  'arquivar cliente com demanda aberta: avisa na tela, não bloqueia');
-- 20b. Arquivar de novo o que já está arquivado (dois cliques, duas abas) não muda nada.
select lives_ok($$ select public.arquivar_cadastro('cliente', '15000000-0000-0000-0000-000000000001') $$,
  'arquivar o que já está arquivado não quebra');
select lives_ok($$ update public.produtos set ativo = false where id = '15300000-0000-0000-0000-000000000003' $$,
  'desativar pelo ativo (caminho antigo) continua valendo');

reset role;
-- 22 a 24.
select ok((select not ativo and arquivado_em is not null and arquivado_por = '00000000-0000-0000-0000-0000000015a2'
  from public.clientes where id = '15000000-0000-0000-0000-000000000001'), 'arquivado: ativo = false, quando e quem');
select ok(exists (select 1 from public.auditoria_acessos where acao = 'arquivar' and entidade = 'clientes'
  and entidade_id = '15000000-0000-0000-0000-000000000001'), 'auditoria registra a ação de arquivar');
-- 23b e 23c. Uma linha só na auditoria, e quem/quando continuam os do primeiro arquivamento.
select is((select count(*) from public.auditoria_acessos where acao = 'arquivar' and entidade = 'clientes'
  and entidade_id = '15000000-0000-0000-0000-000000000001')::int, 1, 'arquivar de novo não repete a auditoria');
select ok((select arquivado_por = '00000000-0000-0000-0000-0000000015a2' from public.clientes
  where id = '15000000-0000-0000-0000-000000000001'), 'arquivar de novo não troca quem arquivou');
select ok((select arquivado_em is not null and arquivado_por = '00000000-0000-0000-0000-0000000015a2'
  from public.produtos where id = '15300000-0000-0000-0000-000000000003'), 'o gatilho grava quando e quem em qualquer mudança de ativo');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a2","role":"authenticated"}', true);
-- 25.
select lives_ok($$ select public.restaurar_cadastro('cliente', '15000000-0000-0000-0000-000000000001') $$, 'editor restaura');
reset role;
-- 26.
select ok((select ativo and arquivado_em is null and arquivado_por is null
  from public.clientes where id = '15000000-0000-0000-0000-000000000001'), 'restaurado: ativo e sem marcas de arquivo');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a1","role":"authenticated"}', true);
-- 27. As demandas abertas vêm com o número (o admin lê chamados).
select is(public.uso_do_cadastro('cliente', '15000000-0000-0000-0000-000000000001') -> 'abertas',
  (select jsonb_build_array(numero) from public.chamados where id = '15600000-0000-0000-0000-000000000001'),
  'uso traz os números das demandas abertas');
-- 28 a 32. Com qualquer contagem > 0, o banco recusa, mesmo que a tela deixe passar.
select throws_ok($$ select public.excluir_cadastro_definitivo('cliente', '15000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.', 'cliente com histórico não é excluído');
select throws_ok($$ select public.excluir_cadastro_definitivo('produto', '15300000-0000-0000-0000-000000000002') $$,
  'P0001', 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.', 'produto num pedido não é excluído');
select throws_ok($$ select public.excluir_cadastro_definitivo('unidade', '15500000-0000-0000-0000-000000000001') $$,
  'P0001', 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.', 'unidade num pedido não é excluída');
select throws_ok($$ select public.excluir_cadastro_definitivo('contato', '15200000-0000-0000-0000-000000000001') $$,
  'P0001', 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.', 'contato com conversa não é excluído');
select throws_ok($$ select public.excluir_cadastro_definitivo('usuario', '00000000-0000-0000-0000-0000000015a5') $$,
  'P0001', 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.', 'pessoa que atendeu não é excluída');
-- 33 a 36.
select throws_ok($$ select public.arquivar_cadastro('usuario', '00000000-0000-0000-0000-0000000015a1') $$,
  'P0001', 'Você não pode arquivar o próprio acesso.', 'ninguém arquiva a si mesmo');
select throws_ok($$ select public.excluir_cadastro_definitivo('usuario', '00000000-0000-0000-0000-0000000015a1') $$,
  'P0001', 'Você não pode excluir o próprio acesso.', 'ninguém exclui a si mesmo');
select throws_ok($$ select public.excluir_cadastro_definitivo('banana', '15000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Tipo de cadastro inválido.', 'tipo desconhecido é recusado');
select throws_ok($$ select public.excluir_cadastro_definitivo('cliente', '15000000-0000-0000-0000-0000000000ff') $$,
  'P0001', 'Cadastro não encontrado.', 'id inexistente é recusado');
-- 37 a 42. Nunca usados: o admin exclui de vez.
select lives_ok($$ select public.excluir_cadastro_definitivo('cliente', '15000000-0000-0000-0000-000000000002') $$, 'exclui cliente nunca usado');
select lives_ok($$ select public.excluir_cadastro_definitivo('produto', '15300000-0000-0000-0000-000000000003') $$, 'exclui produto nunca usado');
select lives_ok($$ select public.excluir_cadastro_definitivo('unidade', '15500000-0000-0000-0000-000000000002') $$, 'exclui unidade nunca usada');
select lives_ok($$ select public.excluir_cadastro_definitivo('rede', '15400000-0000-0000-0000-000000000002') $$, 'exclui rede vazia');
select lives_ok($$ select public.excluir_cadastro_definitivo('contato', '15200000-0000-0000-0000-000000000002') $$, 'exclui contato nunca usado');
select lives_ok($$ select public.excluir_cadastro_definitivo('usuario', '00000000-0000-0000-0000-0000000015a6') $$, 'exclui pessoa que nunca atendeu');
-- 43 a 45.
select lives_ok($$ select public.arquivar_cadastro('usuario', '00000000-0000-0000-0000-0000000015a5') $$,
  'admin arquiva pessoa com demanda aberta (avisa, não bloqueia)');
select lives_ok($$ select public.anonimizar_contato('15200000-0000-0000-0000-000000000003') $$, 'Apagar dados (LGPD) continua funcionando');
select throws_ok($$ select public.restaurar_cadastro('contato', '15200000-0000-0000-0000-000000000003') $$,
  'P0001', 'Os dados deste contato foram apagados (LGPD). Ele não volta.', 'contato anonimizado não volta');

reset role;
-- 46 e 47.
select is((select (select count(*) from public.clientes where id = '15000000-0000-0000-0000-000000000002')
  + (select count(*) from public.produtos where id = '15300000-0000-0000-0000-000000000003')
  + (select count(*) from public.parceiros_unidades where id = '15500000-0000-0000-0000-000000000002')
  + (select count(*) from public.parceiros_grupos where id = '15400000-0000-0000-0000-000000000002')
  + (select count(*) from public.contatos where id = '15200000-0000-0000-0000-000000000002')
  + (select count(*) from public.usuarios where id = '00000000-0000-0000-0000-0000000015a6'))::int, 0,
  'os seis excluídos de vez sumiram');
select ok(exists (select 1 from public.auditoria_acessos where acao = 'excluir_definitivo' and entidade = 'clientes'
  and entidade_id = '15000000-0000-0000-0000-000000000002' and detalhes -> 'antes' ->> 'razao_social' = 'Indústria Y'),
  'auditoria guarda o que foi excluído');

-- 48 e 49. Pessoa arquivada não entra: sem permissões e sem leitura.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a5","role":"authenticated"}', true);
select is(public.eh_usuario_ativo() or public.tem_permissao('editar_clientes'), false, 'arquivado não é usuário ativo');
select is((select count(*) from public.clientes)::int, 0, 'arquivado não lê cadastros');
reset role;

-- 50 a 56. Cadastrar de novo o telefone de um contato arquivado: volta sem os vínculos antigos (revisão final, I2).
insert into public.clientes (id, razao_social, cnpj) values ('15000000-0000-0000-0000-000000000003', 'Indústria W', '15150000000303');
insert into public.contatos (id, nome, telefone, ativo) values ('15200000-0000-0000-0000-000000000004', 'Zé Antigo', '5531999991504', false);
insert into public.contato_clientes (contato_id, cliente_id, pode_pedir_nota, pode_atualizar_preco) values
  ('15200000-0000-0000-0000-000000000004', '15000000-0000-0000-0000-000000000001', true, true),
  ('15200000-0000-0000-0000-000000000004', '15000000-0000-0000-0000-000000000003', false, true);
select ok(not has_function_privilege('anon', 'public.cadastrar_contato(text, text, uuid, boolean, uuid[])', 'execute'), 'visitante não cadastra contato');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a3","role":"authenticated"}', true);
select throws_ok($$ select public.cadastrar_contato('Zé', '5531999991504') $$,
  'P0001', 'Você não tem permissão para cadastrar contatos.', 'sem editar_clientes não cadastra contato');
-- Bia é editora, não administradora: mesmo assim os vínculos antigos saem.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a2","role":"authenticated"}', true);
select is(public.cadastrar_contato('Zé Voltou', '5531999991504', '15000000-0000-0000-0000-000000000003') - array['id', 'vinculos_mantidos'],
  '{"reativado":true,"vinculos_removidos":1}'::jsonb, 'arquivado volta; conta só os vínculos de outras empresas');
select is(public.cadastrar_contato('Contato Usado', '5531999991501', '15000000-0000-0000-0000-000000000003') - array['id', 'vinculos_mantidos'],
  '{"reativado":false,"vinculos_removidos":0}'::jsonb, 'contato ativo: nada sai');
select lives_ok($$ select public.cadastrar_contato('Contato Novo 2', '5531999991505', null, true) $$, 'telefone novo cadastra');
reset role;
select ok((select ativo and nome = 'Zé Voltou' and arquivado_em is null
    and not exists (select 1 from public.contato_clientes where contato_id = c.id)
  from public.contatos c where id = '15200000-0000-0000-0000-000000000004'),
  'o reativado volta sem nenhum vínculo antigo (o da ação é criado depois, sem as permissões velhas)');
select ok((select count(*) = 1 from public.contato_clientes where contato_id = '15200000-0000-0000-0000-000000000001')
  and (select ativo and agente_pausado from public.contatos where telefone = '5531999991505'),
  'ativo continua com os vínculos; o novo grava o agente desligado');

select * from finish();
rollback;
