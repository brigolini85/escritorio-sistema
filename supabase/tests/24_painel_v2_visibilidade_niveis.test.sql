begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Todas do Fiscal, menos o admin e Cléo: Mia (Demandas: Só as minhas), Seto (padrão), Tod (Demandas: Todas),
-- Sem (Atendimento: Sem acesso), Tc (Atendimento: Todas), Nep (Prazos: Não), Cléo (Clientes: Ver e editar),
-- Ás (Assistente: Site), Wá (Assistente: Site e WhatsApp).
insert into auth.users (id, email) values
  ('d2400000-0000-0000-0000-00000000000a', 'a@visibilidade.local'), ('d2400000-0000-0000-0000-00000000000b', 'b@visibilidade.local'),
  ('d2400000-0000-0000-0000-00000000000c', 'c@visibilidade.local'), ('d2400000-0000-0000-0000-00000000000d', 'd@visibilidade.local'),
  ('d2400000-0000-0000-0000-00000000000e', 'e@visibilidade.local'), ('d2400000-0000-0000-0000-00000000000f', 'f@visibilidade.local'),
  ('d2400000-0000-0000-0000-000000000010', 'nep@visibilidade.local'), ('d2400000-0000-0000-0000-000000000011', 'cleo@visibilidade.local'),
  ('d2400000-0000-0000-0000-000000000012', 'as@visibilidade.local'), ('d2400000-0000-0000-0000-000000000013', 'wa@visibilidade.local');
insert into public.usuarios (id, nome, email, papel, telefone) values
  ('d2400000-0000-0000-0000-00000000000a', 'Admin V', 'a@visibilidade.local', 'admin', null),
  ('d2400000-0000-0000-0000-00000000000b', 'Mia V', 'b@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-00000000000c', 'Seto V', 'c@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-00000000000d', 'Tod V', 'd@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-00000000000e', 'Sem V', 'e@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-00000000000f', 'Tc V', 'f@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-000000000010', 'Nep V', 'nep@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-000000000011', 'Cléo V', 'cleo@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-000000000012', 'Ás V', 'as@visibilidade.local', 'atendente', '5531966660001'),
  ('d2400000-0000-0000-0000-000000000013', 'Wá V', 'wa@visibilidade.local', 'atendente', '5531966660002');
insert into public.usuario_setores (usuario_id, setor_id)
select u.id, s.id from public.usuarios u, public.setores s
where s.nome = 'Fiscal' and u.email like '%@visibilidade.local' and u.papel = 'atendente' and u.email <> 'cleo@visibilidade.local';
update public.usuario_permissoes up set nivel = v.nivel
from (values ('b@visibilidade.local', 'demandas', 'minhas'), ('d@visibilidade.local', 'demandas', 'todas'),
             ('e@visibilidade.local', 'atendimento', 'sem_acesso'), ('f@visibilidade.local', 'atendimento', 'todas'),
             ('nep@visibilidade.local', 'prazos', 'nao'), ('cleo@visibilidade.local', 'clientes', 'editar'),
             ('as@visibilidade.local', 'assistente', 'site'), ('wa@visibilidade.local', 'assistente', 'site_whatsapp')) v(email, modulo, nivel),
     public.usuarios u
where u.email = v.email and up.usuario_id = u.id and up.modulo = v.modulo;

insert into public.clientes (id, razao_social, cnpj) values ('d2410000-0000-0000-0000-000000000001', 'Visibilidade Ltda', '11222333000181');
insert into public.conversas (id, telefone) values
  ('d2420000-0000-0000-0000-000000000001', '5531955550001'), ('d2420000-0000-0000-0000-000000000002', '5531955550002'),
  ('d2420000-0000-0000-0000-000000000003', '5531955550003'), ('d2420000-0000-0000-0000-000000000004', '5531955550004'),
  ('d2420000-0000-0000-0000-000000000005', '5531955550005');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo)
select id, 'entrada', 'cliente', 'texto', 'V ' || telefone from public.conversas where telefone like '553195555000_';
insert into public.chamados (id, cliente_id, conversa_id, setor_id, responsavel_id, titulo) values
  ('d2430000-0000-0000-0000-000000000001', 'd2410000-0000-0000-0000-000000000001', 'd2420000-0000-0000-0000-000000000001',
   (select id from public.setores where nome = 'Fiscal'), null, 'V F1 Fiscal'),
  ('d2430000-0000-0000-0000-000000000002', 'd2410000-0000-0000-0000-000000000001', 'd2420000-0000-0000-0000-000000000002',
   (select id from public.setores where nome = 'Fiscal'), 'd2400000-0000-0000-0000-00000000000b', 'V F2 Fiscal da Mia'),
  ('d2430000-0000-0000-0000-000000000003', 'd2410000-0000-0000-0000-000000000001', 'd2420000-0000-0000-0000-000000000003',
   (select id from public.setores where nome = 'Pessoal'), null, 'V P1 Pessoal'),
  ('d2430000-0000-0000-0000-000000000004', 'd2410000-0000-0000-0000-000000000001', 'd2420000-0000-0000-0000-000000000004',
   null, null, 'V T1 Triagem');
-- WhatsApp da Wá com o assistente (com o 9 e sem o 9): conversa interna, fora do Atendimento.
insert into public.conversas (id, telefone) values
  ('d2420000-0000-0000-0000-000000000006', '5531966660002'), ('d2420000-0000-0000-0000-000000000007', '553166660002');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo)
select id, 'entrada', 'cliente', 'texto', 'VA ' || telefone from public.conversas where telefone in ('5531966660002', '553166660002');
insert into public.alertas (id, nivel, setor_id, mensagem) values
  ('d2440000-0000-0000-0000-000000000001', 'operacional', (select id from public.setores where nome = 'Fiscal'), 'V alerta do setor');
insert into public.chamado_eventos (chamado_id, cliente_id, tipo, texto)
  values ('d2430000-0000-0000-0000-000000000001', 'd2410000-0000-0000-0000-000000000001', 'nota_interna', 'V nota F1');
select set_config('teste.prazo_f1', coalesce((select prazo_em::text from public.chamados where id = 'd2430000-0000-0000-0000-000000000001'), ''), true);

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'V %' order by titulo), array['V F2 Fiscal da Mia'], 'Só as minhas: só a dela');
select is(array(select titulo from public.demandas_lista where titulo like 'V %' order by titulo), array['V F2 Fiscal da Mia'], 'Só as minhas: lista igual');
select is(array(select telefone from public.conversas where telefone like '553195555000_' order by telefone),
  array['5531955550001', '5531955550002'], 'o Atendimento não depende do nível de Demandas');
select throws_ok($$ select public.assumir_demanda('d2430000-0000-0000-0000-000000000001') $$,
  'P0001', 'Você não tem acesso a esta demanda.', 'Só as minhas: não assume a do setor');
select throws_ok($$ select public.nota_interna('d2430000-0000-0000-0000-000000000001', 'V nota da Mia') $$,
  'P0001', 'sem acesso a este chamado', 'Só as minhas: não escreve nota na do setor');
select throws_ok($$ select public.concluir_chamado('d2430000-0000-0000-0000-000000000001') $$,
  'P0001', 'sem acesso a este chamado', 'Só as minhas: não conclui a do setor');
select is((select count(*)::int from public.chamado_eventos where chamado_id = 'd2430000-0000-0000-0000-000000000001'), 0,
  'Só as minhas: não lê o histórico da do setor');
select is(array(select mensagem from public.alertas where mensagem like 'V %'), '{}'::text[], 'Só as minhas: não recebe o alerta do setor');
select lives_ok($$ select public.marcar_alerta_lido('d2440000-0000-0000-0000-000000000001') $$, 'Só as minhas: marcar o do setor não faz nada');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'V %' order by titulo),
  array['V F1 Fiscal', 'V F2 Fiscal da Mia'], 'Do meu setor: o de hoje');
select is(array(select mensagem from public.alertas where mensagem like 'V %' and lido_em is null), array['V alerta do setor'],
  'Do meu setor: recebe o alerta do setor (e a Mia não o marcou como lido)');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'V %' order by titulo),
  array['V F1 Fiscal', 'V F2 Fiscal da Mia', 'V P1 Pessoal', 'V T1 Triagem'], 'Todas: inclusive outro setor e Triagem');
select is(array(select telefone from public.conversas where telefone like '553195555000_' order by telefone),
  array['5531955550001', '5531955550002'], 'Demandas Todas não abre as conversas dos outros setores');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is(array(select telefone from public.conversas where telefone like '553195555000_' order by telefone), '{}'::text[], 'Atendimento Sem acesso: nenhuma conversa');
select is(array(select conteudo from public.mensagens where conteudo like 'V 553195555000_' order by conteudo), '{}'::text[], 'Sem acesso: nenhuma mensagem (nem pelo Realtime)');
select is(array(select titulo from public.chamados where titulo like 'V %' order by titulo),
  array['V F1 Fiscal', 'V F2 Fiscal da Mia'], 'Sem acesso ao Atendimento continua vendo as demandas do setor');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select is(array(select telefone from public.conversas where telefone like '553195555000_' order by telefone),
  array['5531955550001', '5531955550002', '5531955550003', '5531955550004', '5531955550005'], 'Todas as conversas: inclusive sem demanda');
select is((select count(*)::int from public.mensagens where conteudo like 'V 553195555000_'), 5, 'Todas as conversas: todas as mensagens (Realtime também)');
select throws_ok($$ select public.pode_ver_chamado_de('d2400000-0000-0000-0000-00000000000b', 'd2430000-0000-0000-0000-000000000001') $$,
  '42501', null, 'a equipe não consulta a visibilidade de outra pessoa');
select is(array(select telefone from public.conversas where telefone in ('5531966660002', '553166660002')), '{}'::text[],
  'Todas as conversas: o WhatsApp de colega com o assistente fica fora (com e sem o 9)');
select is((select count(*)::int from public.mensagens where conteudo like 'VA %'), 0, 'Todas as conversas: nenhuma mensagem do assistente');
select throws_ok($$ select public.registrar_resposta('d2420000-0000-0000-0000-000000000006', 'V resposta', null, null, null) $$,
  'P0001', 'sem acesso a esta conversa', 'Todas as conversas: não responde na conversa do assistente');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-000000000011","role":"authenticated"}', true);
select throws_ok($$ select public.uso_do_cadastro('cliente', 'd2410000-0000-0000-0000-000000000001') $$, 'P0001', 'Sem permissão para arquivar cadastros.', 'Ver e editar não arquiva');
select lives_ok($$ insert into public.clientes (razao_social, cnpj) values ('V Nova', '99888777000166') $$, 'Ver e editar cadastra');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-000000000012","role":"authenticated"}', true);
select lives_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
                   values ('d2400000-0000-0000-0000-000000000012', 'site', 'usuario', 'V pergunta') $$, 'Assistente Site pergunta pelo painel');
select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
                    values ('d2400000-0000-0000-0000-00000000000a', 'site', 'usuario', 'V pergunta') $$, '42501', null,
  'administrador sem a marcação do assistente não pergunta (como hoje)');
select is(array(select telefone from public.conversas where telefone in ('5531966660002', '553166660002') order by telefone),
  array['553166660002', '5531966660002'], 'administrador continua vendo todas (como hoje)');
select ok(public.eh_telefone_do_assistente('5531966660002'), 'Site e WhatsApp: o telefone é do assistente');
select ok(not public.eh_telefone_do_assistente('5531966660001'), 'só Site: o telefone não é do assistente');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.criar_demanda(p_cliente => 'd2410000-0000-0000-0000-000000000001',
                    p_setor => (select id from public.setores where nome = 'Fiscal'), p_titulo => 'V Nova da Mia', p_descricao => '') $$,
  'Só as minhas: cria a demanda');
select is((select responsavel_id from public.chamados where titulo = 'V Nova da Mia'), 'd2400000-0000-0000-0000-00000000000b'::uuid,
  'Só as minhas: quem cria fica responsável (P9)');
select throws_ok($$ select public.criar_demanda(p_cliente => 'd2410000-0000-0000-0000-000000000001',
                     p_setor => (select id from public.setores where nome = 'Fiscal'), p_titulo => 'V Nova para o Seto', p_descricao => '',
                     p_responsavel => 'd2400000-0000-0000-0000-00000000000c') $$,
  'P0001', 'Com "Só as minhas", a demanda que você cria fica com você.', 'Só as minhas: não cria para outra pessoa');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-000000000010","role":"authenticated"}', true);
select throws_ok($$ select public.definir_prioridade_prazo('d2430000-0000-0000-0000-000000000001', null, now() + interval '3 days') $$,
  'P0001', 'Você não tem permissão para alterar prazos.', 'Prazos Não: não escolhe o prazo');
select lives_ok($$ select public.definir_prioridade_prazo('d2430000-0000-0000-0000-000000000001', 'alta') $$,
  'Prazos Não: muda a prioridade (o prazo é recalculado)');
select isnt((select coalesce(prazo_em::text, '') from public.chamados where id = 'd2430000-0000-0000-0000-000000000001'),
  current_setting('teste.prazo_f1'), 'Prazos Não: o prazo mudou com a prioridade');
-- O da abertura (sistema) e o recalculado agora: os dois sem pessoa.
select is((select count(*)::text || '/' || count(usuario_id)::text from public.chamado_eventos
           where chamado_id = 'd2430000-0000-0000-0000-000000000001' and tipo = 'prazo_alterado'), '2/0',
  'Prazos Não: o prazo recalculado é do sistema (sem pessoa)');
select throws_ok($$ select public.criar_demanda(p_cliente => 'd2410000-0000-0000-0000-000000000001',
                     p_setor => (select id from public.setores where nome = 'Fiscal'), p_titulo => 'V Nova do Nep', p_descricao => '',
                     p_prazo => now() + interval '3 days') $$,
  'P0001', 'Você não tem permissão para alterar prazos.', 'Prazos Não: Nova demanda sem prazo escolhido à mão');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$ select public.definir_prioridade_prazo('d2430000-0000-0000-0000-000000000002', null, now() + interval '3 days') $$,
  'Prazos Sim (padrão): escolhe o prazo');

select * from finish();
rollback;
