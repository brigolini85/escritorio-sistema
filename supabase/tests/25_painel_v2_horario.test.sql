begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- 05/10/2026 é segunda; 03/10 é sábado; 04/10 é domingo.
insert into auth.users (id, email) values
  ('d2500000-0000-0000-0000-00000000000a', 'admin@horario.local'), ('d2500000-0000-0000-0000-00000000000b', 'bia@horario.local'),
  ('d2500000-0000-0000-0000-00000000000c', 'ex@horario.local'), ('d2500000-0000-0000-0000-00000000000d', 'semcadastro@horario.local'),
  ('d2500000-0000-0000-0000-00000000000e', 'eli@horario.local');
insert into public.usuarios (id, nome, email, papel) values
  ('d2500000-0000-0000-0000-00000000000a', 'Admin H', 'admin@horario.local', 'admin'),
  ('d2500000-0000-0000-0000-00000000000b', 'Bia H', 'bia@horario.local', 'atendente'),
  ('d2500000-0000-0000-0000-00000000000c', 'Ex H', 'ex@horario.local', 'atendente'),
  ('d2500000-0000-0000-0000-00000000000e', 'Eli H', 'eli@horario.local', 'atendente');
update public.usuarios set ativo = false where id = 'd2500000-0000-0000-0000-00000000000c';
update public.usuarios set horario_acesso = '{"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}'
where id in ('d2500000-0000-0000-0000-00000000000b', 'd2500000-0000-0000-0000-00000000000c');
update public.usuario_permissoes set nivel = 'editar' where usuario_id = 'd2500000-0000-0000-0000-00000000000b' and modulo = 'clientes';
insert into public.usuario_setores (usuario_id, setor_id) select 'd2500000-0000-0000-0000-00000000000b', id from public.setores where nome = 'Fiscal';
insert into public.chamados (id, setor_id, titulo) select 'd2530000-0000-0000-0000-000000000001', id, 'H F1' from public.setores where nome = 'Fiscal';

-- Formato (1 a 7)
select ok(public.horario_valido(null), 'vazio = sem restrição');
select ok(public.horario_valido('{"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}'), 'o padrão do spec');
select ok(not public.horario_valido('{"semana":{"de":"08:00","ate":"18:00"},"sabado":null}'), 'falta o domingo');
select ok(not public.horario_valido('{"semana":{"de":"18:00","ate":"08:00"},"sabado":null,"domingo":null}'), 'fim antes do início');
select ok(not public.horario_valido('{"semana":{"de":"8h","ate":"18:00"},"sabado":null,"domingo":null}'), 'hora fora do formato');
select ok(not public.horario_valido('{"semana":null,"sabado":null,"domingo":null,"feriado":null}'), 'dia desconhecido');
select throws_ok($$ update public.usuarios set horario_acesso = '{"semana":1}' where id = 'd2500000-0000-0000-0000-00000000000b' $$,
  '23514', null, 'o banco recusa horário inválido');

-- Regra (8 a 19)
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 12:00-03'), 'segunda 12:00 entra');
select ok(not public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 07:59-03'), 'segunda 07:59 ainda não');
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 08:00-03'), 'segunda 08:00 entra');
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 18:00-03'), 'segunda 18:00: o minuto final entra (P7)');
select ok(not public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 18:01-03'), 'segunda 18:01 não entra');
select ok(not public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-03 10:00-03'), 'sábado bloqueado');
select ok(not public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-04 10:00-03'), 'domingo bloqueado');
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 20:30+00'), '20:30 UTC = 17:30 em Brasília');
update public.usuarios set horario_acesso = '{"semana":{"de":"08:00","ate":"18:00"},"sabado":{"de":"08:00","ate":"12:00"},"domingo":null}'
where id = 'd2500000-0000-0000-0000-00000000000b';
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-03 11:00-03'), 'sábado liberado das 08 às 12');
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}'
where id in ('d2500000-0000-0000-0000-00000000000a', 'd2500000-0000-0000-0000-00000000000b');
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000a', '2026-10-04 03:00-03'), 'administrador nunca é bloqueado');
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000e', '2026-10-04 03:00-03'), 'sem horário = sem restrição (quem já existia, P4)');
select ok(not public.horario_permite('d2500000-0000-0000-0000-00000000000c', '2026-10-05 12:00-03'), 'arquivado nunca');

-- Bia com todos os dias bloqueados: fora do horário agora, seja quando for que o teste rode (20 a 26)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2500000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select ok(not public.eh_usuario_ativo(), 'fora do horário: não está liberada');
select is((select count(*)::int from public.chamados where titulo like 'H %'), 0, 'fora do horário: não lê as demandas (nem pelo Realtime)');
select throws_ok($$ select public.nota_interna('d2530000-0000-0000-0000-000000000001', 'nota H') $$,
  'P0001', 'sem acesso a este chamado', 'fora do horário: não grava na demanda');
select throws_ok($$ insert into public.clientes (razao_social, cnpj) values ('H Nova', '99888777000166') $$, '42501', null,
  'fora do horário: não cadastra, mesmo com "Ver e editar"');
select throws_ok($$ select public.definir_tamanho_letra('grande') $$, 'P0001', 'Fora do seu horário de acesso.', 'fora do horário: nem preferência');
select is(public.situacao_acesso() ->> 'situacao', 'fora_do_horario', 'situação: fora do horário');
select ok(not public.pode_acessar_agora(), 'pode_acessar_agora: não');

-- Administrador com o mesmo horário bloqueado (27 a 30)
select set_config('request.jwt.claims', '{"sub":"d2500000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.chamados where titulo like 'H %'), 1, 'administrador lê a qualquer hora');
select is(public.situacao_acesso() ->> 'situacao', 'liberado', 'administrador: liberado');
select isnt((select ultimo_acesso_em from public.usuarios where id = 'd2500000-0000-0000-0000-00000000000a'), null, 'último acesso gravado');
select is((select count(*)::int from public.auditoria_acessos
           where entidade = 'usuarios' and entidade_id = 'd2500000-0000-0000-0000-00000000000a'
             and detalhes -> 'depois' ->> 'ultimo_acesso_em' is not null), 0, 'último acesso não entra na auditoria (P8)');

-- Arquivado e sem cadastro (31 e 32)
select set_config('request.jwt.claims', '{"sub":"d2500000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.situacao_acesso() ->> 'situacao', 'inativo', 'arquivado: inativo');
select set_config('request.jwt.claims', '{"sub":"d2500000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(public.situacao_acesso() ->> 'situacao', 'sem_cadastro', 'sem cadastro no painel');

-- 33: a equipe não consulta o horário de outra pessoa
select throws_ok($$ select public.horario_permite('d2500000-0000-0000-0000-00000000000b', now()) $$, '42501', null,
  'horario_permite é só do banco e do trabalhador');

-- 34: toda função de gravação que a equipe pode chamar passa por uma trava (pessoa ativa e no horário). Foco da revisão 4.
reset role;
select is(array(
  select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('authenticated', p.oid, 'execute')
    and p.prosrc ~* '\m(insert|update|delete)\M'
    and p.prosrc !~ '(eh_usuario_ativo|eh_admin|pode_ver_chamado|pode_ver_conversa|tem_permissao|tem_nivel|meus_setores|pode_acessar_agora|demanda_para_agir|exigir_arquivar|exigir_acesso|usuario_liberado|horario_permite)'
  order by 1), '{}'::text[], 'nenhuma função de gravação da equipe sem trava');

select * from finish();
rollback;
