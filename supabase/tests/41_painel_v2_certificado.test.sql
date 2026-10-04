-- Parte H1, Task 3 (spec 7D.1 item 7): o aviso do certificado vira uma demanda no Fiscal, para o responsável do Fiscal,
-- uma por empresa e vencimento; nunca para empresa arquivada nem "Sem certificado"; só o trabalhador dispara (D21).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('ea100000-0000-0000-0000-00000000000a', 'admin@h1c.local'),
  ('ea100000-0000-0000-0000-00000000000b', 'fe@h1c.local'),
  ('ea100000-0000-0000-0000-00000000000c', 'velho@h1c.local');
insert into public.usuarios (id, nome, email, papel) values
  ('ea100000-0000-0000-0000-00000000000a', 'Admin H1C', 'admin@h1c.local', 'admin'),
  ('ea100000-0000-0000-0000-00000000000b', 'Fê H1C', 'fe@h1c.local', 'atendente'),
  ('ea100000-0000-0000-0000-00000000000c', 'Velho H1C', 'velho@h1c.local', 'atendente');
insert into public.usuario_setores (usuario_id, setor_id)
select u, s.id from public.setores s, unnest(array['ea100000-0000-0000-0000-00000000000b', 'ea100000-0000-0000-0000-00000000000c']::uuid[]) u
where s.nome = 'Fiscal';
insert into public.clientes (id, razao_social, cnpj, ativo, certificado_tipo, certificado_vencimento, certificado_avisar_dias) values
  ('ea300000-0000-0000-0000-00000000000a', 'H1C Alfa', '11222333000181', true, 'e_cnpj_a1', '2030-01-20', 30),
  ('ea300000-0000-0000-0000-00000000000b', 'H1C Beta', '11444777000161', true, 'e_cnpj_a3', '2030-01-25', 30),
  ('ea300000-0000-0000-0000-00000000000c', 'H1C Sem', '17170000000132', true, 'sem', '2030-01-15', 30),
  ('ea300000-0000-0000-0000-00000000000d', 'H1C Longe', '12345678000195', true, 'e_cnpj_a1', '2030-06-01', 30),
  ('ea300000-0000-0000-0000-00000000000e', 'H1C Arquivada', '55566677000183', false, 'e_cnpj_a1', '2030-01-20', 30),
  ('ea300000-0000-0000-0000-00000000000f', 'H1C Vencida', '12121212000106', true, null, '2030-01-05', 30),
  ('ea300000-0000-0000-0000-000000000010', 'H1C Quinze', '99888777000166', true, 'e_cpf_a1', '2030-02-01', 15);
-- Alfa: Fê responde pelo Fiscal. Beta: o responsável do Fiscal foi arquivado (a demanda cai na fila do setor).
insert into public.cliente_responsaveis (cliente_id, setor_id, usuario_id)
select c, s.id, u from public.setores s,
  (values ('ea300000-0000-0000-0000-00000000000a'::uuid, 'ea100000-0000-0000-0000-00000000000b'::uuid),
          ('ea300000-0000-0000-0000-00000000000b'::uuid, 'ea100000-0000-0000-0000-00000000000c'::uuid)) v(c, u)
where s.nome = 'Fiscal';
update public.usuarios set ativo = false where id = 'ea100000-0000-0000-0000-00000000000c';

-- 1–3: estrutura e quem dispara
select col_is_pk('public', 'certificado_avisos', array['cliente_id', 'vencimento'], 'um aviso por empresa e vencimento');
select ok(not has_function_privilege('authenticated', 'public.gerar_demandas_certificado(date)', 'execute'), 'a equipe não dispara');
select ok(has_function_privilege('service_role', 'public.gerar_demandas_certificado(date)', 'execute'), 'o trabalhador dispara');

-- 4–10: o dia 10/01/2030
select is(public.gerar_demandas_certificado('2030-01-10'), 3, 'Alfa, Beta e Vencida (dentro do aviso ou já vencidas)');
select is((select count(*)::int from public.chamados where cliente_id in ('ea300000-0000-0000-0000-00000000000c',
  'ea300000-0000-0000-0000-00000000000d', 'ea300000-0000-0000-0000-00000000000e', 'ea300000-0000-0000-0000-000000000010')), 0,
  'Sem certificado, longe do vencimento, arquivada e fora dos 15 dias: nada');
select results_eq(
  $$ select s.nome, c.responsavel_id, c.origem, c.prioridade::text, c.titulo, c.prazo_em
     from public.chamados c join public.setores s on s.id = c.setor_id where c.cliente_id = 'ea300000-0000-0000-0000-00000000000a' $$,
  $$ values ('Fiscal'::text, 'ea100000-0000-0000-0000-00000000000b'::uuid, 'sistema'::text, 'normal'::text,
             'Certificado digital vence em 20/01/2030'::text, '2030-01-19 18:00-03'::timestamptz) $$,
  'Alfa: Fiscal, responsável do Fiscal, origem sistema, prazo às 18:00 da véspera');
select is((select responsavel_id from public.chamados where cliente_id = 'ea300000-0000-0000-0000-00000000000b'), null,
  'Beta: responsável arquivado, a demanda fica na fila do Fiscal');
select results_eq(
  $$ select prioridade::text, titulo, prazo_em is not null from public.chamados where cliente_id = 'ea300000-0000-0000-0000-00000000000f' $$,
  $$ values ('alta'::text, 'Certificado digital vencido em 05/01/2030'::text, true) $$,
  'vencido: alta, com o prazo da prioridade');
select ok((select resumo from public.chamados where cliente_id = 'ea300000-0000-0000-0000-00000000000a')
          like 'Renovar o certificado digital (e-CNPJ A1) de H1C Alfa.%', 'o resumo diz o tipo e a empresa');
select is((select count(*)::int from public.chamado_eventos e join public.chamados c on c.id = e.chamado_id
           where c.cliente_id = 'ea300000-0000-0000-0000-00000000000a' and e.tipo = 'criacao'), 1,
  'a demanda tem a linha do tempo de sempre (gatilhos da Parte C)');

-- 11–14: sem repetir; 15 dias; certificado renovado
select is(public.gerar_demandas_certificado('2030-01-10'), 0, 'rodar de novo no mesmo dia não repete');
select is(public.gerar_demandas_certificado('2030-01-17'), 1, 'Quinze entra 15 dias antes');
update public.clientes set certificado_vencimento = '2031-01-20' where id = 'ea300000-0000-0000-0000-00000000000a';
select is(public.gerar_demandas_certificado('2030-12-25'), 2, 'Alfa renovado (novo vencimento) e Longe (já vencido)');
select is((select count(*)::int from public.certificado_avisos where cliente_id = 'ea300000-0000-0000-0000-00000000000a' and chamado_id is not null), 2,
  'uma linha por vencimento, cada uma com a sua demanda');

-- 15–16: nunca "Sem certificado" nem arquivada; nem o administrador dispara pelo painel
select is((select count(*)::int from public.chamados where cliente_id in ('ea300000-0000-0000-0000-00000000000c', 'ea300000-0000-0000-0000-00000000000e')), 0,
  '"Sem certificado" e arquivada continuam sem demanda');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ea100000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.gerar_demandas_certificado('2030-01-10') $$, '42501', null, 'nem o administrador dispara pelo painel');

select * from finish();
rollback;
