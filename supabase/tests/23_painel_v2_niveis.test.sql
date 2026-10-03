begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('d1100000-0000-0000-0000-00000000000a', 'admin@niveis.local'),
  ('d1100000-0000-0000-0000-00000000000b', 'bia@niveis.local'),
  ('d1100000-0000-0000-0000-00000000000c', 'caio@niveis.local'),
  ('d1100000-0000-0000-0000-00000000000d', 'wal@niveis.local'),
  ('d1100000-0000-0000-0000-00000000000e', 'zeca@niveis.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('d1100000-0000-0000-0000-00000000000a', 'Admin N', 'admin@niveis.local', 'admin', '{}'),
  ('d1100000-0000-0000-0000-00000000000b', 'Bia N', 'bia@niveis.local', 'atendente', '{}'),
  ('d1100000-0000-0000-0000-00000000000c', 'Caio N', 'caio@niveis.local', 'atendente',
   '{editar_clientes,editar_precos,emitir_notas,assistente_site,treinar_agente}'),
  ('d1100000-0000-0000-0000-00000000000d', 'Wal N', 'wal@niveis.local', 'atendente', '{assistente_whatsapp}'),
  ('d1100000-0000-0000-0000-00000000000e', 'Zeca N', 'zeca@niveis.local', 'atendente', '{qualquer_coisa}');

select is((select count(*)::int from public.permissao_niveis), 23, 'catálogo: 23 níveis em 9 módulos');
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000b'),
  '{"atendimento":"meus_setores","demandas":"meu_setor","clientes":"ver","precos":"ver","notas":"ver","assistente":"sem_acesso","treinar":"nao","prazos":"sim","configuracoes":"nao"}'::jsonb,
  'sem marcação: os níveis que reproduzem o de hoje');
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000c') - array['atendimento', 'demandas', 'prazos', 'configuracoes'],
  '{"clientes":"arquivar","precos":"mudar","notas":"corrigir","assistente":"site","treinar":"sim"}'::jsonb,
  'cada marcação antiga vira o nível equivalente (editar_clientes = Editar e arquivar)');
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000d') ->> 'assistente', 'site_whatsapp', 'só WhatsApp vira Site e WhatsApp (P2)');
select is((select permissoes from public.usuarios where id = 'd1100000-0000-0000-0000-00000000000d'),
  '{assistente_site,assistente_whatsapp}'::text[], 'a cópia antiga acompanha o nível');
select is((select permissoes from public.usuarios where id = 'd1100000-0000-0000-0000-00000000000e'), '{}'::text[], 'marcação desconhecida some da cópia');
select is((select count(*)::int from public.usuario_permissoes where usuario_id = 'd1100000-0000-0000-0000-00000000000b'), 9,
  'pessoa nova ganha os 9 módulos');
select is(public.niveis_da_permissao_legada('{emitir_notas}', '{}'::jsonb),
  '{"clientes":"ver","precos":"ver","notas":"corrigir","assistente":"sem_acesso","treinar":"nao"}'::jsonb,
  'a conversão que a migração usou nas pessoas que já existiam');

-- Painel novo baixa Clientes para "Ver e editar": a cópia antiga continua com editar_clientes.
update public.usuario_permissoes set nivel = 'editar' where usuario_id = 'd1100000-0000-0000-0000-00000000000c' and modulo = 'clientes';
select ok('editar_clientes' = any ((select permissoes from public.usuarios where id = 'd1100000-0000-0000-0000-00000000000c')::text[]),
  '"Ver e editar" aparece como editar_clientes na cópia');
-- Painel antigo da homologação salva a pessoa mudando outra coisa (tira treinar): não promove para arquivar (foco da revisão 2).
update public.usuarios set permissoes = '{editar_clientes,editar_precos,emitir_notas,assistente_site}' where id = 'd1100000-0000-0000-0000-00000000000c';
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000c') ->> 'clientes', 'editar', 'painel antigo não promove "Ver e editar"');
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000c') ->> 'treinar', 'nao', 'painel antigo tira "Treinar o agente"');
update public.usuarios set permissoes = '{}' where id = 'd1100000-0000-0000-0000-00000000000c';
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000c') ->> 'clientes', 'ver', 'painel antigo tira editar_clientes');
-- Nível novo aparece na cópia (o trabalhador antigo da homologação lê o array).
update public.usuario_permissoes set nivel = 'site_whatsapp' where usuario_id = 'd1100000-0000-0000-0000-00000000000c' and modulo = 'assistente';
select is((select permissoes from public.usuarios where id = 'd1100000-0000-0000-0000-00000000000c'),
  '{assistente_site,assistente_whatsapp}'::text[], 'nível novo aparece na cópia antiga');

update public.usuario_permissoes set nivel = 'editar' where usuario_id = 'd1100000-0000-0000-0000-00000000000b' and modulo = 'clientes';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1100000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select ok(public.tem_permissao('clientes', 'editar'), 'Bia: Ver e editar');
select ok(not public.tem_permissao('clientes', 'arquivar'), 'Bia: não arquiva');
select ok(public.tem_permissao('editar_clientes'), 'adaptador: editar_clientes = "Ver e editar" ou mais');
select throws_ok($$ select public.tem_permissao('clientes', 'tudo') $$, 'P0001', 'Nível desconhecido: clientes/tudo.',
  'nível digitado errado não passa calado');
select throws_ok($$ insert into public.usuario_permissoes (usuario_id, modulo, nivel) values ('d1100000-0000-0000-0000-00000000000e', 'demandas', 'todas') $$,
  '42501', null, 'atendente não muda nível');

select set_config('request.jwt.claims', '{"sub":"d1100000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ update public.usuario_permissoes set nivel = 'todas' where usuario_id = 'd1100000-0000-0000-0000-00000000000b' and modulo = 'demandas' $$,
  'administrador muda o nível');
select ok(not public.tem_nivel('assistente', 'site'), 'tem_nivel: administrador sem a marcação do assistente não usa o assistente (como hoje)');
select ok(public.tem_permissao('assistente', 'site'), 'tem_permissao: administrador passa');
reset role;
select is((select count(*)::int from public.auditoria_acessos
           where entidade = 'usuario_permissoes' and usuario_id = 'd1100000-0000-0000-0000-00000000000a'), 1, 'auditoria guarda quem mudou o nível');
select has_column('public', 'usuarios', 'cargo', 'cargo');
select has_column('public', 'usuarios', 'observacoes', 'observações');
select has_column('public', 'usuarios', 'ultimo_acesso_em', 'último acesso');

select * from finish();
rollback;
