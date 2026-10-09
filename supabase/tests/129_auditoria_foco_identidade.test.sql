-- Auditoria 3.8, 1.4/3.9, 1.10 e 1.9: um contato ativo por telefone (com ou sem o nono dígito), a troca de contato da
-- conversa zera a empresa em foco e marca a hora da troca, e o perfil do acesso é o das marcações (recalculado no banco).
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into auth.users (id, email) values ('e1290000-0000-0000-0000-00000000000b', 'bia@t129.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e1290000-0000-0000-0000-00000000000b', 'Bia T129', 'bia@t129.local', 'atendente', '{editar_clientes}');
insert into public.clientes (id, razao_social, cnpj) values
  ('e1291000-0000-0000-0000-00000000000a', 'T129 Rede Bom Preço Ltda', '11222333000181'),
  ('e1291000-0000-0000-0000-00000000000b', 'T129 Padaria Sol ME', '11444777000161');

-- 1–3: estrutura
select has_column('public', 'conversas', 'contato_trocado_em', 'conversa guarda a hora da última troca de contato (1.10)');
select ok((select indisunique from pg_index where indexrelid = 'public.contatos_telefone_unico'::regclass),
  'índice único no telefone canônico dos contatos ativos (3.8)');
select ok(not has_function_privilege('authenticated', 'public.contato_ativo_do_telefone(text)', 'execute'),
  'só o trabalhador procura o contato pelo telefone');

-- 4–10: o mesmo número com e sem o nono dígito não vira dois contatos ativos (3.8)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1290000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.cadastrar_contato('T129 Ana', '5531999990000') $$, 'primeiro cadastro: …99999-0000');
select throws_ok($$ select public.cadastrar_contato('T129 Outro', '553199990000') $$, 'P0001',
  'Este telefone já é de outro contato (com ou sem o nono dígito).', 'segundo cadastro (…9999-0000) dá erro');
select throws_ok($$ select public.contato_arquivado_do_telefone('553199990000') $$, 'P0001',
  'Este telefone já é de outro contato (com ou sem o nono dígito).', 'a conferência da tela já mostra a mensagem');
select is(public.contato_arquivado_do_telefone('5531999990000'), null, 'o mesmo número escrito igual segue livre (vira o mesmo contato)');
reset role;
-- Arquivado com a outra forma convive; trazer de volta com o ativo existindo, não.
insert into public.contatos (id, nome, telefone, ativo) values ('e1292000-0000-0000-0000-000000000001', 'T129 Antigo', '553199990000', false);
select throws_ok($$ update public.contatos set ativo = true where id = 'e1292000-0000-0000-0000-000000000001' $$, 'P0001',
  'Este telefone já é de outro contato (com ou sem o nono dígito).', 'reativar a outra forma com o ativo existindo dá erro');
-- Sem o gatilho (corrida entre dois cadastros), o índice segura.
alter table public.contatos disable trigger telefone_contato_unico;
select throws_ok($$ insert into public.contatos (nome, telefone) values ('T129 Corrida', '553199990000') $$, '23505', null,
  'o índice único segura a corrida');
alter table public.contatos enable trigger telefone_contato_unico;
select is(public.contato_ativo_do_telefone('553199990000'),
  (select id from public.contatos where telefone = '5531999990000'), 'procura pelo canônico: acha o contato da outra forma');

-- 11–15: troca de contato na conversa zera o foco e marca a hora (1.4, 1.10)
insert into public.contatos (id, nome, telefone) values
  ('e1292000-0000-0000-0000-000000000002', 'T129 Bruno', '5531988880129'),
  ('e1292000-0000-0000-0000-000000000003', 'T129 Carla', '5531977770129');
insert into public.conversas (id, telefone, contato_id, cliente_em_foco) values
  ('e1293000-0000-0000-0000-000000000001', '5531988880129', 'e1292000-0000-0000-0000-000000000002', 'e1291000-0000-0000-0000-00000000000a');
select is((select contato_trocado_em from public.conversas where id = 'e1293000-0000-0000-0000-000000000001'), null, 'conversa nova: sem troca');
update public.conversas set atualizado_em = now() where id = 'e1293000-0000-0000-0000-000000000001';
select is((select cliente_em_foco from public.conversas where id = 'e1293000-0000-0000-0000-000000000001'),
  'e1291000-0000-0000-0000-00000000000a'::uuid, 'sem troca de contato, o foco fica');
update public.conversas set contato_id = 'e1292000-0000-0000-0000-000000000003' where id = 'e1293000-0000-0000-0000-000000000001';
select is((select cliente_em_foco from public.conversas where id = 'e1293000-0000-0000-0000-000000000001'), null, 'troca de contato: foco zerado');
select ok((select contato_trocado_em is not null from public.conversas where id = 'e1293000-0000-0000-0000-000000000001'),
  'troca de contato: hora gravada');
update public.conversas set contato_id = 'e1292000-0000-0000-0000-000000000002', cliente_em_foco = 'e1291000-0000-0000-0000-00000000000b'
 where id = 'e1293000-0000-0000-0000-000000000001';
select is((select cliente_em_foco from public.conversas where id = 'e1293000-0000-0000-0000-000000000001'),
  'e1291000-0000-0000-0000-00000000000b'::uuid, 'foco escolhido na mesma escrita vale');

-- 16–22: contato arquivado ou com o telefone trocado também conta como troca nas conversas dele (1.10, revisão)
insert into public.contatos (id, nome, telefone) values
  ('e1292000-0000-0000-0000-000000000004', 'T129 Dora', '5531966660129'),
  ('e1292000-0000-0000-0000-000000000005', 'T129 Edu', '5531955550129'),
  ('e1292000-0000-0000-0000-000000000006', 'T129 Fabi', '5531944440129');
insert into public.conversas (id, telefone, contato_id, cliente_em_foco) values
  ('e1293000-0000-0000-0000-000000000004', '5531966660129', 'e1292000-0000-0000-0000-000000000004', 'e1291000-0000-0000-0000-00000000000a'),
  ('e1293000-0000-0000-0000-000000000005', '5531955550129', 'e1292000-0000-0000-0000-000000000005', 'e1291000-0000-0000-0000-00000000000a'),
  ('e1293000-0000-0000-0000-000000000006', '5531944440129', 'e1292000-0000-0000-0000-000000000006', 'e1291000-0000-0000-0000-00000000000a');
update public.contatos set nome = 'T129 Dora Silva' where id = 'e1292000-0000-0000-0000-000000000004';
select is((select (contato_trocado_em is null, cliente_em_foco)::text from public.conversas where id = 'e1293000-0000-0000-0000-000000000004'),
  '(t,e1291000-0000-0000-0000-00000000000a)', 'mudar só o nome não mexe na conversa');
update public.contatos set ativo = false where id = 'e1292000-0000-0000-0000-000000000004';
select ok((select contato_trocado_em is not null from public.conversas where id = 'e1293000-0000-0000-0000-000000000004'),
  'contato arquivado: hora da troca gravada na conversa dele');
select is((select cliente_em_foco from public.conversas where id = 'e1293000-0000-0000-0000-000000000004'), null,
  'contato arquivado: foco zerado');
select is((select contato_id from public.conversas where id = 'e1293000-0000-0000-0000-000000000004'),
  'e1292000-0000-0000-0000-000000000004'::uuid, 'o contato da conversa fica (o painel ainda mostra quem era)');
update public.contatos set telefone = '5531955550999' where id = 'e1292000-0000-0000-0000-000000000005';
select ok((select contato_trocado_em is not null from public.conversas where id = 'e1293000-0000-0000-0000-000000000005'),
  'telefone trocado: hora da troca gravada');
select is((select cliente_em_foco from public.conversas where id = 'e1293000-0000-0000-0000-000000000005'), null, 'telefone trocado: foco zerado');
select is((select (contato_trocado_em is null, cliente_em_foco)::text from public.conversas where id = 'e1293000-0000-0000-0000-000000000006'),
  '(t,e1291000-0000-0000-0000-00000000000a)', 'conversa de outro contato não muda');

-- 23–36: perfil_das_marcas, com os casos de packages/core/test/acesso.test.ts. A Rede contrata Fiscal, Pessoal, Contábil e
-- Legalização (Financeiro entra sempre). Ajudante: as marcas de um perfil pronto, como marcasDoPerfil.
insert into public.servicos (id, nome, setor_id) select gen_random_uuid(), 'T129 ' || nome, id from public.setores
  where nome in ('Fiscal', 'Pessoal', 'Contábil', 'Legalização');
insert into public.cliente_servicos (cliente_id, servico_id)
  select 'e1291000-0000-0000-0000-00000000000a', id from public.servicos where nome like 'T129 %';
create function pg_temp.marcas(p_setores text[], p_procurado boolean, p_nota boolean, p_preco boolean, p_valores boolean,
  p_docs boolean, p_avisar text[] default '{whatsapp}', p_alertas boolean default false) returns jsonb language sql as $$
  select jsonb_build_object(
    'setores', coalesce((select jsonb_agg(jsonb_build_object('setor_id', id, 'pode_ser_procurado', p_procurado))
                         from public.setores where nome = any (p_setores)), '[]'::jsonb),
    'pode_pedir_nota', p_nota, 'pode_atualizar_preco', p_preco, 'ver_valores', p_valores, 'receber_documentos', p_docs,
    'avisar_documento_novo', to_jsonb(p_avisar), 'recebe_alertas_acesso', p_alertas)
$$;
create function pg_temp.perfil(p jsonb) returns text language sql as $$
  select public.perfil_das_marcas('e1291000-0000-0000-0000-00000000000a', p)
$$;
-- "cada perfil pronto volta como ele mesmo"
select is(pg_temp.perfil(pg_temp.marcas('{Fiscal,Pessoal,Contábil,Financeiro,Legalização}', true, true, true, true, true, '{whatsapp}', true)),
  'socio', 'Sócio');
select is(pg_temp.perfil(pg_temp.marcas('{Fiscal,Contábil,Financeiro,Legalização}', true, true, false, true, true)), 'administrativo', 'Administrativo');
select is(pg_temp.perfil(pg_temp.marcas('{Financeiro,Contábil}', true, false, false, true, true)), 'financeiro', 'Financeiro');
select is(pg_temp.perfil(pg_temp.marcas('{Pessoal}', true, false, false, true, true)), 'rh_dp', 'RH/DP');
select is(pg_temp.perfil(pg_temp.marcas('{Fiscal}', true, true, true, false, true)), 'compras_vendas', 'Compras/Vendas');
select is(pg_temp.perfil(pg_temp.marcas('{Fiscal}', false, true, false, false, false, '{}')), 'funcionario', 'Funcionário');
select is(pg_temp.perfil(pg_temp.marcas('{}', false, false, false, false, false, '{}')), 'basico', 'Básico');
-- "mudar uma marcação vira Personalizado; desfazer volta ao perfil"
select is(pg_temp.perfil(pg_temp.marcas('{Fiscal}', true, true, true, false, true)
    || jsonb_build_object('setores', (pg_temp.marcas('{Fiscal}', true, true, true, false, true) -> 'setores')
         || jsonb_build_array(jsonb_build_object('setor_id', (select id from public.setores where nome = 'Pessoal'), 'pode_ser_procurado', false)))),
  'personalizado', 'Compras/Vendas + Pessoal: Personalizado');
select is(pg_temp.perfil(pg_temp.marcas('{Fiscal}', true, true, true, false, true)), 'compras_vendas', 'desfazer volta ao perfil');
-- "avisos não mudam o perfil (D3)"
select is(pg_temp.perfil(pg_temp.marcas('{Fiscal,Pessoal,Contábil,Financeiro,Legalização}', true, true, true, true, true, '{}', false)),
  'socio', 'avisos não mudam o perfil');
-- "contato antigo com pode pedir nota e nenhum setor continua Básico (D2, D3)"
select is(pg_temp.perfil(pg_temp.marcas('{}', false, true, true, false, false, '{}')), 'basico', 'nota e preço sem setor: Básico');
-- Setor marcado que não é do contrato não bate com perfil pronto; empresa sem serviço com setor: todos valem.
select is(pg_temp.perfil(pg_temp.marcas('{Fiscal,Pessoal,Contábil,Financeiro,Legalização}', true, true, true, true, true)
    || jsonb_build_object('setores', (pg_temp.marcas('{Fiscal,Pessoal,Contábil,Financeiro,Legalização}', true, true, true, true, true) -> 'setores')
         || jsonb_build_array(jsonb_build_object('setor_id', (select id from public.setores where nome = 'Legalização'), 'pode_ser_procurado', true)))),
  'personalizado', 'setor repetido não vira perfil pronto');
select is(public.perfil_das_marcas('e1291000-0000-0000-0000-00000000000b',
    pg_temp.marcas((select array_agg(nome) from public.setores where ativo and nome <> 'Direção'), true, true, true, true, true)),
  'socio', 'empresa sem serviço com setor: todos os setores contam');
select ok(not has_function_privilege('authenticated', 'public.perfil_das_marcas(uuid, jsonb)', 'execute'), 'só o banco usa o cálculo');

-- 37–44: salvar_acesso_contato grava o perfil das marcações, não o que veio (1.9)
insert into public.contato_clientes (contato_id, cliente_id) values
  ('e1292000-0000-0000-0000-000000000002', 'e1291000-0000-0000-0000-00000000000a');
create function pg_temp.perfil_gravado() returns text language sql as $$
  select perfil from public.contato_clientes
   where contato_id = 'e1292000-0000-0000-0000-000000000002' and cliente_id = 'e1291000-0000-0000-0000-00000000000a'
$$;
grant execute on function pg_temp.marcas(text[], boolean, boolean, boolean, boolean, boolean, text[], boolean), pg_temp.perfil_gravado() to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1290000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_acesso_contato('e1292000-0000-0000-0000-000000000002', 'e1291000-0000-0000-0000-00000000000a',
  pg_temp.marcas('{}', false, false, false, false, false, '{}') || '{"perfil": "socio"}') $$, '"Sócio" sem marcações: salva');
select is(pg_temp.perfil_gravado(), 'basico', '"Sócio" sem marcações é gravado como Básico');
select lives_ok($$ select public.salvar_acesso_contato('e1292000-0000-0000-0000-000000000002', 'e1291000-0000-0000-0000-00000000000a',
  pg_temp.marcas('{Fiscal,Pessoal,Contábil,Financeiro,Legalização}', true, true, true, true, true, '{whatsapp}', true) || '{"perfil": "basico"}') $$,
  'marcas de Sócio enviadas como Básico: salva');
select is(pg_temp.perfil_gravado(), 'socio', 'gravado como Sócio');
select lives_ok($$ select public.salvar_acesso_contato('e1292000-0000-0000-0000-000000000002', 'e1291000-0000-0000-0000-00000000000a',
  pg_temp.marcas('{Pessoal}', false, false, false, true, true, '{}') || '{"perfil": "rh_dp"}') $$, 'RH/DP sem "procurado": salva');
select is(pg_temp.perfil_gravado(), 'personalizado', 'marcação diferente do perfil: Personalizado');
select lives_ok($$ select public.salvar_acesso_contato('e1292000-0000-0000-0000-000000000002', 'e1291000-0000-0000-0000-00000000000a',
  pg_temp.marcas('{}', false, true, true, false, false, '{}') || '{"perfil": "compras_vendas"}') $$, 'só nota e preço: salva');
select is(pg_temp.perfil_gravado(), 'basico', 'só nota e preço: Básico (D3)');
reset role;

select * from finish();
rollback;
