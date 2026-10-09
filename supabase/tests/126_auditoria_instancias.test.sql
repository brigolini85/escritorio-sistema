-- Auditoria 4.3 e 3.13: o trabalhador confere o ambiente do banco na partida e se registra a cada batimento; com outra
-- instância viva de versão ou ambiente diferente, a mais antiga para de consumir.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- 1–6: tabela, coluna e permissões (só o trabalhador)
select has_table('public', 'instancias_trabalhador', 'tabela das instâncias do trabalhador');
select has_column('public', 'configuracoes', 'ambiente', 'configuracoes guarda o ambiente do banco');
select ok(not has_table_privilege('authenticated', 'public.instancias_trabalhador', 'select'), 'o painel não lê as instâncias');
select ok(not has_function_privilege('authenticated', 'public.registrar_instancia(uuid, text, text, text)', 'execute'), 'o painel não registra instância');
select ok(not has_function_privilege('anon', 'public.registrar_instancia(uuid, text, text, text)', 'execute'), 'visitante não registra instância');
select ok(not has_function_privilege('authenticated', 'public.ambiente_do_banco(text)', 'execute'), 'o painel não define o ambiente');

-- 7–10: a primeira partida define o ambiente; as seguintes só leem
update public.configuracoes set ambiente = null where id = 1;
select is(public.ambiente_do_banco('producao'), 'producao', 'banco sem ambiente: a primeira partida grava o seu');
select is(public.ambiente_do_banco('homologacao'), 'producao', 'partida seguinte com outro ambiente: o banco continua com o primeiro');
select is((select ambiente from public.configuracoes where id = 1), 'producao', 'gravado em configuracoes');
select throws_ok($$ select public.ambiente_do_banco('teste') $$, '22023', null, 'ambiente fora da lista: recusa');

-- 11–13: uma instância só
select is(public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1'),
  '{"deve_parar": false, "outras": []}'::jsonb, 'sozinha: não para e não vê outra');
update public.instancias_trabalhador set iniciado_em = now() - interval '1 hour', visto_em = now() - interval '30 seconds'
 where id = 'e1260000-0000-0000-0000-0000000000a1';
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1')) -> 'deve_parar', 'false'::jsonb,
  'o batimento da mesma instância não conta como outra');
select is((select visto_em from public.instancias_trabalhador where id = 'e1260000-0000-0000-0000-0000000000a1'), now(),
  'o batimento grava visto_em');

-- 14–17: a nova (versão diferente) chega: a antiga para, a nova segue; as duas se veem
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a2', 'novo', 'producao', 'v2')) -> 'deve_parar', 'false'::jsonb,
  'a mais nova não para');
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a2', 'novo', 'producao', 'v2')) #>> '{outras,0,hostname}', 'antigo',
  'a mais nova vê a antiga');
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1')) -> 'deve_parar', 'true'::jsonb,
  'a mais antiga, com versão diferente, para de consumir');
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1')) #>> '{outras,0,hostname}', 'novo',
  'a mais antiga vê a nova');

-- 18–19: mesma versão e mesmo ambiente (duas réplicas): nenhuma para, mas as duas se veem
update public.instancias_trabalhador set versao = 'v1' where id = 'e1260000-0000-0000-0000-0000000000a2';
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1')) -> 'deve_parar', 'false'::jsonb,
  'réplica igual: a antiga não para');
select is(jsonb_array_length((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1')) -> 'outras'), 1,
  'réplica igual: continua vendo a outra');

-- 20: ambiente diferente também faz a antiga parar
update public.instancias_trabalhador set ambiente = 'homologacao' where id = 'e1260000-0000-0000-0000-0000000000a2';
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1')) -> 'deve_parar', 'true'::jsonb,
  'a mais antiga, com ambiente diferente, para de consumir');

-- 21: a outra sumida há mais de 2 minutos não conta
update public.instancias_trabalhador set visto_em = now() - interval '3 minutes' where id = 'e1260000-0000-0000-0000-0000000000a2';
select is(public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1'),
  '{"deve_parar": false, "outras": []}'::jsonb, 'instância não vista há mais de 2 minutos não conta');

-- 22: com pessoa na sessão (o painel, mesmo administrador), o ambiente do banco não muda
select throws_ok($$
  set local request.jwt.claims = '{"sub": "e1260000-0000-0000-0000-0000000000ff", "role": "authenticated"}';
  update public.configuracoes set ambiente = 'local' where id = 1;
$$, 'P0001', null, 'o painel não muda o ambiente do banco');

select * from finish();
rollback;
