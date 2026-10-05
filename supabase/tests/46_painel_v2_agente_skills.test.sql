-- Parte I1, Task 3 (spec 7E.3, 7E.10; D5–D9): só o dono sobe, liga, restaura e arquiva skills; nome no formato das skills do
-- Claude; .md/.txt/.csv; Jeito+Limites ligados até 10.000; o trabalhador lê só as ligadas do próprio agente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

update public.usuarios set dono = false where dono;
insert into auth.users (id, email) values
  ('f5200000-0000-0000-0000-00000000000a', 'dono@i1b.local'), ('f5200000-0000-0000-0000-00000000000b', 'admin@i1b.local'),
  ('f5200000-0000-0000-0000-00000000000c', 'ana@i1b.local'), ('f5200000-0000-0000-0000-00000000000d', 'ze@i1b.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('f5200000-0000-0000-0000-00000000000a', 'I1B Dono', 'dono@i1b.local', 'admin', '{}'),
  ('f5200000-0000-0000-0000-00000000000b', 'I1B Admin', 'admin@i1b.local', 'admin', '{}'),
  ('f5200000-0000-0000-0000-00000000000c', 'I1B Ana', 'ana@i1b.local', 'atendente', '{treinar_agente}'),
  ('f5200000-0000-0000-0000-00000000000d', 'I1B Zé', 'ze@i1b.local', 'atendente', '{}');
update public.usuarios set dono = true where id = 'f5200000-0000-0000-0000-00000000000a';

create temp table pac (nome text primary key, p jsonb) on commit drop;
grant all on pac to authenticated;
insert into pac values
  ('limites', '{"nome":"nunca-prometer-prazo","titulo":"Nunca promete prazo","descricao":"O que nunca prometer.","tipo":"limites","corpo":"# Nunca promete prazo\nNunca prometa prazo de emissão.","skill_md":"---\nname: nunca-prometer-prazo\n---"}'),
  ('limites-v2', '{"nome":"nunca-prometer-prazo","titulo":"Nunca promete prazo","descricao":"O que nunca prometer.","tipo":"limites","corpo":"# Nunca promete prazo\nNunca prometa prazo nenhum.","skill_md":"---\nname: nunca-prometer-prazo\n---"}'),
  ('jeito-longo', jsonb_build_object('nome', 'jeito-longo', 'titulo', 'Jeito longo', 'descricao', 'Muito texto.', 'tipo', 'jeito',
     'corpo', repeat('x', 9990), 'skill_md', '---')),
  ('procedimento', '{"nome":"conferencia-certidao","titulo":"Certidão","descricao":"Quando pedirem certidão negativa.","tipo":"procedimento","corpo":"Pergunte a finalidade antes.","skill_md":"---","arquivos":[{"caminho":"checklist.md","conteudo":"Pergunte a finalidade."}]}'),
  ('conhecimento', '{"nome":"tabela-cfop","titulo":"Tabela CFOP","descricao":"CFOPs mais usados.","tipo":"conhecimento","corpo":"Veja cfop.csv.","skill_md":"---","arquivos":[{"caminho":"cfop.csv","conteudo":"5102;Venda"}]}'),
  ('fiscal', '{"nome":"jeito-do-fiscal","titulo":"Jeito do Fiscal","descricao":"Tom do Fiscal.","tipo":"jeito","corpo":"Assine Fiscal do escritório.","skill_md":"---","arquivos":[{"caminho":"frases.md","conteudo":"Bom dia!"}]}'),
  ('nome-ruim', '{"nome":"Nome Com Espaço","titulo":"x","descricao":"x","tipo":"limites","corpo":"x","skill_md":"---"}'),
  ('pdf', '{"nome":"com-pdf","titulo":"x","descricao":"x","tipo":"conhecimento","corpo":"x","skill_md":"---","arquivos":[{"caminho":"guia.pdf","conteudo":"x"}]}'),
  ('fuga', '{"nome":"com-fuga","titulo":"x","descricao":"x","tipo":"conhecimento","corpo":"x","skill_md":"---","arquivos":[{"caminho":"../segredo.md","conteudo":"x"}]}'),
  ('muitos', jsonb_build_object('nome', 'muitos', 'titulo', 'x', 'descricao', 'x', 'tipo', 'conhecimento', 'corpo', 'x', 'skill_md', '---',
     'arquivos', (select jsonb_agg(jsonb_build_object('caminho', 'a' || i || '.md', 'conteudo', 'x')) from generate_series(1, 21) i)));

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f5200000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1–8: subir
select is(public.subir_skill('atendimento', (select p from pac where nome = 'limites')) ->> 'versao', '1', 'skill nova é a versão 1');
select is((select ativo from public.agente_skills where nome = 'nunca-prometer-prazo'), false, 'nasce desligada (D8)');
select is(public.subir_skill('atendimento', (select p from pac where nome = 'limites-v2')) ->> 'versao', '2', 'mesmo name = versão nova');
select is((select count(*)::int from public.agente_skill_versoes v join public.agente_skills s on s.id = v.skill_id where s.nome = 'nunca-prometer-prazo'),
  2, 'as duas versões ficam');
select throws_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'nome-ruim')) $$, 'P0001',
  'O "name" usa só letras minúsculas, números e hífen (até 64), como nas skills do Claude.', 'name fora do formato');
select throws_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'pdf')) $$, 'P0001',
  'Arquivo de referência inválido: guia.pdf. Use .md, .txt ou .csv.', 'PDF não entra na I1 (D7)');
select throws_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'fuga')) $$, 'P0001',
  'Arquivo de referência inválido: ../segredo.md. Use .md, .txt ou .csv.', 'caminho com .. não entra');
select throws_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'muitos')) $$, 'P0001',
  'No máximo 20 arquivos de referência por skill.', 'até 20 arquivos');

-- 9–11: ligar e o limite do bloco sempre carregado (D6)
select is(public.alternar_skill((select id from public.agente_skills where nome = 'nunca-prometer-prazo'), true), true, 'liga o Limite');
select lives_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'jeito-longo')) $$, 'sobe um Jeito longo (desligado)');
select throws_like($$ select public.alternar_skill((select id from public.agente_skills where nome = 'jeito-longo'), true) $$,
  '%passam de 10.000 caracteres%', 'Jeito + Limites ligados acima de 10.000 não ligam');

-- 12–17: as outras (um comando por teste: o pgTAP executa um só)
select is((select ativo from public.agente_skills where nome = 'jeito-longo'), false, 'a tentativa não deixou nada ligado');
select lives_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'procedimento')) $$, 'sobe o procedimento');
select lives_ok($$ select public.alternar_skill((select id from public.agente_skills where nome = 'conferencia-certidao'), true) $$,
  'procedimento ligado');
select lives_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'conhecimento')) $$, 'conhecimento (desligado)');
select lives_ok($$ select public.subir_skill('fiscal', (select p from pac where nome = 'fiscal')) $$, 'Jeito do Fiscal');
select lives_ok($$ select public.alternar_skill((select id from public.agente_skills where nome = 'jeito-do-fiscal'), true) $$,
  'Jeito do Fiscal ligado');

-- 18: restaurar = versão nova com o texto antigo (D9)
select is(public.restaurar_versao_skill((select v.id from public.agente_skill_versoes v join public.agente_skills s on s.id = v.skill_id
  where s.nome = 'nunca-prometer-prazo' and v.versao = 1)), 3, 'restaurar a versão 1 vira a versão 3');

-- 19–21: teste de skill (só o dono; só do Thiago na I1)
select lives_ok($$ select public.criar_simulacao_skill((select id from public.agente_skills where nome = 'tabela-cfop'), 'Qual o CFOP de venda?') $$,
  'o dono testa a skill desligada');
select is((select s.nome from public.simulacoes_agente m join public.agente_skills s on s.id = m.skill_id
  where m.usuario_id = 'f5200000-0000-0000-0000-00000000000a'), 'tabela-cfop', 'o teste leva a skill');
select throws_ok($$ select public.criar_simulacao_skill((select id from public.agente_skills where nome = 'jeito-do-fiscal'), 'Oi') $$,
  'P0001', 'Nesta etapa só dá para testar skills do Thiago.', 'skill de outro agente não testa na I1');

-- 22: arquivar; 23: ligar vira frase no histórico
select lives_ok($$ select public.arquivar_skill((select id from public.agente_skills where nome = 'conferencia-certidao')) $$, 'arquiva');
select ok(exists (select 1 from public.agente_mudancas m where m.agente_id = 'a0000000-0000-4000-8000-000000000001'
  and m.descricao = 'Skill Nunca promete prazo ligada'), 'ligar vira frase no histórico (D28)');

-- 24–26: administrador não-dono
select set_config('request.jwt.claims', '{"sub":"f5200000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'conhecimento')) $$, 'P0001',
  'Só o dono altera as skills.', 'administrador não-dono não sobe');
select throws_ok($$ select public.alternar_skill((select id from public.agente_skills where nome = 'tabela-cfop'), true) $$, 'P0001',
  'Só o dono altera as skills.', 'nem liga');
select ok((select count(*) from public.agente_skills) > 0, 'administrador vê as skills');

-- 27–28: atendente com Treinar o agente lê, mas não chama as leituras do trabalhador
select set_config('request.jwt.claims', '{"sub":"f5200000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select ok((select count(*) from public.agente_skill_versoes) > 0, 'quem treina vê as versões');
select throws_ok($$ select * from public.skills_do_agente('a0000000-0000-4000-8000-000000000001') $$, '42501', null,
  'skills_do_agente é só do trabalhador');

-- 29–30: atendente sem Treinar o agente
select set_config('request.jwt.claims', '{"sub":"f5200000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.agente_skills), 0, 'sem Treinar o agente, não vê skills');
select throws_ok($$ insert into public.agente_skills (agente_id, nome, tipo) values ('a0000000-0000-4000-8000-000000000001', 'x', 'jeito') $$,
  '42501', null, 'direto na tabela, não');
reset role;
select set_config('request.jwt.claims', '', true);

-- 31–36: o que o trabalhador lê (D5)
select results_eq($$ select nome from public.skills_do_agente('a0000000-0000-4000-8000-000000000001') $$,
  $$ values ('nunca-prometer-prazo') $$, 'só as ligadas e não arquivadas do Thiago (sem a desligada, a arquivada e a do Fiscal)');
select results_eq($$ select nome from public.skills_do_agente('a0000000-0000-4000-8000-000000000001',
  (select id from public.agente_skills where nome = 'tabela-cfop')) $$,
  $$ values ('nunca-prometer-prazo'), ('tabela-cfop') $$, 'a skill em teste entra mesmo desligada');
select results_eq($$ select nome from public.skills_do_agente('a0000000-0000-4000-8000-000000000001',
  (select id from public.agente_skills where nome = 'jeito-do-fiscal')) $$,
  $$ values ('nunca-prometer-prazo') $$, 'skill de outro agente não entra nem como teste');
select is(public.referencia_da_skill('a0000000-0000-4000-8000-000000000001', 'tabela-cfop', 'cfop.csv'), null::text, 'arquivo de skill desligada: nada');
select is(public.referencia_da_skill('a0000000-0000-4000-8000-000000000001', 'tabela-cfop', 'cfop.csv',
  (select id from public.agente_skills where nome = 'tabela-cfop')), '5102;Venda', 'na simulação da skill, lê');
select is(public.referencia_da_skill('a0000000-0000-4000-8000-000000000001', 'jeito-do-fiscal', 'frases.md'), null::text,
  'arquivo de skill de outro agente: nada');

-- 37–41: a chave de serviço só lê (pelas funções do trabalhador); não grava nem chama as funções do dono
set local role service_role;
select throws_ok($$ insert into public.agente_skills (agente_id, nome, tipo) values ('a0000000-0000-4000-8000-000000000001', 'x', 'jeito') $$,
  '42501', null, 'service_role não grava skill direto');
select throws_ok($$ update public.agente_skill_versoes set corpo = 'y' $$, '42501', null, 'service_role não muda versão direto');
select throws_ok($$ select public.subir_skill('atendimento', '{}'::jsonb) $$, '42501', null, 'service_role não chama subir_skill');
select throws_ok($$ select public.criar_simulacao_skill(gen_random_uuid(), 'Oi') $$, '42501', null, 'service_role não chama criar_simulacao_skill');
select results_eq($$ select nome from public.skills_do_agente('a0000000-0000-4000-8000-000000000001') $$,
  $$ values ('nunca-prometer-prazo') $$, 'service_role lê as skills ligadas pela função do trabalhador');
reset role;

select * from finish();
rollback;
