begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000b', 'ana@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000e', 'caio@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values
  ('00000000-0000-0000-0000-00000000000b', 'Ana', 'ana@pgtap.local', 'atendente'),
  ('00000000-0000-0000-0000-00000000000e', 'Caio', 'caio@pgtap.local', 'atendente');
insert into public.usuario_setores (usuario_id, setor_id)
  select '00000000-0000-0000-0000-00000000000b', id from public.setores where nome = 'Fiscal';
insert into public.usuario_setores (usuario_id, setor_id)
  select '00000000-0000-0000-0000-00000000000e', id from public.setores where nome = 'Pessoal';
insert into public.clientes (id, razao_social, cnpj) values ('10000000-0000-0000-0000-000000000001', 'Indústria X', '11222333000181');
insert into public.conversas (id, telefone) values ('20000000-0000-0000-0000-000000000001', '5531999990001');
insert into public.chamados (id, cliente_id, conversa_id, setor_id, titulo)
  select '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
         '20000000-0000-0000-0000-000000000001', id, 'Guia DAS setembro'
  from public.setores where nome = 'Fiscal';

set local role authenticated;

-- Caio (outro setor) não pode assumir
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$ select public.assumir_conversa('20000000-0000-0000-0000-000000000001') $$,
  'P0001', 'sem acesso a esta conversa', 'outro setor não assume');

-- Ana assume
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.assumir_conversa('20000000-0000-0000-0000-000000000001') $$, 'Ana assume');
select is((select estado::text from public.conversas where id = '20000000-0000-0000-0000-000000000001'), 'humano', 'conversa vira humano');
select is((select responsavel_id from public.chamados where id = '30000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 'chamado sem responsável passa para Ana');

-- Ana responde: mensagem pendente de atendente
select isnt((select public.registrar_resposta('20000000-0000-0000-0000-000000000001', 'Segue a guia', null, null, null)), null, 'resposta registrada');
select is((select status_envio::text from public.mensagens where autor = 'atendente'), 'pendente', 'mensagem fica pendente para o trabalhador enviar');

-- Nota interna e conclusão
select lives_ok($$ select public.nota_interna('30000000-0000-0000-0000-000000000001', 'cliente pediu com urgência') $$, 'nota interna');
select lives_ok($$ select public.concluir_chamado('30000000-0000-0000-0000-000000000001') $$, 'conclui chamado');
select is((select estado::text from public.conversas where id = '20000000-0000-0000-0000-000000000001'), 'agente',
  'sem chamados abertos, a conversa volta para o agente');

select * from finish();
rollback;
