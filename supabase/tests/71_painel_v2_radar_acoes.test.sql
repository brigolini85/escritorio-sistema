-- Parte I5, Task 3 (spec 7E.7, 7E.8; D11-D14, D17): o que a pessoa faz com a novidade (demanda, aviso, descarte, mensagem), os clientes
-- possivelmente afetados, o envio aos clientes (aprovação de uma pessoa do setor, as pausas e o limite do dia compartilhado) e os avisos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(127);

update public.usuarios set dono = false where dono;   -- outro teste ou e2e pode ter deixado um dono
insert into auth.users (id, email) values
  ('fd000000-0000-0000-0000-00000000000a', 'dono@i5a.local'), ('fd000000-0000-0000-0000-00000000000c', 'ana@i5a.local'),
  ('fd000000-0000-0000-0000-00000000000d', 'paula@i5a.local'), ('fd000000-0000-0000-0000-00000000000e', 'rui@i5a.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('fd000000-0000-0000-0000-00000000000a', 'I5A Dono', 'dono@i5a.local', 'admin', '{}'),
  ('fd000000-0000-0000-0000-00000000000c', 'I5A Ana', 'ana@i5a.local', 'atendente', '{}'),
  ('fd000000-0000-0000-0000-00000000000d', 'I5A Paula', 'paula@i5a.local', 'atendente', '{}'),
  ('fd000000-0000-0000-0000-00000000000e', 'I5A Rui', 'rui@i5a.local', 'atendente', '{}');
update public.usuarios set dono = true where id = 'fd000000-0000-0000-0000-00000000000a';
insert into public.usuario_setores (usuario_id, setor_id) values
  ('fd000000-0000-0000-0000-00000000000c', (select id from public.setores where nome = 'Fiscal')),
  ('fd000000-0000-0000-0000-00000000000d', (select id from public.setores where nome = 'Pessoal')),
  ('fd000000-0000-0000-0000-00000000000e', (select id from public.setores where nome = 'Fiscal'));
insert into public.usuario_permissoes (usuario_id, modulo, nivel) values
  ('fd000000-0000-0000-0000-00000000000c', 'treinar', 'sim'), ('fd000000-0000-0000-0000-00000000000d', 'treinar', 'sim')
  on conflict (usuario_id, modulo) do update set nivel = 'sim';

insert into public.clientes (id, razao_social, cnpj, regime, uf, cidade, segmentos, ativo) values
  ('fd100000-0000-0000-0000-00000000000a', 'I5A Padaria Sol', '21448390000107', 'Simples Nacional', 'MG', 'Conselheiro Lafaiete', '{comercio}', true),
  ('fd100000-0000-0000-0000-00000000000b', 'I5A Mercado Lua', '11222333000181', 'Lucro Presumido', 'MG', 'Conselheiro Lafaiete', '{comercio}', true),
  ('fd100000-0000-0000-0000-00000000000c', 'I5A Oficina Sul', '12345678000195', 'Lucro Real', 'SP', 'São Paulo', '{servicos}', true);
-- João, Maria, Beto, Caio, Duda (do enunciado) e seis contatos da Oficina Sul para os testes de limite e de fila
insert into public.contatos (id, nome, telefone, agente_pausado) values
  ('fd500000-0000-0000-0000-00000000000a', 'I5A João', '5531999990501', false),
  ('fd500000-0000-0000-0000-00000000000b', 'I5A Maria', '5531999990502', false),
  ('fd500000-0000-0000-0000-00000000000c', 'I5A Beto', '5531999990503', false),
  ('fd500000-0000-0000-0000-00000000000d', 'I5A Caio', '5531999990504', false),
  ('fd500000-0000-0000-0000-00000000000e', 'I5A Duda', '5531999990505', true),
  ('fd500000-0000-0000-0000-000000000011', 'I5A Edu', '5531999990511', false),
  ('fd500000-0000-0000-0000-000000000012', 'I5A Fabi', '5531999990512', false),
  ('fd500000-0000-0000-0000-000000000013', 'I5A Gui', '5531999990513', false),
  ('fd500000-0000-0000-0000-000000000014', 'I5A Hugo', '5531999990514', false),
  ('fd500000-0000-0000-0000-000000000015', 'I5A Iara', '5531999990515', false),
  ('fd500000-0000-0000-0000-000000000016', 'I5A Joel', '5531999990516', false);
insert into public.contato_clientes (contato_id, cliente_id, perfil) values
  ('fd500000-0000-0000-0000-00000000000a', 'fd100000-0000-0000-0000-00000000000a', 'personalizado'),
  ('fd500000-0000-0000-0000-00000000000b', 'fd100000-0000-0000-0000-00000000000a', 'personalizado'),
  ('fd500000-0000-0000-0000-00000000000b', 'fd100000-0000-0000-0000-00000000000b', 'personalizado'),
  ('fd500000-0000-0000-0000-00000000000c', 'fd100000-0000-0000-0000-00000000000b', 'basico'),
  ('fd500000-0000-0000-0000-00000000000d', 'fd100000-0000-0000-0000-00000000000b', 'personalizado'),
  ('fd500000-0000-0000-0000-00000000000e', 'fd100000-0000-0000-0000-00000000000c', 'personalizado'),
  ('fd500000-0000-0000-0000-000000000011', 'fd100000-0000-0000-0000-00000000000c', 'personalizado'),
  ('fd500000-0000-0000-0000-000000000012', 'fd100000-0000-0000-0000-00000000000c', 'personalizado'),
  ('fd500000-0000-0000-0000-000000000013', 'fd100000-0000-0000-0000-00000000000c', 'personalizado'),
  ('fd500000-0000-0000-0000-000000000014', 'fd100000-0000-0000-0000-00000000000c', 'personalizado'),
  ('fd500000-0000-0000-0000-000000000015', 'fd100000-0000-0000-0000-00000000000c', 'personalizado'),
  ('fd500000-0000-0000-0000-000000000016', 'fd100000-0000-0000-0000-00000000000c', 'personalizado');
insert into public.contato_cliente_setores (contato_id, cliente_id, setor_id, pode_ser_procurado)
select v.contato, v.cliente, (select id from public.setores where nome = 'Fiscal'), v.procurado from (values
  ('fd500000-0000-0000-0000-00000000000a'::uuid, 'fd100000-0000-0000-0000-00000000000a'::uuid, true),
  ('fd500000-0000-0000-0000-00000000000b', 'fd100000-0000-0000-0000-00000000000a', true),
  ('fd500000-0000-0000-0000-00000000000b', 'fd100000-0000-0000-0000-00000000000b', true),
  ('fd500000-0000-0000-0000-00000000000c', 'fd100000-0000-0000-0000-00000000000b', true),     -- Beto é básico: não conta
  ('fd500000-0000-0000-0000-00000000000d', 'fd100000-0000-0000-0000-00000000000b', false),    -- Caio: sem "pode ser procurado"
  ('fd500000-0000-0000-0000-00000000000e', 'fd100000-0000-0000-0000-00000000000c', true),
  ('fd500000-0000-0000-0000-000000000011', 'fd100000-0000-0000-0000-00000000000c', true),
  ('fd500000-0000-0000-0000-000000000012', 'fd100000-0000-0000-0000-00000000000c', true),
  ('fd500000-0000-0000-0000-000000000013', 'fd100000-0000-0000-0000-00000000000c', true),
  ('fd500000-0000-0000-0000-000000000014', 'fd100000-0000-0000-0000-00000000000c', true),
  ('fd500000-0000-0000-0000-000000000015', 'fd100000-0000-0000-0000-00000000000c', true),
  ('fd500000-0000-0000-0000-000000000016', 'fd100000-0000-0000-0000-00000000000c', true)) v (contato, cliente, procurado);
-- conversas de João e Maria (o envio vira mensagem de saída e a pessoa pode assumir a conversa)
insert into public.conversas (id, telefone, contato_id) values
  ('fd700000-0000-0000-0000-00000000000a', '5531999990501', 'fd500000-0000-0000-0000-00000000000a'),
  ('fd700000-0000-0000-0000-00000000000b', '5531999990502', 'fd500000-0000-0000-0000-00000000000b');

-- giros e novidades (inseridas direto, como dono do banco)
insert into public.radar_giros (id, origem, estado, dia, novidades, iniciado_em, terminado_em) values
  ('fd400000-0000-0000-0000-000000000001', 'pedido', 'concluido', '2026-09-20', 1, now(), now());
insert into public.radar_novidades (id, giro_id, titulo, url, url_normalizada, fonte_nome, selo, publicado_em, resumo, impacto, setores, criterios,
  clientes_afetados, vigencia_texto, mensagem_cliente, estado)
select ('fd500000-0000-0000-0000-0000000000' || v.n)::uuid, 'fd400000-0000-0000-0000-000000000001', 'I5A Novidade ' || v.n,
       'https://www.cfc.org.br/novidade-' || v.n, 'cfc.org.br/novidade-' || v.n, 'CFC', 'oficial', '2026-10-20',
       'Resumo simples da novidade número ' || v.n || '.', v.impacto, array[(select id from public.setores where nome = 'Fiscal')],
       '{"segmentos":["comercio"]}', 2, 'a partir de 1º de janeiro', 'Olá! Saiu uma mudança que pode afetar sua empresa.', 'para_decidir'
  from (values ('01', 'alto'), ('02', 'medio'), ('03', 'baixo'), ('04', 'medio'), ('05', 'medio'), ('06', 'alto'), ('07', 'alto'), ('08', 'alto'),
               ('09', 'alto'), ('10', 'alto'), ('11', 'alto'), ('13', 'medio')) v (n, impacto);

-- 1: as tabelas, fora do Realtime, com RLS; a pessoa não escreve direto
select has_table('public', 'radar_envios', 'radar_envios existe');
select has_table('public', 'radar_avisos', 'radar_avisos existe');
select is((select count(*)::int from pg_class where oid in ('public.radar_envios'::regclass, 'public.radar_avisos'::regclass) and relrowsecurity), 2, 'RLS ligada nas duas');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('radar_envios', 'radar_avisos')), 0, 'as duas fora do Realtime');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ insert into public.radar_envios (novidade_id, setor_id, cliente_id, contato_id, texto)
  values ('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'fd100000-0000-0000-0000-00000000000a',
          'fd500000-0000-0000-0000-00000000000a', 'Texto direto de Ana.') $$, '42501', null, 'Ana não insere envio');
select throws_ok($$ insert into public.radar_avisos (tipo, giro_id) values ('resumo', 'fd400000-0000-0000-0000-000000000001') $$, '42501', null, 'Ana não insere aviso');

-- 2: criar_demanda_radar (D12, D17)
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select public.criar_demanda_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal')) $$,
  'P0001', 'Só quem é do setor Fiscal cria a demanda.', 'Paula (Pessoal) não cria no Fiscal');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.criar_demanda_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Pessoal')) $$,
  'P0001', 'Escolha um dos setores da novidade.', 'Ana com setor fora da novidade');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$ select public.criar_demanda_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal')) $$,
  'P0001', 'Novidade não encontrada.', 'Rui (sem treinar) não vê o Radar');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select ok(set_config('i5a.dem', public.criar_demanda_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'))::text, true) is not null,
  'Ana cria a demanda no Fiscal');
select is((public.criar_demanda_radar('fd500000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Fiscal')) ->> 'numero') is not null, true,
  'devolve {id, numero}');
reset role;
select results_eq($$ select cliente_id is null, setor_id = (select id from public.setores where nome = 'Fiscal'), titulo, prioridade::text, origem, criado_por
    from public.chamados where id = (current_setting('i5a.dem')::jsonb ->> 'id')::uuid $$,
  $$ values (true, true, 'Radar: I5A Novidade 01'::text, 'alta'::text, 'sistema'::text, 'fd000000-0000-0000-0000-00000000000c'::uuid) $$,
  'demanda sem empresa, no Fiscal, prioridade alta, origem sistema, criada por Ana');
select ok((select resumo like '%Link: https://www.cfc.org.br/novidade-01%' and resumo like '%Clientes possivelmente afetados: 2%'
             and resumo like '%Fonte: CFC · 20/10/2026%' and resumo like '%Vigência: a partir de 1º de janeiro%'
             from public.chamados where id = (current_setting('i5a.dem')::jsonb ->> 'id')::uuid), 'resumo com fonte, data, link, vigência e clientes afetados');
select results_eq($$ select estado, chamado_id = (current_setting('i5a.dem')::jsonb ->> 'id')::uuid, decidida_por
    from public.radar_novidades where id = 'fd500000-0000-0000-0000-000000000001' $$,
  $$ values ('demanda'::text, true, 'fd000000-0000-0000-0000-00000000000c'::uuid) $$, 'a novidade virou demanda, com a chave e quem decidiu');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.criar_demanda_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal')) $$,
  'P0001', 'Esta novidade já virou a demanda #' || (current_setting('i5a.dem')::jsonb ->> 'numero') || '.', 'não cria duas vezes');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.criar_demanda_radar('fd500000-0000-0000-0000-000000000004', (select id from public.setores where nome = 'Fiscal')) $$,
  'o dono cria sem ser do setor');
select is((select impacto from public.radar_novidades where id = 'fd500000-0000-0000-0000-000000000004'), 'medio', 'novidade de impacto médio');
reset role;
select is((select prioridade::text from public.chamados where titulo = 'Radar: I5A Novidade 04'), 'normal', 'impacto médio: prioridade normal');
-- 02 e 04 usadas acima; devolve 04 e 02 ao estado de origem para os testes seguintes
update public.radar_novidades set estado = 'para_decidir', chamado_id = null, decidida_por = null, decidida_em = null
 where id in ('fd500000-0000-0000-0000-000000000002', 'fd500000-0000-0000-0000-000000000004');

-- 3: avisar_equipe_radar (D13a)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$ select public.avisar_equipe_radar('fd500000-0000-0000-0000-000000000004') $$, 'P0001', 'Novidade não encontrada.', 'Rui não avisa a equipe');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.avisar_equipe_radar('fd500000-0000-0000-0000-000000000004'), 1, 'Ana avisa: um aviso por setor');
reset role;
select results_eq($$ select nivel, setor_id = (select id from public.setores where nome = 'Fiscal'), mensagem from public.alertas
    where mensagem = 'Radar: I5A Novidade 04 · CFC' $$,
  $$ values ('aviso'::text, true, 'Radar: I5A Novidade 04 · CFC'::text) $$, 'o aviso vai ao Fiscal, nível aviso, com título e fonte');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.avisar_equipe_radar('fd500000-0000-0000-0000-000000000004') $$, 'P0001', 'A equipe já foi avisada há pouco.', 'de novo em seguida: recusa');
reset role;
update public.radar_novidades set avisada_em = now() - interval '11 minutes' where id = 'fd500000-0000-0000-0000-000000000004';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.avisar_equipe_radar('fd500000-0000-0000-0000-000000000004'), 1, 'depois de 11 minutos avisa de novo');
reset role;
update public.radar_novidades set avisada_em = null where id = 'fd500000-0000-0000-0000-000000000004';
delete from public.alertas where mensagem = 'Radar: I5A Novidade 04 · CFC';

-- 4: descartar_novidade_radar
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$ select public.descartar_novidade_radar('fd500000-0000-0000-0000-000000000003') $$, 'Ana descarta');
select results_eq($$ select estado, decidida_por from public.radar_novidades where id = 'fd500000-0000-0000-0000-000000000003' $$,
  $$ values ('descartada'::text, 'fd000000-0000-0000-0000-00000000000c'::uuid) $$, 'ficou descartada, por Ana');
select throws_ok($$ select public.descartar_novidade_radar('fd500000-0000-0000-0000-000000000003') $$, 'P0001', 'Esta novidade já foi decidida.', 'descartar de novo');
select throws_ok($$ select public.criar_demanda_radar('fd500000-0000-0000-0000-000000000003', (select id from public.setores where nome = 'Fiscal')) $$,
  'P0001', 'Esta novidade foi descartada.', 'não cria demanda de novidade descartada');
select throws_ok($$ select public.descartar_novidade_radar('fd500000-0000-0000-0000-000000000001') $$, 'P0001', 'Esta novidade já foi decidida.', 'nem a que virou demanda');

-- 5: salvar_mensagem_radar
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_mensagem_radar('fd500000-0000-0000-0000-000000000001', 'Texto novo da mensagem.') $$,
  'P0001', 'Só quem é de um setor da novidade edita a mensagem.', 'Paula (fora dos setores) não edita');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_mensagem_radar('fd500000-0000-0000-0000-000000000001', 'ab') $$,
  'P0001', 'Mensagem ao cliente: de 3 a 1.000 letras.', 'duas letras não valem');
select lives_ok($$ select public.salvar_mensagem_radar('fd500000-0000-0000-0000-000000000001', '  Texto novo da mensagem.  ') $$, 'Ana salva');
select is((select mensagem_cliente from public.radar_novidades where id = 'fd500000-0000-0000-0000-000000000001'), 'Texto novo da mensagem.', 'gravou, sem espaços nas pontas');

-- 6: clientes_afetados_radar (D10)
select results_eq($$ select nome, regime, uf from public.clientes_afetados_radar('fd500000-0000-0000-0000-000000000001') $$,
  $$ values ('I5A Mercado Lua'::text, 'Lucro Presumido'::text, 'MG'::text), ('I5A Padaria Sol', 'Simples Nacional', 'MG') $$,
  'comércio: Mercado Lua e Padaria Sol, em ordem de nome');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select count(*)::int from public.clientes_afetados_radar('fd500000-0000-0000-0000-000000000001')), 0, 'Rui não vê a lista');
select is((select count(*)::int from public.contatos_para_envio_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'))), 0,
  'Rui não vê os contatos');

-- 7: contatos_para_envio_radar
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select results_eq($$ select nome, contatos from public.contatos_para_envio_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal')) $$,
  $$ values ('I5A Mercado Lua'::text, 1), ('I5A Padaria Sol', 2) $$, 'Padaria 2 (João e Maria); Lua 1 (Maria: Beto é básico e Caio não pode ser procurado)');

-- 9 (parte 1): nada sai sem aprovação
reset role;
select is((select count(*)::int from public.radar_envios), 0, 'antes de aprovar não há envio nenhum');
set local role service_role;
select lives_ok($$ select public.avisar_novidade_nova('fd500000-0000-0000-0000-000000000005') $$, 'o trabalhador avisa de novidade média (nada a fazer)');
select is(public.reservar_resumo_radar('fd400000-0000-0000-0000-000000000001'), null::jsonb, 'resumo de giro "pedido": nada');
select is((select count(*)::int from public.envios_radar_para_enviar(20)), 0, 'nada para enviar');
reset role;
select is((select count(*)::int from public.radar_envios), 0, 'o trabalhador não cria envio');

-- 8: aprovar_envio_radar (D14, Foco 2)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select public.aprovar_envio_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  array['fd100000-0000-0000-0000-00000000000a']::uuid[], 'Mensagem do Radar para clientes.') $$,
  'P0001', 'Só quem é do setor Fiscal aprova o envio.', 'Paula (Pessoal) não aprova no Fiscal');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$ select public.aprovar_envio_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  array['fd100000-0000-0000-0000-00000000000a']::uuid[], 'Mensagem do Radar para clientes.') $$,
  'P0001', 'Novidade não encontrada.', 'Rui (sem treinar) não aprova');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.aprovar_envio_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  '{}'::uuid[], 'Mensagem do Radar para clientes.') $$, 'P0001', 'Escolha ao menos um cliente.', 'sem cliente');
select throws_ok($$ select public.aprovar_envio_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  array['fd100000-0000-0000-0000-00000000000c']::uuid[], 'Mensagem do Radar para clientes.') $$,
  'P0001', 'Só clientes possivelmente afetados recebem.', 'cliente que não é afetado');
select throws_ok($$ select public.aprovar_envio_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  array(select gen_random_uuid() from generate_series(1, 201)), 'Mensagem do Radar para clientes.') $$,
  'P0001', 'Até 200 clientes por envio.', '201 clientes');
select is(public.aprovar_envio_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  array['fd100000-0000-0000-0000-00000000000a', 'fd100000-0000-0000-0000-00000000000b', 'fd100000-0000-0000-0000-00000000000a']::uuid[],
  '  Mensagem do Radar para clientes.  '), 2, 'Padaria e Lua: João e Maria (Maria uma vez só; id repetido não conta)');
reset role;
select results_eq($$ select contato_id, cliente_id, estado, aprovado_por, texto from public.radar_envios order by contato_id $$,
  $$ values ('fd500000-0000-0000-0000-00000000000a'::uuid, 'fd100000-0000-0000-0000-00000000000a'::uuid, 'aguardando'::text,
             'fd000000-0000-0000-0000-00000000000c'::uuid, 'Mensagem do Radar para clientes.'::text),
            ('fd500000-0000-0000-0000-00000000000b', 'fd100000-0000-0000-0000-00000000000a', 'aguardando',
             'fd000000-0000-0000-0000-00000000000c', 'Mensagem do Radar para clientes.') $$,
  'dois envios aguardando, aprovados por Ana, com o texto aprovado');
select is((select mensagem_cliente from public.radar_novidades where id = 'fd500000-0000-0000-0000-000000000001'), 'Mensagem do Radar para clientes.',
  'a novidade guarda a mensagem aprovada');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.aprovar_envio_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  array['fd100000-0000-0000-0000-00000000000a', 'fd100000-0000-0000-0000-00000000000b']::uuid[], 'Mensagem do Radar para clientes.'), 0,
  'aprovar de novo: ninguém recebe duas vezes a mesma novidade');
select throws_ok($$ select public.aprovar_envio_radar('fd500000-0000-0000-0000-000000000003', (select id from public.setores where nome = 'Fiscal'),
  array['fd100000-0000-0000-0000-00000000000a']::uuid[], 'Mensagem do Radar para clientes.') $$,
  'P0001', 'Esta novidade foi descartada.', 'novidade descartada não envia');
reset role;
update public.radar_novidades set setores = setores || (select id from public.setores where nome = 'Pessoal') where id = 'fd500000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select public.aprovar_envio_radar('fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Pessoal'),
  array['fd100000-0000-0000-0000-00000000000b']::uuid[], 'Mensagem do Radar para clientes.') $$,
  'P0001', 'Nenhum contato destes clientes pode ser procurado pelo setor Pessoal.', 'ninguém procurável pelo Pessoal');
reset role;
update public.radar_novidades set setores = array[(select id from public.setores where nome = 'Fiscal')] where id = 'fd500000-0000-0000-0000-000000000001';

-- 10: interno.envio_radar_impedido + reservar / liberar / marcar (service_role)
set local role service_role;
select is((select count(*)::int from public.reservar_envio_radar((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000a'))), 1,
  'o envio de João reserva');
select results_eq($$ select telefone, texto from public.reservar_envio_radar((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b')) $$,
  $$ values ('5531999990502'::text, 'Mensagem do Radar para clientes.'::text) $$, 'o de Maria reserva e devolve telefone e texto');
select lives_ok($$ select public.liberar_envio_radar((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b')) $$, 'libera a reserva de Maria');
select is((select count(*)::int from public.reservar_envio_radar((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b'))), 1,
  'depois de liberar, reserva de novo');
select is((select count(*)::int from public.reservar_envio_radar((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000a'))), 0,
  'o de João já está reservado: nenhuma linha');
select lives_ok($$ select public.liberar_envio_radar((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b')) $$, 'solta Maria de novo');
reset role;
insert into public.mensagens (id, conversa_id, direcao, autor, conteudo, status_envio) values
  ('fd800000-0000-0000-0000-00000000000a', 'fd700000-0000-0000-0000-00000000000a', 'saida', 'agente', 'Mensagem do Radar para clientes.', 'enviada');
set local role service_role;
select lives_ok($$ select public.marcar_envio_radar((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000a'),
  'fd800000-0000-0000-0000-00000000000a') $$, 'marca o de João como enviado');
reset role;
select results_eq($$ select estado, enviado_em is not null, mensagem_id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000a' $$,
  $$ values ('enviado'::text, true, 'fd800000-0000-0000-0000-00000000000a'::uuid) $$, 'enviado, com a data e a mensagem');
-- as razões que seguram o envio de Maria (as mesmas da I3a, na mesma ordem)
select set_config('request.jwt.claims', '', true);
update public.configuracoes set agente_pausado = true where id = 1;
set local role service_role;
select is((select count(*)::int from public.reservar_envio_radar((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b'))), 0,
  'agente pausado: o de Maria não reserva');
reset role;
select is((select motivo from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b'), 'pausado', 'motivo pausado');
update public.configuracoes set agente_pausado = false where id = 1;
update public.conversas set estado = 'humano' where id = 'fd700000-0000-0000-0000-00000000000b';
select is(interno.envio_radar_impedido((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b')), 'atendimento_humano',
  'conversa com uma pessoa: atendimento_humano');
update public.conversas set estado = 'agente' where id = 'fd700000-0000-0000-0000-00000000000b';
update public.contato_cliente_setores set pode_ser_procurado = false
 where contato_id = 'fd500000-0000-0000-0000-00000000000b' and cliente_id = 'fd100000-0000-0000-0000-00000000000a';
select is(interno.envio_radar_impedido((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b')), 'nao_procuravel',
  'não pode mais ser procurado: nao_procuravel');
update public.contato_cliente_setores set pode_ser_procurado = true
 where contato_id = 'fd500000-0000-0000-0000-00000000000b' and cliente_id = 'fd100000-0000-0000-0000-00000000000a';
select is(interno.envio_radar_impedido((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b')), null::text, 'tudo certo: sem impedimento');

-- 17: a I3a continua reservando fora do limite
insert into public.chamados (id, cliente_id, setor_id, titulo) values
  ('fd200000-0000-0000-0000-00000000000a', 'fd100000-0000-0000-0000-00000000000c', (select id from public.setores where nome = 'Fiscal'), 'I5A Fechamento');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, setor_id, pedido, limite_usd, limite_minutos) values
  ('fd300000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'contabil'), 'fd200000-0000-0000-0000-00000000000a',
   'fd100000-0000-0000-0000-00000000000c', (select id from public.setores where nome = 'Fiscal'), 'Fechar outubro', 2, 20);
-- Hugo (1 a 3) e Iara (4 e 5) já receberam pedidos hoje; 6 é o próximo pedido de Iara; 7 é de Joel, que nunca recebeu
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, contato_id, pedido_texto, pedido_em, pedido_enviado_em)
select 'fd300000-0000-0000-0000-00000000000a', v.n, 'cliente', 'Extrato número ' || v.n, v.contato, 'Pode mandar o extrato ' || v.n || '?', now() - interval '1 hour',
       case when v.enviado then now() - interval '1 hour' end
  from (values (1, 'fd500000-0000-0000-0000-000000000014'::uuid, true), (2, 'fd500000-0000-0000-0000-000000000014', true),
               (3, 'fd500000-0000-0000-0000-000000000014', true), (4, 'fd500000-0000-0000-0000-000000000015', true),
               (5, 'fd500000-0000-0000-0000-000000000015', true), (6, 'fd500000-0000-0000-0000-000000000015', false),
               (7, 'fd500000-0000-0000-0000-000000000016', false)) v (n, contato, enviado);
select is(interno.pedido_impedido((select id from public.agente_pendencias where numero = 6)), null::text,
  'Iara: 2 pedidos de pendência e nenhum do Radar, o 3º ainda pode sair');
set local role service_role;
select is((select count(*)::int from public.reservar_envio_pendencia((select id from public.agente_pendencias where numero = 7))), 1,
  'I3a intacta: pedido de contato procurável e sem envios do Radar reserva como antes');
reset role;

-- 11: limite do dia compartilhado (D14, Foco 2)
insert into public.radar_novidades (id, giro_id, titulo, url, url_normalizada, fonte_nome, selo, resumo, impacto, setores, criterios)
values ('fd500000-0000-0000-0000-000000000012', 'fd400000-0000-0000-0000-000000000001', 'I5A Novidade 12', 'https://www.cfc.org.br/n12', 'cfc.org.br/n12',
  'CFC', 'oficial', 'Resumo simples da novidade número 12.', 'baixo', array[(select id from public.setores where nome = 'Fiscal')], '{}');
-- Hugo: 3 pedidos de pendência enviados nas últimas 24 h; o envio do Radar a ele fica de fora
insert into public.radar_envios (id, novidade_id, setor_id, cliente_id, contato_id, texto) values
  ('fd900000-0000-0000-0000-000000000014', 'fd500000-0000-0000-0000-000000000012', (select id from public.setores where nome = 'Fiscal'),
   'fd100000-0000-0000-0000-00000000000c', 'fd500000-0000-0000-0000-000000000014', 'Texto do Radar a Hugo.');
select is(interno.envio_radar_impedido('fd900000-0000-0000-0000-000000000014'), 'limite_dia', '3 pedidos de pendência já enviados a Hugo: o envio do Radar fica em limite_dia');
-- Iara: 2 pedidos de pendência + 1 envio do Radar enviado = 3; o próximo pedido de pendência é barrado (comportamento novo)
insert into public.radar_envios (id, novidade_id, setor_id, cliente_id, contato_id, texto, estado, enviado_em) values
  ('fd900000-0000-0000-0000-000000000015', 'fd500000-0000-0000-0000-000000000012', (select id from public.setores where nome = 'Fiscal'),
   'fd100000-0000-0000-0000-00000000000c', 'fd500000-0000-0000-0000-000000000015', 'Texto do Radar a Iara.', 'enviado', now());
select is(interno.pedido_impedido((select id from public.agente_pendencias where numero = 6)), 'limite_dia',
  '2 pendências + 1 envio do Radar a Iara: o pedido de pendência vira limite_dia');
select is(interno.mensagens_ativas_24h('fd500000-0000-0000-0000-000000000015', null, null), 3, 'Iara: 3 mensagens ativas somando as duas filas');
set local role service_role;
select is((select count(*)::int from public.reservar_envio_pendencia((select id from public.agente_pendencias where numero = 6))), 0,
  'a reserva da I3a não deixa passar o 4º do dia');
reset role;

-- 12: envios_radar_para_enviar(20)
insert into public.radar_envios (id, novidade_id, setor_id, cliente_id, contato_id, texto, reservado_em, aprovado_em) values
  ('fd900000-0000-0000-0000-000000000011', 'fd500000-0000-0000-0000-000000000013', (select id from public.setores where nome = 'Fiscal'),
   'fd100000-0000-0000-0000-00000000000c', 'fd500000-0000-0000-0000-000000000011', 'Texto do Radar a Edu.', null, now()),
  ('fd900000-0000-0000-0000-000000000012', 'fd500000-0000-0000-0000-000000000013', (select id from public.setores where nome = 'Fiscal'),
   'fd100000-0000-0000-0000-00000000000c', 'fd500000-0000-0000-0000-000000000012', 'Texto do Radar a Fabi.', now(), now()),
  ('fd900000-0000-0000-0000-000000000013', 'fd500000-0000-0000-0000-000000000013', (select id from public.setores where nome = 'Fiscal'),
   'fd100000-0000-0000-0000-00000000000c', 'fd500000-0000-0000-0000-000000000013', 'Texto do Radar a Gui.', now() - interval '11 minutes', now()),
  ('fd900000-0000-0000-0000-00000000000d', 'fd500000-0000-0000-0000-000000000013', (select id from public.setores where nome = 'Fiscal'),
   'fd100000-0000-0000-0000-00000000000b', 'fd500000-0000-0000-0000-00000000000d', 'Texto do Radar a Caio.', null, now()),
  ('fd900000-0000-0000-0000-00000000000e', 'fd500000-0000-0000-0000-000000000013', (select id from public.setores where nome = 'Fiscal'),
   'fd100000-0000-0000-0000-00000000000c', 'fd500000-0000-0000-0000-00000000000e', 'Texto do Radar a Duda.', null, now() - interval '4 days');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.envios_radar_para_enviar(20) $$, '42501', null, 'Ana não chama envios_radar_para_enviar');
reset role;
set local role service_role;
select results_eq($$ select x from public.envios_radar_para_enviar(20) x order by 1 $$,
  $$ select id from public.radar_envios where id in ('fd900000-0000-0000-0000-000000000011', 'fd900000-0000-0000-0000-000000000013')
        or (contato_id = 'fd500000-0000-0000-0000-00000000000b' and novidade_id = 'fd500000-0000-0000-0000-000000000001') order by 1 $$,
  'devolve só Edu, Gui (reserva velha solta) e Maria: sem impedimento e sem reserva');
reset role;
select ok((select reservado_em is not null from public.radar_envios where id = 'fd900000-0000-0000-0000-000000000012'), 'a reserva recente de Fabi continua');
select ok((select reservado_em is null from public.radar_envios where id = 'fd900000-0000-0000-0000-000000000013'), 'a reserva de mais de 10 min de Gui foi solta');
select results_eq($$ select estado, motivo from public.radar_envios where id = 'fd900000-0000-0000-0000-00000000000e' $$,
  $$ values ('nao_enviado'::text, 'pausado'::text) $$, 'Duda: aprovado há mais de 3 dias e ainda impedido vira nao_enviado com o motivo');
select results_eq($$ select estado, motivo from public.radar_envios where id = 'fd900000-0000-0000-0000-00000000000d' $$,
  $$ values ('aguardando'::text, 'nao_procuravel'::text) $$, 'Caio: espera, com o motivo anotado');

-- 12b (revisão final): a reserva do Radar ainda não enviada conta no limite do dia; liberar a reserva devolve a vaga
insert into public.contatos (id, nome, telefone, agente_pausado) values ('fd500000-0000-0000-0000-000000000017', 'I5A Kai', '5531999990517', false);
insert into public.contato_clientes (contato_id, cliente_id, perfil) values ('fd500000-0000-0000-0000-000000000017', 'fd100000-0000-0000-0000-00000000000c', 'personalizado');
insert into public.contato_cliente_setores (contato_id, cliente_id, setor_id, pode_ser_procurado)
  values ('fd500000-0000-0000-0000-000000000017', 'fd100000-0000-0000-0000-00000000000c', (select id from public.setores where nome = 'Fiscal'), true);
insert into public.conversas (id, telefone, contato_id) values ('fd700000-0000-0000-0000-000000000017', '5531999990517', 'fd500000-0000-0000-0000-000000000017');
-- Kai: 2 envios do Radar enviados + 1 reservado e não enviado; o 4º espera
insert into public.radar_envios (id, novidade_id, setor_id, cliente_id, contato_id, texto, estado, enviado_em, reservado_em) values
  ('fd900000-0000-0000-0000-000000000171', 'fd500000-0000-0000-0000-000000000012', (select id from public.setores where nome = 'Fiscal'),
   'fd100000-0000-0000-0000-00000000000c', 'fd500000-0000-0000-0000-000000000017', 'Texto 1 do Radar a Kai.', 'enviado', now(), null),
  ('fd900000-0000-0000-0000-000000000172', 'fd500000-0000-0000-0000-000000000013', (select id from public.setores where nome = 'Fiscal'),
   'fd100000-0000-0000-0000-00000000000c', 'fd500000-0000-0000-0000-000000000017', 'Texto 2 do Radar a Kai.', 'enviado', now(), null),
  ('fd900000-0000-0000-0000-000000000173', 'fd500000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
   'fd100000-0000-0000-0000-00000000000c', 'fd500000-0000-0000-0000-000000000017', 'Texto 3 do Radar a Kai.', 'aguardando', null, now()),
  ('fd900000-0000-0000-0000-000000000174', 'fd500000-0000-0000-0000-000000000002', (select id from public.setores where nome = 'Fiscal'),
   'fd100000-0000-0000-0000-00000000000c', 'fd500000-0000-0000-0000-000000000017', 'Texto 4 do Radar a Kai.', 'aguardando', null, null);
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, contato_id, pedido_texto, pedido_em)
values ('fd300000-0000-0000-0000-00000000000a', 20, 'cliente', 'Extrato de Kai', 'fd500000-0000-0000-0000-000000000017', 'Pode mandar o extrato de Kai?', now());
select is(interno.envio_radar_impedido('fd900000-0000-0000-0000-000000000174'), 'limite_dia', '2 enviados + 1 reservado a Kai: o próximo envio do Radar fica em limite_dia');
select is(interno.pedido_impedido((select id from public.agente_pendencias where numero = 20)), 'limite_dia', '2 enviados + 1 reservado a Kai: o pedido de pendência também');
set local role service_role;
select lives_ok($$ select public.liberar_envio_radar('fd900000-0000-0000-0000-000000000173') $$, 'libera a reserva do 3º envio a Kai');
reset role;
select is(interno.envio_radar_impedido('fd900000-0000-0000-0000-000000000174'), null::text, 'reserva liberada: o envio do Radar a Kai pode sair');
select is(interno.pedido_impedido((select id from public.agente_pendencias where numero = 20)), null::text, 'reserva liberada: o pedido de pendência a Kai pode sair');
-- reservar um envio que já saiu, com o agente pausado: nada muda (o motivo só vai para o envio que espera)
select set_config('request.jwt.claims', '', true);
update public.configuracoes set agente_pausado = true where id = 1;
set local role service_role;
select is((select count(*)::int from public.reservar_envio_radar('fd900000-0000-0000-0000-000000000171')), 0, 'envio já enviado não reserva');
reset role;
select results_eq($$ select estado, motivo from public.radar_envios where id = 'fd900000-0000-0000-0000-000000000171' $$,
  $$ values ('enviado'::text, null::text) $$, 'o envio já enviado não ganha motivo');
update public.configuracoes set agente_pausado = false where id = 1;
-- reserva velha cuja mensagem de saída já foi gravada (mesmo texto): não é solta
update public.radar_envios set reservado_em = now() - interval '11 minutes' where id = 'fd900000-0000-0000-0000-000000000173';
insert into public.mensagens (id, conversa_id, direcao, autor, conteudo, status_envio) values
  ('fd800000-0000-0000-0000-000000000017', 'fd700000-0000-0000-0000-000000000017', 'saida', 'agente', 'Texto 3 do Radar a Kai.', 'enviada');
set local role service_role;
select ok(not exists (select 1 from public.envios_radar_para_enviar(20) x where x = 'fd900000-0000-0000-0000-000000000173'),
  'reserva velha com a mensagem já gravada não volta para enviar');
reset role;
select ok((select reservado_em is not null from public.radar_envios where id = 'fd900000-0000-0000-0000-000000000173'), 'a reserva velha com mensagem continua');
-- devolve o banco ao estado dos testes seguintes
delete from public.mensagens where id = 'fd800000-0000-0000-0000-000000000017';
delete from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-000000000017';
delete from public.agente_pendencias where numero = 20;

-- 13: envios_da_novidade
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select results_eq($$ select estado, motivo, total from public.envios_da_novidade('fd500000-0000-0000-0000-000000000001') $$,
  $$ values ('aguardando'::text, null::text, 1), ('enviado', null, 1) $$, 'novidade 01: um enviado (João) e um aguardando (Maria)');
select results_eq($$ select estado, motivo, total from public.envios_da_novidade('fd500000-0000-0000-0000-000000000013') $$,
  $$ values ('aguardando'::text, 'nao_procuravel'::text, 1), ('aguardando', null, 3), ('nao_enviado', 'pausado', 1) $$,
  'novidade 13: por estado e motivo');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select count(*)::int from public.envios_da_novidade('fd500000-0000-0000-0000-000000000013')), 0, 'Rui não vê os envios');

-- 14: avisar_novidade_nova (D13)
reset role;
update public.radar_config set avisar_painel = false, aviso_alto = true;
set local role service_role;
select is(public.avisar_novidade_nova('fd500000-0000-0000-0000-000000000005') ->> 'whatsapp', 'false', 'médio, painel desligado: sem WhatsApp');
reset role;
select is((select count(*)::int from public.alertas where mensagem = 'Radar: I5A Novidade 05 · CFC'), 0, 'e nenhum alerta');
update public.radar_config set avisar_painel = true;
set local role service_role;
select is(public.avisar_novidade_nova('fd500000-0000-0000-0000-000000000005') ->> 'whatsapp', 'false', 'médio, painel ligado: sem WhatsApp');
reset role;
select is((select count(*)::int from public.alertas where mensagem = 'Radar: I5A Novidade 05 · CFC' and nivel = 'aviso'
                and setor_id = (select id from public.setores where nome = 'Fiscal')), 1, 'um alerta por setor');
set local role service_role;
select lives_ok($$ select public.avisar_novidade_nova('fd500000-0000-0000-0000-000000000005') $$, 'chamar de novo');
reset role;
select is((select count(*)::int from public.alertas where mensagem = 'Radar: I5A Novidade 05 · CFC'), 1, 'não duplica o alerta');
update public.radar_config set avisar_painel = false;
-- impacto alto: sem telefone do dono, nada de WhatsApp (mas o painel avisa)
select set_config('request.jwt.claims', '', true);
update public.configuracoes set telefone_dono = null where id = 1;
set local role service_role;
select is(public.avisar_novidade_nova('fd500000-0000-0000-0000-000000000006') ->> 'whatsapp', 'false', 'alto sem telefone do dono: sem WhatsApp');
reset role;
select is((select count(*)::int from public.alertas where mensagem = 'Radar: I5A Novidade 06 · CFC'), 1, 'alto avisa o painel dos setores');
select is((select count(*)::int from public.radar_avisos), 0, 'sem aviso gravado');
update public.configuracoes set telefone_dono = '5531999990000' where id = 1;
set local role service_role;
select is(public.avisar_novidade_nova('fd500000-0000-0000-0000-000000000006') ->> 'whatsapp', 'true', 'alto com telefone: WhatsApp');
select is(public.avisar_novidade_nova('fd500000-0000-0000-0000-000000000006') ->> 'whatsapp', 'false', 'chamar de novo: não manda de novo');
reset role;
select results_eq($$ select tipo, novidade_id from public.radar_avisos $$,
  $$ values ('alto'::text, 'fd500000-0000-0000-0000-000000000006'::uuid) $$, 'um aviso do tipo alto');
select is((select count(*)::int from public.alertas where mensagem = 'Radar: I5A Novidade 06 · CFC'), 1, 'e o alerta do painel não duplica');
-- o limite de 5 avisos por dia no WhatsApp: 07 a 10 são o 2º ao 5º; 11 é o 6º
set local role service_role;
select is((select array_agg(public.avisar_novidade_nova(('fd500000-0000-0000-0000-0000000000' || n)::uuid) ->> 'whatsapp' order by n) from unnest(array['07', '08', '09', '10']) n),
  array['true', 'true', 'true', 'true'], 'do 2º ao 5º alto do dia: WhatsApp');
select is(public.avisar_novidade_nova('fd500000-0000-0000-0000-000000000011') ->> 'whatsapp', 'false', 'o 6º alto do dia: sem WhatsApp');
reset role;
select is((select count(*)::int from public.radar_avisos where tipo = 'alto'), 5, 'cinco avisos no dia');

-- 15: reservar_resumo_radar (D13d)
insert into public.radar_giros (id, origem, estado, dia, novidades, iniciado_em, terminado_em, fontes_fora) values
  ('fd400000-0000-0000-0000-000000000002', 'agenda', 'concluido', '2026-10-01', 2, now(), now(),
   '[{"nome":"Prefeitura de Conselheiro Lafaiete","motivo":"fora do ar"}]'),
  ('fd400000-0000-0000-0000-000000000003', 'agenda', 'concluido', '2026-10-02', 0, now(), now(), '[]'),
  ('fd400000-0000-0000-0000-000000000004', 'agenda', 'concluido', '2026-10-03', 1, now(), now(), '[]');
update public.radar_novidades set giro_id = 'fd400000-0000-0000-0000-000000000002' where id in ('fd500000-0000-0000-0000-000000000012', 'fd500000-0000-0000-0000-000000000001');
update public.radar_novidades set giro_id = 'fd400000-0000-0000-0000-000000000004' where id = 'fd500000-0000-0000-0000-000000000013';
set local role service_role;
select is(public.reservar_resumo_radar('fd400000-0000-0000-0000-000000000001'), null::jsonb, 'giro "pedido": sem resumo');
select results_eq($$ select jsonb_array_length(r -> 'novidades'), (r -> 'novidades' -> 0 ->> 'titulo'), r -> 'fontes_fora'
    from (select public.reservar_resumo_radar('fd400000-0000-0000-0000-000000000002') r) x $$,
  $$ values (2, 'I5A Novidade 01'::text, '["Prefeitura de Conselheiro Lafaiete"]'::jsonb) $$, 'giro agendado com 2 novidades: o resumo, alto primeiro, com as fontes fora');
select is(public.reservar_resumo_radar('fd400000-0000-0000-0000-000000000002'), null::jsonb, 'de novo: nada (uma vez por giro)');
select is(public.reservar_resumo_radar('fd400000-0000-0000-0000-000000000003'), null::jsonb, 'giro agendado sem novidade: nada');
reset role;
update public.radar_config set resumo_whatsapp = false;
set local role service_role;
select is(public.reservar_resumo_radar('fd400000-0000-0000-0000-000000000004'), null::jsonb, 'resumo desligado: nada');
reset role;
update public.radar_config set resumo_whatsapp = true;
set local role service_role;
select is(public.reservar_resumo_radar('fd400000-0000-0000-0000-000000000004') ->> 'aviso_id' is not null, true, 'ligado de novo: o resumo sai');
select lives_ok($$ select public.marcar_aviso_radar((select id from public.radar_avisos where giro_id = 'fd400000-0000-0000-0000-000000000004'),
  'fd800000-0000-0000-0000-00000000000a') $$, 'marca o aviso como enviado');
reset role;
select is((select enviado_em is not null and mensagem_id = 'fd800000-0000-0000-0000-00000000000a' from public.radar_avisos where giro_id = 'fd400000-0000-0000-0000-000000000004'), true,
  'o aviso guarda a data e a mensagem');

-- leitura (D11): quem não vê os Agentes não lê envios nem avisos
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is((select count(*)::int from public.radar_envios) + (select count(*)::int from public.radar_avisos), 0, 'Rui (sem treinar) lê 0 linhas');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select ok((select count(*) from public.radar_envios) > 0 and (select count(*) from public.radar_avisos) > 0, 'Ana (treinar) lê envios e avisos');
reset role;

-- 11 (parte 2): 30 mensagens ativas no escritório, somando as duas filas (pendências sem contato completam o número)
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, contato_id, pedido_texto, pedido_em, pedido_enviado_em)
values ('fd300000-0000-0000-0000-00000000000a', 8, 'cliente', 'Extrato número 8', 'fd500000-0000-0000-0000-000000000016', 'Pode mandar o extrato 8?', now() - interval '1 hour', null);
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, pedido_texto, pedido_em, pedido_enviado_em)
select 'fd300000-0000-0000-0000-00000000000a', 100 + g, 'cliente', 'Extrato de outro cliente ' || g, 'Pode mandar?', now() - interval '1 hour', now() - interval '1 hour'
  from generate_series(1, 29 - interno.mensagens_ativas_24h(null, null, null)) g;
select is(interno.mensagens_ativas_24h(null, null, null), 29, 'o escritório está em 29 mensagens ativas (pendências e Radar somadas)');
select is(interno.envio_radar_impedido((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b' and novidade_id = 'fd500000-0000-0000-0000-000000000001')),
  null::text, 'com 29, o envio de Maria ainda sai');
select is(interno.pedido_impedido((select id from public.agente_pendencias where numero = 8)), null::text, 'com 29, o pedido de Joel ainda sai');
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, pedido_texto, pedido_em, pedido_enviado_em)
values ('fd300000-0000-0000-0000-00000000000a', 200, 'cliente', 'Mais um extrato', 'Pode mandar?', now() - interval '1 hour', now() - interval '1 hour');
select is(interno.envio_radar_impedido((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b' and novidade_id = 'fd500000-0000-0000-0000-000000000001')),
  'limite_dia', 'com 30, o envio do Radar a Maria fica em limite_dia');
select is(interno.pedido_impedido((select id from public.agente_pendencias where numero = 8)), 'limite_dia', 'com 30, o pedido de pendência de Joel também');
set local role service_role;
select is((select count(*)::int from public.reservar_envio_radar((select id from public.radar_envios where contato_id = 'fd500000-0000-0000-0000-00000000000b' and novidade_id = 'fd500000-0000-0000-0000-000000000001'))), 0,
  'e a reserva do Radar não deixa passar o 31º');
select is((select count(*)::int from public.envios_radar_para_enviar(20)), 0, 'nada mais sai hoje');
reset role;

-- 16: quem pode chamar o quê
select is((select count(*)::int from unnest(array['public.criar_demanda_radar(uuid,uuid)', 'public.avisar_equipe_radar(uuid)', 'public.descartar_novidade_radar(uuid)',
  'public.salvar_mensagem_radar(uuid,text)', 'public.clientes_afetados_radar(uuid)', 'public.contatos_para_envio_radar(uuid,uuid)',
  'public.aprovar_envio_radar(uuid,uuid,uuid[],text)', 'public.envios_da_novidade(uuid)']) f where has_function_privilege('anon', f, 'execute')), 0,
  'anon não chama nenhuma função da pessoa');
select is((select count(*)::int from unnest(array['public.criar_demanda_radar(uuid,uuid)', 'public.avisar_equipe_radar(uuid)', 'public.descartar_novidade_radar(uuid)',
  'public.salvar_mensagem_radar(uuid,text)', 'public.clientes_afetados_radar(uuid)', 'public.contatos_para_envio_radar(uuid,uuid)',
  'public.aprovar_envio_radar(uuid,uuid,uuid[],text)', 'public.envios_da_novidade(uuid)']) f where has_function_privilege('authenticated', f, 'execute')), 8,
  'a pessoa chama as oito');
select is((select count(*)::int from unnest(array['public.envios_radar_para_enviar(int)', 'public.reservar_envio_radar(uuid)', 'public.liberar_envio_radar(uuid)',
  'public.marcar_envio_radar(uuid,uuid)', 'public.avisar_novidade_nova(uuid)', 'public.reservar_resumo_radar(uuid)', 'public.marcar_aviso_radar(uuid,uuid)']) f
  where has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute')), 0,
  'nem anon nem a pessoa chamam as do trabalhador');
select is((select count(*)::int from unnest(array['public.envios_radar_para_enviar(int)', 'public.reservar_envio_radar(uuid)', 'public.liberar_envio_radar(uuid)',
  'public.marcar_envio_radar(uuid,uuid)', 'public.avisar_novidade_nova(uuid)', 'public.reservar_resumo_radar(uuid)', 'public.marcar_aviso_radar(uuid,uuid)']) f
  where has_function_privilege('service_role', f, 'execute')), 7, 'o trabalhador chama as sete');
select is((select count(*)::int from unnest(array['interno.envio_radar_impedido(uuid)', 'interno.mensagens_ativas_24h(uuid,uuid,uuid)', 'interno.pedido_impedido(uuid)',
  'interno.novidade_da_pessoa(uuid)']) f where has_function_privilege('authenticated', f, 'execute') or has_function_privilege('service_role', f, 'execute')), 0,
  'as funções internas não são chamáveis por ninguém de fora');

select * from finish();
rollback;
