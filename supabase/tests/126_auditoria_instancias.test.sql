-- Auditoria 4.3 e 3.13: o trabalhador confere o ambiente do banco na partida e se registra a cada batimento; com outra
-- instância viva de versão ou ambiente diferente, a de build mais antigo para de consumir.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- 1–6: tabela, coluna e permissões (só o trabalhador)
select has_table('public', 'instancias_trabalhador', 'tabela das instâncias do trabalhador');
select has_column('public', 'configuracoes', 'ambiente', 'configuracoes guarda o ambiente do banco');
select ok(not has_table_privilege('authenticated', 'public.instancias_trabalhador', 'select'), 'o painel não lê as instâncias');
select ok(not has_function_privilege('authenticated', 'public.registrar_instancia(uuid, text, text, text, timestamptz)', 'execute'), 'o painel não registra instância');
select ok(not has_function_privilege('anon', 'public.registrar_instancia(uuid, text, text, text, timestamptz)', 'execute'), 'visitante não registra instância');
select ok(not has_function_privilege('authenticated', 'public.ambiente_do_banco(text)', 'execute'), 'o painel não define o ambiente');

-- 7–10: a primeira partida define o ambiente; as seguintes só leem
update public.configuracoes set ambiente = null where id = 1;
select is(public.ambiente_do_banco('producao'), 'producao', 'banco sem ambiente: a primeira partida grava o seu');
select is(public.ambiente_do_banco('homologacao'), 'producao', 'partida seguinte com outro ambiente: o banco continua com o primeiro');
select is((select ambiente from public.configuracoes where id = 1), 'producao', 'gravado em configuracoes');
select throws_ok($$ select public.ambiente_do_banco('teste') $$, '22023', null, 'ambiente fora da lista: recusa');

-- 11–13: uma instância só
select is(public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1', '2026-10-01T10:00:00Z') -> 'outras',
  '[]'::jsonb, 'sozinha: não vê outra');
update public.instancias_trabalhador set iniciado_em = now() - interval '1 hour', visto_em = now() - interval '30 seconds'
 where id = 'e1260000-0000-0000-0000-0000000000a1';
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1', '2026-10-01T10:00:00Z')) -> 'deve_parar', 'false'::jsonb,
  'o batimento da mesma instância não conta como outra');
select is((select visto_em from public.instancias_trabalhador where id = 'e1260000-0000-0000-0000-0000000000a1'), now(),
  'o batimento grava visto_em');

-- 14–17: a nova (build mais novo, versão diferente) chega: a antiga para, a nova segue; as duas se veem
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a2', 'novo', 'producao', 'v2', '2026-10-02T10:00:00Z')) -> 'deve_parar', 'false'::jsonb,
  'a de build mais novo não para');
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a2', 'novo', 'producao', 'v2', '2026-10-02T10:00:00Z')) #>> '{outras,0,hostname}', 'antigo',
  'a mais nova vê a antiga');
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1', '2026-10-01T10:00:00Z')) -> 'deve_parar', 'true'::jsonb,
  'a de build mais antigo, com versão diferente, para de consumir');
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1', '2026-10-01T10:00:00Z')) -> 'todas',
  '[{"hostname": "antigo", "versao": "v1", "ambiente": "producao", "build_em": "2026-10-01T10:00:00+00:00", "para": true},
    {"hostname": "novo", "versao": "v2", "ambiente": "producao", "build_em": "2026-10-02T10:00:00+00:00", "para": false}]'::jsonb,
  'todas, da mais antiga para a mais nova, dizem quem parou');

-- 18–20: o contêiner antigo que reinicia depois (processo mais novo, build mais antigo) é o que para
update public.instancias_trabalhador set iniciado_em = now() where id = 'e1260000-0000-0000-0000-0000000000a1';
update public.instancias_trabalhador set iniciado_em = now() - interval '2 hours' where id = 'e1260000-0000-0000-0000-0000000000a2';
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1', '2026-10-01T10:00:00Z')) -> 'deve_parar', 'true'::jsonb,
  'antigo reiniciado: o build mais antigo para, mesmo com o processo mais novo');
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a2', 'novo', 'producao', 'v2', '2026-10-02T10:00:00Z')) -> 'deve_parar', 'false'::jsonb,
  'o build mais novo continua, mesmo com o processo mais antigo');
-- Sem build_em (local, "dev") conta como o build mais antigo.
update public.instancias_trabalhador set build_em = null where id = 'e1260000-0000-0000-0000-0000000000a2';
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a2', 'novo', 'producao', 'v2', null)) -> 'deve_parar', 'true'::jsonb,
  'sem build_em: conta como o mais antigo');
update public.instancias_trabalhador set build_em = '2026-10-02T10:00:00Z' where id = 'e1260000-0000-0000-0000-0000000000a2';

-- 21–22: mesmo build no mesmo instante: o início do processo desempata
update public.instancias_trabalhador set build_em = '2026-10-01T10:00:00Z', iniciado_em = now() - interval '2 hours'
 where id = 'e1260000-0000-0000-0000-0000000000a2';
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a2', 'novo', 'producao', 'v2', '2026-10-01T10:00:00Z')) -> 'deve_parar', 'true'::jsonb,
  'build no mesmo instante: o processo mais antigo para');
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1', '2026-10-01T10:00:00Z')) -> 'deve_parar', 'false'::jsonb,
  'build no mesmo instante: o processo mais novo segue');

-- 23–24: mesma versão e mesmo ambiente (duas réplicas): nenhuma para, mas as duas se veem
update public.instancias_trabalhador set versao = 'v1', build_em = '2026-10-02T10:00:00Z', iniciado_em = now() - interval '2 hours'
 where id = 'e1260000-0000-0000-0000-0000000000a2';
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1', '2026-10-01T10:00:00Z')) -> 'deve_parar', 'false'::jsonb,
  'réplica igual: a antiga não para');
select is(jsonb_array_length((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1', '2026-10-01T10:00:00Z')) -> 'outras'), 1,
  'réplica igual: continua vendo a outra');

-- 25: ambiente diferente também faz a de build mais antigo parar
update public.instancias_trabalhador set ambiente = 'homologacao' where id = 'e1260000-0000-0000-0000-0000000000a2';
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1', '2026-10-01T10:00:00Z')) -> 'deve_parar', 'true'::jsonb,
  'a de build mais antigo, com ambiente diferente, para de consumir');

-- 26–27: a outra sumida há mais de 2 minutos não conta
update public.instancias_trabalhador set visto_em = now() - interval '3 minutes' where id = 'e1260000-0000-0000-0000-0000000000a2';
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1', '2026-10-01T10:00:00Z')) -> 'deve_parar', 'false'::jsonb,
  'instância não vista há mais de 2 minutos: não faz parar');
select is((public.registrar_instancia('e1260000-0000-0000-0000-0000000000a1', 'antigo', 'producao', 'v1', '2026-10-01T10:00:00Z')) -> 'outras', '[]'::jsonb,
  'instância não vista há mais de 2 minutos não conta');

-- 28: com pessoa na sessão (o painel, mesmo administrador), o ambiente do banco não muda
select throws_ok($$
  set local request.jwt.claims = '{"sub": "e1260000-0000-0000-0000-0000000000ff", "role": "authenticated"}';
  update public.configuracoes set ambiente = 'local' where id = 1;
$$, 'P0001', null, 'o painel não muda o ambiente do banco');

-- 29–30: sem a linha de configuracoes, erro claro (nunca o texto "null")
select lives_ok($$ set local request.jwt.claims = '{}' $$, 'sessão sem pessoa de novo');
delete from public.configuracoes where id = 1;
select throws_ok($$ select public.ambiente_do_banco('producao') $$, 'P0002', null, 'sem configuracoes: erro claro');

select * from finish();
rollback;
