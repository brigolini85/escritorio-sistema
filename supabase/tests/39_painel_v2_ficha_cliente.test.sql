-- Parte H1, Task 1 (spec 7D.1): ficha completa do cliente. Só acréscimos: o endereço antigo continua, a cópia não
-- sobrescreve nada, a aba inteira salva numa chamada com a regra de quem chama, e "Só ver" não grava.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email) values
  ('e8100000-0000-0000-0000-00000000000a', 'admin@h1.local'),
  ('e8100000-0000-0000-0000-00000000000b', 'bia@h1.local'),
  ('e8100000-0000-0000-0000-00000000000c', 'ana@h1.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e8100000-0000-0000-0000-00000000000a', 'Admin H1', 'admin@h1.local', 'admin', '{}'),
  ('e8100000-0000-0000-0000-00000000000b', 'Bia H1', 'bia@h1.local', 'atendente', '{editar_clientes}'),
  ('e8100000-0000-0000-0000-00000000000c', 'Ana H1', 'ana@h1.local', 'atendente', '{}');
insert into public.setores (id, nome) values ('e8400000-0000-0000-0000-000000000001', 'H1 Fiscal');
insert into public.servicos (id, nome) values ('e8200000-0000-0000-0000-000000000001', 'H1 Contábil');
-- Antigo: só o endereço de hoje. Já Tem: já tem logradouro (o gatilho monta o endereço por extenso).
insert into public.clientes (id, razao_social, cnpj, endereco) values
  ('e8300000-0000-0000-0000-00000000000a', 'H1 Antigo Ltda', '11222333000181', 'Rua Antiga, 10 - Centro, Belo Horizonte');
insert into public.clientes (id, razao_social, cnpj, endereco, logradouro) values
  ('e8300000-0000-0000-0000-00000000000b', 'H1 Já Tem Ltda', '11444777000161', 'Texto velho', 'Rua Nova');

-- 1–7: estrutura, cópia do endereço e endereço por extenso
select has_table('public', 'cliente_inscricoes_st', 'tabela de inscrições de substituto tributário');
select has_column('public', 'clientes', 'endereco', 'o endereço antigo continua (nada sai)');
select is((select endereco from public.clientes where id = 'e8300000-0000-0000-0000-00000000000b'), 'Rua Nova',
  'com logradouro, endereco vira o endereço por extenso (D11)');
select ok(public.copiar_endereco_para_logradouro() >= 1, 'a cópia preenche quem só tinha o endereço antigo');
select results_eq(
  $$ select logradouro, endereco from public.clientes where id = 'e8300000-0000-0000-0000-00000000000a' $$,
  $$ values ('Rua Antiga, 10 - Centro, Belo Horizonte'::text, 'Rua Antiga, 10 - Centro, Belo Horizonte'::text) $$,
  'antigo: copiado inteiro para Logradouro (D12) e o endereço continua igual');
select is((select logradouro from public.clientes where id = 'e8300000-0000-0000-0000-00000000000b'), 'Rua Nova',
  'logradouro já preenchido não é sobrescrito');
select is(public.montar_endereco('Rua Rosa Figueiredo', '430', 'loja 2', 'São Marcos', 'Conselheiro Lafaiete', 'MG', '36404450'),
  'Rua Rosa Figueiredo, 430, loja 2 - São Marcos, Conselheiro Lafaiete/MG, CEP 36404-450', 'endereço por extenso como na imagem');

-- 8–13: gatilho e checagens de formato (só valem quando há valor)
update public.clientes set logradouro = 'Rua Antiga', numero = '10', bairro = 'Centro', cidade = 'Belo Horizonte', uf = 'MG', cep = '30110000'
 where id = 'e8300000-0000-0000-0000-00000000000a';
select is((select endereco from public.clientes where id = 'e8300000-0000-0000-0000-00000000000a'),
  'Rua Antiga, 10 - Centro, Belo Horizonte/MG, CEP 30110-000', 'mudou o endereço: o por extenso acompanha');
select throws_ok($$ update public.clientes set cep = '3011' where id = 'e8300000-0000-0000-0000-00000000000a' $$, '23514', null, 'CEP precisa de 8 números');
select throws_ok($$ update public.clientes set segmentos = '{atacado}' where id = 'e8300000-0000-0000-0000-00000000000a' $$, '23514', null, 'segmento desconhecido é recusado');
select throws_ok($$ update public.clientes set uf = 'XX' where id = 'e8300000-0000-0000-0000-00000000000a' $$, '23514', null, 'UF nova fora da lista é recusada');
select ok(not has_function_privilege('anon', 'public.salvar_ficha_cliente(uuid, jsonb)', 'execute'), 'visitante não salva ficha');
select ok(not has_function_privilege('authenticated', 'public.copiar_endereco_para_logradouro()', 'execute'), 'a cópia é só da migração');

-- 14–16: Ana ("Só ver") não grava nada, nem pela função
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e8100000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_ficha_cliente(null, '{"razao_social":"X Ltda","cnpj":"12345678000195"}') $$,
  'P0001', 'Você não tem permissão para editar clientes.', '"Só ver" não salva a ficha (D14)');
select throws_ok($$ insert into public.cliente_inscricoes_st (cliente_id, uf, inscricao) values ('e8300000-0000-0000-0000-00000000000a', 'SP', '1') $$,
  '42501', null, '"Só ver" não grava inscrição ST');
select is(public.ultima_alteracao_cliente('e8300000-0000-0000-0000-00000000000a'), null, 'mudança sem pessoa (migração, testes) não conta');

-- 17–21: Bia ("Ver e editar") cria a ficha completa numa chamada
select set_config('request.jwt.claims', '{"sub":"e8100000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_ficha_cliente(null, '{
  "razao_social": "H1 Padaria Sol Comércio de Alimentos ME", "nome_fantasia": "H1 Padaria Sol", "cnpj": "12345678000195",
  "tipo_pessoa": "juridica", "isento_ie": false, "inscricao_estadual": "0037486930064", "regime": "Simples Nacional", "porte": "me",
  "faturamento_ultimo_ano": 820000, "funcionarios": 8, "segmentos": ["industria", "comercio"],
  "cep": "36404450", "logradouro": "Rua Rosa Figueiredo", "numero": "430", "complemento": "loja 2", "bairro": "São Marcos",
  "cidade": "Conselheiro Lafaiete", "uf": "MG", "telefone": "31987800133", "email": "contato@padariasol.com.br",
  "email_cobranca": "financeiro@padariasol.com.br", "contrato_inicio": "2022-03-01", "honorario_mensal": 1250, "dia_vencimento": 10,
  "reajuste": "anual", "reajuste_mes": 3, "decimo_terceiro": true, "certificado_tipo": "e_cnpj_a1", "certificado_vencimento": "2030-10-25",
  "certificado_avisar_dias": 30, "servicos": ["e8200000-0000-0000-0000-000000000001"],
  "responsaveis": {"e8400000-0000-0000-0000-000000000001": "e8100000-0000-0000-0000-00000000000b"},
  "inscricoes_st": [{"uf": "SP", "inscricao": "123456789110"}, {"uf": "rj", "inscricao": null}]}') $$,
  'Bia cria a ficha completa numa chamada');
select results_eq(
  $$ select razao_social, honorario_mensal, segmentos, contrato_inicio, reajuste, reajuste_mes, decimo_terceiro, certificado_tipo, email_cobranca
     from public.clientes where cnpj = '12345678000195' $$,
  $$ values ('H1 Padaria Sol Comércio de Alimentos ME'::text, 1250.00::numeric(12, 2), '{comercio,industria}'::text[], '2022-03-01'::date,
             'anual'::text, 3::smallint, true, 'e_cnpj_a1'::text, 'financeiro@padariasol.com.br'::text) $$,
  'campos novos gravados (segmentos em ordem, sem repetir)');
select is((select endereco from public.clientes where cnpj = '12345678000195'),
  'Rua Rosa Figueiredo, 430, loja 2 - São Marcos, Conselheiro Lafaiete/MG, CEP 36404-450', 'o agente lê o endereço por extenso');
select results_eq(
  $$ select uf::text, inscricao from public.cliente_inscricoes_st
     where cliente_id = (select id from public.clientes where cnpj = '12345678000195') order by uf $$,
  $$ values ('RJ'::text, null::text), ('SP'::text, '123456789110'::text) $$,
  'inscrições ST: UF em maiúsculas; linha sem inscrição fica (vira pendência na tela)');
select results_eq(
  $$ select (select count(*)::int from public.cliente_servicos where cliente_id = c.id),
            (select usuario_id from public.cliente_responsaveis where cliente_id = c.id and setor_id = 'e8400000-0000-0000-0000-000000000001')
     from public.clientes c where c.cnpj = '12345678000195' $$,
  $$ values (1, 'e8100000-0000-0000-0000-00000000000b'::uuid) $$,
  'serviços e responsáveis na mesma chamada');

-- 22–25: salvar de novo troca as listas; a pausa do agente só muda quando vem; UF repetida e razão vazia recusam
reset role;
update public.clientes set agente_pausado = true where cnpj = '12345678000195';
set local role authenticated;
select lives_ok($$ select public.salvar_ficha_cliente((select id from public.clientes where cnpj = '12345678000195'), '{
  "razao_social": "H1 Padaria Sol Comércio de Alimentos ME", "cnpj": "12345678000195", "segmentos": ["comercio"],
  "servicos": [], "responsaveis": {"e8400000-0000-0000-0000-000000000001": null},
  "inscricoes_st": [{"uf": "SP", "inscricao": "123456789110"}]}') $$,
  'Bia salva de novo, sem serviços, sem responsável e só SP');
select results_eq(
  $$ select (select count(*)::int from public.cliente_inscricoes_st where cliente_id = c.id),
            (select count(*)::int from public.cliente_servicos where cliente_id = c.id),
            (select count(*)::int from public.cliente_responsaveis where cliente_id = c.id),
            c.agente_pausado
     from public.clientes c where c.cnpj = '12345678000195' $$,
  $$ values (1, 0, 0, true) $$,
  'as listas trocam inteiras; sem a chave agente_pausado, a pausa fica como estava (D14)');
select throws_ok($$ select public.salvar_ficha_cliente(null, '{"razao_social":"H1 Repetida","cnpj":"17170000000132",
  "inscricoes_st":[{"uf":"SP","inscricao":"1"},{"uf":"sp","inscricao":"2"}]}') $$,
  'P0001', 'UF repetida nas inscrições de substituto tributário.', 'UF repetida recusa a ficha inteira');
select throws_ok($$ select public.salvar_ficha_cliente(null, '{"razao_social":" ","cnpj":"17170000000132"}') $$,
  'P0001', 'Informe a razão social.', 'razão social continua obrigatória (D9)');

-- 26–27: última alteração (só nome e hora) para quem vê a ficha
select set_config('request.jwt.claims', '{"sub":"e8100000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.ultima_alteracao_cliente((select id from public.clientes where cnpj = '12345678000195')) ->> 'pessoa', 'Bia H1',
  'Ana ("Só ver") lê quem mudou por último');
reset role;
select ok(not has_function_privilege('anon', 'public.ultima_alteracao_cliente(uuid)', 'execute'), 'visitante não lê a última alteração');

select * from finish();
rollback;
