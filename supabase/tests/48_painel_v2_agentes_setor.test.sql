-- Parte I2, Task 2 (spec 7E.3 "Como fala com o cliente", 7E.9 item 2; D2, D6, D8, D11, D12): catálogo do setor, trava das
-- ferramentas, agentes ativos para o contato, condução da conversa e uso no mês das regras e das skills por agente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

update public.usuarios set dono = false where dono;   -- outro teste ou e2e pode ter deixado um dono
insert into auth.users (id, email) values
  ('f6000000-0000-0000-0000-00000000000a', 'dono@i2a.local'), ('f6000000-0000-0000-0000-00000000000b', 'ze@i2a.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('f6000000-0000-0000-0000-00000000000a', 'I2 Dono', 'dono@i2a.local', 'admin', '{}'),
  ('f6000000-0000-0000-0000-00000000000b', 'I2 Zé', 'ze@i2a.local', 'atendente', '{}');
update public.usuarios set dono = true where id = 'f6000000-0000-0000-0000-00000000000a';
insert into public.contatos (id, nome, telefone) values
  ('f6100000-0000-0000-0000-00000000000a', 'I2 Carla', '5531966660001'),
  ('f6100000-0000-0000-0000-00000000000b', 'I2 Beto', '5531966660002');
insert into public.conversas (id, telefone, contato_id) values
  ('f6200000-0000-0000-0000-00000000000a', '5531966660001', 'f6100000-0000-0000-0000-00000000000a'),
  ('f6200000-0000-0000-0000-00000000000b', '5531966660002', 'f6100000-0000-0000-0000-00000000000b');

-- 1–4: colunas e catálogo (D12)
select has_column('public', 'conversas', 'agente_conduzindo_id', 'conversas.agente_conduzindo_id existe');
select has_column('public', 'decisoes_agente', 'agente_id', 'decisoes_agente.agente_id existe');
select is(public.ferramentas_do_catalogo(), public.ferramentas_do_atendimento() || public.ferramentas_do_setor(), 'catálogo = 16 do Thiago + 4 do setor');
select ok(public.ferramentas_so_do_atendimento() <@ public.ferramentas_do_atendimento(), 'as "só do Thiago" são do Thiago');

-- 5–8: trava das ferramentas (D8), pelo dono
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f6000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_agente('fiscal', '{"ferramentas":["abrir_chamado"]}') $$, 'P0001',
  'Abrir demanda, escolher empresa, avisar que não entendeu, passar para pessoa e enviar documento são só do Thiago: o agente do setor devolve a conversa a ele.',
  'agente do setor não recebe ferramenta "só do Thiago"');
select lives_ok($$ select public.salvar_agente('fiscal', '{"ferramentas":["consultar_chamados","responder","conferir_pedido_nota","nota_interna"]}') $$,
  'as do setor e responder entram no Fiscal');
select throws_ok($$ select public.salvar_agente('atendimento', jsonb_build_object('ferramentas', to_jsonb(public.ferramentas_do_atendimento() || array['nota_interna']))) $$,
  'P0001', 'As ferramentas do setor são dos agentes dos setores, não do Thiago.', 'o Thiago não recebe ferramenta do setor');
select throws_ok($$ select * from public.agentes_para_contato('f6100000-0000-0000-0000-00000000000a') $$, '42501', null,
  'agentes_para_contato é só do trabalhador');

-- 9–16: quem está ativo para o contato (D2)
select lives_ok($$ select public.definir_contatos_teste('fiscal', array['f6100000-0000-0000-0000-00000000000a'::uuid]) $$, 'Carla na lista');
select lives_ok($$ select public.salvar_agente('fiscal', '{"estado":"teste"}') $$, 'Fiscal em Teste, ainda sem modo');
select lives_ok($$ select public.salvar_regra_assunto('fiscal', null, 'Pedido de nota de venda', 'Preciso da nota do pedido 4512', 'mesma_voz') $$, 'uma regra');
select throws_ok($$ select public.salvar_regra_assunto('fiscal', null, '   ', 'x', 'mesma_voz') $$, 'P0001', 'O assunto tem de 2 a 80 letras.', 'regra sem assunto (só espaços) é recusada');
reset role;
select throws_ok($$ insert into public.agente_regras_assunto (agente_id, assunto, modo) values ((select id from public.agentes where slug = 'fiscal'), '   ', 'mesma_voz') $$, '23514', null, 'o banco também recusa assunto vazio na regra');
select is((select count(*)::int from public.agentes_para_contato('f6100000-0000-0000-0000-00000000000a')), 0, 'sem modo: não atende (D2)');
update public.agentes set modo_contato = 'por_tras' where slug = 'fiscal';
select results_eq($$ select slug, setor, modo_contato, jsonb_array_length(regras) from public.agentes_para_contato('f6100000-0000-0000-0000-00000000000a') $$,
  $$ values ('fiscal'::text, 'Fiscal'::text, 'por_tras'::text, 1) $$, 'Teste + modo + contato na lista: atende, com as regras');
select is((select count(*)::int from public.agentes_para_contato('f6100000-0000-0000-0000-00000000000b')), 0, 'Teste: contato fora da lista não');
update public.agentes set estado = 'ligado' where slug = 'fiscal';
update public.agentes set estado = 'ligado', modo_contato = 'mesma_voz' where slug = 'contabil';
select results_eq($$ select slug from public.agentes_para_contato('f6100000-0000-0000-0000-00000000000b') $$, $$ values ('fiscal'::text) $$,
  'Ligado: todos os contatos; só Trabalho (Contábil) não entra na conversa');
select is((select regras -> 0 ->> 'assunto' from public.agentes_para_contato('f6100000-0000-0000-0000-00000000000a')),
  'Pedido de nota de venda', 'a regra vem com assunto, exemplo e modo');

-- 17–23: condução (D6)
select ok(public.iniciar_conducao('f6200000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal')), 'passa a conversa');
select is((select tipo || ':' || texto from public.conversa_eventos where conversa_id = 'f6200000-0000-0000-0000-00000000000a'),
  'agente_assumiu:Agente Fiscal', 'marco "assumiu" com o nome do agente');
select ok(not public.iniciar_conducao('f6200000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal')),
  'o mesmo agente de novo: nada muda (sem marco repetido)');
select throws_ok($$ select public.iniciar_conducao('f6200000-0000-0000-0000-00000000000a', 'a0000000-0000-4000-8000-000000000001') $$,
  'P0001', 'Agente não encontrado.', 'o Thiago não "conduz"');
select ok(public.encerrar_conducao('f6200000-0000-0000-0000-00000000000a', 'assunto encerrado'), 'devolve ao Thiago');
select is((select texto from public.conversa_eventos where conversa_id = 'f6200000-0000-0000-0000-00000000000a' and tipo = 'agente_devolveu'),
  'Agente Fiscal: assunto encerrado', 'marco "devolveu" com o motivo');
select ok(not public.encerrar_conducao('f6200000-0000-0000-0000-00000000000a', 'de novo'), 'sem condução: nada a encerrar');

-- 24–29: uso no mês das regras e das skills, por agente (D11)
insert into public.decisoes_agente (conversa_id, etapa, entrada, saida, criado_em) values
  ('f6200000-0000-0000-0000-00000000000a', 'chamar_agente', '{}', jsonb_build_object('agente_id', (select id from public.agentes where slug = 'fiscal'),
     'regra_id', (select id from public.agente_regras_assunto limit 1)), '2026-10-05 15:00Z'),
  ('f6200000-0000-0000-0000-00000000000a', 'chamar_agente', '{}', jsonb_build_object('agente_id', (select id from public.agentes where slug = 'fiscal'),
     'regra_id', (select id from public.agente_regras_assunto limit 1)), '2026-10-06 15:00Z'),
  ('f6200000-0000-0000-0000-00000000000b', 'chamar_agente', '{}', jsonb_build_object('agente_id', (select id from public.agentes where slug = 'fiscal'),
     'regra_id', (select id from public.agente_regras_assunto limit 1)), '2026-10-07 15:00Z'),
  ('f6200000-0000-0000-0000-00000000000b', 'chamar_agente', '{}', jsonb_build_object('agente_id', (select id from public.agentes where slug = 'fiscal'),
     'regra_id', null), '2026-10-07 16:00Z');
insert into public.agente_skills (agente_id, nome, tipo, ativo)
  values ((select id from public.agentes where slug = 'fiscal'), 'tabela-cfop', 'conhecimento', false),
         ('a0000000-0000-4000-8000-000000000001', 'tabela-cfop', 'conhecimento', false);
insert into public.decisoes_agente (conversa_id, etapa, entrada, criado_em, agente_id) values
  ('f6200000-0000-0000-0000-00000000000a', 'ler_skill', '{"nome":"tabela-cfop"}', '2026-10-05 15:00Z', (select id from public.agentes where slug = 'fiscal')),
  ('f6200000-0000-0000-0000-00000000000a', 'ler_skill', '{"nome":"tabela-cfop"}', '2026-10-05 15:01Z', (select id from public.agentes where slug = 'fiscal')),
  ('f6200000-0000-0000-0000-00000000000b', 'ler_skill', '{"nome":"tabela-cfop"}', '2026-10-05 15:02Z', null);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f6000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select results_eq($$ select conversas from public.uso_regras('fiscal', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$,
  $$ values (2::bigint) $$, 'regra: conversas distintas (2); chamada sem regra não conta');
select results_eq($$ select nome, vezes from public.uso_skills('fiscal', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$,
  $$ values ('tabela-cfop'::text, 2::bigint) $$, 'skill do Fiscal: só as leituras do Fiscal');
select results_eq($$ select nome, vezes from public.uso_skills('atendimento', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$,
  $$ values ('tabela-cfop'::text, 1::bigint) $$, 'mesmo nome no Thiago: só as leituras sem agente (o Thiago)');
select throws_ok($$ select * from public.uso_regras('fiscal', '2026-11-01 03:00Z', '2026-10-01 03:00Z') $$, 'P0001', 'Período inválido.',
  'período invertido recusa');
select throws_ok($$ select public.iniciar_conducao('f6200000-0000-0000-0000-00000000000b', (select id from public.agentes where slug = 'fiscal')) $$,
  '42501', null, 'a condução é só do trabalhador');
select set_config('request.jwt.claims', '{"sub":"f6000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select * from public.uso_regras('fiscal', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$, 'P0001',
  'Você não tem acesso aos agentes.', 'uso das regras só de quem vê os agentes');
reset role;

select * from finish();
rollback;
