-- supabase/tests/20_painel_v2_alerta_vencimento.test.sql
-- Parte C (spec 6.5): o alerta de vencimento vai para o responsável; sem responsável, para o setor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000020a1', 'ana20@pgtap.local'),
  ('00000000-0000-0000-0000-0000000020a2', 'bia20@pgtap.local'),
  ('00000000-0000-0000-0000-0000000020a3', 'dora20@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values
  ('00000000-0000-0000-0000-0000000020a1', 'Ana', 'ana20@pgtap.local', 'atendente'),
  ('00000000-0000-0000-0000-0000000020a2', 'Bia', 'bia20@pgtap.local', 'atendente'),
  ('00000000-0000-0000-0000-0000000020a3', 'Dora', 'dora20@pgtap.local', 'admin');
insert into public.usuario_setores (usuario_id, setor_id)
  select u, s.id from (values ('00000000-0000-0000-0000-0000000020a1'::uuid), ('00000000-0000-0000-0000-0000000020a2'::uuid)) v(u),
    public.setores s where s.nome = 'Fiscal';
insert into public.alertas (id, nivel, mensagem, setor_id, usuario_id) values
  ('20000000-0000-0000-0000-000000000001', 'aviso', 'Demanda #1 "Guia DAS" venceu o prazo.', null, '00000000-0000-0000-0000-0000000020a1');
insert into public.alertas (id, nivel, mensagem, setor_id)
  select '20000000-0000-0000-0000-000000000002', 'aviso', 'Demanda #2 "Certidão" venceu o prazo.', id from public.setores where nome = 'Fiscal';

-- Demanda para as asserções da visão e do prazo (criada como dono do banco, antes de trocar de papel).
insert into public.chamados (id, setor_id, titulo, responsavel_id, prioridade, prazo_em)
  select '20000000-0000-0000-0000-0000000000c1', id, 'Venceu ontem', '00000000-0000-0000-0000-0000000020a1', 'normal', now() - interval '1 day'
  from public.setores where nome = 'Fiscal';
insert into public.chamados (id, setor_id, titulo, responsavel_id, prioridade, prazo_em)
  select '20000000-0000-0000-0000-0000000000c2', id, 'Sem prazo', '00000000-0000-0000-0000-0000000020a1', 'normal', null
  from public.setores where nome = 'Fiscal';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a1","role":"authenticated"}', true);
select is((select count(*) from public.alertas where id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')),
  2::bigint, 'Ana vê o alerta dela e o do setor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a2","role":"authenticated"}', true);
select results_eq($$ select id from public.alertas where id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002') $$,
  $$ values ('20000000-0000-0000-0000-000000000002'::uuid) $$, 'Bia, do mesmo setor, não vê o alerta que é só da Ana');
select public.marcar_alerta_lido('20000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a3","role":"authenticated"}', true);
select is((select count(*) from public.alertas where id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')),
  2::bigint, 'o administrador vê os dois');
select is((select lido_em from public.alertas where id = '20000000-0000-0000-0000-000000000001'), null::timestamptz, 'Bia não marca como lido o alerta da Ana');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a1","role":"authenticated"}', true);
select public.marcar_alerta_lido('20000000-0000-0000-0000-000000000001');
select isnt((select lido_em from public.alertas where id = '20000000-0000-0000-0000-000000000001'), null::timestamptz, 'Ana marca o dela como lido');

-- Sobras da Task 2: vencida nunca é nula; prazo existente não some quando o cálculo devolve nulo.
select is((select vencida from public.demandas_lista where id = '20000000-0000-0000-0000-0000000000c2'), false,
  'demanda sem prazo: vencida é false, não nulo');

select public.definir_prioridade_prazo('20000000-0000-0000-0000-0000000000c1', 'urgente', null);
select isnt((select prazo_em from public.chamados where id = '20000000-0000-0000-0000-0000000000c1'), null::timestamptz,
  'mudar a prioridade não apaga o prazo existente');

reset role;
-- Sem nenhum dia útil, calcular_prazo devolve nulo: o prazo antigo fica e não há evento prazo_alterado.
update public.configuracoes set dias_uteis = '{}' where true;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a1","role":"authenticated"}', true);
select set_config('t.antes', (select count(*) from public.chamado_eventos where chamado_id = '20000000-0000-0000-0000-0000000000c1' and tipo = 'prazo_alterado')::text, true);
select set_config('t.prazo', (select prazo_em from public.chamados where id = '20000000-0000-0000-0000-0000000000c1')::text, true);
select public.definir_prioridade_prazo('20000000-0000-0000-0000-0000000000c1', 'baixa', null);
select is((select prazo_em::text from public.chamados where id = '20000000-0000-0000-0000-0000000000c1'), current_setting('t.prazo'), 'sem prazo calculável, o prazo antigo fica');
select is((select count(*)::text from public.chamado_eventos where chamado_id = '20000000-0000-0000-0000-0000000000c1' and tipo = 'prazo_alterado'), current_setting('t.antes'), 'sem prazo calculável, nenhum evento prazo_alterado novo');

reset role;
select is((select has_table_privilege('anon', 'public.demandas_lista', 'select')), false, 'anon não lê demandas_lista');

select * from finish();
rollback;
