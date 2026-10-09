begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('d2700000-0000-0000-0000-00000000000a', 'admin@config.local'), ('d2700000-0000-0000-0000-00000000000b', 'conf@config.local'),
  ('d2700000-0000-0000-0000-00000000000c', 'sem@config.local'), ('d2700000-0000-0000-0000-00000000000d', 'noite@config.local');
insert into public.usuarios (id, nome, email, papel) values
  ('d2700000-0000-0000-0000-00000000000a', 'Admin C', 'admin@config.local', 'admin'),
  ('d2700000-0000-0000-0000-00000000000b', 'Conf C', 'conf@config.local', 'atendente'),
  ('d2700000-0000-0000-0000-00000000000c', 'Sem C', 'sem@config.local', 'atendente'),
  ('d2700000-0000-0000-0000-00000000000d', 'Noite C', 'noite@config.local', 'atendente');
update public.usuario_permissoes set nivel = 'sim'
where modulo = 'configuracoes' and usuario_id in ('d2700000-0000-0000-0000-00000000000b', 'd2700000-0000-0000-0000-00000000000d');
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'd2700000-0000-0000-0000-00000000000d';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2700000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.configuracoes), 1, 'Configurações Sim: lê');
-- Auditoria 6.7: o aviso do login passou a ser só do administrador (antes "Configurações: Sim" mudava).
select throws_ok($$ update public.configuracoes set aviso_login = 'Recado C' where id = 1 $$,
  'P0001', 'Só o administrador muda as mensagens automáticas, o aviso do login e os dados de pagamento.',
  'Configurações Sim: não muda o aviso do login');
select throws_ok($$ update public.configuracoes set teto_ia_usd = 999 where id = 1 $$,
  'P0001', 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'não muda o teto (P12)');
select throws_ok($$ update public.configuracoes set agente_pausado = true where id = 1 $$,
  'P0001', 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'não pausa o agente');
select lives_ok($$ insert into public.feriados (data, descricao) values ('2026-12-24', 'Véspera C') $$, 'cadastra feriado');
select lives_ok($$ insert into public.setores (nome) values ('Setor C') $$, 'cadastra setor');

select set_config('request.jwt.claims', '{"sub":"d2700000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.configuracoes), 0, 'Sem acesso: não lê (como hoje)');
select throws_ok($$ insert into public.feriados (data, descricao) values ('2026-12-31', 'Fim C') $$, '42501', null, 'Sem acesso: não cadastra feriado');

select set_config('request.jwt.claims', '{"sub":"d2700000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ update public.configuracoes set teto_ia_usd = 999 where id = 1 $$, 'administrador muda o teto');

select set_config('request.jwt.claims', '{"sub":"d2700000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$ update public.configuracoes set aviso_login = 'Fora do horário C' where id = 1 $$, 'fora do horário a alteração não acha a linha');
reset role;
-- Auditoria 6.7: o "Recado C" de cima não grava mais; a afirmação fica só no que importa aqui.
select isnt((select aviso_login from public.configuracoes where id = 1), 'Fora do horário C', 'fora do horário nada mudou');

select * from finish();
rollback;
