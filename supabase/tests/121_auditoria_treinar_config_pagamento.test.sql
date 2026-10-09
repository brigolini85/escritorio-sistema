-- Auditoria 5.1 e 6.7 (decisão D3): "Treinar o agente" e "Configurações: Sim" pedem o segundo fator; as mensagens
-- automáticas, o aviso do login e os dados de pagamento são só do administrador; mudar mensagens ou dados de pagamento
-- e ligar orientação geral avisam o dono. Também: o administrador que não é o dono não muda o horário do dono.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into auth.users (id, email) values
  ('e1310000-0000-0000-0000-00000000000a', 'admin@t121.local'),
  ('e1310000-0000-0000-0000-00000000000d', 'dono@t121.local'),
  ('e1310000-0000-0000-0000-000000000071', 'tina@t121.local'),
  ('e1310000-0000-0000-0000-000000000072', 'caio@t121.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e1310000-0000-0000-0000-00000000000a', 'Admin T121', 'admin@t121.local', 'admin', '{}'),
  ('e1310000-0000-0000-0000-000000000071', 'Tina T121', 'tina@t121.local', 'atendente', '{}'),
  ('e1310000-0000-0000-0000-000000000072', 'Caio T121', 'caio@t121.local', 'atendente', '{}');
insert into public.usuarios (id, nome, email, papel, permissoes, dono) values
  ('e1310000-0000-0000-0000-00000000000d', 'Dono T121', 'dono@t121.local', 'admin', '{}', true);
-- Tina treina o agente; Caio tem "Configurações: Sim". Nenhum dos dois é administrador.
update public.usuario_permissoes set nivel = 'sim' where usuario_id = 'e1310000-0000-0000-0000-000000000071' and modulo = 'treinar';
update public.usuario_permissoes set nivel = 'sim' where usuario_id = 'e1310000-0000-0000-0000-000000000072' and modulo = 'configuracoes';
insert into public.clientes (id, razao_social, cnpj) values ('e1320000-0000-0000-0000-000000000001', 'T121 Ltda', '11222333000181');
-- Orientações já existentes, desligadas: uma geral e uma só da empresa (criadas sem pessoa, como a semente).
insert into public.orientacoes_agente (id, titulo, texto, tipo, cliente_id) values
  ('e1330000-0000-0000-0000-000000000001', 'Geral T121', 'Texto geral.', 'regra', null),
  ('e1330000-0000-0000-0000-000000000002', 'Empresa T121', 'Texto da empresa.', 'regra', 'e1320000-0000-0000-0000-000000000001');

create function pg_temp.como(p_id text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims',
    case when p_aal is null then json_build_object('sub', p_id, 'role', 'authenticated')::text
         else json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text end, true);
$$;
grant execute on function pg_temp.como(text, text) to authenticated;
-- Avisos ao dono com o texto dado (LIKE; lidos como dona da tabela, sem RLS).
create function pg_temp.avisos(p_mensagem text) returns int language sql security definer as $$
  select count(*)::int from public.alertas where mensagem like p_mensagem and usuario_id = 'e1310000-0000-0000-0000-00000000000d'
$$;
grant execute on function pg_temp.avisos(text) to authenticated, service_role;

-- 1–4: catálogo
select ok(has_function_privilege('authenticated', 'public.salvar_dados_pagamento(jsonb)', 'execute'), 'o painel grava os dados de pagamento');
select ok(not has_function_privilege('anon', 'public.salvar_dados_pagamento(jsonb)', 'execute'), 'visitante não grava');
select is((select dados_pagamento from public.configuracoes where id = 1), '{}'::jsonb, 'começa vazio');
select throws_ok($$ update public.configuracoes set dados_pagamento = '{"pix": 123}' where id = 1 $$, '23514', null,
  'a coluna só aceita as chaves conhecidas, em texto');

set local role authenticated;

-- 5–14: quem treina o agente precisa do segundo fator (5.1)
select pg_temp.como('e1310000-0000-0000-0000-000000000071', 'aal1');
select is(public.exige_segundo_fator(), true, 'quem treina o agente precisa do fator');
select throws_ok($$ select public.salvar_orientacao(null, 'Pix T121', 'Nosso Pix é 123.', 'regra', null, null, true) $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: não cria orientação');
select throws_ok($$ select public.alternar_orientacao('e1330000-0000-0000-0000-000000000001', true) $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: não liga orientação');
select throws_ok($$ select public.salvar_orientacao_agente('atendimento', null, 'Pix T121', 'Nosso Pix é 123.', 'regra') $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: nem pelo caminho do agente');
select throws_ok($$ select public.restaurar_orientacao(gen_random_uuid()) $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: não restaura versão');
select throws_ok($$ select public.criar_simulacao('Qual o Pix?') $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: não testa o agente');
select is((select count(*)::int from public.orientacoes_agente), 0, 'aal1: não lê as orientações');

select pg_temp.como('e1310000-0000-0000-0000-000000000071', 'aal2');
select lives_ok($$ select public.salvar_orientacao(null, 'Rascunho T121', 'Ainda desligada.', 'jeito') $$, 'aal2: cria orientação');
select is(pg_temp.avisos('Tina T121 ligou a orientação Rascunho T121 (vale para todos os clientes)'), 0, 'criar desligada não avisa');
select is((select count(*)::int from public.orientacoes_agente where titulo = 'Rascunho T121'), 1, 'aal2: lê');

-- 15–22: ligar orientação geral avisa o dono (5.1)
select lives_ok($$ select public.alternar_orientacao('e1330000-0000-0000-0000-000000000001', true) $$, 'aal2: liga a geral');
select is(pg_temp.avisos('Tina T121 ligou a orientação Geral T121 (vale para todos os clientes)'), 1, 'ligar a geral avisa o dono');
select lives_ok($$ select public.salvar_orientacao(null, 'Nova T121', 'Já nasce ligada.', 'regra', null, null, true) $$,
  'aal2: cria já ligada');
select is(pg_temp.avisos('Tina T121 ligou a orientação Nova T121 (vale para todos os clientes)'), 1, 'criar já ligada avisa o dono');
select lives_ok($$ select public.salvar_orientacao('e1330000-0000-0000-0000-000000000001', 'Geral T121', 'Texto trocado depois de ligada.', 'regra') $$,
  'aal2: muda o texto da geral ligada');
select is(pg_temp.avisos('Tina T121 mudou a orientação ligada Geral T121 (vale para todos os clientes)'), 1,
  'mudar o texto da geral ligada também avisa (senão bastava ligar algo inocente e trocar depois)');
select lives_ok($$ select public.alternar_orientacao('e1330000-0000-0000-0000-000000000002', true) $$, 'aal2: liga a da empresa');
select is(pg_temp.avisos('%Empresa T121%'), 0, 'a de uma empresa só não avisa');

-- 23–29: "Configurações: Sim" sem ser administrador (6.7)
select pg_temp.como('e1310000-0000-0000-0000-000000000072', 'aal1');
select is(public.exige_segundo_fator(), true, '"Configurações: Sim" precisa do fator');
select pg_temp.como('e1310000-0000-0000-0000-000000000072', 'aal2');
select throws_ok($$ update public.configuracoes set mensagens = mensagens || '{"fora_do_horario": "Pague em http://golpe"}' where id = 1 $$,
  'P0001', null, 'não muda as mensagens automáticas');
select throws_ok($$ update public.configuracoes set aviso_login = 'Recado T121' where id = 1 $$, 'P0001', null, 'não muda o aviso do login');
select throws_ok($$ update public.configuracoes set dados_pagamento = '{"pix": "golpe"}' where id = 1 $$, 'P0001', null,
  'não muda os dados de pagamento direto');
select throws_ok($$ select public.salvar_dados_pagamento('{"pix": "golpe"}') $$, 'P0001',
  'Só o administrador muda os dados de pagamento.', 'nem pela função');
select lives_ok($$ update public.configuracoes set horario_fim = '17:30' where id = 1 $$, 'muda o fim do expediente');
select is((select horario_fim from public.configuracoes where id = 1), '17:30'::time, 'gravou');

-- 30–38: administrador e os dados de pagamento (D3)
select pg_temp.como('e1310000-0000-0000-0000-00000000000a', 'aal1');
select throws_ok($$ select public.salvar_dados_pagamento('{"pix": "chave-t121"}') $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'administrador em aal1: não grava');
select pg_temp.como('e1310000-0000-0000-0000-00000000000a', 'aal2');
select lives_ok($$ select public.salvar_dados_pagamento('{"pix": " chave-t121 ", "banco": "Banco T121", "conta": ""}') $$,
  'administrador em aal2: grava');
select is((select dados_pagamento from public.configuracoes where id = 1), '{"pix": "chave-t121", "banco": "Banco T121"}'::jsonb,
  'aparado e sem campo vazio');
select is(pg_temp.avisos('Pix e Banco alterados por Admin T121 (dados de pagamento do escritório)'), 1, 'avisa o dono sem repetir a chave');
select lives_ok($$ select public.salvar_dados_pagamento('{"pix": "chave-t121", "banco": "Banco T121"}') $$, 'gravar igual');
select is(pg_temp.avisos('%(dados de pagamento do escritório)'), 1, 'sem mudança, sem aviso');
select throws_ok($$ select public.salvar_dados_pagamento('{"senha": "x"}') $$, 'P0001', 'Dados de pagamento inválidos.', 'chave desconhecida');
select throws_ok($$ select public.salvar_dados_pagamento('{"pix": 123}') $$, 'P0001', 'Dados de pagamento inválidos.', 'valor que não é texto');
select throws_ok($$ select public.salvar_dados_pagamento(jsonb_build_object('pix', repeat('x', 121))) $$, 'P0001',
  'Cada dado de pagamento tem até 120 letras; a observação, até 500.', 'longo demais');

-- 39–40: mensagem automática mudada pelo administrador avisa o dono (6.7)
select lives_ok($$ update public.configuracoes set mensagens = mensagens || '{"fora_do_horario": "Voltamos às {inicio}."}' where id = 1 $$,
  'administrador muda a mensagem');
select is(pg_temp.avisos('Mensagem automática "Fora do horário" alterada por Admin T121'), 1, 'avisa o dono');

-- 41–42: o horário do dono só ele muda (revisão da Task 1)
select throws_ok($$ select public.salvar_usuario('e1310000-0000-0000-0000-00000000000d',
  '{"nome":"Dono T121","papel":"admin","setores":[],"horario_acesso":{"semana":null,"sabado":null,"domingo":null}}'::jsonb) $$,
  null, 'Só o dono muda o próprio acesso.', 'administrador não muda o horário do dono');
select lives_ok($$ select public.salvar_usuario('e1310000-0000-0000-0000-00000000000d', jsonb_build_object('nome', 'Dono T121', 'papel', 'admin',
  'setores', '[]'::jsonb, 'horario_acesso', (select horario_acesso from public.usuarios where id = 'e1310000-0000-0000-0000-00000000000d'))) $$,
  'mandar o mesmo horário (o formulário manda) continua valendo');

-- 43–44: trabalhador (chave de serviço, sem "sub"): muda sem trava e sem aviso
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$ update public.configuracoes set mensagens = mensagens || '{"ia_indisponivel": "Já te respondo."}' where id = 1 $$,
  'trabalhador muda');
select is(pg_temp.avisos('%"IA indisponível"%'), 0, 'sem pessoa, sem aviso');

select * from finish();
rollback;
