-- supabase/tests/16_painel_v2_contato_volta.test.sql
-- Sobra 5 da Parte B (decisão do dono, 02/10): contato arquivado cadastrado de novo volta com as empresas escolhidas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Bia (editar_clientes) e Ana (sem permissão).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000016a1', 'bia16@pgtap.local'),
  ('00000000-0000-0000-0000-0000000016a2', 'ana16@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('00000000-0000-0000-0000-0000000016a1', 'Bia', 'bia16@pgtap.local', 'atendente', '{editar_clientes}'),
  ('00000000-0000-0000-0000-0000000016a2', 'Ana', 'ana16@pgtap.local', 'atendente', '{}');

-- W: empresa da ação. X e Y: empresas de antes, ativas. Z: empresa de antes, arquivada.
insert into public.clientes (id, razao_social, cnpj, ativo) values
  ('16000000-0000-0000-0000-000000000001', 'Indústria W', '16160000000101', true),
  ('16000000-0000-0000-0000-000000000002', 'Indústria X', '16160000000202', true),
  ('16000000-0000-0000-0000-000000000003', 'Indústria Y', '16160000000303', true),
  ('16000000-0000-0000-0000-000000000004', 'Indústria Z', '16160000000404', false);
insert into public.contatos (id, nome, telefone, ativo) values
  ('16200000-0000-0000-0000-000000000001', 'Zé Antigo', '5531999991601', false),
  ('16200000-0000-0000-0000-000000000002', 'Lu Antiga', '5531999991602', false),
  ('16200000-0000-0000-0000-000000000003', 'Lia Antiga', '5531999991603', false),
  ('16200000-0000-0000-0000-000000000004', 'Contato Ativo', '5531999991604', true),
  ('16200000-0000-0000-0000-000000000005', 'Contato removido', '5500123451605', false);
insert into public.contato_clientes (contato_id, cliente_id, pode_pedir_nota, pode_atualizar_preco) values
  ('16200000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', true, false),
  ('16200000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003', false, true),
  ('16200000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000004', true, false),
  ('16200000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000001', true, false),
  ('16200000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000002', false, true),
  ('16200000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000003', false, false),
  ('16200000-0000-0000-0000-000000000004', '16000000-0000-0000-0000-000000000002', false, false);
-- O contato 5 foi apagado pela LGPD (é o registro que anonimizar_contato deixa).
insert into public.auditoria_acessos (acao, entidade, entidade_id) values ('anonimizar', 'contatos', '16200000-0000-0000-0000-000000000005');

-- 1 a 3. Fechadas ao visitante; a versão antiga (4 argumentos) não existe mais.
select ok(not has_function_privilege('anon', 'public.cadastrar_contato(text, text, uuid, boolean, uuid[])', 'execute'), 'visitante não cadastra contato');
select ok(not has_function_privilege('anon', 'public.contato_arquivado_do_telefone(text)', 'execute'), 'visitante não consulta contato arquivado');
select hasnt_function('public', 'cadastrar_contato', array['text', 'text', 'uuid', 'boolean'], 'a assinatura antiga saiu (sem chamada ambígua)');

set local role authenticated;
-- 4 e 5. Sem editar_clientes não consulta nem cadastra.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016a2","role":"authenticated"}', true);
select throws_ok($$ select public.contato_arquivado_do_telefone('5531999991601') $$,
  'P0001', 'Você não tem permissão para cadastrar contatos.', 'sem permissão não consulta');
select throws_ok($$ select public.cadastrar_contato('Zé', '5531999991601') $$,
  'P0001', 'Você não tem permissão para cadastrar contatos.', 'sem permissão não cadastra');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016a1","role":"authenticated"}', true);
-- 6 a 10. A consulta que a tela usa para perguntar.
select is(
  (select jsonb_agg(v - 'razao_social' - 'nome_fantasia' order by v ->> 'cliente_id')
     from jsonb_array_elements(public.contato_arquivado_do_telefone('5531999991601') -> 'vinculos') v),
  '[{"cliente_id":"16000000-0000-0000-0000-000000000002","pode_pedir_nota":true,"pode_atualizar_preco":false},
    {"cliente_id":"16000000-0000-0000-0000-000000000003","pode_pedir_nota":false,"pode_atualizar_preco":true}]'::jsonb,
  'consulta: empresas de antes, só as ativas, com as marcações antigas');
select is(public.contato_arquivado_do_telefone('5531999991601') ->> 'nome', 'Zé Antigo', 'consulta: nome de antes');
select ok(public.contato_arquivado_do_telefone('5531999991604') is null, 'contato ativo: nada a perguntar');
select ok(public.contato_arquivado_do_telefone('5531999991699') is null, 'telefone livre: nada a perguntar');
select is(public.contato_arquivado_do_telefone('5500123451605') - 'id', '{"anonimizado":true,"vinculos":[]}'::jsonb,
  'contato apagado (LGPD): a consulta diz isso e não mostra nome nem empresas');

-- 11 a 15. O cadastro.
-- Zé: volta na W; marcou Y, Z (arquivada) e um id sem vínculo. Só Y volta; X e Z saem.
select is(public.cadastrar_contato('Zé Voltou', '5531999991601', '16000000-0000-0000-0000-000000000001', null,
    array['16000000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000004', '16000000-0000-0000-0000-0000000000ff']::uuid[]) - 'id',
  '{"reativado":true,"vinculos_removidos":2,"vinculos_mantidos":1}'::jsonb,
  'volta só a empresa escolhida que já era vínculo e está ativa');
-- Contato ativo: a lista é ignorada (alguém o cadastrou entre a pergunta e o clique).
select is(public.cadastrar_contato('Contato Ativo', '5531999991604', '16000000-0000-0000-0000-000000000001', null,
    array['16000000-0000-0000-0000-000000000003']::uuid[]) - 'id',
  '{"reativado":false,"vinculos_removidos":0,"vinculos_mantidos":0}'::jsonb, 'contato ativo: nada muda');
-- Lia: chamada por nome sem p_manter, como o painel da Parte B (homologação) chama.
select is(public.cadastrar_contato(p_nome => 'Lia Voltou', p_telefone => '5531999991603', p_cliente => null::uuid, p_agente_pausado => null::boolean) - 'id',
  '{"reativado":true,"vinculos_removidos":1,"vinculos_mantidos":0}'::jsonb, 'sem a lista: nenhuma empresa antiga volta (como antes)');
-- Lu: a empresa da ação (W) também era vínculo antigo; marcou W e X. X volta; W é recriada pela tela com as marcações novas.
select is(public.cadastrar_contato('Lu Voltou', '5531999991602', '16000000-0000-0000-0000-000000000001', null,
    array['16000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002']::uuid[]) - 'id',
  '{"reativado":true,"vinculos_removidos":0,"vinculos_mantidos":1}'::jsonb, 'a empresa da ação não conta como mantida nem removida');
select throws_ok($$ select public.cadastrar_contato('Volta', '5500123451605') $$,
  'P0001', 'Os dados deste contato foram apagados (LGPD). Ele não volta.', 'contato apagado (LGPD) não volta pelo cadastro');
reset role;

-- 16 a 21. O que ficou gravado.
select is((select jsonb_build_object('ativo', ativo, 'nome', nome, 'vinculos',
    (select jsonb_agg(jsonb_build_object('cliente_id', cliente_id, 'nota', pode_pedir_nota, 'preco', pode_atualizar_preco))
       from public.contato_clientes where contato_id = c.id))
  from public.contatos c where id = '16200000-0000-0000-0000-000000000001'),
  '{"ativo":true,"nome":"Zé Voltou","vinculos":[{"cliente_id":"16000000-0000-0000-0000-000000000003","nota":false,"preco":true}]}'::jsonb,
  'Zé: ativo, nome novo e só Y, com as marcações antigas');
select is((select jsonb_build_object('usuario', usuario_id, 'empresa_nova', detalhes -> 'empresa_nova', 'mantidos', detalhes -> 'mantidos',
    'removidos', (select jsonb_agg(r order by r) from jsonb_array_elements_text(detalhes -> 'removidos') r))
  from public.auditoria_acessos where acao = 'reativar_contato' and entidade_id = '16200000-0000-0000-0000-000000000001'),
  jsonb_build_object('usuario', '00000000-0000-0000-0000-0000000016a1', 'empresa_nova', '16000000-0000-0000-0000-000000000001',
    'mantidos', '["16000000-0000-0000-0000-000000000003"]'::jsonb,
    'removidos', '["16000000-0000-0000-0000-000000000002","16000000-0000-0000-0000-000000000004"]'::jsonb),
  'auditoria registra quem trouxe de volta, o que ficou e o que saiu');
select is((select count(*)::int from public.contato_clientes where contato_id = '16200000-0000-0000-0000-000000000004'), 1,
  'contato ativo continua com o vínculo que tinha');
select ok((select ativo and not exists (select 1 from public.contato_clientes where contato_id = c.id)
  from public.contatos c where id = '16200000-0000-0000-0000-000000000003'), 'Lia volta sem empresas');
select is((select jsonb_agg(jsonb_build_object('cliente_id', cliente_id, 'preco', pode_atualizar_preco))
  from public.contato_clientes where contato_id = '16200000-0000-0000-0000-000000000002'),
  '[{"cliente_id":"16000000-0000-0000-0000-000000000002","preco":true}]'::jsonb,
  'Lu: só X fica (a W é recriada pela tela)');
select ok((select not ativo from public.contatos where id = '16200000-0000-0000-0000-000000000005'), 'o contato apagado continua fora');

select * from finish();
rollback;
