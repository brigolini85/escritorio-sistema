begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Complementa o 27 (P12): as outras 7 colunas do administrador, o caminho do trabalhador (service_role), inserir/apagar
-- a linha de configurações e "excluir de vez" setor/serviço (spec 5.2: só o administrador).

insert into auth.users (id, email) values
  ('d27b0000-0000-0000-0000-00000000000a', 'admin@config27b.local'), ('d27b0000-0000-0000-0000-00000000000b', 'conf@config27b.local');
insert into public.usuarios (id, nome, email, papel) values
  ('d27b0000-0000-0000-0000-00000000000a', 'Admin 27b', 'admin@config27b.local', 'admin'),
  ('d27b0000-0000-0000-0000-00000000000b', 'Conf 27b', 'conf@config27b.local', 'atendente');
update public.usuario_permissoes set nivel = 'sim'
where modulo = 'configuracoes' and usuario_id = 'd27b0000-0000-0000-0000-00000000000b';
insert into public.setores (id, nome) values
  ('d27b0000-0000-0000-0000-0000000000a1', 'Setor 27b'), ('d27b0000-0000-0000-0000-0000000000a2', 'Setor 27b admin');
insert into public.servicos (id, nome) values
  ('d27b0000-0000-0000-0000-0000000000b1', 'Serviço 27b'), ('d27b0000-0000-0000-0000-0000000000b2', 'Serviço 27b admin');
insert into public.feriados (data, descricao) values ('2026-11-20', 'Feriado 27b');
insert into public.respostas_prontas (id, pergunta, resposta) values
  ('d27b0000-0000-0000-0000-0000000000c1', 'Pergunta 27b', 'Resposta 27b');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d27b0000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

-- 1–7: as 7 colunas que o 27 não cobre
select throws_ok($$ update public.configuracoes set alerta_ia_80_mes = '2026-10' where id = 1 $$,
  'P0001', 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'Configurações Sim: não muda alerta_ia_80_mes');
select throws_ok($$ update public.configuracoes set minutos_alerta_fila = 99 where id = 1 $$,
  'P0001', 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'Configurações Sim: não muda minutos_alerta_fila');
select throws_ok($$ update public.configuracoes set modelo_conversa = 'outro-modelo' where id = 1 $$,
  'P0001', 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'Configurações Sim: não muda modelo_conversa');
select throws_ok($$ update public.configuracoes set modelo_rapido = 'outro-modelo' where id = 1 $$,
  'P0001', 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'Configurações Sim: não muda modelo_rapido');
select throws_ok($$ update public.configuracoes set precos_modelos = '{}' where id = 1 $$,
  'P0001', 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'Configurações Sim: não muda precos_modelos');
select throws_ok($$ update public.configuracoes set telefone_dono = '5511999990000' where id = 1 $$,
  'P0001', 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'Configurações Sim: não muda telefone_dono');
select throws_ok($$ update public.configuracoes set email_alertas = 'outro@config27b.local' where id = 1 $$,
  'P0001', 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'Configurações Sim: não muda email_alertas');

-- 8–10: a linha única de configurações não se cria nem se apaga sem ser administrador
select throws_ok($$ insert into public.configuracoes (id) values (1) $$, '42501', null, 'Configurações Sim: não insere configurações');
delete from public.configuracoes where id = 1;
reset role;
select is((select count(*)::int from public.configuracoes), 1, 'Configurações Sim: não apaga configurações');
select is((select minutos_alerta_fila from public.configuracoes where id = 1), 30, 'nada das colunas do administrador mudou');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d27b0000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

-- 11–19: setor e serviço — cadastra e altera, mas não exclui de vez
select lives_ok($$ update public.setores set nome = 'Setor 27b alterado' where id = 'd27b0000-0000-0000-0000-0000000000a1' $$,
  'Configurações Sim: altera setor');
select lives_ok($$ insert into public.servicos (nome) values ('Serviço 27b novo') $$, 'Configurações Sim: cadastra serviço');
select lives_ok($$ update public.servicos set ativo = false where id = 'd27b0000-0000-0000-0000-0000000000b1' $$,
  'Configurações Sim: desativa serviço');
delete from public.setores where id = 'd27b0000-0000-0000-0000-0000000000a1';
delete from public.servicos where id = 'd27b0000-0000-0000-0000-0000000000b1';
-- feriado e resposta pronta podem ser apagados (não levam nada junto)
delete from public.feriados where data = '2026-11-20';
delete from public.respostas_prontas where id = 'd27b0000-0000-0000-0000-0000000000c1';
reset role;
select is((select nome from public.setores where id = 'd27b0000-0000-0000-0000-0000000000a1'), 'Setor 27b alterado',
  'Configurações Sim: a alteração do setor entrou');
select is((select count(*)::int from public.setores where id = 'd27b0000-0000-0000-0000-0000000000a1'), 1,
  'Configurações Sim: não exclui setor de vez');
select is((select count(*)::int from public.servicos where id = 'd27b0000-0000-0000-0000-0000000000b1'), 1,
  'Configurações Sim: não exclui serviço de vez');
select is((select ativo from public.servicos where id = 'd27b0000-0000-0000-0000-0000000000b1'), false,
  'Configurações Sim: a desativação do serviço entrou');
select is((select count(*)::int from public.feriados where data = '2026-11-20'), 0, 'Configurações Sim: apaga feriado');
select is((select count(*)::int from public.respostas_prontas where id = 'd27b0000-0000-0000-0000-0000000000c1'), 0,
  'Configurações Sim: apaga resposta pronta');

-- 20–23: o administrador exclui de vez
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d27b0000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
delete from public.setores where id = 'd27b0000-0000-0000-0000-0000000000a2';
delete from public.servicos where id = 'd27b0000-0000-0000-0000-0000000000b2';
select lives_ok($$ update public.configuracoes set minutos_alerta_fila = 45, email_alertas = 'dono@config27b.local' where id = 1 $$,
  'administrador muda as colunas do administrador');
reset role;
select is((select count(*)::int from public.setores where id = 'd27b0000-0000-0000-0000-0000000000a2'), 0, 'administrador exclui setor');
select is((select count(*)::int from public.servicos where id = 'd27b0000-0000-0000-0000-0000000000b2'), 0, 'administrador exclui serviço');
select is((select minutos_alerta_fila from public.configuracoes where id = 1), 45, 'a alteração do administrador entrou');

-- 24–25: o trabalhador (chave de serviço, sem pessoa) pausa o agente
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$ update public.configuracoes set agente_pausado = true where id = 1 $$, 'trabalhador pausa o agente');
reset role;
select is((select agente_pausado from public.configuracoes where id = 1), true, 'a pausa do trabalhador entrou');

select * from finish();
rollback;
