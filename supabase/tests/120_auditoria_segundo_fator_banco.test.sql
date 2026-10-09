-- Auditoria 2.1, 2.4, 2.5, 2.8 e 5.3: o segundo fator vale dentro do banco (RLS, Storage, funções), não só na tela.
-- Quem precisa do fator e está só com a senha (aal1) não lê nem grava nada; o trabalhador (sem "sub") não muda.
-- Escrita direta em usuarios, usuario_permissoes e usuario_setores sai; o dono fica protegido; telefone da equipe é único
-- e não pode ser o de um contato de cliente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(62);

insert into auth.users (id, email) values
  ('e1200000-0000-0000-0000-00000000000a', 'admin@t120.local'),
  ('e1200000-0000-0000-0000-00000000000b', 'bia@t120.local'),
  ('e1200000-0000-0000-0000-00000000000d', 'dono@t120.local'),
  ('e1200000-0000-0000-0000-000000000011', 'u1@t120.local'),
  ('e1200000-0000-0000-0000-000000000012', 'u2@t120.local'),
  ('e1200000-0000-0000-0000-000000000013', 'u3@t120.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e1200000-0000-0000-0000-00000000000a', 'Admin T120', 'admin@t120.local', 'admin', '{}'),
  ('e1200000-0000-0000-0000-00000000000b', 'Bia T120', 'bia@t120.local', 'atendente', '{}');
-- Dono marcado direto no banco (sem token, como manda o gatilho dono_so_por_sql).
insert into public.usuarios (id, nome, email, papel, permissoes, dono, telefone) values
  ('e1200000-0000-0000-0000-00000000000d', 'Dono T120', 'dono@t120.local', 'admin', '{}', true, '5531988887777');
insert into public.usuario_setores (usuario_id, setor_id)
  select 'e1200000-0000-0000-0000-00000000000b', id from public.setores where nome = 'Fiscal';

insert into public.clientes (id, razao_social, cnpj) values ('e1210000-0000-0000-0000-000000000001', 'T120 Ltda', '11222333000181');
insert into public.conversas (id, telefone) values ('e1220000-0000-0000-0000-000000000001', '5531977770120');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo)
  values ('e1220000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'texto', 'oi t120');
insert into public.chamados (cliente_id, conversa_id, setor_id, titulo)
  values ('e1210000-0000-0000-0000-000000000001', 'e1220000-0000-0000-0000-000000000001',
          (select id from public.setores where nome = 'Fiscal'), 'T120 Fiscal');
insert into storage.objects (bucket_id, name) values ('documentos', 'clientes/e1210000-0000-0000-0000-000000000001/t120.pdf');
insert into public.contatos (id, nome, telefone) values ('e1230000-0000-0000-0000-000000000001', 'Cliente T120', '5531977771234');

-- Ajudantes só deste arquivo: o token com a marca "aal" (como o Supabase Auth emite) e quantas linhas um comando mexeu.
create function pg_temp.como(p_id text, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims',
    case when p_aal is null then json_build_object('sub', p_id, 'role', 'authenticated')::text
         else json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text end, true);
$$;
create function pg_temp.linhas(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function pg_temp.como(text, text), pg_temp.linhas(text) to authenticated;
-- O Storage API liga esta marca antes de apagar; aqui ela deixa a política decidir.
select set_config('storage.allow_delete_query', 'true', true);

-- 1–9: telefone_canonico, com os casos de packages/core/test/telefone.test.ts
select is(public.telefone_canonico('(31) 99999-0001'), '553199990001', 'celular com DDD: 55 na frente, sem o 9 extra');
select is(public.telefone_canonico('31 3333-0001'), '553133330001', 'fixo com DDD: 55 na frente');
select is(public.telefone_canonico('+55 31 99999-0001'), '553199990001', 'já com 55');
select is(public.telefone_canonico('12345'), null, 'curto demais: nulo');
select is(public.telefone_canonico(''), null, 'vazio: nulo');
select is(public.telefone_canonico('5531999990001'), public.telefone_canonico('553199990001'), 'com e sem o nono dígito: o mesmo');
select is(public.telefone_canonico('553133330001'), '553133330001', 'fixo não muda');
select is(public.telefone_canonico('5511999990000'), '551199990000', 'celular de SP sem o 9 extra');
select is((select provolatile from pg_proc where oid = 'public.telefone_canonico(text)'::regprocedure), 'i', 'imutável (serve de índice)');

-- 10–13: catálogo
select ok(not has_function_privilege('authenticated', 'public.exige_segundo_fator_de(uuid)', 'execute'), 'a equipe não pergunta pelos outros');
select ok(has_function_privilege('service_role', 'public.exige_segundo_fator_de(uuid)', 'execute'), 'o trabalhador pergunta');
select ok(has_function_privilege('authenticated', 'public.registrar_fator_cadastrado()', 'execute'), 'o painel registra o cadastro do fator');
select ok(not has_function_privilege('anon', 'public.registrar_fator_cadastrado()', 'execute'), 'visitante não registra');

set local role authenticated;

-- 14–23: administrador só com a senha (aal1): não lê nem grava nada
select pg_temp.como('e1200000-0000-0000-0000-00000000000a', 'aal1');
select is(public.exige_segundo_fator(), true, 'administrador precisa do fator');
select is((select count(*)::int from public.mensagens), 0, 'aal1: não lê mensagens');
select is((select count(*)::int from public.usuarios where id = 'e1200000-0000-0000-0000-00000000000a'), 0, 'aal1: nem a própria linha');
select throws_ok($$ update public.usuarios set telefone = '5531900000001' where id = 'e1200000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'aal1: não troca o telefone direto');
select throws_ok($$ insert into public.usuario_permissoes (usuario_id, modulo, nivel)
  values ('e1200000-0000-0000-0000-00000000000a', 'assistente', 'site_whatsapp') $$, '42501', null, 'aal1: não dá nível direto');
select is(pg_temp.linhas($$ update public.configuracoes set telefone_dono = '5531900000002' where id = 1 $$), 0,
  'aal1: não muda o telefone do dono nas configurações');
select throws_ok($$ select public.aprovar_envio_radar(gen_random_uuid(), (select id from public.setores where nome = 'Fiscal'),
  array['e1210000-0000-0000-0000-000000000001'::uuid], 'Mensagem de teste') $$, null, null, 'aal1: não aprova envio do radar');
select is(pg_temp.linhas($$ delete from storage.objects where bucket_id = 'documentos' and name like '%t120.pdf' $$), 0,
  'aal1: não apaga documentos');
select throws_ok($$ select public.definir_visao_demandas('quadro') $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'aal1: nem as funções da própria pessoa');
select is(public.limites_espera(), null, 'aal1: nem os limites do cronômetro');

-- 24–31: o mesmo administrador com o segundo fator (aal2)
select pg_temp.como('e1200000-0000-0000-0000-00000000000a', 'aal2');
select is((select count(*)::int from public.mensagens where conteudo = 'oi t120'), 1, 'aal2: lê');
select lives_ok($$ select public.salvar_usuario('e1200000-0000-0000-0000-00000000000b', jsonb_build_object('nome', 'Bia T120 Souza',
  'papel', 'atendente', 'setores', jsonb_build_array((select id from public.setores where nome = 'Fiscal')))) $$, 'aal2: salvar_usuario funciona');
select is((select nome from public.usuarios where id = 'e1200000-0000-0000-0000-00000000000b'), 'Bia T120 Souza', 'gravou');
-- 2.8: nem com o fator a tabela aceita escrita direta; tudo passa pelas funções.
select throws_ok($$ update public.usuarios set nome = 'X' where id = 'e1200000-0000-0000-0000-00000000000b' $$, '42501', null,
  'aal2: update direto em usuarios recusado');
select throws_ok($$ delete from public.usuarios where id = 'e1200000-0000-0000-0000-00000000000b' $$, '42501', null,
  'aal2: delete direto em usuarios recusado');
select throws_ok($$ delete from public.usuario_setores where usuario_id = 'e1200000-0000-0000-0000-00000000000b' $$, '42501', null,
  'aal2: delete direto em usuario_setores recusado');
select throws_ok($$ update public.usuario_permissoes set nivel = 'todas' where usuario_id = 'e1200000-0000-0000-0000-00000000000b' $$,
  '42501', null, 'aal2: update direto em usuario_permissoes recusado');
select is(pg_temp.linhas($$ delete from storage.objects where bucket_id = 'documentos' and name like '%t120.pdf' $$), 1,
  'aal2: apaga documentos');

-- 32–37: o dono fica protegido de quem não é o dono (2.8, Banco M1)
select throws_ok($$ select public.salvar_usuario('e1200000-0000-0000-0000-00000000000d',
  '{"nome":"Dono T120","papel":"atendente","setores":[]}'::jsonb) $$, null, 'Só o dono muda o próprio acesso.',
  'administrador não rebaixa o dono');
select throws_ok($$ select public.salvar_usuario('e1200000-0000-0000-0000-00000000000d',
  '{"nome":"Dono T120","papel":"admin","telefone":"5531900000003","setores":[]}'::jsonb) $$, null, 'Só o dono muda o próprio acesso.',
  'administrador não troca o telefone do dono');
select lives_ok($$ select public.salvar_usuario('e1200000-0000-0000-0000-00000000000d',
  '{"nome":"Dono T120 Silva","papel":"admin","telefone":"5531988887777","setores":[]}'::jsonb) $$,
  'o nome do dono o administrador muda');
select throws_ok($$ select public.definir_ver_acessos('e1200000-0000-0000-0000-00000000000d', true) $$, null,
  'Só o dono muda o próprio acesso.', 'administrador não muda "Ver acessos" do dono');
select throws_ok($$ select public.arquivar_cadastro('usuario', 'e1200000-0000-0000-0000-00000000000d') $$, null,
  'Só o dono muda o próprio acesso.', 'administrador não arquiva o dono');
select throws_ok($$ select public.excluir_cadastro_definitivo('usuario', 'e1200000-0000-0000-0000-00000000000d') $$, null,
  'Só o dono muda o próprio acesso.', 'administrador não exclui o dono');

-- 38–40: atendente sem obrigação de fator lê em aal1 o mesmo que sem a marca (teste 22)
select pg_temp.como('e1200000-0000-0000-0000-00000000000b', null);
create temp table t120_bia_sem_marca as
  select (select count(*)::int from public.mensagens where conteudo = 'oi t120') as msgs,
         (select count(*)::int from public.chamados where titulo = 'T120 Fiscal') as demandas,
         (select count(*)::int from public.usuarios where id = 'e1200000-0000-0000-0000-00000000000b') as linha;
select pg_temp.como('e1200000-0000-0000-0000-00000000000b', 'aal1');
select is(public.exige_segundo_fator(), false, 'atendente não precisa do fator');
select is((select row(msgs, demandas, linha)::text from t120_bia_sem_marca), '(1,1,1)', 'atendente vê a conversa do setor');
select is(row((select count(*)::int from public.mensagens where conteudo = 'oi t120'),
              (select count(*)::int from public.chamados where titulo = 'T120 Fiscal'),
              (select count(*)::int from public.usuarios where id = 'e1200000-0000-0000-0000-00000000000b'))::text,
          (select row(msgs, demandas, linha)::text from t120_bia_sem_marca), 'aal1: o mesmo de antes');

-- 41–44: dono que não é administrador (2.4) também precisa do fator
reset role;
select set_config('request.jwt.claims', '', true);
update public.usuarios set papel = 'atendente' where id = 'e1200000-0000-0000-0000-00000000000d';
set local role authenticated;
select pg_temp.como('e1200000-0000-0000-0000-00000000000d', 'aal1');
select is(public.exige_segundo_fator(), true, 'dono não administrador precisa do fator');
select throws_ok($$ select public.salvar_agente('atendimento', '{"descricao":"T120"}'::jsonb) $$, '42501',
  'Confirme o código do aplicativo autenticador para continuar.', 'dono em aal1: não altera agentes');
select pg_temp.como('e1200000-0000-0000-0000-00000000000d', 'aal2');
select lives_ok($$ select public.salvar_agente('atendimento', '{"descricao":"T120"}'::jsonb) $$, 'dono em aal2: altera');
select is((select descricao from public.agentes where slug = 'atendimento'), 'T120', 'gravou');

-- 45–49: trabalhador (chave de serviço, token sem "sub"): nada muda
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(public.eh_admin_de('e1200000-0000-0000-0000-00000000000a'), true, 'trabalhador: administrador continua administrador');
select is(public.usuario_liberado('e1200000-0000-0000-0000-00000000000a'), true, 'trabalhador: administrador liberado');
select is(public.tem_nivel_de('e1200000-0000-0000-0000-00000000000b', 'demandas', 'meu_setor'), true, 'trabalhador: nível padrão vale');
select is(public.tem_nivel_de('e1200000-0000-0000-0000-00000000000b', 'demandas', 'todas'), false, 'trabalhador: e só ele');
select is(public.exige_segundo_fator_de('e1200000-0000-0000-0000-00000000000d'), true, 'trabalhador consulta quem precisa (dono)');

-- 50–55: telefone da equipe único (normalizado) e diferente dos contatos (5.3)
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.usuarios (id, nome, email, telefone) values
  ('e1200000-0000-0000-0000-000000000011', 'U1 T120', 'u1@t120.local', '5511999990000');
select throws_ok($$ insert into public.usuarios (id, nome, email, telefone) values
  ('e1200000-0000-0000-0000-000000000012', 'U2 T120', 'u2@t120.local', '551199990000') $$, '23505', null,
  'mesmo telefone sem o nono dígito: recusado');
select lives_ok($$ insert into public.usuarios (id, nome, email, telefone, ativo) values
  ('e1200000-0000-0000-0000-000000000013', 'U3 T120', 'u3@t120.local', '551199990000', false) $$, 'arquivado não conta');
select throws_ok($$ update public.usuarios set ativo = true where id = 'e1200000-0000-0000-0000-000000000013' $$, '23505', null,
  'mas não volta com o telefone repetido');
select throws_ok($$ update public.usuarios set telefone = '553177771234' where id = 'e1200000-0000-0000-0000-00000000000b' $$,
  null, 'Este telefone já é de um contato de cliente.', 'telefone de contato ativo na equipe: recusado');
select throws_ok($$ insert into public.contatos (nome, telefone) values ('Outro T120', '551199990000') $$,
  null, 'Este telefone já é de alguém da equipe.', 'telefone da equipe como contato: recusado');
update public.contatos set ativo = false where id = 'e1230000-0000-0000-0000-000000000001';
select lives_ok($$ update public.usuarios set telefone = '553177771234' where id = 'e1200000-0000-0000-0000-00000000000b' $$,
  'contato arquivado libera o número');

-- 56–62: cadastro do aplicativo vira aviso ao dono (2.5)
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret) values
  ('e1240000-0000-0000-0000-000000000001', 'e1200000-0000-0000-0000-00000000000a', 'T120', 'totp', 'verified', now(), now(), 'x');
set local role authenticated;
select pg_temp.como('e1200000-0000-0000-0000-00000000000b', 'aal1');
select is(public.registrar_fator_cadastrado(), 0, 'sem aplicativo cadastrado: nada a registrar');
select pg_temp.como('e1200000-0000-0000-0000-00000000000a', 'aal2');
select is(public.registrar_fator_cadastrado(), 1, 'registra o aplicativo da própria pessoa');
select is(public.registrar_fator_cadastrado(), 0, 'chamar de novo não repete');
reset role;
select is((select count(*)::int from public.auditoria_acessos
  where acao = 'cadastrar_fator' and usuario_id = 'e1200000-0000-0000-0000-00000000000a'
    and entidade_id = 'e1240000-0000-0000-0000-000000000001'), 1, 'fica na auditoria');
select is((select usuario_id from public.alertas where mensagem = 'Admin T120 cadastrou um aplicativo de código'),
  'e1200000-0000-0000-0000-00000000000d'::uuid, 'o aviso vai para o dono');
select is((select count(*)::int from public.alertas where mensagem like '%cadastrou um aplicativo de código'), 1, 'um aviso só');
select ok(not exists (select 1 from public.auditoria_acessos where acao = 'cadastrar_fator'
  and usuario_id = 'e1200000-0000-0000-0000-00000000000b'), 'nada em nome de outra pessoa');

select * from finish();
rollback;
