-- Parte H2, Task 1 (spec 7D.2): acesso por contato e por empresa. Contato novo nasce Básico; salvar grava setores e
-- marcações numa transação, com a permissão de hoje; caminho antigo que muda nota/preço vira Personalizado (D6).
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email) values
  ('f4200000-0000-0000-0000-00000000000a', 'admin@h2a.local'),
  ('f4200000-0000-0000-0000-00000000000b', 'bia@h2a.local'),
  ('f4200000-0000-0000-0000-00000000000c', 'ze@h2a.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('f4200000-0000-0000-0000-00000000000a', 'Admin H2A', 'admin@h2a.local', 'admin', '{}'),
  ('f4200000-0000-0000-0000-00000000000b', 'Bia H2A', 'bia@h2a.local', 'atendente', '{editar_clientes}'),
  ('f4200000-0000-0000-0000-00000000000c', 'Zé H2A', 'ze@h2a.local', 'atendente', '{}');
insert into public.clientes (id, razao_social, cnpj) values
  ('f4300000-0000-0000-0000-00000000000a', 'H2A Rede Bom Preço Ltda', '11222333000181'),
  ('f4300000-0000-0000-0000-00000000000b', 'H2A Padaria Sol ME', '11444777000161');
insert into public.contatos (id, nome, telefone) values
  ('f4400000-0000-0000-0000-00000000000a', 'H2A Carla Mendes', '5511977772211'),
  ('f4400000-0000-0000-0000-00000000000b', 'H2A Roberto Faria', '5511988880001');
insert into public.contato_clientes (contato_id, cliente_id) values
  ('f4400000-0000-0000-0000-00000000000a', 'f4300000-0000-0000-0000-00000000000a'),
  ('f4400000-0000-0000-0000-00000000000a', 'f4300000-0000-0000-0000-00000000000b');
-- Contato novo com "pode pedir nota" marcado no cadastro (ficha, Atendimento): continua Básico (D6).
insert into public.contato_clientes (contato_id, cliente_id, pode_pedir_nota) values
  ('f4400000-0000-0000-0000-00000000000b', 'f4300000-0000-0000-0000-00000000000a', true);

-- 1–9: estrutura e padrões
select has_column('public', 'contatos', 'cargo', 'contato tem cargo');
select has_column('public', 'contatos', 'email', 'contato tem e-mail');
select col_default_is('public', 'contato_clientes', 'perfil', 'basico', 'perfil padrão: Básico');
select is((select perfil from public.contato_clientes where contato_id = 'f4400000-0000-0000-0000-00000000000a'
           and cliente_id = 'f4300000-0000-0000-0000-00000000000a'), 'basico', 'contato novo nasce Básico');
select is((select perfil from public.contato_clientes where contato_id = 'f4400000-0000-0000-0000-00000000000b'), 'basico',
  'nasce Básico mesmo com "pode pedir nota" marcado (D6)');
select is((select (ver_valores, receber_documentos, recebe_alertas_acesso, avisar_documento_novo)::text from public.contato_clientes
           where contato_id = 'f4400000-0000-0000-0000-00000000000a' and cliente_id = 'f4300000-0000-0000-0000-00000000000a'),
  '(f,f,f,{})', 'nada liberado por padrão');
select has_column('public', 'documentos_empresa', 'setor_id', 'documento tem setor (spec 7D.2)');
select col_default_is('public', 'documentos_empresa', 'tem_valores', 'false', 'documento sem valores por padrão (D11)');
select throws_ok($$ update public.contato_clientes set avisar_documento_novo = '{sms}'
                    where contato_id = 'f4400000-0000-0000-0000-00000000000b' $$, '23514', null, 'aviso só por WhatsApp ou e-mail');

-- 10–12: privilégios (D1)
select ok(not has_table_privilege('authenticated', 'public.contato_cliente_setores', 'insert'), 'setores: escrita só pela função');
select ok(has_table_privilege('authenticated', 'public.contato_cliente_setores', 'select'), 'setores: a equipe lê');
select ok(not has_function_privilege('anon', 'public.salvar_acesso_contato(uuid, uuid, jsonb)', 'execute'), 'visitante não salva');

-- 13–22: Bia ("Ver e editar") salva o acesso da Carla na Rede
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f4200000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_acesso_contato('f4400000-0000-0000-0000-00000000000a', 'f4300000-0000-0000-0000-00000000000a',
  jsonb_build_object('perfil', 'compras_vendas',
    'setores', jsonb_build_array(jsonb_build_object('setor_id', (select id from public.setores where nome = 'Fiscal'), 'pode_ser_procurado', true)),
    'pode_pedir_nota', true, 'pode_atualizar_preco', true, 'ver_valores', false, 'receber_documentos', true,
    'avisar_documento_novo', jsonb_build_array('whatsapp', 'whatsapp'), 'recebe_alertas_acesso', false,
    'contato', jsonb_build_object('nome', 'H2A Carla Mendes', 'cargo', ' Compras ', 'email', 'Carla@BomPreco.com.br'))) $$,
  'Bia salva o acesso');
select results_eq(
  $$ select s.nome, cs.pode_ser_procurado from public.contato_cliente_setores cs join public.setores s on s.id = cs.setor_id
     where cs.contato_id = 'f4400000-0000-0000-0000-00000000000a' and cs.cliente_id = 'f4300000-0000-0000-0000-00000000000a' $$,
  $$ values ('Fiscal'::text, true) $$, 'setor Fiscal com "pode ser procurado"');
select is((select (perfil, pode_pedir_nota, pode_atualizar_preco, ver_valores, receber_documentos, avisar_documento_novo)::text
           from public.contato_clientes where contato_id = 'f4400000-0000-0000-0000-00000000000a' and cliente_id = 'f4300000-0000-0000-0000-00000000000a'),
  '(compras_vendas,t,t,f,t,{whatsapp})', 'marcações gravadas; canal repetido vira um');
select is((select (cargo, email)::text from public.contatos where id = 'f4400000-0000-0000-0000-00000000000a'),
  '(Compras,carla@bompreco.com.br)', 'cargo sem espaços e e-mail em minúsculas');
select is((select perfil from public.contato_clientes where contato_id = 'f4400000-0000-0000-0000-00000000000a'
           and cliente_id = 'f4300000-0000-0000-0000-00000000000b'), 'basico', 'a mesma pessoa continua Básico na outra empresa');
-- Troca: tira o Fiscal, põe Pessoal sem "procurado"; o "procurado" do Fiscal some junto (D30).
select lives_ok($$ select public.salvar_acesso_contato('f4400000-0000-0000-0000-00000000000a', 'f4300000-0000-0000-0000-00000000000a',
  jsonb_build_object('perfil', 'personalizado',
    'setores', jsonb_build_array(jsonb_build_object('setor_id', (select id from public.setores where nome = 'Pessoal'), 'pode_ser_procurado', false)),
    'pode_pedir_nota', false, 'pode_atualizar_preco', false, 'ver_valores', true, 'receber_documentos', true,
    'avisar_documento_novo', '[]'::jsonb, 'recebe_alertas_acesso', false)) $$, 'salvar de novo troca os setores');
select results_eq(
  $$ select s.nome from public.contato_cliente_setores cs join public.setores s on s.id = cs.setor_id
     where cs.contato_id = 'f4400000-0000-0000-0000-00000000000a' and cs.cliente_id = 'f4300000-0000-0000-0000-00000000000a' $$,
  $$ values ('Pessoal'::text) $$, 'só o Pessoal ficou');
select is((select cargo from public.contatos where id = 'f4400000-0000-0000-0000-00000000000a'), 'Compras',
  'sem a chave "contato", nome, cargo e e-mail não mudam');
select throws_ok($$ select public.salvar_acesso_contato('f4400000-0000-0000-0000-00000000000a', 'f4300000-0000-0000-0000-00000000000a',
  jsonb_build_object('perfil', 'chefe', 'setores', '[]'::jsonb)) $$, 'P0001', 'Perfil inválido.', 'perfil fora da lista');
select throws_ok($$ select public.salvar_acesso_contato('f4400000-0000-0000-0000-00000000000a', 'f4300000-0000-0000-0000-00000000000a',
  jsonb_build_object('perfil', 'personalizado', 'setores', jsonb_build_array(jsonb_build_object('setor_id', gen_random_uuid())))) $$,
  'P0001', 'Setor inválido ou desativado.', 'setor que não existe');

-- 23–26: recusas
select throws_ok($$ select public.salvar_acesso_contato('f4400000-0000-0000-0000-00000000000b', 'f4300000-0000-0000-0000-00000000000b',
  jsonb_build_object('perfil', 'basico', 'setores', '[]'::jsonb)) $$, 'P0001', 'Este contato não está mais ligado a esta empresa.', 'vínculo que não existe');
select throws_ok($$ insert into public.contato_cliente_setores (contato_id, cliente_id, setor_id)
  values ('f4400000-0000-0000-0000-00000000000b', 'f4300000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Fiscal')) $$,
  '42501', null, 'Bia não escreve na tabela de setores direto');
select set_config('request.jwt.claims', '{"sub":"f4200000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_acesso_contato('f4400000-0000-0000-0000-00000000000a', 'f4300000-0000-0000-0000-00000000000a',
  jsonb_build_object('perfil', 'basico', 'setores', '[]'::jsonb)) $$, 'P0001', 'Você não tem permissão para editar contatos.', 'Zé ("Só ver") não salva');
reset role;
update public.contatos set ativo = false where id = 'f4400000-0000-0000-0000-00000000000b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f4200000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_acesso_contato('f4400000-0000-0000-0000-00000000000b', 'f4300000-0000-0000-0000-00000000000a',
  jsonb_build_object('perfil', 'basico', 'setores', '[]'::jsonb)) $$, 'P0001', 'Contato arquivado: restaure para mudar as marcações.', 'contato arquivado não muda');
reset role;
update public.contatos set ativo = true where id = 'f4400000-0000-0000-0000-00000000000b';

-- 27–29: gatilho dos caminhos antigos (D6)
update public.contato_clientes set perfil = 'compras_vendas'
 where contato_id = 'f4400000-0000-0000-0000-00000000000a' and cliente_id = 'f4300000-0000-0000-0000-00000000000b';
update public.contato_clientes set pode_pedir_nota = true
 where contato_id = 'f4400000-0000-0000-0000-00000000000a' and cliente_id = 'f4300000-0000-0000-0000-00000000000b';
select is((select perfil from public.contato_clientes where contato_id = 'f4400000-0000-0000-0000-00000000000a'
           and cliente_id = 'f4300000-0000-0000-0000-00000000000b'), 'personalizado', 'mudar nota por fora vira Personalizado');
update public.contato_clientes set pode_atualizar_preco = true where contato_id = 'f4400000-0000-0000-0000-00000000000b';
select is((select perfil from public.contato_clientes where contato_id = 'f4400000-0000-0000-0000-00000000000b'), 'basico',
  'Básico continua Básico (aguardando os setores)');
select ok(exists (select 1 from public.auditoria_acessos where entidade = 'contato_cliente_setores'
  and usuario_id = 'f4200000-0000-0000-0000-00000000000b'), 'mudança de setor fica na auditoria com quem fez');

-- 30–32: LGPD (D25)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f4200000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.anonimizar_contato('f4400000-0000-0000-0000-00000000000a') $$, 'admin apaga os dados da Carla');
reset role;
select is((select (cargo, email)::text from public.contatos where id = 'f4400000-0000-0000-0000-00000000000a'), '(,)',
  'cargo e e-mail apagados');
select ok(not exists (select 1 from public.auditoria_acessos where entidade = 'contato_cliente_setores'
  and detalhes::text like '%f4400000-0000-0000-0000-00000000000a%'), 'auditoria dos setores dela apagada');

-- 33: Direção nunca entra no acesso do contato (D5; revisão de segurança, rodada 1)
insert into public.setores (nome, descricao_assuntos) values ('Direção', 'Assuntos sensíveis') on conflict (nome) do nothing;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f4200000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_acesso_contato('f4400000-0000-0000-0000-00000000000b', 'f4300000-0000-0000-0000-00000000000a',
  jsonb_build_object('perfil', 'personalizado',
    'setores', jsonb_build_array(jsonb_build_object('setor_id', (select id from public.setores where nome = 'Direção'))))) $$,
  'P0001', 'A Direção não entra no acesso do contato.', 'Direção não é setor que o contato trata');
reset role;

select * from finish();
rollback;
