-- Parte H2, Task 9 (revisão das Tasks 1–2): as marcações novas do acesso mudam só por salvar_acesso_contato. Os caminhos
-- de hoje (vincular, nota e preço pelo Atendimento e pela ficha) continuam, e o vínculo novo nasce Básico (D6).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values ('f4600000-0000-0000-0000-00000000000b', 'bia@h2c.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('f4600000-0000-0000-0000-00000000000b', 'Bia H2C', 'bia@h2c.local', 'atendente', '{editar_clientes}');
insert into public.clientes (id, razao_social, cnpj) values
  ('f4700000-0000-0000-0000-00000000000a', 'H2C Rede Bom Preço Ltda', '11222333000181'),
  ('f4700000-0000-0000-0000-00000000000b', 'H2C Padaria Sol ME', '11444777000161');
insert into public.contatos (id, nome, telefone) values
  ('f4800000-0000-0000-0000-00000000000a', 'H2C Carla Mendes', '5511977772211'),
  ('f4800000-0000-0000-0000-00000000000b', 'H2C Roberto Faria', '5511988880001');
-- Preparo como dono do banco: Carla é Compras/Vendas na Rede.
insert into public.contato_clientes (contato_id, cliente_id, perfil, pode_pedir_nota, pode_atualizar_preco, receber_documentos, avisar_documento_novo) values
  ('f4800000-0000-0000-0000-00000000000a', 'f4700000-0000-0000-0000-00000000000a', 'compras_vendas', true, true, true, '{whatsapp}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f4600000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

-- 1–5: a equipe não muda as marcações novas direto (nem o perfil)
select throws_ok($$ update public.contato_clientes set ver_valores = true where contato_id = 'f4800000-0000-0000-0000-00000000000a' $$,
  '42501', 'O acesso do contato muda pelo bloco de acesso.', 'ver valores não muda direto');
select throws_ok($$ update public.contato_clientes set perfil = 'socio' where contato_id = 'f4800000-0000-0000-0000-00000000000a' $$,
  '42501', 'O acesso do contato muda pelo bloco de acesso.', 'perfil não muda direto');
select throws_ok($$ update public.contato_clientes set recebe_alertas_acesso = true, avisar_documento_novo = '{}', receber_documentos = false
                    where contato_id = 'f4800000-0000-0000-0000-00000000000a' $$,
  '42501', 'O acesso do contato muda pelo bloco de acesso.', 'alertas, avisos e documentos não mudam direto');
select throws_ok($$ insert into public.contato_clientes (contato_id, cliente_id, perfil, ver_valores) values
                    ('f4800000-0000-0000-0000-00000000000b', 'f4700000-0000-0000-0000-00000000000a', 'socio', true) $$,
  '42501', 'Contato novo nasce Básico: defina o acesso no bloco de acesso.', 'vínculo novo não nasce com acesso');
select throws_ok($$ insert into public.contato_clientes (contato_id, cliente_id, receber_documentos) values
                    ('f4800000-0000-0000-0000-00000000000b', 'f4700000-0000-0000-0000-00000000000a', true) $$,
  '42501', 'Contato novo nasce Básico: defina o acesso no bloco de acesso.', 'vínculo novo não nasce recebendo documentos');

-- 6–9: os caminhos de hoje continuam (vincular com nota; upsert do Atendimento; mudar preço vira Personalizado)
select lives_ok($$ insert into public.contato_clientes (contato_id, cliente_id, pode_pedir_nota, pode_atualizar_preco) values
                   ('f4800000-0000-0000-0000-00000000000b', 'f4700000-0000-0000-0000-00000000000a', true, false) $$,
  'vincular com "pode pedir nota" segue');
select lives_ok($$ insert into public.contato_clientes (contato_id, cliente_id, pode_pedir_nota) values
                   ('f4800000-0000-0000-0000-00000000000b', 'f4700000-0000-0000-0000-00000000000a', false)
                   on conflict (contato_id, cliente_id) do update set pode_pedir_nota = excluded.pode_pedir_nota $$,
  'upsert do Atendimento segue');
select lives_ok($$ update public.contato_clientes set pode_atualizar_preco = false where contato_id = 'f4800000-0000-0000-0000-00000000000a' $$,
  'mudar preço direto segue');
select is((select perfil from public.contato_clientes where contato_id = 'f4800000-0000-0000-0000-00000000000a'), 'personalizado',
  'e vira Personalizado (gatilho dos caminhos antigos)');

-- 10–11: o bloco de acesso grava
select lives_ok($$ select public.salvar_acesso_contato('f4800000-0000-0000-0000-00000000000b', 'f4700000-0000-0000-0000-00000000000a',
  jsonb_build_object('perfil', 'personalizado', 'setores', '[]'::jsonb, 'ver_valores', true, 'receber_documentos', true,
    'avisar_documento_novo', jsonb_build_array('email'), 'recebe_alertas_acesso', true)) $$,
  'salvar_acesso_contato grava as marcações novas');
reset role;
select is((select (perfil, ver_valores, receber_documentos, avisar_documento_novo, recebe_alertas_acesso)::text from public.contato_clientes
           where contato_id = 'f4800000-0000-0000-0000-00000000000b'), '(personalizado,t,t,{email},t)', 'gravado pela função');

-- 12–13: o trabalhador e o preparo dos testes (service_role) seguem gravando direto
set local role service_role;
select lives_ok($$ update public.contato_clientes set ver_valores = false where contato_id = 'f4800000-0000-0000-0000-00000000000b' $$,
  'service_role grava direto');
reset role;
select is((select ver_valores from public.contato_clientes where contato_id = 'f4800000-0000-0000-0000-00000000000b'), false,
  'mudou pelo service_role');

select * from finish();
rollback;
