-- supabase/tests/18_painel_v2_prazo.test.sql
-- Parte C (spec 6.5 e 6.6): prazo em dias úteis, pausa em "Com o cliente", eventos iniciais e última atualização.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- Expediente de 8h às 18h, de segunda a sexta, prazos padrão; 12/10/2026 (segunda) é feriado.
update public.configuracoes set horario_inicio = '08:00', horario_fim = '18:00', dias_uteis = '{1,2,3,4,5}',
  prazo_urgente_dias = 0, prazo_alta_dias = 1, prazo_normal_dias = 2, prazo_baixa_dias = 5 where id = 1;
insert into public.feriados (data, descricao) values ('2026-10-12', 'Nossa Senhora Aparecida') on conflict (data) do nothing;

-- 1-6: calcular_prazo (08/10/2026 é quinta).
select is(public.calcular_prazo('urgente', '2026-10-08 10:00-03'), '2026-10-08 18:00-03'::timestamptz, 'urgente: mesmo dia, no fim do expediente');
select is(public.calcular_prazo('urgente', '2026-10-08 19:00-03'), '2026-10-09 18:00-03'::timestamptz, 'urgente depois do expediente: fim do próximo dia útil');
select is(public.calcular_prazo('alta', '2026-10-09 10:00-03'), '2026-10-13 18:00-03'::timestamptz, 'alta na sexta: pula o fim de semana e o feriado');
select is(public.calcular_prazo('normal', '2026-10-08 10:00-03'), '2026-10-13 18:00-03'::timestamptz, 'normal: 2 dias úteis, sem contar o feriado');
select is(public.calcular_prazo('baixa', '2026-10-05 08:30-03'), '2026-10-13 18:00-03'::timestamptz, 'baixa: 5 dias úteis');
select is(public.calcular_prazo('alta', '2026-10-10 09:00-03'), '2026-10-14 18:00-03'::timestamptz, 'aberta no sábado: conta a partir do próximo dia útil');

-- 7: os prazos vêm de Configurações › Prazos.
update public.configuracoes set prazo_normal_dias = 3 where id = 1;
select is(public.calcular_prazo('normal', '2026-10-08 10:00-03'), '2026-10-14 18:00-03'::timestamptz, 'normal com 3 dias configurados');
update public.configuracoes set prazo_normal_dias = 2 where id = 1;

-- 8: sem nenhum dia útil, não há prazo (e abrir demanda continua funcionando).
update public.configuracoes set dias_uteis = '{}' where id = 1;
select is(public.calcular_prazo('normal', '2026-10-08 10:00-03'), null::timestamptz, 'sem dias úteis: prazo vazio, sem erro');
update public.configuracoes set dias_uteis = '{1,2,3,4,5}' where id = 1;

-- 9-12: tempo útil entre dois instantes e soma de tempo útil.
select is(public.tempo_util_entre('2026-10-09 17:00-03', '2026-10-13 09:30-03'), interval '2 hours 30 minutes',
  'sexta 17h até terça 9h30: 1h na sexta + 1h30 na terça (fim de semana e feriado não contam)');
select is(public.tempo_util_entre('2026-10-13 10:00-03', '2026-10-13 09:00-03'), interval '0', 'fim antes do início: zero');
select is(public.somar_tempo_util('2026-10-09 18:00-03', interval '2 hours 30 minutes'), '2026-10-13 10:30-03'::timestamptz,
  'somar a partir do fim do expediente continua no próximo dia útil');
select is(public.somar_tempo_util('2026-10-13 10:00-03', interval '3 hours'), '2026-10-13 13:00-03'::timestamptz, 'soma no mesmo dia');

-- Demanda do agente: empresa, contato e conversa.
insert into public.clientes (id, razao_social, cnpj) values ('18000000-0000-0000-0000-000000000001', 'Indústria 18', '18181818000118');
insert into public.contatos (id, nome, telefone) values ('18100000-0000-0000-0000-000000000001', 'Carla', '5531999991801');
insert into public.conversas (id, telefone, contato_id) values ('18200000-0000-0000-0000-000000000001', '5531999991801', '18100000-0000-0000-0000-000000000001');
insert into public.chamados (id, cliente_id, conversa_id, setor_id, titulo, resumo, prioridade, criado_em)
  select '18300000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000001', '18200000-0000-0000-0000-000000000001',
         id, 'Guia DAS', 'Pediu a guia de setembro', 'alta', '2026-10-08 10:00-03'
  from public.setores where nome = 'Fiscal';

-- 13-17: ao abrir, o banco calcula o prazo, pega o contato da conversa e grava os eventos iniciais.
select is((select prazo_em from public.chamados where id = '18300000-0000-0000-0000-000000000001'), '2026-10-09 18:00-03'::timestamptz,
  'prazo calculado pela prioridade e pela hora de abertura');
select is((select contato_id from public.chamados where id = '18300000-0000-0000-0000-000000000001'), '18100000-0000-0000-0000-000000000001'::uuid,
  'contato na empresa vem da conversa');
select results_eq(
  $$ select tipo from public.chamado_eventos where chamado_id = '18300000-0000-0000-0000-000000000001' order by criado_em $$,
  $$ values ('criacao'), ('prioridade_alterada'), ('prazo_alterado') $$,
  'abrir grava: abriu, prioridade, prazo (nessa ordem)');
select results_eq(
  $$ select usuario_id, texto from public.chamado_eventos where chamado_id = '18300000-0000-0000-0000-000000000001' and tipo = 'prazo_alterado' $$,
  $$ values (null::uuid, '2026-10-09T21:00:00Z') $$,
  'prazo sugerido aparece como Sistema, com o prazo em ISO');
insert into public.chamado_eventos (chamado_id, tipo, texto) values ('18300000-0000-0000-0000-000000000001', 'criacao', 'Pediu a guia de setembro');
select is((select count(*) from public.chamado_eventos where chamado_id = '18300000-0000-0000-0000-000000000001' and tipo = 'criacao'), 1::bigint,
  'a criação gravada de novo pelo trabalhador antigo é ignorada');

-- 18-23: "Com o cliente" pausa; ao sair, o prazo anda o tempo útil parado.
update public.chamados set status = 'aguardando_cliente' where id = '18300000-0000-0000-0000-000000000001';
select is((select prazo_pausado_desde from public.chamados where id = '18300000-0000-0000-0000-000000000001'), now(), 'entrar em Com o cliente pausa o prazo');
update public.chamados set prazo_pausado_desde = now() - interval '30 days', alertado_vencimento_em = now()
  where id = '18300000-0000-0000-0000-000000000001';
create temp table antes as select prazo_em, prazo_pausado_desde from public.chamados where id = '18300000-0000-0000-0000-000000000001';
update public.chamados set status = 'em_andamento' where id = '18300000-0000-0000-0000-000000000001';
select is((select prazo_em from public.chamados where id = '18300000-0000-0000-0000-000000000001'),
  (select public.somar_tempo_util(a.prazo_em, public.tempo_util_entre(a.prazo_pausado_desde, now())) from antes a),
  'ao sair da pausa, o prazo anda o tempo útil que ficou parado');
select ok((select c.prazo_em > a.prazo_em from public.chamados c, antes a where c.id = '18300000-0000-0000-0000-000000000001'), 'o prazo foi empurrado');
select is((select prazo_pausado_desde from public.chamados where id = '18300000-0000-0000-0000-000000000001'), null::timestamptz, 'a pausa acabou');
select is((select count(*) from public.chamado_eventos where chamado_id = '18300000-0000-0000-0000-000000000001' and tipo = 'prazo_alterado' and usuario_id is null),
  2::bigint, 'o prazo empurrado vira evento do Sistema');
select is((select alertado_vencimento_em from public.chamados where id = '18300000-0000-0000-0000-000000000001'), null::timestamptz,
  'prazo novo libera um alerta de vencimento novo');

-- 24-25: concluir uma demanda pausada não mexe no prazo.
insert into public.chamados (id, setor_id, titulo, status, criado_em)
  select '18300000-0000-0000-0000-000000000002', id, 'Balancete', 'aguardando_cliente', '2026-10-08 10:00-03' from public.setores where nome = 'Contábil';
update public.chamados set status = 'concluido', concluido_em = now() where id = '18300000-0000-0000-0000-000000000002';
select is((select prazo_em from public.chamados where id = '18300000-0000-0000-0000-000000000002'), '2026-10-13 18:00-03'::timestamptz,
  'concluir pausada: o prazo fica como estava');
select is((select prazo_pausado_desde from public.chamados where id = '18300000-0000-0000-0000-000000000002'), null::timestamptz, 'concluir pausada: a pausa acaba');

-- 26-28: última atualização (atualizado_em) só muda com o que a equipe vê.
update public.chamados set atualizado_em = '2026-01-01 00:00-03' where id = '18300000-0000-0000-0000-000000000001';
update public.chamados set alertado_fila_em = now() where id = '18300000-0000-0000-0000-000000000001';
select is((select atualizado_em from public.chamados where id = '18300000-0000-0000-0000-000000000001'), '2026-01-01 00:00-03'::timestamptz,
  'marca interna do alerta da fila não conta como atualização');
update public.chamados set titulo = 'Guia DAS de setembro' where id = '18300000-0000-0000-0000-000000000001';
select is((select atualizado_em from public.chamados where id = '18300000-0000-0000-0000-000000000001'), now(), 'mudar o título atualiza');
update public.chamados set atualizado_em = '2026-01-01 00:00-03' where id = '18300000-0000-0000-0000-000000000001';
insert into public.chamado_eventos (chamado_id, tipo, texto) values ('18300000-0000-0000-0000-000000000001', 'nota_interna', 'Cliente ligou');
select ok((select atualizado_em > '2026-01-02'::timestamptz from public.chamados where id = '18300000-0000-0000-0000-000000000001'),
  'evento novo (nota interna) atualiza');

select * from finish();
rollback;
