-- Parte I1, Task 2 (spec 7E.1, 7E.3, 7E.8; D1, D11–D16, D25, D28): só o dono muda os agentes; a marcação de dono só muda
-- por SQL; os 7 agentes iniciais; o Thiago travado como "Ligado, mesma voz"; orientações pelo setor do agente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

update public.usuarios set dono = false where dono;   -- outro teste ou e2e pode ter deixado um dono
insert into auth.users (id, email) values
  ('f5000000-0000-0000-0000-00000000000a', 'antigo@i1a.local'), ('f5000000-0000-0000-0000-00000000000b', 'novo@i1a.local'),
  ('f5000000-0000-0000-0000-00000000000c', 'ana@i1a.local'), ('f5000000-0000-0000-0000-00000000000d', 'ze@i1a.local'),
  ('f5000000-0000-0000-0000-00000000000e', 'paula@i1a.local'), ('f5000000-0000-0000-0000-00000000000f', 'intruso@i1a.local');
insert into public.usuarios (id, nome, email, papel, permissoes, criado_em) values
  ('f5000000-0000-0000-0000-00000000000a', 'I1 Admin Antigo', 'antigo@i1a.local', 'admin', '{}', '2000-01-01'),
  ('f5000000-0000-0000-0000-00000000000b', 'I1 Admin Novo', 'novo@i1a.local', 'admin', '{}', '2000-06-01'),
  ('f5000000-0000-0000-0000-00000000000c', 'I1 Ana', 'ana@i1a.local', 'atendente', '{treinar_agente}', now()),
  ('f5000000-0000-0000-0000-00000000000d', 'I1 Zé', 'ze@i1a.local', 'atendente', '{}', now()),
  ('f5000000-0000-0000-0000-00000000000e', 'I1 Paula', 'paula@i1a.local', 'atendente', '{treinar_agente}', now());
insert into public.usuario_setores (usuario_id, setor_id) values
  ('f5000000-0000-0000-0000-00000000000c', (select id from public.setores where nome = 'Fiscal')),
  ('f5000000-0000-0000-0000-00000000000e', (select id from public.setores where nome = 'Pessoal'));
insert into public.contatos (id, nome, telefone) values
  ('f5100000-0000-0000-0000-00000000000a', 'I1 Carla', '5531977770001'),
  ('f5100000-0000-0000-0000-00000000000b', 'I1 Arquivado', '5531977770002');
update public.contatos set ativo = false where id = 'f5100000-0000-0000-0000-00000000000b';

-- 1–5: a marcação de dono
select has_column('public', 'usuarios', 'dono', 'usuarios.dono existe');
select is(public.marcar_dono_inicial(), 'I1 Admin Antigo', 'sem dono, marca o administrador ativo mais antigo');
select is((select count(*)::int from public.usuarios where dono), 1, 'um dono só');
select is(public.marcar_dono_inicial(), null::text, 'com dono, não marca outro');
select throws_ok($$ update public.usuarios set dono = true where id = 'f5000000-0000-0000-0000-00000000000b' $$,
  '23505', null, 'dois donos: o índice recusa');

-- 6–7: pela API (qualquer papel, inclusive o de serviço) a marcação não muda
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok($$ update public.usuarios set dono = false where id = 'f5000000-0000-0000-0000-00000000000a' $$,
  'P0001', 'A marcação de dono só muda direto no banco (SQL).', 'a chave de serviço não desmarca o dono');
select throws_ok($$ insert into public.usuarios (id, nome, email, papel, dono) values
  ('f5000000-0000-0000-0000-00000000000f', 'I1 Intruso', 'intruso@i1a.local', 'admin', true) $$,
  'P0001', 'A marcação de dono só muda direto no banco (SQL).', 'ninguém nasce dono pela API');
select set_config('request.jwt.claims', '', true);

-- 8–14: os 7 agentes iniciais (D1)
select is((select count(*)::int from public.agentes), 7, '7 agentes iniciais');
select results_eq($$ select slug from public.agentes order by ordem $$,
  $$ values ('atendimento'), ('radar'), ('fiscal'), ('contabil'), ('pessoal'), ('legalizacao'), ('comercial') $$, 'na ordem da tela');
select is((select (id, nome, estado, modo_contato, porta_de_entrada, setor_id is null)::text from public.agentes where slug = 'atendimento'),
  '(a0000000-0000-4000-8000-000000000001,Thiago,ligado,mesma_voz,t,t)', 'o Thiago: id fixo, Ligado, mesma voz, porta de entrada, sem setor');
select is((select array(select unnest(ferramentas) order by 1) from public.agentes where slug = 'atendimento'),
  array(select unnest(public.ferramentas_do_catalogo()) order by 1), 'o Thiago tem as 16 ferramentas');
select ok((select bool_and(estado = 'desligado' and modo_contato is null and ferramentas = '{}' and not porta_de_entrada)
  from public.agentes where slug <> 'atendimento'), 'os outros 6 desligados, sem modo e sem ferramentas');
select is((select setor_id from public.agentes where slug = 'fiscal'), (select id from public.setores where nome = 'Fiscal'), 'Fiscal no setor Fiscal');
insert into public.orientacoes_agente (titulo, texto, tipo) values ('I1 Antiga', 'Orientação de antes.', 'jeito');
select is((select agente_id from public.orientacoes_agente where titulo = 'I1 Antiga'), 'a0000000-0000-4000-8000-000000000001'::uuid,
  'orientação sem agente é do Thiago (como todas as de hoje)');

-- 15–33: o dono
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select ok(public.eh_dono(), 'o administrador mais antigo é o dono');
select lives_ok($$ select public.salvar_agente('fiscal', '{"modo_contato":"mesma_voz","ferramentas":["consultar_chamados","responder"]}') $$,
  'o dono escolhe modo e ferramentas do Fiscal');
select throws_ok($$ select public.salvar_agente('fiscal', '{"estado":"teste"}') $$,
  'P0001', 'Em teste, escolha pelo menos um contato.', 'Teste sem contato não passa');
select lives_ok($$ select public.definir_contatos_teste('fiscal', array['f5100000-0000-0000-0000-00000000000a']::uuid[]) $$, 'escolhe a Carla');
select lives_ok($$ select public.salvar_agente('fiscal', '{"estado":"teste"}') $$, 'agora fica em Teste');
select throws_ok($$ select public.definir_contatos_teste('fiscal', '{}') $$,
  'P0001', 'Em teste, escolha pelo menos um contato (ou desligue o agente).', 'não esvazia a lista em Teste');
select throws_ok($$ select public.definir_contatos_teste('fiscal', array['f5100000-0000-0000-0000-00000000000b']::uuid[]) $$,
  'P0001', 'Contato não encontrado ou arquivado.', 'contato arquivado não entra');
select throws_ok($$ select public.salvar_agente('atendimento', '{"estado":"desligado"}') $$,
  'P0001', 'O Thiago fica sempre ligado: para parar o atendimento, use PAUSAR no Início.', 'o Thiago não desliga (D13)');
select throws_ok($$ select public.salvar_agente('atendimento', '{"modo_contato":"por_tras"}') $$,
  'P0001', 'O Thiago é a voz do escritório: o modo dele não muda.', 'nem muda de modo');
select throws_ok($$ select public.salvar_agente('atendimento', '{"ferramentas":["responder"]}') $$,
  'P0001', 'As ferramentas do atendimento são fixas nesta etapa.', 'nem perde ferramenta');
select throws_ok($$ select public.salvar_agente('fiscal', '{"ferramentas":["apagar_tudo"]}') $$,
  'P0001', 'Ferramenta fora do catálogo.', 'ferramenta inventada não entra');
select throws_ok($$ select public.salvar_agente('atendimento', '{"modelo":"modelo-sem-preco"}') $$,
  'P0001', 'Modelo sem preço em Configurações › Teto e modelos de IA.', 'modelo sem preço não entra (D29)');
select lives_ok($$ select public.salvar_agente('atendimento', '{"modelo":"claude-haiku-4-5"}') $$, 'o modelo do Thiago o dono escolhe');
select throws_ok($$ select public.salvar_regra_assunto('atendimento', null, 'Nota', '', 'mesma_voz') $$,
  'P0001', 'O Thiago não tem regras por assunto: ele é quem recebe toda mensagem.', 'o Thiago não tem regras');
select lives_ok($$ select public.salvar_regra_assunto('fiscal', null, 'Dúvida sobre imposto', 'Por que o DAS veio mais alto?', 'passa_conversa') $$,
  'regra por assunto do Fiscal');
select is(public.criar_agente('{"slug":"irpf","nome":"Agente do IRPF","tipos":["conversa"]}'), 'irpf', 'o dono cria um agente (D25)');
select throws_ok($$ select public.criar_agente('{"slug":"irpf","nome":"Outro IRPF","tipos":["conversa"]}') $$,
  'P0001', 'Já existe um agente com este endereço: mude o nome.', 'endereço repetido não passa');
select bag_eq($$ select descricao from public.agente_mudancas where agente_id = (select id from public.agentes where slug = 'fiscal') $$,
  $$ values ('Fala com o cliente: a definir → Mesma voz'), ('Ferramentas: +consultar_chamados, +responder'), ('Contatos em teste: 1'),
            ('Estado: Desligado → Teste'), ('Nova regra "Dúvida sobre imposto": Passa a conversa') $$, 'cada mudança vira uma frase (D28)');
select throws_ok($$ update public.agentes set estado = 'ligado' where slug = 'fiscal' $$, '42501', null, 'direto na tabela, não');

-- 34–35: administrador que não é dono
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_agente('fiscal', '{"estado":"ligado"}') $$, 'P0001', 'Só o dono altera os agentes.', 'administrador não-dono não altera');
select is((select count(*)::int from public.agentes), 8, 'administrador vê os agentes');

-- 36–37: atendente sem "Treinar o agente"
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.agentes), 0, 'sem Treinar o agente, não vê os agentes');
select throws_ok($$ select public.criar_agente('{"slug":"teste-ze","nome":"Do Zé","tipos":["conversa"]}') $$, 'P0001', 'Só o dono altera os agentes.', 'nem cria');

-- 38–42: orientações pelo setor do agente (D12)
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.agentes), 8, 'com Treinar o agente, vê os agentes');
select lives_ok($$ select public.salvar_orientacao_agente('fiscal', null, 'Prazo', 'Notas até as 16h.', 'regra') $$, 'Ana (Fiscal) orienta o Fiscal');
select is((select a.slug from public.orientacoes_agente o join public.agentes a on a.id = o.agente_id where o.titulo = 'Prazo'), 'fiscal',
  'a orientação é do Fiscal');
select throws_ok($$ select public.salvar_orientacao_agente('pessoal', null, 'Folha', 'Folha até dia 20.', 'regra') $$,
  'P0001', 'Você não tem permissão para as orientações deste agente.', 'Ana não orienta o Pessoal');
select lives_ok($$ select public.salvar_orientacao(null, 'Cumprimento', 'Chame pelo nome.', 'jeito') $$, 'o Thiago, como hoje');

-- 43: Paula (Pessoal) não liga a orientação do Fiscal, nem pela função de hoje
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$ select public.alternar_orientacao((select id from public.orientacoes_agente where titulo = 'Prazo'), true) $$,
  'P0001', 'Você não tem permissão para as orientações deste agente.', 'ligar orientação de outro setor, não');
reset role;
select set_config('request.jwt.claims', '', true);

-- 44: o custo ganha o agente
select has_column('public', 'uso_ia', 'agente_id', 'uso_ia.agente_id existe');

-- 45–47: a chave de serviço também não escreve direto nas tabelas dos agentes nem chama os ajudantes
set local role service_role;
select throws_ok($$ update public.agentes set estado = 'ligado' where slug = 'fiscal' $$, '42501', null, 'service_role não muda agente direto');
select throws_ok($$ insert into public.agente_mudancas (agente_id, descricao) values ('a0000000-0000-4000-8000-000000000001', 'x') $$, '42501', null, 'service_role não escreve o histórico');
select throws_ok($$ select public.mudanca_agente('a0000000-0000-4000-8000-000000000001', 'x') $$, '42501', null, 'service_role não chama o ajudante do histórico');
reset role;

select * from finish();
rollback;
