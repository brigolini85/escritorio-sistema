-- Parte I4, Task 3 (spec 7E.5; D4–D7, D13, D15): pedir ao agente pelo painel e pelo trabalhador (a mesma função).
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

insert into auth.users (id, email) values
  ('fc000000-0000-0000-0000-00000000000a', 'claudia@i4.local'), ('fc000000-0000-0000-0000-00000000000b', 'paula@i4.local'),
  ('fc000000-0000-0000-0000-00000000000c', 'dono@i4.local'), ('fc000000-0000-0000-0000-00000000000d', 'inativa@i4.local');
insert into public.usuarios (id, nome, email, papel, telefone, ativo) values
  ('fc000000-0000-0000-0000-00000000000a', 'I4 Cláudia', 'claudia@i4.local', 'atendente', '5531911110001', true),
  ('fc000000-0000-0000-0000-00000000000b', 'I4 Paula', 'paula@i4.local', 'atendente', null, true),
  ('fc000000-0000-0000-0000-00000000000c', 'I4 Dono', 'dono@i4.local', 'admin', '5531911110003', true),
  ('fc000000-0000-0000-0000-00000000000d', 'I4 Inativa', 'inativa@i4.local', 'atendente', null, false);
update public.usuarios set dono = false where dono;
update public.usuarios set dono = true where id = 'fc000000-0000-0000-0000-00000000000c';
insert into public.usuario_setores (usuario_id, setor_id) values
  ('fc000000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil')),
  ('fc000000-0000-0000-0000-00000000000b', (select id from public.setores where nome = 'Pessoal')),
  ('fc000000-0000-0000-0000-00000000000b', (select id from public.setores where nome = 'Legalização')),
  ('fc000000-0000-0000-0000-00000000000d', (select id from public.setores where nome = 'Contábil'));
update public.usuario_permissoes set nivel = 'site_whatsapp' where modulo = 'assistente' and usuario_id = 'fc000000-0000-0000-0000-00000000000a';
update public.usuario_permissoes set nivel = 'sem_acesso' where modulo = 'notas' and usuario_id = 'fc000000-0000-0000-0000-00000000000a';
-- F8: o Assistente do painel exige o nível "site" (o dono não tem passe livre no Assistente, P3).
update public.usuario_permissoes set nivel = 'site' where modulo = 'assistente' and usuario_id = 'fc000000-0000-0000-0000-00000000000c';
update public.agentes set estado = 'ligado', tipos = '{trabalho}' where slug in ('contabil', 'pessoal');
update public.agentes set estado = 'ligado', tipos = '{conversa,trabalho}' where slug = 'fiscal';
update public.agentes set estado = 'teste', tipos = '{trabalho}' where slug = 'legalizacao';
insert into public.clientes (id, razao_social, cnpj) values ('fc100000-0000-0000-0000-00000000000a', 'I4 Padaria Sol', '21448390000107');
insert into public.chamados (id, cliente_id, setor_id, titulo, pedido_venda) values
  ('fc200000-0000-0000-0000-00000000000a', 'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechamento de outubro', null),
  ('fc200000-0000-0000-0000-00000000000b', 'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Fiscal'), 'Notas de setembro', null),
  ('fc200000-0000-0000-0000-00000000000c', 'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Com tarefa', null),
  ('fc200000-0000-0000-0000-00000000000d', 'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'NF de venda', '{}'::jsonb);
insert into public.agente_tarefas (agente_id, chamado_id, cliente_id, setor_id, pedido, limite_usd, limite_minutos) values
  ((select id from public.agentes where slug = 'contabil'), 'fc200000-0000-0000-0000-00000000000c', 'fc100000-0000-0000-0000-00000000000a',
   (select id from public.setores where nome = 'Contábil'), 'Tarefa ativa', 2, 20);
-- D13: três tarefas decididas do Contábil com custo (0,20 / 0,50 / 0,90): quartis 0,35 e 0,70.
insert into public.agente_tarefas (agente_id, chamado_id, cliente_id, setor_id, pedido, limite_usd, limite_minutos, estado, decidida_em, custo_usd)
select (select id from public.agentes where slug = 'contabil'), 'fc200000-0000-0000-0000-00000000000d', 'fc100000-0000-0000-0000-00000000000a',
       (select id from public.setores where nome = 'Contábil'), 'Antiga', 2, 20, 'aprovada', now(), c
  from unnest(array[0.20, 0.50, 0.90]) c;

-- 1–3: as colunas novas
select has_column('public', 'agente_tarefas', 'prazo_desejado', 'agente_tarefas.prazo_desejado');
select has_column('public', 'agente_tarefas', 'avisar_whatsapp', 'agente_tarefas.avisar_whatsapp');
select has_column('public', 'agente_tarefas', 'drive_subpasta', 'agente_tarefas.drive_subpasta');

-- A RLS de agentes esconde o agente da pessoa do setor: os ids vão guardados antes (como o teste 51).
select set_config('teste.contabil', (select id::text from public.agentes where slug = 'contabil'), true),
       set_config('teste.fiscal', (select id::text from public.agentes where slug = 'fiscal'), true),
       set_config('teste.pessoal', (select id::text from public.agentes where slug = 'pessoal'), true),
       set_config('teste.legalizacao', (select id::text from public.agentes where slug = 'legalizacao'), true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
-- 4–7: Cláudia (Contábil) vê só o Agente Contábil; destino conforme a demanda (D6); pedido de nota sem "ver" some
select is((select array_agg(slug order by slug) from public.agentes_para_pedir(null)), '{contabil}'::text[], 'só os agentes do setor dela');
select is((select destino from public.agentes_para_pedir('fc200000-0000-0000-0000-00000000000a') where slug = 'contabil'), 'esta_demanda', 'mesma demanda');
select is((select destino from public.agentes_para_pedir('fc200000-0000-0000-0000-00000000000c') where slug = 'contabil'), 'nova', 'com tarefa ativa: demanda nova');
select is((select count(*)::int from public.agentes_para_pedir('fc200000-0000-0000-0000-00000000000d')), 0, 'pedido de nota sem "ver": nenhum');
-- 8–12: pede na própria demanda, com prazo, avisos e subpasta
select is((public.pedir_ao_agente(current_setting('teste.contabil')::uuid, 'Fazer o fechamento de outubro',
  'fc200000-0000-0000-0000-00000000000a', null, null, now() + interval '1 day', true, true, true, 'Contabil/2026-10') ->> 'demanda_nova'), 'false', 'nesta demanda');
select is((select canal || ':' || avisar_whatsapp || ':' || drive_subpasta || ':' || (prazo_desejado is not null)
             from public.agente_tarefas where chamado_id = 'fc200000-0000-0000-0000-00000000000a'),
  'painel:true:Contabil/2026-10:true', 'canal, WhatsApp liberado, subpasta e prazo gravados');
select is((select e.texto from public.agente_tarefa_eventos e join public.agente_tarefas t on t.id = e.tarefa_id
            where t.chamado_id = 'fc200000-0000-0000-0000-00000000000a'), 'pediu a tarefa pelo painel', 'evento da criação');
select is((public.pedir_ao_agente(current_setting('teste.contabil')::uuid, 'Conferir os extratos',
  'fc200000-0000-0000-0000-00000000000a') ->> 'demanda_nova'), 'true', 'a demanda já tem tarefa ativa: demanda nova (D6)');
select ok(exists (select 1 from public.chamado_eventos where chamado_id = 'fc200000-0000-0000-0000-00000000000a' and tipo = 'nota_interna'
                  and texto like 'Pedido ao % na demanda nova #%'), 'nota interna na demanda de onde saiu');
-- 13–19: recusas
select throws_ok($$ select public.pedir_ao_agente(current_setting('teste.fiscal')::uuid, 'Conferir notas', 'fc200000-0000-0000-0000-00000000000a') $$,
  'P0001', 'Você só pede aos agentes dos seus setores.', 'agente de outro setor (forjado): recusa');
select throws_ok($$ select public.pedir_ao_agente(current_setting('teste.contabil')::uuid, 'Fechar o mês') $$,
  'P0001', 'Escolha a empresa.', 'sem demanda e sem empresa');
select throws_ok($$ select public.pedir_ao_agente(current_setting('teste.contabil')::uuid, 'Fechar o mês', null,
  'fc100000-0000-0000-0000-00000000000a', null, now() - interval '1 hour') $$, 'P0001', 'O prazo desejado precisa ser depois de agora e em até 90 dias.', 'prazo no passado');
select throws_ok($$ select public.pedir_ao_agente(current_setting('teste.contabil')::uuid, 'ab', null, 'fc100000-0000-0000-0000-00000000000a') $$,
  'P0001', 'Escreva o que você quer (de 3 a 2.000 letras).', 'pedido curto');
select throws_ok($$ select public.pedir_ao_agente(current_setting('teste.contabil')::uuid, 'Fechar o mês', null,
  'fc100000-0000-0000-0000-00000000000a', null, null, true, false, true, '../outra') $$, 'P0001', 'Subpasta inválida: use nomes separados por /, até 3 níveis.', 'subpasta com ..');
select throws_ok($$ select public.pedir_ao_agente(current_setting('teste.contabil')::uuid, 'Fechar o mês', 'fc200000-0000-0000-0000-00000000000d') $$,
  'P0001', 'Só quem vê os pedidos de nota pede tarefa nesta demanda.', 'demanda de pedido de nota');
select is(public.meu_whatsapp_para_avisos(), null, 'Cláudia pode receber avisos no WhatsApp');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
-- 20–22: Paula (Pessoal, Legalização): sem telefone; Legalização em Teste; WhatsApp pedido mas não liberado vira false
select is(public.meu_whatsapp_para_avisos(), 'Cadastre seu WhatsApp em Usuários para receber avisos.', 'Paula sem telefone');
select throws_ok($$ select public.pedir_ao_agente(current_setting('teste.legalizacao')::uuid, 'Abrir a filial', null, 'fc100000-0000-0000-0000-00000000000a') $$,
  'P0001', 'O agente está em teste: só o dono e o administrador pedem tarefas.', 'agente em Teste');
-- A linha criada pela função não aparece na mesma consulta (foto do começo do comando): o id vai guardado antes.
select set_config('teste.t22', public.pedir_ao_agente(current_setting('teste.pessoal')::uuid, 'Folha de outubro', null,
                    'fc100000-0000-0000-0000-00000000000a', null, null, true, true) ->> 'tarefa_id', true);
select is((select avisar_whatsapp from public.agente_tarefas where id = current_setting('teste.t22')::uuid), false, 'WhatsApp sem telefone fica desligado');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
-- 23–25: o dono vê todos (D15) e pede ao Fiscal a partir da demanda do Contábil
select is((select count(*)::int from public.agentes_para_pedir(null) where slug in ('contabil', 'fiscal', 'pessoal', 'legalizacao')), 4, 'o dono vê todos, também em Teste');
select set_config('teste.c24', public.pedir_ao_agente(current_setting('teste.fiscal')::uuid, 'Conferir as notas de setembro',
                    'fc200000-0000-0000-0000-00000000000a') ->> 'chamado_id', true);
select is((select s.nome from public.chamados c join public.setores s on s.id = c.setor_id where c.id = current_setting('teste.c24')::uuid),
  'Fiscal', 'demanda nova no setor do agente');
select throws_ok($$ select public.pedir_ao_agente_de('fc000000-0000-0000-0000-00000000000a', 'whatsapp', current_setting('teste.contabil')::uuid, 'x') $$,
  '42501', null, 'pessoa não chama a função do trabalhador');

reset role;
select set_config('request.jwt.claims', '', true);
set local role service_role;
-- 26–32: o trabalhador (WhatsApp e Assistente)
select set_config('teste.t26', public.pedir_ao_agente_de('fc000000-0000-0000-0000-00000000000a', 'whatsapp', current_setting('teste.contabil')::uuid,
                    'Conferir os extratos de outubro', 'fc100000-0000-0000-0000-00000000000a') ->> 'tarefa_id', true);
select is((select canal || ':' || avisar_whatsapp from public.agente_tarefas where id = current_setting('teste.t26')::uuid), 'whatsapp:true', 'pelo WhatsApp: canal e aviso');
select ok(exists (select 1 from public.agente_tarefa_eventos where texto = 'pediu a tarefa pelo WhatsApp (Assistente)'), 'evento do WhatsApp');
select throws_ok(format($$ select public.pedir_ao_agente_de('fc000000-0000-0000-0000-00000000000a', 'whatsapp', current_setting('teste.contabil')::uuid,
  'Refazer', null, %s) $$, (select numero from public.chamados where id = 'fc200000-0000-0000-0000-00000000000c')),
  'P0001', 'Esta demanda já tem uma tarefa do agente em andamento.', 'número de demanda com tarefa ativa: recusa (D6)');
select throws_ok(format($$ select public.pedir_ao_agente_de('fc000000-0000-0000-0000-00000000000c', 'assistente', current_setting('teste.contabil')::uuid,
  'Fechar', null, %s) $$, (select numero from public.chamados where id = 'fc200000-0000-0000-0000-00000000000b')),
  'P0001', format('A demanda #%s é de outro setor. Peça sem o número para abrir uma demanda nova no Contábil.',
                  (select numero from public.chamados where id = 'fc200000-0000-0000-0000-00000000000b')), 'número de outro setor: diz por quê');
select throws_ok($$ select public.pedir_ao_agente_de('fc000000-0000-0000-0000-00000000000d', 'whatsapp', current_setting('teste.contabil')::uuid,
  'Fechar', 'fc100000-0000-0000-0000-00000000000a') $$, 'P0001', 'Acesso desativado.', 'pessoa inativa');
select is((select custo_min::text || '–' || custo_max::text from public.agentes_para_pedir_de('fc000000-0000-0000-0000-00000000000a') where slug = 'contabil'),
  '0.35–0.70', 'custo estimado pelos quartis (D13)');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'agente_tarefas'), 0, 'fora do Realtime');
-- 33–34 (F8): o banco confere o nível do Assistente de cada origem
select throws_ok($$ select public.pedir_ao_agente_de('fc000000-0000-0000-0000-00000000000c', 'whatsapp', current_setting('teste.contabil')::uuid,
  'Fechar o mês', 'fc100000-0000-0000-0000-00000000000a') $$, 'P0001', 'Acesso desativado.', 'WhatsApp exige "Assistente: site e WhatsApp"');
select throws_ok($$ select public.pedir_ao_agente_de('fc000000-0000-0000-0000-00000000000b', 'assistente', current_setting('teste.pessoal')::uuid,
  'Folha de novembro', 'fc100000-0000-0000-0000-00000000000a') $$, 'P0001', 'Acesso desativado.', 'Assistente do painel exige o nível "site"');
-- 35–38 (revisão final, Important 1): a mesma chave (a mensagem que o Assistente está respondendo) devolve a tarefa já criada,
-- então a nova tentativa do job não cria outra tarefa nem outra demanda.
select set_config('teste.n_chamados', (select count(*)::text from public.chamados), true);
select set_config('teste.t35', public.pedir_ao_agente_de('fc000000-0000-0000-0000-00000000000a', 'whatsapp', current_setting('teste.contabil')::uuid,
                    'Fechar novembro', 'fc100000-0000-0000-0000-00000000000a', null, null, 'msg-35:contabil') ->> 'tarefa_id', true);
select is(public.pedir_ao_agente_de('fc000000-0000-0000-0000-00000000000a', 'whatsapp', current_setting('teste.contabil')::uuid,
            'Fechar novembro', 'fc100000-0000-0000-0000-00000000000a', null, null, 'msg-35:contabil'),
          (select jsonb_build_object('tarefa_id', t.id, 'tarefa_numero', t.numero, 'chamado_id', t.chamado_id, 'chamado_numero', c.numero,
                                     'demanda_nova', false, 'ja_criada', true)
             from public.agente_tarefas t join public.chamados c on c.id = t.chamado_id where t.id = current_setting('teste.t35')::uuid),
          'mesma chave: a mesma tarefa, marcada como já criada');
select is((select count(*)::int from public.chamados), current_setting('teste.n_chamados')::int + 1, 'mesma chave: uma demanda nova só');
select is((select count(*)::int from public.agente_tarefas where pedido = 'Fechar novembro'), 1, 'mesma chave: uma tarefa só');
select isnt(public.pedir_ao_agente_de('fc000000-0000-0000-0000-00000000000a', 'whatsapp', current_setting('teste.contabil')::uuid,
              'Fechar novembro', 'fc100000-0000-0000-0000-00000000000a', null, null, 'msg-36:contabil') ->> 'tarefa_id',
            current_setting('teste.t35'), 'chave de outra mensagem: tarefa nova');

select * from finish();
rollback;
