-- Auditoria 6.11, 6.12, 6.14 e 2.9: funções antigas fechadas ao visitante e com search_path vazio, índices que faltavam,
-- nenhum grant de tabela ao visitante (nem nas tabelas futuras) e o papel painel_fila, que só enfileira no pg-boss.
-- A prova de que o painel enfileira com esse papel (e não lê public.mensagens) está em apps/painel/src/lib/fila-papel.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- 1–2 (6.12): nenhuma função security definer do public executável pelo visitante, fora aviso_login (tela de entrar);
-- nenhuma função do public com search_path = public.
select is_empty($$
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('aviso_login')
$$, 'visitante não executa função security definer do public (só aviso_login)');
select is_empty($$
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proconfig::text ~ 'search_path=(public|"public")'
$$, 'nenhuma função do public com search_path = public');

-- 3–6: o visitante é recusado; a equipe continua chamando (as políticas usam essas funções).
set local role anon;
select throws_ok($$ select public.eh_admin() $$, '42501', null, 'visitante não chama eh_admin');
select throws_ok($$ select public.pode_ver_conversa(gen_random_uuid()) $$, '42501', null, 'visitante não chama pode_ver_conversa');
reset role;
select ok(has_function_privilege('authenticated', 'public.eh_admin()', 'execute'), 'a equipe chama eh_admin (políticas)');
select ok(has_function_privilege('authenticated', 'public.nota_interna(uuid, text)', 'execute'), 'a equipe chama nota_interna');
-- Revisão: guarda contra deriva de ACL (grant explícito na migração) das RPCs e ajudantes fechados ao visitante.
select is_empty($$
  select f from unnest(array['public.eh_usuario_ativo()', 'public.eh_admin()', 'public.meus_setores()', 'public.tem_permissao(text)',
    'public.pode_ver_chamado(uuid)', 'public.pode_ver_conversa(uuid)', 'public.marcar_alerta_lido(uuid)', 'public.assumir_conversa(uuid)',
    'public.devolver_ao_agente(uuid)', 'public.registrar_resposta(uuid, text, text, text, text)', 'public.nota_interna(uuid, text)',
    'public.transferir_chamado(uuid, uuid, uuid)', 'public.concluir_chamado(uuid)', 'public.anonimizar_contato(uuid)',
    'public.definir_preco(uuid, uuid, numeric)', 'public.vincular_contato_conversa(uuid, uuid)']) f
  where not has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute')
$$, 'equipe e trabalhador continuam chamando as RPCs e ajudantes');

-- 7–13 (6.11): índices das leituras do painel e da retenção.
select has_index('public', 'chamado_eventos', 'chamado_eventos_chamado_idx', array['chamado_id', 'criado_em'], 'chamado_eventos por demanda');
select has_index('public', 'decisoes_agente', 'decisoes_agente_conversa_idx', array['conversa_id', 'criado_em'], 'decisoes_agente por conversa');
select has_index('public', 'decisoes_agente', 'decisoes_agente_criado_idx', array['criado_em'], 'decisoes_agente por data (retenção)');
select has_index('public', 'assistente_mensagens', 'assistente_mensagens_criado_idx', array['criado_em'], 'assistente_mensagens por data');
select has_index('public', 'alertas', 'alertas_setor_idx', array['setor_id'], 'alertas por setor');
select has_index('public', 'alertas', 'alertas_usuario_idx', array['usuario_id'], 'alertas por pessoa');
select has_index('public', 'alertas', 'alertas_criado_idx', array['criado_em'], 'alertas por data (retenção)');

-- 14–17 (6.14): o visitante não tem grant em tabela, view ou sequência do public, nem nas que forem criadas depois.
select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')
$$, 'visitante sem grant em tabela ou view do public');
select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and case when c.relkind = 'S' then has_sequence_privilege('anon', c.oid, 'usage, select, update') else false end
$$, 'visitante sem grant em sequência do public');
create table public.t133_futura (id bigint generated always as identity primary key);
select ok(not has_table_privilege('anon', 'public.t133_futura', 'select, insert, update, delete, truncate'), 'tabela nova: nada ao visitante');
select ok(has_table_privilege('authenticated', 'public.t133_futura', 'select'), 'tabela nova: a equipe continua com o grant padrão (a RLS filtra)');

-- 18–19 (6.12): eh_telefone_do_assistente não serve de oráculo a quem não é da equipe ativa; o banco e o trabalhador
-- (sem auth.uid()) e a equipe continuam vendo.
insert into auth.users (id, email) values ('e1330000-0000-0000-0000-00000000000a', 'dono133@pgtap.local');
insert into public.usuarios (id, nome, email, papel, telefone, permissoes) values
  ('e1330000-0000-0000-0000-00000000000a', 'Dono 133', 'dono133@pgtap.local', 'admin', '5531977771330', '{assistente_site,assistente_whatsapp}');
select ok(public.eh_telefone_do_assistente('5531977771330'), 'sem sessão (trabalhador): reconhece o telefone da equipe');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1330000-0000-0000-0000-0000000000ff","role":"authenticated"}', true);
select ok(not public.eh_telefone_do_assistente('5531977771330'), 'sessão de quem não é da equipe ativa: sempre falso');
reset role;
select set_config('request.jwt.claims', '', true);

-- 20–29 (2.9): papel painel_fila, sem login na migração (o dono cria a senha), só o que o send do pg-boss usa.
select has_role('painel_fila', 'papel painel_fila existe');
select ok(not (select rolcanlogin from pg_roles where rolname = 'painel_fila'), 'painel_fila nasce sem login');
select ok(not has_table_privilege('painel_fila', 'public.mensagens', 'select'), 'painel_fila não lê mensagens');
select ok(not has_table_privilege('painel_fila', 'public.usuarios', 'select'), 'painel_fila não lê usuarios');
select ok(not has_function_privilege('authenticated', 'public.conceder_fila_painel()', 'execute')
  and not has_function_privilege('anon', 'public.conceder_fila_painel()', 'execute')
  and not has_function_privilege('service_role', 'public.conceder_fila_painel()', 'execute'), 'só o dono do banco concede a fila');
-- O esquema pgboss só existe depois que o trabalhador sobe (num banco recém-zerado, não): as conferências abaixo valem
-- quando ele existe, e a função as aplica de novo quando o trabalhador cria o esquema.
select public.conceder_fila_painel();
select ok(to_regnamespace('pgboss') is null or has_schema_privilege('painel_fila', 'pgboss', 'usage'), 'painel_fila usa o esquema pgboss');
select ok(to_regclass('pgboss.job') is null
  or (has_table_privilege('painel_fila', 'pgboss.job', 'insert') and has_column_privilege('painel_fila', 'pgboss.job', 'id', 'select')),
  'painel_fila insere jobs');
select ok(to_regclass('pgboss.job') is null
  or not has_table_privilege('painel_fila', 'pgboss.job', 'update, delete, truncate'), 'painel_fila não altera nem apaga jobs');
select ok(to_regclass('pgboss.queue') is null
  or (has_table_privilege('painel_fila', 'pgboss.queue', 'select') and not has_table_privilege('painel_fila', 'pgboss.queue', 'insert, update, delete')),
  'painel_fila só lê as filas');
select ok(to_regclass('pgboss.version') is null
  or (has_table_privilege('painel_fila', 'pgboss.version', 'select') and not has_table_privilege('painel_fila', 'pgboss.version', 'update')),
  'painel_fila só lê a versão');

select * from finish();
rollback;
