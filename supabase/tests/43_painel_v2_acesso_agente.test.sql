-- Parte H2, Task 2 (spec 7D.2 e 7D.3): o que o agente lê passa pelo acesso do contato. Básico não lê documentos nem
-- demandas; o filtro é por setor e por empresa; pedido fora do acesso conta um por contato, empresa, setor e dia.
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

create function pg_temp.setor(p text) returns uuid language sql stable as $$ select id from public.setores where nome = p $$;

insert into public.clientes (id, razao_social, cnpj) values
  ('f5300000-0000-0000-0000-00000000000a', 'H2B Rede Bom Preço Ltda', '11222333000181'),
  ('f5300000-0000-0000-0000-00000000000b', 'H2B Padaria Sol ME', '11444777000161');
insert into public.contatos (id, nome, telefone) values
  ('f5400000-0000-0000-0000-00000000000a', 'Carla Mendes', '5511977772211'),
  ('f5400000-0000-0000-0000-00000000000b', 'Roberto Faria', '5511988880001'),
  ('f5400000-0000-0000-0000-00000000000c', 'Bia Nova', '5511955557788'),
  ('f5400000-0000-0000-0000-00000000000d', 'Patrícia Gomes', '5511966661020');
insert into public.contato_clientes (contato_id, cliente_id, perfil, pode_pedir_nota, pode_atualizar_preco, ver_valores, receber_documentos, recebe_alertas_acesso) values
  ('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a', 'compras_vendas', true, true, false, true, false),
  ('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000b', 'basico', false, false, false, false, false),
  ('f5400000-0000-0000-0000-00000000000b', 'f5300000-0000-0000-0000-00000000000a', 'socio', true, true, true, true, true),
  ('f5400000-0000-0000-0000-00000000000c', 'f5300000-0000-0000-0000-00000000000a', 'basico', false, false, false, false, false),
  ('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a', 'rh_dp', false, false, true, true, false);
insert into public.contato_cliente_setores (contato_id, cliente_id, setor_id, pode_ser_procurado) values
  ('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a', pg_temp.setor('Fiscal'), true),
  ('f5400000-0000-0000-0000-00000000000b', 'f5300000-0000-0000-0000-00000000000a', pg_temp.setor('Fiscal'), true),
  ('f5400000-0000-0000-0000-00000000000b', 'f5300000-0000-0000-0000-00000000000a', pg_temp.setor('Pessoal'), true),
  ('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a', pg_temp.setor('Pessoal'), true),
  -- Linha "sobrando" num Básico (gravada por fora): não pode valer.
  ('f5400000-0000-0000-0000-00000000000c', 'f5300000-0000-0000-0000-00000000000a', pg_temp.setor('Fiscal'), true);
insert into public.documentos_empresa (cliente_id, nome, arquivo_path, arquivo_nome, ia_pode_enviar, setor_id, tem_valores) values
  ('f5300000-0000-0000-0000-00000000000a', 'Contrato social', 'c/a/contrato.pdf', 'contrato.pdf', true, null, false),
  ('f5300000-0000-0000-0000-00000000000a', 'Certidão negativa federal', 'c/a/cnd.pdf', 'cnd.pdf', true, pg_temp.setor('Fiscal'), false),
  ('f5300000-0000-0000-0000-00000000000a', 'Folha de setembro', 'c/a/folha.pdf', 'folha.pdf', true, pg_temp.setor('Pessoal'), true),
  ('f5300000-0000-0000-0000-00000000000a', 'Recibo do eSocial', 'c/a/recibo.pdf', 'recibo.pdf', false, pg_temp.setor('Pessoal'), false),
  ('f5300000-0000-0000-0000-00000000000b', 'Contrato social da Padaria', 'c/b/contrato.pdf', 'contrato.pdf', true, null, false);
insert into public.conversas (id, telefone, contato_id) values
  ('f5500000-0000-0000-0000-00000000000a', '5511977772211', 'f5400000-0000-0000-0000-00000000000a'),
  ('f5500000-0000-0000-0000-00000000000b', '5511955557788', 'f5400000-0000-0000-0000-00000000000c');
insert into public.chamados (cliente_id, conversa_id, setor_id, titulo) values
  ('f5300000-0000-0000-0000-00000000000a', null, pg_temp.setor('Fiscal'), 'Guia do DAS de setembro'),
  ('f5300000-0000-0000-0000-00000000000a', null, pg_temp.setor('Pessoal'), 'Admissão do João'),
  ('f5300000-0000-0000-0000-00000000000a', 'f5500000-0000-0000-0000-00000000000a', null, 'Triagem da Carla'),
  ('f5300000-0000-0000-0000-00000000000a', 'f5500000-0000-0000-0000-00000000000b', null, 'Triagem da Bia'),
  ('f5300000-0000-0000-0000-00000000000b', null, pg_temp.setor('Fiscal'), 'Guia da Padaria');

-- 1–5: acesso_do_contato
select is(public.acesso_do_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a') ->> 'perfil', 'compras_vendas', 'Carla na Rede: Compras/Vendas');
select is(public.acesso_do_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a') -> 'setores',
  jsonb_build_array(jsonb_build_object('id', pg_temp.setor('Fiscal'), 'nome', 'Fiscal', 'pode_ser_procurado', true)), 'Carla na Rede: só o Fiscal, procurado');
select is(public.acesso_do_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000b') -> 'setores', '[]'::jsonb,
  'a mesma Carla na Padaria: Básico, sem setores (por empresa)');
select is(public.acesso_do_contato('f5400000-0000-0000-0000-00000000000c', 'f5300000-0000-0000-0000-00000000000a') -> 'setores', '[]'::jsonb,
  'Básico nunca tem setores, mesmo com linha gravada por fora');
select is(public.acesso_do_contato('f5400000-0000-0000-0000-00000000000b', 'f5300000-0000-0000-0000-00000000000b'), null, 'sem vínculo: nada');

-- 6–11: documentos_para_contato
select results_eq($$ select nome from public.documentos_para_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a') $$,
  $$ values ('Certidão negativa federal'::text), ('Contrato social'::text) $$, 'Carla: o do Fiscal e o da empresa; nada do Pessoal');
select results_eq($$ select nome from public.documentos_para_contato('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a') $$,
  $$ values ('Contrato social'::text), ('Folha de setembro'::text), ('Recibo do eSocial'::text) $$, 'Patrícia (RH, vê valores): Pessoal e o da empresa');
update public.contato_clientes set ver_valores = false where contato_id = 'f5400000-0000-0000-0000-00000000000d';
select results_eq($$ select nome from public.documentos_para_contato('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a') $$,
  $$ values ('Contrato social'::text), ('Recibo do eSocial'::text) $$, 'sem "Ver valores", a folha some (D11)');
select is((select count(*)::int from public.documentos_para_contato('f5400000-0000-0000-0000-00000000000c', 'f5300000-0000-0000-0000-00000000000a')), 0,
  'Básico não lê documentos');
select is((select count(*)::int from public.documentos_para_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000b')), 0,
  'Carla, Básico na Padaria, não lê os documentos da Padaria');
update public.contato_clientes set receber_documentos = false
 where contato_id = 'f5400000-0000-0000-0000-00000000000a' and cliente_id = 'f5300000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.documentos_para_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a')), 0,
  'sem "Receber documentos": nenhum');

-- 12–16: demandas_para_contato
select results_eq($$ select titulo from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a',
                    'f5500000-0000-0000-0000-00000000000a') order by titulo $$,
  $$ values ('Guia do DAS de setembro'::text), ('Triagem da Carla'::text) $$, 'Carla: Fiscal e a Triagem dela; nada do Pessoal nem a Triagem da Bia');
select results_eq($$ select setor_nome from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a',
                    'f5500000-0000-0000-0000-00000000000a') where setor_id is not null $$,
  $$ values ('Fiscal'::text) $$, 'traz o nome do setor');
select is((select count(*)::int from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000c', 'f5300000-0000-0000-0000-00000000000a',
  'f5500000-0000-0000-0000-00000000000b')), 0, 'Básico não lê demandas (nem a própria Triagem)');
select is((select count(*)::int from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000b',
  'f5500000-0000-0000-0000-00000000000a')), 0, 'Carla não lê as demandas da Padaria (Básico lá)');
update public.chamados set status = 'concluido' where titulo = 'Guia do DAS de setembro';
select results_eq($$ select titulo from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a',
                    'f5500000-0000-0000-0000-00000000000a') $$, $$ values ('Triagem da Carla'::text) $$, 'concluída sai');

-- 17–22: pedido fora do acesso, um por contato, empresa, setor e dia (D15)
select is(public.registrar_pedido_fora_do_acesso('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a',
  pg_temp.setor('Pessoal'), '2026-10-13') ->> 'novo', 'true', 'primeiro pedido do dia: novo');
select is(public.registrar_pedido_fora_do_acesso('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a',
  pg_temp.setor('Pessoal'), '2026-10-13') ->> 'novo', 'false', 'segundo no mesmo dia e setor: não é novo');
select is((select vezes from public.pedidos_fora_do_acesso where dia = '2026-10-13' and setor_id = pg_temp.setor('Pessoal')), 2, 'conta as vezes');
select is(public.registrar_pedido_fora_do_acesso('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a',
  pg_temp.setor('Financeiro'), '2026-10-13') ->> 'novo', 'true', 'outro setor no mesmo dia: novo');
select is(public.registrar_pedido_fora_do_acesso('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a',
  pg_temp.setor('Pessoal'), '2026-10-14') ->> 'novo', 'true', 'dia seguinte: novo');
update public.pedidos_fora_do_acesso set chamado_id = (select id from public.chamados where titulo = 'Admissão do João')
 where dia = '2026-10-13' and setor_id = pg_temp.setor('Pessoal');
select is(public.registrar_pedido_fora_do_acesso('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a',
  pg_temp.setor('Pessoal'), '2026-10-13') ->> 'chamado_id', (select id::text from public.chamados where titulo = 'Admissão do João'),
  'devolve a demanda do dia para a nota "pediu de novo"');

-- 23–25: sócios e procuráveis (D7, D17)
select results_eq($$ select nome from public.socios_para_alerta('f5300000-0000-0000-0000-00000000000a', 'f5400000-0000-0000-0000-00000000000a') $$,
  $$ values ('Roberto Faria'::text) $$, 'Carla pede: avisa o Roberto');
select is((select count(*)::int from public.socios_para_alerta('f5300000-0000-0000-0000-00000000000a', 'f5400000-0000-0000-0000-00000000000b')), 0,
  'quem pediu nunca é avisado');
update public.contatos set agente_pausado = true where id = 'f5400000-0000-0000-0000-00000000000b';
select results_eq($$ select nome from public.contatos_procuraveis('f5300000-0000-0000-0000-00000000000a', pg_temp.setor('Fiscal')) $$,
  $$ values ('Carla Mendes'::text) $$, 'procurável no Fiscal: Carla (Bia é Básico; Roberto com o agente desligado)');

-- 26–30: só o trabalhador executa; a equipe não grava pedidos (D9, D29)
select ok(not has_function_privilege('authenticated', 'public.acesso_do_contato(uuid, uuid)', 'execute'), 'a equipe não chama acesso_do_contato');
select ok(not has_function_privilege('authenticated', 'public.documentos_para_contato(uuid, uuid)', 'execute'), 'nem documentos_para_contato');
select ok(has_function_privilege('service_role', 'public.demandas_para_contato(uuid, uuid, uuid)', 'execute'), 'o trabalhador chama demandas_para_contato');
select ok(has_function_privilege('service_role', 'public.registrar_pedido_fora_do_acesso(uuid, uuid, uuid, date)', 'execute'), 'o trabalhador registra o pedido');
select ok(not has_table_privilege('authenticated', 'public.pedidos_fora_do_acesso', 'insert'), 'a equipe não grava pedidos');

-- 31–35: setor desativado pelo escritório e contato arquivado não liberam nada (revisão de segurança, rodada 1)
update public.contato_clientes set ver_valores = true where contato_id = 'f5400000-0000-0000-0000-00000000000d';
select results_eq($$ select titulo from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a', null) $$,
  $$ values ('Admissão do João'::text) $$, 'Patrícia (RH) vê a demanda do Pessoal');
update public.setores set ativo = false where nome = 'Pessoal';
select results_eq($$ select nome from public.documentos_para_contato('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a') $$,
  $$ values ('Contrato social'::text) $$, 'Pessoal desativado: a folha e o recibo somem');
select is((select count(*)::int from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a', null)), 0,
  'Pessoal desativado: a demanda do Pessoal some');
update public.setores set ativo = true where nome = 'Pessoal';
update public.contatos set ativo = false where id = 'f5400000-0000-0000-0000-00000000000d';
select is((select count(*)::int from public.documentos_para_contato('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a')), 0,
  'contato arquivado não lê documentos');
select is((select count(*)::int from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a', null)), 0,
  'contato arquivado não lê demandas');
update public.contatos set ativo = true where id = 'f5400000-0000-0000-0000-00000000000d';

-- 36–38: empresa arquivada não libera nada nem avisa ninguém
update public.clientes set ativo = false where id = 'f5300000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.documentos_para_contato('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a')), 0,
  'empresa arquivada: nenhum documento');
select is((select count(*)::int from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a', null)), 0,
  'empresa arquivada: nenhuma demanda');
select is((select count(*)::int from public.socios_para_alerta('f5300000-0000-0000-0000-00000000000a', 'f5400000-0000-0000-0000-00000000000a')), 0,
  'empresa arquivada: ninguém recebe alerta');
update public.clientes set ativo = true where id = 'f5300000-0000-0000-0000-00000000000a';

-- 39–40: sem "quem pediu" (null) o sócio ainda é avisado; Básico com a marcação não recebe alerta
select results_eq($$ select nome from public.socios_para_alerta('f5300000-0000-0000-0000-00000000000a', null) $$,
  $$ values ('Roberto Faria'::text) $$, 'sem quem pediu: avisa o Roberto');
update public.contato_clientes set recebe_alertas_acesso = true where contato_id = 'f5400000-0000-0000-0000-00000000000c';
select results_eq($$ select nome from public.socios_para_alerta('f5300000-0000-0000-0000-00000000000a', 'f5400000-0000-0000-0000-00000000000a') $$,
  $$ values ('Roberto Faria'::text) $$, 'Básico com "recebe alertas" não é avisado');

-- 41: visitante não chama nenhuma função do agente
select ok(not (has_function_privilege('anon', 'public.acesso_do_contato(uuid, uuid)', 'execute')
  or has_function_privilege('anon', 'public.documentos_para_contato(uuid, uuid)', 'execute')
  or has_function_privilege('anon', 'public.demandas_para_contato(uuid, uuid, uuid)', 'execute')
  or has_function_privilege('anon', 'public.registrar_pedido_fora_do_acesso(uuid, uuid, uuid, date)', 'execute')
  or has_function_privilege('anon', 'public.socios_para_alerta(uuid, uuid)', 'execute')
  or has_function_privilege('anon', 'public.contatos_procuraveis(uuid, uuid)', 'execute')), 'visitante não chama as funções do agente');


-- 42–43: a demanda "Fora do acesso" de um pedido de valores cai num setor do próprio contato; ela não volta para ele (fix round 1)
insert into public.chamados (cliente_id, conversa_id, setor_id, titulo) values
  ('f5300000-0000-0000-0000-00000000000a', null, pg_temp.setor('Pessoal'), 'Fora do acesso: Valor da folha');
insert into public.pedidos_fora_do_acesso (contato_id, cliente_id, setor_id, dia, chamado_id) values
  ('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a', pg_temp.setor('Pessoal'), '2026-10-20',
   (select id from public.chamados where titulo = 'Fora do acesso: Valor da folha'));
select results_eq($$ select titulo from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000d', 'f5300000-0000-0000-0000-00000000000a', null) $$,
  $$ values ('Admissão do João'::text) $$, 'quem pediu não vê a demanda "Fora do acesso" do próprio pedido');
select results_eq($$ select titulo from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000b', 'f5300000-0000-0000-0000-00000000000a', null) order by titulo $$,
  $$ values ('Admissão do João'::text), ('Fora do acesso: Valor da folha'::text) $$, 'o sócio do Pessoal continua vendo');

-- 44–46: a demanda da Direção que o próprio contato abriu nesta conversa volta para ele; a de outra conversa não (onda final, Minor 2)
insert into public.setores (nome, descricao_assuntos) values ('Direção', 'Assuntos sensíveis') on conflict (nome) do nothing;
insert into public.chamados (cliente_id, conversa_id, setor_id, titulo) values
  ('f5300000-0000-0000-0000-00000000000a', 'f5500000-0000-0000-0000-00000000000a', pg_temp.setor('Direção'), 'Assunto sensível da Carla'),
  ('f5300000-0000-0000-0000-00000000000a', null, pg_temp.setor('Direção'), 'Assunto sensível de outra pessoa');
select results_eq($$ select titulo from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a',
                    'f5500000-0000-0000-0000-00000000000a') order by titulo $$,
  $$ values ('Assunto sensível da Carla'::text), ('Triagem da Carla'::text) $$, 'Carla vê a demanda da Direção que ela abriu nesta conversa');
select is((select count(*)::int from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000a', 'f5300000-0000-0000-0000-00000000000a', null)
            where setor_nome = 'Direção'), 0, 'fora da conversa dela, nenhuma demanda da Direção');
select is((select count(*)::int from public.demandas_para_contato('f5400000-0000-0000-0000-00000000000b', 'f5300000-0000-0000-0000-00000000000a', null)
            where setor_nome = 'Direção'), 0, 'o sócio não vê assunto sensível de ninguém pela demanda da Direção');

select * from finish();
rollback;
