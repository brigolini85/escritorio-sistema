-- Parte I5, Task 2 (spec 7E.7; D1–D10, D15, D16): fontes, agenda, giros e novidades do Radar de legislação.
-- Só o dono muda fontes e agenda; lê quem vê os Agentes; o trabalhador abre, pega e fecha os giros e registra as novidades.
begin;
create extension if not exists pgtap with schema extensions;
select plan(154);

update public.usuarios set dono = false where dono;   -- outro teste ou e2e pode ter deixado um dono
insert into auth.users (id, email) values
  ('fc000000-0000-0000-0000-00000000000a', 'dono@i5r.local'), ('fc000000-0000-0000-0000-00000000000b', 'adm@i5r.local'),
  ('fc000000-0000-0000-0000-00000000000c', 'ana@i5r.local'), ('fc000000-0000-0000-0000-00000000000d', 'paula@i5r.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('fc000000-0000-0000-0000-00000000000a', 'I5R Dono', 'dono@i5r.local', 'admin', '{}'),
  ('fc000000-0000-0000-0000-00000000000b', 'I5R Adm', 'adm@i5r.local', 'admin', '{}'),
  ('fc000000-0000-0000-0000-00000000000c', 'I5R Ana', 'ana@i5r.local', 'atendente', '{}'),
  ('fc000000-0000-0000-0000-00000000000d', 'I5R Paula', 'paula@i5r.local', 'atendente', '{}');
update public.usuarios set dono = true where id = 'fc000000-0000-0000-0000-00000000000a';
insert into public.usuario_setores (usuario_id, setor_id) values
  ('fc000000-0000-0000-0000-00000000000c', (select id from public.setores where nome = 'Fiscal')),
  ('fc000000-0000-0000-0000-00000000000d', (select id from public.setores where nome = 'Pessoal'));
insert into public.usuario_permissoes (usuario_id, modulo, nivel) values ('fc000000-0000-0000-0000-00000000000c', 'treinar', 'sim')
  on conflict (usuario_id, modulo) do update set nivel = 'sim';
insert into public.clientes (id, razao_social, cnpj, regime, uf, cidade, segmentos, cnae_principal, funcionarios, ativo) values
  ('fc100000-0000-0000-0000-00000000000a', 'I5R Padaria Sol', '21448390000107', 'Simples Nacional', 'MG', 'Conselheiro Lafaiete', '{comercio}', '4721-1/02', 8, true),
  ('fc100000-0000-0000-0000-00000000000b', 'I5R Mercado Lua', '11222333000181', 'Lucro Presumido', 'MG', 'Conselheiro Lafaiete', '{comercio}', null, 0, true),
  ('fc100000-0000-0000-0000-00000000000c', 'I5R Oficina Sul', '12345678000195', 'Lucro Real', 'SP', 'São Paulo', '{servicos}', null, null, true),
  ('fc100000-0000-0000-0000-00000000000d', 'I5R Antiga', '23456789000195', 'simples', 'MG', 'Conselheiro Lafaiete', '{}', null, 3, false);
-- uma linha em cada tabela, para a leitura ter o que ler
insert into public.radar_giros (id, origem, estado, dia, terminado_em) values
  ('fc400000-0000-0000-0000-000000000000', 'pedido', 'concluido', '2026-01-01', now());
insert into public.radar_novidades (id, giro_id, titulo, url, url_normalizada, fonte_nome, selo, resumo, impacto) values
  ('fc500000-0000-0000-0000-000000000000', 'fc400000-0000-0000-0000-000000000000', 'I5R Novidade de leitura', 'https://www.cfc.org.br/leitura',
   'cfc.org.br/leitura', 'CFC', 'oficial', 'Resumo da novidade de leitura.', 'baixo');

-- 1–6: as tabelas, fora do Realtime, com RLS
select has_table('public', 'radar_config', 'radar_config existe');
select has_table('public', 'radar_fontes', 'radar_fontes existe');
select has_table('public', 'radar_giros', 'radar_giros existe');
select has_table('public', 'radar_novidades', 'radar_novidades existe');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime'
            and tablename in ('radar_config', 'radar_fontes', 'radar_giros', 'radar_novidades')), 0, 'as quatro fora do Realtime');
select is((select count(*)::int from pg_class where oid in ('public.radar_config'::regclass, 'public.radar_fontes'::regclass,
            'public.radar_giros'::regclass, 'public.radar_novidades'::regclass) and relrowsecurity), 4, 'RLS ligada nas quatro');

-- 7–13: as 9 fontes e a agenda iniciais
select results_eq($$ select nome, dominio, caminho, etiqueta, oficial, ativa from public.radar_fontes order by ordem $$,
  $$ values ('Receita Federal'::text, 'gov.br'::text, '/receitafederal'::text, 'FED'::text, true, true),
            ('Diário Oficial da União', 'in.gov.br', null, 'FED', true, true),
            ('Portal do Simples Nacional', 'www8.receita.fazenda.gov.br', '/simplesnacional', 'FED', true, true),
            ('eSocial', 'gov.br', '/esocial', 'FED', true, true),
            ('CFC', 'cfc.org.br', null, 'FED', true, true),
            ('CONFAZ', 'confaz.fazenda.gov.br', null, 'FED', true, true),
            ('Planalto (legislação)', 'planalto.gov.br', null, 'FED', true, true),
            ('SEFAZ-MG', 'fazenda.mg.gov.br', null, 'MG', true, true),
            ('Prefeitura de Conselheiro Lafaiete', 'conselheirolafaiete.mg.gov.br', null, 'MUN', true, true) $$,
  'as 9 fontes iniciais, na ordem, oficiais e ativas');
select is((select count(*)::int from public.radar_config), 1, 'radar_config tem uma linha');
select is((select hora from public.radar_config), '07:00'::time, 'hora 07:00');
select is((select dias from public.radar_config), '{0,1,2,3,4,5,6}'::smallint[], 'todos os dias');
select results_eq($$ select resumo_whatsapp, aviso_alto, avisar_painel, limite_usd_giro from public.radar_config $$,
  $$ values (true, true, false, 0.50::numeric) $$, 'avisos e limite iniciais');
select is((select assuntos from public.radar_config), array['Fiscal e tributos', 'Trabalhista / eSocial', 'Societário', 'Contábil / CFC',
  'Simples Nacional', 'Estaduais de MG', 'Municipais de Conselheiro Lafaiete (ISS, alvará)'], 'os 7 assuntos vigiados');
select is((select estado from public.agentes where slug = 'radar'), 'desligado', 'o Radar continua desligado');

-- 14–24: leitura (D11)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.radar_fontes), 9, 'Ana (treinar) lê as fontes');
select is((select count(*)::int from public.radar_config), 1, 'Ana lê a agenda');
select is((select count(*)::int from public.radar_giros), 1, 'Ana lê os giros');
select is((select count(*)::int from public.radar_novidades), 1, 'Ana lê as novidades');
select throws_ok($$ insert into public.radar_fontes (nome, dominio) values ('Intruso', 'intruso.com.br') $$, '42501', null, 'Ana não insere fonte');
select throws_ok($$ insert into public.radar_config (id) values (1) $$, '42501', null, 'Ana não insere config');
select throws_ok($$ insert into public.radar_giros (origem, dia) values ('pedido', '2026-01-02') $$, '42501', null, 'Ana não insere giro');
select throws_ok($$ insert into public.radar_novidades (titulo, url, url_normalizada, fonte_nome, selo, resumo, impacto)
  values ('Intruso', 'https://x.com', 'x.com', 'x', 'oficial', 'Resumo do intruso.', 'baixo') $$, '42501', null, 'Ana não insere novidade');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.radar_fontes) + (select count(*)::int from public.radar_config)
        + (select count(*)::int from public.radar_giros) + (select count(*)::int from public.radar_novidades), 0, 'Paula (sem treinar) lê 0 linhas nas quatro');
select throws_ok($$ select public.pegar_giro_radar() $$, '42501', null, 'Paula não chama pegar_giro_radar');
select throws_ok($$ select public.abrir_giros_radar(now()) $$, '42501', null, 'pessoa não chama abrir_giros_radar');

-- 25–32: de onde é o link (D2, Foco 1)
reset role;
select set_config('request.jwt.claims', '', true);
select is(interno.fonte_da_url('https://www.gov.br/receitafederal/pt-br/x'), (select id from public.radar_fontes where nome = 'Receita Federal'), 'gov.br/receitafederal: Receita');
select is(interno.fonte_da_url('https://gov.br/esocial'), (select id from public.radar_fontes where nome = 'eSocial'), 'gov.br/esocial: eSocial');
select is(interno.fonte_da_url('https://normas.cfc.org.br/x'), (select id from public.radar_fontes where nome = 'CFC'), 'subdomínio do CFC');
select is(interno.fonte_da_url('https://www.gov.br/receitafederalx/y'), null::uuid, 'receitafederalx não é a Receita');
select is(interno.fonte_da_url('https://gov.br.exemplo.com/receitafederal'), null::uuid, 'gov.br.exemplo.com não é gov.br');
select is(interno.fonte_da_url('https://fakegov.br/receitafederal'), null::uuid, 'fakegov.br não é gov.br');
select is(interno.fonte_da_url('https://gov.br@golpe.net/receitafederal'), null::uuid, 'o usuário antes do @ não engana');
select is(interno.fonte_da_url('ftp://cfc.org.br'), null::uuid, 'só http e https');
select is(interno.fonte_da_url('https://evil.com\.gov.br/receitafederal/x'), null::uuid, 'barra invertida no endereço não vale (o navegador abre evil.com)');
select is(interno.fonte_da_url('https://gov%2Ebr/receitafederal/x'), null::uuid, 'endereço com % não vale');
select is(interno.fonte_da_url('https://gov.br /receitafederal/x'), null::uuid, 'endereço com espaço não vale');
-- revisão final: "." / ".." / %2e no caminho não casam; o "_" do caminho não é curinga
select is(interno.fonte_da_url('https://www.gov.br/receitafederal/../esocial'), null::uuid, '/../ no caminho não casa nenhuma fonte');
select is(interno.fonte_da_url('https://gov.br/esocial/./x'), null::uuid, '/./ no caminho não casa nenhuma fonte');
select is(interno.fonte_da_url('https://gov.br/receitafederal/%2E%2E/esocial/x'), null::uuid, '%2E no caminho (maiúsculo) não casa nenhuma fonte');
select is(interno.fonte_da_url('https://gov.br/esocial/..'), null::uuid, '.. no fim do caminho não casa nenhuma fonte');
select is(interno.fonte_da_url('https://gov.br/esocial/arquivo.pdf'), (select id from public.radar_fontes where nome = 'eSocial'), 'ponto no nome do arquivo continua valendo');
insert into public.radar_fontes (id, nome, dominio, caminho, etiqueta, ordem) values ('fc600000-0000-0000-0000-00000000000f', 'I5R Curinga', 'exemplo-i5r.gov.br', '/a_b', 'FED', 99);
select is(interno.fonte_da_url('https://exemplo-i5r.gov.br/axb/c'), null::uuid, 'o "_" do caminho da fonte não vira curinga');
select is(interno.fonte_da_url('https://exemplo-i5r.gov.br/a_b/c'), 'fc600000-0000-0000-0000-00000000000f'::uuid, 'caminho com "_" casa ele mesmo');
delete from public.radar_fontes where id = 'fc600000-0000-0000-0000-00000000000f';

-- 33–43: salvar_fonte_radar só do dono
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_fonte_radar(null, '{"nome":"Portal Contábeis","dominio":"contabeis.com.br","oficial":false}') $$,
  'P0001', 'Só o dono altera as fontes do Radar.', 'Adm não cria fonte');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_fonte_radar(null, '{"nome":"Portal Contábeis","dominio":"contabeis.com.br","oficial":false}') $$,
  'P0001', 'Só o dono altera as fontes do Radar.', 'Ana não cria fonte');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select ok(set_config('i5r.fonte', public.salvar_fonte_radar(null, '{"nome":"Portal Contábeis","dominio":"contabeis.com.br","oficial":false}')::text, true) is not null,
  'Dono cria o Portal Contábeis');
select is((select oficial from public.radar_fontes where id = current_setting('i5r.fonte')::uuid), false, 'a fonte nasce não oficial');
select throws_ok($$ select public.salvar_fonte_radar(null, '{"nome":"Portal Contábeis","dominio":"contabeis.com.br"}') $$,
  'P0001', 'Esta fonte já está cadastrada.', 'a mesma fonte de novo');
select throws_ok($$ select public.salvar_fonte_radar(null, '{"nome":"Rede","dominio":"10.0.0.1"}') $$,
  'P0001', 'Endereço inválido: use o nome do site, como cfc.org.br.', 'IP não vale');
select throws_ok($$ select public.salvar_fonte_radar(null, '{"nome":"Rede","dominio":"intranet"}') $$,
  'P0001', 'Endereço inválido: use o nome do site, como cfc.org.br.', 'nome sem ponto não vale');
select throws_ok($$ select public.salvar_fonte_radar(null, '{"nome":"Rede","dominio":"outro.com.br","caminho":"/a/b/c"}') $$,
  'P0001', 'Caminho inválido: use até duas partes, como /receitafederal.', 'caminho com 3 partes');
select throws_ok($$ select public.salvar_fonte_radar(null, '{"nome":"Rede","dominio":"cfc.org.br","caminho":"/x","paginas":["https://outro.com/x"]}') $$,
  'P0001', 'A página https://outro.com/x não é desta fonte.', 'página de outro site');
select throws_ok($$ select public.salvar_fonte_radar(null, '{"nome":"Rede","dominio":"novo.com.br","paginas":["https://novo.com.br/1","https://novo.com.br/2",
  "https://novo.com.br/3","https://novo.com.br/4","https://novo.com.br/5","https://novo.com.br/6"]}') $$,
  'P0001', 'Até 5 páginas por fonte.', '6 páginas');
select is((select count(*)::int from public.agente_mudancas where descricao = 'Fonte do Radar: + Portal Contábeis'), 1, 'o histórico do Radar registra a fonte nova');
select lives_ok($$ select public.salvar_fonte_radar(current_setting('i5r.fonte')::uuid, '{"ativa":true,"paginas":["https://www.contabeis.com.br/n"]}') $$, 'Dono edita a fonte');
select is((select paginas from public.radar_fontes where id = current_setting('i5r.fonte')::uuid), array['https://www.contabeis.com.br/n'], 'a página ficou');
select is((select count(*)::int from public.agente_mudancas where descricao = 'Fonte do Radar alterada: Portal Contábeis'), 1, 'o histórico registra a edição');

-- 47: a 31ª fonte ligada
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.radar_fontes (nome, dominio, ordem)
  select 'I5R Fonte ' || g, 'f' || g || '.gov.br', 200 + g from generate_series(1, 20) g;   -- 10 + 20 = 30 ligadas
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_fonte_radar(null, '{"nome":"Fonte 31","dominio":"f31.gov.br"}') $$,
  'P0001', 'Até 30 fontes ligadas.', 'a 31ª fonte ligada');
select lives_ok($$ select public.salvar_fonte_radar(null, '{"nome":"Fonte 31","dominio":"f31.gov.br","ativa":false}') $$, 'a 31ª desligada cabe');

-- 49–52: remover_fonte_radar
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.radar_fontes where nome like 'I5R Fonte %' or nome = 'Fonte 31';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.remover_fonte_radar(current_setting('i5r.fonte')::uuid) $$, 'P0001', 'Só o dono altera as fontes do Radar.', 'Adm não remove');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.remover_fonte_radar(current_setting('i5r.fonte')::uuid) $$, 'Dono remove');
select is((select count(*)::int from public.radar_fontes where nome = 'Portal Contábeis'), 0, 'a fonte saiu');
select is((select count(*)::int from public.agente_mudancas where descricao = 'Fonte do Radar: − Portal Contábeis'), 1, 'o histórico registra a remoção');

-- 53–62: salvar_config_radar
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_config_radar('{"hora":"07:30"}') $$, 'P0001', 'Só o dono altera o Radar.', 'Adm não muda a agenda');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_config_radar('{"hora":"07:30","dias":[1,2,3,4,5]}') $$, 'Dono muda a agenda');
select results_eq($$ select hora, dias from public.radar_config $$, $$ values ('07:30'::time, '{1,2,3,4,5}'::smallint[]) $$, 'a agenda gravou');
select throws_ok($$ select public.salvar_config_radar('{"hora":"25:00"}') $$, 'P0001', 'Hora inválida.', 'hora 25:00');
select throws_ok($$ select public.salvar_config_radar('{"dias":[]}') $$, 'P0001', 'Escolha ao menos um dia.', 'nenhum dia');
select throws_ok($$ select public.salvar_config_radar('{"limite_usd_giro":9}') $$, 'P0001', 'O limite por giro vai de US$ 0,05 a US$ 5,00.', 'limite alto demais');
select throws_ok($$ select public.salvar_config_radar('{"cor":"azul"}') $$, 'P0001', 'Dados do Radar inválidos.', 'chave desconhecida');
select throws_ok($$ select public.salvar_config_radar(jsonb_build_object('assuntos', to_jsonb(array(select 'Assunto ' || g from generate_series(1, 21) g)))) $$,
  'P0001', 'Até 20 assuntos vigiados.', '21 assuntos');
select is((select count(*)::int from public.agente_mudancas where descricao = 'Radar: agenda dias úteis, 7h30'), 1, 'o histórico registra a agenda');
select is((select hora from public.radar_config), '07:30'::time, 'as recusas não mudaram nada');

-- 63–73: pedir_giro_radar
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.pedir_giro_radar() $$, 'P0001', 'Só o dono e o administrador pedem um giro.', 'Ana não pede giro');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.pedir_giro_radar() $$, 'P0001', 'O Radar está desligado.', 'Radar desligado');
reset role;
select set_config('request.jwt.claims', '', true);
update public.agentes set estado = 'ligado' where slug = 'radar';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select ok(set_config('i5r.giro', public.pedir_giro_radar()::text, true) is not null, 'Adm pede um giro');
select results_eq($$ select estado, origem, pedido_por from public.radar_giros where id = current_setting('i5r.giro')::uuid $$,
  $$ values ('pendente'::text, 'pedido'::text, 'fc000000-0000-0000-0000-00000000000b'::uuid) $$, 'pendente, pedido, por Adm');
select throws_ok($$ select public.pedir_giro_radar() $$, 'P0001', 'Já tem um giro em andamento.', 'segundo pedido enquanto roda');
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.radar_giros;
insert into public.radar_giros (origem, estado, dia, terminado_em)
  select 'pedido', 'concluido', interno.dia_sp(now()), now() from generate_series(1, 6);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.pedir_giro_radar() $$, 'P0001', 'Já foram 6 giros pedidos hoje. O próximo agendado roda sozinho.', '6 pedidos no dia');
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.radar_giros;
update public.radar_fontes set ativa = false;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.pedir_giro_radar() $$, 'P0001', 'Cadastre ao menos uma fonte ligada.', 'sem fonte ligada');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.pedir_giro_radar() $$, 'P0001', 'Cadastre ao menos uma fonte ligada.', 'o dono também');
reset role;
select set_config('request.jwt.claims', '', true);
update public.radar_fontes set ativa = true;
delete from public.radar_giros;
update public.radar_config set hora = '07:00', dias = '{0,1,2,3,4,5,6}';

-- 74–83: abrir_giros_radar (D5, Foco 4): São Paulo = UTC−3
set local role service_role;
select is(public.abrir_giros_radar('2026-10-26 09:59+00'), null::text, '06:59 em SP: ainda não');
select is(public.abrir_giros_radar('2026-10-26 10:00+00'), 'agenda', '07:00 em SP: abre o agendado');
select results_eq($$ select origem, estado, dia from public.radar_giros $$, $$ values ('agenda'::text, 'pendente'::text, '2026-10-26'::date) $$, 'o giro agendado do dia 26');
select is(public.abrir_giros_radar('2026-10-26 10:01+00'), null::text, 'com giro em andamento: nada');
update public.radar_giros set estado = 'concluido', terminado_em = '2026-10-26 10:05+00';
select is(public.abrir_giros_radar('2026-10-26 18:00+00'), null::text, 'um agendado por dia');
update public.radar_config set hora = '15:00';
select is(public.abrir_giros_radar('2026-10-26 18:30+00'), null::text, 'mudar a hora não abre outro no mesmo dia');
select is(public.abrir_giros_radar('2026-10-27 02:59+00'), null::text, '23:59 do dia 26 em SP ainda é o dia 26');
update public.radar_config set hora = '00:00';
select is(public.abrir_giros_radar('2026-10-27 03:00+00'), 'agenda', 'meia-noite em SP abre o do dia 27');
select is((select dia from public.radar_giros where estado = 'pendente'), '2026-10-27'::date, 'com dia 27');
update public.radar_giros set estado = 'concluido', terminado_em = '2026-10-27 03:05+00';
update public.radar_config set dias = '{1,2,3,4,5}';
select is(public.abrir_giros_radar('2026-10-31 12:00+00'), null::text, 'sábado fora da agenda de seg–sex');
update public.radar_config set dias = '{0,1,2,3,4,5,6}';
reset role;
update public.agentes set estado = 'teste' where slug = 'radar';
set local role service_role;
select is(public.abrir_giros_radar('2026-11-03 12:00+00'), null::text, 'Radar em teste: não abre sozinho');
reset role;
update public.agentes set estado = 'ligado' where slug = 'radar';
set local role service_role;
insert into public.radar_giros (origem, estado, dia, iniciado_em) values ('pedido', 'rodando', '2026-11-03', '2026-11-03 11:19+00');
select is(public.abrir_giros_radar('2026-11-03 12:00+00'), 'agenda', 'o giro parado fecha e o agendado abre na mesma chamada');
select results_eq($$ select estado, erro from public.radar_giros where origem = 'pedido' and dia = '2026-11-03' $$,
  $$ values ('falhou'::text, 'O giro parou no meio.'::text) $$, 'o giro de 41 minutos virou falhou');

-- 87–90: nova tentativa (D15)
delete from public.radar_giros;
insert into public.radar_giros (origem, estado, dia, terminado_em, nova_tentativa_em, fontes_fora) values
  ('agenda', 'concluido', '2026-11-04', '2026-11-04 10:30+00', '2026-11-04 15:00+00',
   jsonb_build_array(jsonb_build_object('fonte_id', (select id from public.radar_fontes where nome like 'Prefeitura%'),
     'nome', 'Prefeitura de Conselheiro Lafaiete', 'motivo', 'fora do ar')));
select is(public.abrir_giros_radar('2026-11-04 14:59+00'), null::text, 'antes da hora da nova tentativa: nada');
select is(public.abrir_giros_radar('2026-11-04 16:00+00'), 'nova_tentativa', 'a hora chegou: nova tentativa');
select is((select fontes_ids from public.radar_giros where origem = 'nova_tentativa'),
  array[(select id from public.radar_fontes where nome like 'Prefeitura%')], 'só a fonte que estava fora');
update public.radar_giros set estado = 'concluido', terminado_em = '2026-11-04 16:10+00' where origem = 'nova_tentativa';
select is(public.abrir_giros_radar('2026-11-04 17:00+00'), null::text, 'uma nova tentativa por dia');

-- fonte_id que não é código de fonte não trava o dia; a nova tentativa não abre depois das 20 h em SP
delete from public.radar_giros;
insert into public.radar_giros (origem, estado, dia, terminado_em, nova_tentativa_em, fontes_fora) values
  ('agenda', 'concluido', '2026-11-08', '2026-11-08 10:30+00', '2026-11-08 12:00+00', '[{"fonte_id":"x","nome":"A"},{"fonte_id":null,"nome":"B"},{"nome":"C"}]');
select is(public.abrir_giros_radar('2026-11-08 13:00+00'), null::text, 'fonte_id inválido ou nulo: não dá erro e não abre nova tentativa');
delete from public.radar_giros;
insert into public.radar_giros (origem, estado, dia, terminado_em, nova_tentativa_em, fontes_fora) values
  ('agenda', 'concluido', '2026-11-09', '2026-11-09 15:00+00', '2026-11-09 20:00+00',
   jsonb_build_array(jsonb_build_object('fonte_id', (select id from public.radar_fontes where nome like 'Prefeitura%'), 'nome', 'Prefeitura', 'motivo', 'fora do ar')));
select is(public.abrir_giros_radar('2026-11-09 23:00+00'), null::text, '20:00 em SP: a nova tentativa não abre');
select is(public.abrir_giros_radar('2026-11-09 22:59+00'), 'nova_tentativa', '19:59 em SP: abre');
delete from public.radar_giros;

-- 91–101: pegar_giro_radar
select is(public.pegar_giro_radar(), null::jsonb, 'sem giro pendente: null');
insert into public.radar_giros (id, origem, estado, dia) values ('fc400000-0000-0000-0000-000000000001', 'pedido', 'pendente', '2026-11-05');
select set_config('i5r.pego', public.pegar_giro_radar()::text, true);
select results_eq($$ select estado, iniciado_em is not null from public.radar_giros where id = 'fc400000-0000-0000-0000-000000000001' $$,
  $$ values ('rodando'::text, true) $$, 'o giro vira rodando com a hora de início');
select is((current_setting('i5r.pego')::jsonb -> 'giro' ->> 'id')::uuid, 'fc400000-0000-0000-0000-000000000001'::uuid, 'devolve o giro');
select is(current_setting('i5r.pego')::jsonb -> 'config' ->> 'hora', '00:00', 'devolve a agenda');
select is(jsonb_array_length(current_setting('i5r.pego')::jsonb -> 'fontes'), 9, 'devolve as 9 fontes');
select is(jsonb_array_length(current_setting('i5r.pego')::jsonb -> 'setores'), (select count(*)::int from public.setores where ativo), 'devolve os setores ativos');
select ok((current_setting('i5r.pego')::jsonb -> 'recentes') @> to_jsonb('I5R Novidade de leitura'::text), 'devolve os títulos recentes');
update public.radar_giros set estado = 'concluido', terminado_em = now() where id = 'fc400000-0000-0000-0000-000000000001';
insert into public.radar_giros (id, origem, estado, dia, fontes_ids) values ('fc400000-0000-0000-0000-000000000002', 'nova_tentativa', 'pendente', '2026-11-06',
  array[(select id from public.radar_fontes where nome like 'Prefeitura%')]);
select set_config('i5r.pego', public.pegar_giro_radar()::text, true);
select is(jsonb_array_length(current_setting('i5r.pego')::jsonb -> 'fontes'), 1, 'nova tentativa: só as fontes dela');
select is(current_setting('i5r.pego')::jsonb -> 'fontes' -> 0 ->> 'nome', 'Prefeitura de Conselheiro Lafaiete', 'a Prefeitura');
update public.radar_giros set estado = 'concluido', terminado_em = now() where id = 'fc400000-0000-0000-0000-000000000002';

-- 102–: registrar_novidade_radar
insert into public.radar_giros (id, origem, estado, dia, iniciado_em) values ('fc400000-0000-0000-0000-000000000003', 'pedido', 'rodando', '2026-11-07', now());
select set_config('i5r.base', '{"titulo":"eSocial muda o leiaute","url":"https://www.gov.br/esocial/pt-br/noticias/leiaute",
  "url_normalizada":"gov.br/esocial/pt-br/noticias/leiaute","publicado_em":"2026-10-01","resumo":"O leiaute do eSocial muda para os eventos de folha.",
  "impacto":"alto","criterios":{"com_funcionarios":true},"vigencia_texto":"vale a partir de 01/01/2027","vigencia_inicio":"2027-01-01",
  "mensagem_cliente":"Olá, o eSocial muda a partir de janeiro."}', true);
select set_config('i5r.res', public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb
  || jsonb_build_object('setores', jsonb_build_array((select id from public.setores where nome = 'Pessoal'),
       (select id from public.setores where nome = 'Contábil'), 'fc990000-0000-0000-0000-000000000000')))::text, true);
select is(current_setting('i5r.res')::jsonb ->> 'situacao', 'nova', 'novidade nova');
select is(current_setting('i5r.res')::jsonb ->> 'selo', 'oficial', 'o selo oficial vem do banco');
select is((current_setting('i5r.res')::jsonb ->> 'clientes')::int, 1, 'só a Padaria Sol (Antiga inativa, Lua sem funcionários)');
select results_eq($$ select fonte_nome, cardinality(setores), estado, selo from public.radar_novidades where id = (current_setting('i5r.res')::jsonb ->> 'id')::uuid $$,
  $$ values ('eSocial'::text, 2, 'para_decidir'::text, 'oficial'::text) $$, 'fonte eSocial, só os 2 setores que existem, para decidir');
select is((select setores @> array[(select id from public.setores where nome = 'Pessoal'), (select id from public.setores where nome = 'Contábil')]
           from public.radar_novidades where id = (current_setting('i5r.res')::jsonb ->> 'id')::uuid), true, 'os setores são o Pessoal e o Contábil');
select is((select novidades from public.radar_giros where id = 'fc400000-0000-0000-0000-000000000003'), 1, 'o giro conta 1 novidade');

-- repetidas, selo e fonte desconhecida
select is(public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb) ->> 'situacao', 'repetida', 'mesma URL: repetida');
select is((select repetidas from public.radar_giros where id = 'fc400000-0000-0000-0000-000000000003'), 1, 'o giro conta 1 repetida');
select is(public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb
  || '{"titulo":"ESOCIAL MUDA O LEIAUTE","url":"https://www.gov.br/esocial/pt-br/outro","url_normalizada":"gov.br/esocial/pt-br/outro"}') ->> 'situacao',
  'repetida', 'mesmo título em outro link: repetida');
-- uma fonte não oficial cadastrada (como o trabalhador não pode, o dono do banco faria; service_role tem a tabela)
insert into public.radar_fontes (id, nome, dominio, etiqueta, oficial, ordem) values ('fc600000-0000-0000-0000-000000000001', 'Contábeis', 'contabeis.com.br', 'FED', false, 99);
select set_config('i5r.res2', public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb
  || '{"titulo":"Notícia de portal","url":"https://www.contabeis.com.br/n/1","url_normalizada":"contabeis.com.br/n/1"}')::text, true);
select is(current_setting('i5r.res2')::jsonb ->> 'selo', 'confirmar', 'fonte não oficial: confirmar');
select is((select fonte_id from public.radar_novidades where id = (current_setting('i5r.res2')::jsonb ->> 'id')::uuid), 'fc600000-0000-0000-0000-000000000001'::uuid, 'com a fonte do portal');
select set_config('i5r.res3', public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb
  || '{"titulo":"Notícia da Anvisa","url":"https://www.gov.br/anvisa/n","url_normalizada":"gov.br/anvisa/n"}')::text, true);
select is(current_setting('i5r.res3')::jsonb ->> 'selo', 'confirmar', 'fonte desconhecida: confirmar');
select results_eq($$ select fonte_id, fonte_nome from public.radar_novidades where id = (current_setting('i5r.res3')::jsonb ->> 'id')::uuid $$,
  $$ values (null::uuid, 'gov.br'::text) $$, 'sem fonte, com o domínio como nome');

-- critérios (D10)
select is((public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb
  || '{"titulo":"Critério A","url_normalizada":"gov.br/c/a","criterios":{"regimes":["presumido","real"],"segmentos":["comercio"],"ufs":["MG"]}}') ->> 'clientes')::int,
  1, 'presumido ou real + comércio + MG: só o Mercado Lua');
select is((public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb
  || '{"titulo":"Critério B","url_normalizada":"gov.br/c/b","criterios":{"regimes":["simples"]}}') ->> 'clientes')::int,
  1, 'simples: a Padaria (a Antiga está inativa)');
select is((public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb
  || '{"titulo":"Critério C","url_normalizada":"gov.br/c/c","criterios":{"cnaes":["4721"]}}') ->> 'clientes')::int,
  1, 'CNAE 4721: a Padaria');
select is((public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb
  || '{"titulo":"Critério D","url_normalizada":"gov.br/c/d","criterios":{}}') ->> 'clientes')::int,
  3, 'sem critério: os 3 ativos');
select is((public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb
  || '{"titulo":"Critério E","url_normalizada":"gov.br/c/e","criterios":{"ufs":"MG"}}') ->> 'clientes')::int,
  3, 'critério que não é lista é ignorado');

-- validações
select throws_ok($$ select public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb || '{"titulo":"Valida I","impacto":"altíssimo"}') $$,
  'P0001', 'Impacto inválido.', 'impacto inválido');
select throws_ok($$ select public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb || '{"titulo":"ab"}') $$,
  'P0001', 'Título da novidade: de 3 a 200 letras.', 'título curto');
select throws_ok($$ select public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000003', current_setting('i5r.base')::jsonb || '{"titulo":"Valida L","url":"javascript:x"}') $$,
  'P0001', 'Link inválido.', 'link que não é http');
select throws_ok($$ select public.registrar_novidade_radar('fc400000-0000-0000-0000-000000000000', current_setting('i5r.base')::jsonb || '{"titulo":"Valida G"}') $$,
  'P0001', 'O giro não está rodando.', 'giro concluído');

-- giro confirmar (D7)
update public.radar_giros set estado = 'concluido', terminado_em = now() where id = 'fc400000-0000-0000-0000-000000000003';
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select ok(set_config('i5r.conf', public.procurar_fonte_oficial_radar((current_setting('i5r.res2')::jsonb ->> 'id')::uuid)::text, true) is not null, 'Dono pede para achar a fonte oficial');
select results_eq($$ select origem, estado, novidade_id from public.radar_giros where id = current_setting('i5r.conf')::uuid $$,
  $$ values ('confirmar'::text, 'pendente'::text, (current_setting('i5r.res2')::jsonb ->> 'id')::uuid) $$, 'giro confirmar com a novidade');
reset role;
select set_config('request.jwt.claims', '', true);
set local role service_role;
select is(public.pegar_giro_radar() -> 'novidade' ->> 'titulo', 'Notícia de portal', 'o trabalhador recebe a novidade a confirmar');
select is(public.registrar_novidade_radar(current_setting('i5r.conf')::uuid, current_setting('i5r.base')::jsonb
  || '{"url":"https://www.gov.br/esocial/pt-br/confirmado","url_normalizada":"gov.br/esocial/pt-br/confirmado"}') ->> 'situacao',
  'confirmada', 'link oficial: confirmada');
select results_eq($$ select selo, url, fonte_nome from public.radar_novidades where id = (current_setting('i5r.res2')::jsonb ->> 'id')::uuid $$,
  $$ values ('oficial'::text, 'https://www.gov.br/esocial/pt-br/confirmado'::text, 'eSocial'::text) $$, 'a novidade original ficou oficial com o link novo');
update public.radar_giros set estado = 'concluido', terminado_em = now() where id = current_setting('i5r.conf')::uuid;
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_config('i5r.conf', public.procurar_fonte_oficial_radar((current_setting('i5r.res3')::jsonb ->> 'id')::uuid)::text, true);
reset role;
select set_config('request.jwt.claims', '', true);
set local role service_role;
select public.pegar_giro_radar();
select is(public.registrar_novidade_radar(current_setting('i5r.conf')::uuid, current_setting('i5r.base')::jsonb
  || '{"url":"https://www.contabeis.com.br/n/9","url_normalizada":"contabeis.com.br/n/9"}') ->> 'situacao',
  'nao_oficial', 'link não oficial: não confirma');
select results_eq($$ select selo, url from public.radar_novidades where id = (current_setting('i5r.res3')::jsonb ->> 'id')::uuid $$,
  $$ values ('confirmar'::text, 'https://www.gov.br/anvisa/n'::text) $$, 'nada mudou na novidade');
update public.radar_giros set estado = 'concluido', terminado_em = now() where id = current_setting('i5r.conf')::uuid;
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.procurar_fonte_oficial_radar((current_setting('i5r.res2')::jsonb ->> 'id')::uuid) $$,
  'P0001', 'Esta novidade já é de fonte oficial.', 'novidade já oficial');
-- revisão final: giro confirmar sem fonte oficial ligada é recusado
reset role;
select set_config('request.jwt.claims', '', true);
update public.radar_fontes set oficial = false;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.procurar_fonte_oficial_radar((current_setting('i5r.res3')::jsonb ->> 'id')::uuid) $$,
  'P0001', 'Ligue ao menos uma fonte oficial.', 'sem fonte oficial ligada: não abre giro confirmar');
reset role;
select set_config('request.jwt.claims', '', true);
select is((select count(*)::int from public.radar_giros where estado in ('pendente', 'rodando')), 0, 'nenhum giro ficou aberto');
update public.radar_fontes set oficial = true;

-- concluir_giro_radar (D15)
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.radar_giros;
insert into public.radar_giros (id, origem, estado, dia, iniciado_em) values ('fc400000-0000-0000-0000-000000000004', 'agenda', 'rodando', '2026-10-26', '2026-10-26 10:00+00');
set local role service_role;
select public.concluir_giro_radar('fc400000-0000-0000-0000-000000000004', jsonb_build_object('estado', 'concluido', 'terminado_em', '2026-10-26 10:03+00',
  'fontes', 9, 'paginas', 12, 'buscas', 3, 'resumo', 'Tudo lido.', 'lidas', jsonb_build_array(jsonb_build_object('fonte', 'CFC', 'paginas', 2)),
  'fontes_fora', jsonb_build_array(jsonb_build_object('fonte_id', (select id from public.radar_fontes where nome like 'Prefeitura%'), 'nome', 'Prefeitura', 'motivo', 'fora do ar'))));
select results_eq($$ select estado, fontes, paginas, buscas, resumo, jsonb_array_length(fontes_fora), jsonb_array_length(lidas)
  from public.radar_giros where id = 'fc400000-0000-0000-0000-000000000004' $$,
  $$ values ('concluido'::text, 9, 12, 3, 'Tudo lido.'::text, 1, 1) $$, 'grava estado, contagens, resumo, fontes fora e lidas');
select is((select nova_tentativa_em from public.radar_giros where id = 'fc400000-0000-0000-0000-000000000004'), '2026-10-26 15:03+00'::timestamptz,
  'agendado com fonte fora: nova tentativa em 5 h');
delete from public.radar_giros;
insert into public.radar_giros (id, origem, estado, dia, iniciado_em) values ('fc400000-0000-0000-0000-000000000005', 'agenda', 'rodando', '2026-10-26', '2026-10-26 18:00+00');
select public.concluir_giro_radar('fc400000-0000-0000-0000-000000000005', jsonb_build_object('terminado_em', '2026-10-26 18:30+00',
  'fontes_fora', jsonb_build_array(jsonb_build_object('fonte_id', (select id from public.radar_fontes where nome like 'Prefeitura%'), 'nome', 'Prefeitura', 'motivo', 'fora do ar'))));
select is((select nova_tentativa_em from public.radar_giros where id = 'fc400000-0000-0000-0000-000000000005'), null::timestamptz, 'depois das 20 h em SP: sem nova tentativa');
insert into public.radar_giros (id, origem, estado, dia, iniciado_em) values ('fc400000-0000-0000-0000-000000000006', 'pedido', 'rodando', '2026-10-26', now());
select public.concluir_giro_radar('fc400000-0000-0000-0000-000000000006', jsonb_build_object('terminado_em', '2026-10-26 10:03+00', 'resumo', 'Primeiro.',
  'fontes_fora', jsonb_build_array(jsonb_build_object('fonte_id', (select id from public.radar_fontes where nome like 'Prefeitura%'), 'nome', 'Prefeitura', 'motivo', 'fora do ar'))));
select is((select nova_tentativa_em from public.radar_giros where id = 'fc400000-0000-0000-0000-000000000006'), null::timestamptz, 'giro pedido: sem nova tentativa');
select public.concluir_giro_radar('fc400000-0000-0000-0000-000000000006', '{"resumo":"Segundo.","estado":"falhou"}');
select results_eq($$ select estado, resumo from public.radar_giros where id = 'fc400000-0000-0000-0000-000000000006' $$,
  $$ values ('concluido'::text, 'Primeiro.'::text) $$, 'concluir um giro que não está rodando não muda nada');

-- somar_custo_giro
insert into public.radar_giros (id, origem, estado, dia, iniciado_em) values ('fc400000-0000-0000-0000-000000000007', 'pedido', 'rodando', '2026-10-28', now());
select public.somar_custo_giro('fc400000-0000-0000-0000-000000000007', 0.5);
select public.somar_custo_giro('fc400000-0000-0000-0000-000000000007', 0.25);
select is((select custo_usd from public.radar_giros where id = 'fc400000-0000-0000-0000-000000000007'), 0.75::numeric, 'o custo soma');
select public.somar_custo_giro('fc400000-0000-0000-0000-000000000007', -1);
select is((select custo_usd from public.radar_giros where id = 'fc400000-0000-0000-0000-000000000007'), 0.75::numeric, 'valor negativo soma 0');

-- restaurar_radar_inicial: ninguém pela API
select throws_ok($$ select public.salvar_config_radar('{"hora":"07:30"}') $$, '42501', null, 'service_role não chama as funções das pessoas');
select throws_ok($$ select public.restaurar_radar_inicial() $$, '42501', null, 'service_role não chama restaurar_radar_inicial');
reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.restaurar_radar_inicial() $$, '42501', null, 'o dono não chama restaurar_radar_inicial');
reset role;
select set_config('request.jwt.claims', '', true);
select lives_ok($$ select public.restaurar_radar_inicial() $$, 'o dono do banco restaura');
select is((select count(*)::int from public.radar_fontes), 9, 'voltam as 9 fontes');
select results_eq($$ select (select count(*)::int from public.radar_giros), (select count(*)::int from public.radar_novidades), (select hora from public.radar_config) $$,
  $$ values (0, 0, '07:00'::time) $$, 'sem giros, sem novidades, agenda inicial');

select * from finish();
rollback;
