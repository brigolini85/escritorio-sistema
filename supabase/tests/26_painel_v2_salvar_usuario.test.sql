begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('d2600000-0000-0000-0000-00000000000a', 'admin@salvar.local'), ('d2600000-0000-0000-0000-00000000000b', 'bia@salvar.local'),
  ('d2600000-0000-0000-0000-00000000000c', 'arq@salvar.local'), ('d2600000-0000-0000-0000-00000000000d', 'nova@salvar.local'),
  ('d2600000-0000-0000-0000-00000000000e', 'padrao@salvar.local');
insert into public.usuarios (id, nome, email, papel) values
  ('d2600000-0000-0000-0000-00000000000a', 'Admin S', 'admin@salvar.local', 'admin'),
  ('d2600000-0000-0000-0000-00000000000b', 'Bia S', 'bia@salvar.local', 'atendente'),
  ('d2600000-0000-0000-0000-00000000000c', 'Arq S', 'arq@salvar.local', 'atendente');
update public.usuarios set ativo = false where id = 'd2600000-0000-0000-0000-00000000000c';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2600000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000b', '{"nome":"Bia","papel":"admin"}') $$,
  'P0001', 'Só o administrador muda pessoas.', 'atendente não se faz administrador');

select set_config('request.jwt.claims', '{"sub":"d2600000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000d', jsonb_build_object(
    'nome', 'Nova S', 'email', ' Nova@Salvar.local ', 'papel', 'atendente', 'cargo', 'Analista', 'telefone', null,
    'setores', jsonb_build_array((select id from public.setores where nome = 'Fiscal')),
    'niveis', '{"demandas":"todas","clientes":"editar"}'::jsonb,
    'horario_acesso', '{"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}'::jsonb,
    'observacoes', 'Férias em novembro')) $$, 'cria a pessoa com tudo de uma vez');
select is((select email || '|' || cargo || '|' || observacoes from public.usuarios where id = 'd2600000-0000-0000-0000-00000000000d'),
  'nova@salvar.local|Analista|Férias em novembro', 'dados gravados (e-mail aparado e minúsculo)');
-- niveis_do_usuario é só do banco e do trabalhador (Task 4): lê como dono do banco.
reset role;
select is((public.niveis_do_usuario('d2600000-0000-0000-0000-00000000000d') ->> 'demandas') || '/'
          || (public.niveis_do_usuario('d2600000-0000-0000-0000-00000000000d') ->> 'clientes') || '/'
          || (public.niveis_do_usuario('d2600000-0000-0000-0000-00000000000d') ->> 'prazos'),
  'todas/editar/sim', 'níveis escolhidos e o padrão nos outros');
set local role authenticated;
select is(array(select s.nome from public.usuario_setores us join public.setores s on s.id = us.setor_id
                where us.usuario_id = 'd2600000-0000-0000-0000-00000000000d'), array['Fiscal'], 'setores gravados');
select is((select permissoes from public.usuarios where id = 'd2600000-0000-0000-0000-00000000000d'), '{editar_clientes}'::text[],
  'a cópia antiga acompanha');

-- Marcar como administrador: só o Assistente vem; o resto fica como estava (foco da revisão 3).
select lives_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000d', jsonb_build_object(
    'nome', 'Nova S', 'papel', 'admin', 'setores', jsonb_build_array((select id from public.setores where nome = 'Fiscal')),
    'niveis', '{"assistente":"site"}'::jsonb)) $$, 'vira administrador');
reset role;
select is(public.niveis_do_usuario('d2600000-0000-0000-0000-00000000000d') ->> 'demandas', 'todas', 'os níveis escondidos não se perdem');
set local role authenticated;
select isnt((select horario_acesso from public.usuarios where id = 'd2600000-0000-0000-0000-00000000000d'), null,
  'sem a chave horario_acesso, o horário fica como estava');

select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000a', '{"nome":"Admin S","papel":"atendente"}') $$,
  'P0001', 'Você não pode tirar o seu próprio acesso de administrador.', 'ninguém tira o próprio administrador (P16)');
select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000b', '{"nome":"Bia S","papel":"atendente","niveis":{"demandas":"tudo"}}') $$,
  'P0001', 'Nível inválido em demandas.', 'nível inválido');
select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000b',
    '{"nome":"Bia S","papel":"atendente","horario_acesso":{"semana":{"de":"18:00","ate":"08:00"},"sabado":null,"domingo":null}}') $$,
  'P0001', 'Horário de acesso inválido.', 'horário inválido');
select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000b',
    '{"nome":"Mudou","papel":"atendente","telefone":null,"niveis":{"assistente":"site_whatsapp"}}') $$,
  'P0001', 'Informe o telefone para usar o assistente pelo WhatsApp.', 'WhatsApp sem telefone');
select is((select nome from public.usuarios where id = 'd2600000-0000-0000-0000-00000000000b'), 'Bia S', 'erro desfaz tudo (uma transação só)');
select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000c', '{"nome":"Arq S","papel":"atendente"}') $$,
  'P0001', 'Esta pessoa está arquivada. Restaure antes de mudar.', 'arquivada não muda');
select ok((select count(*) from public.auditoria_acessos
           where usuario_id = 'd2600000-0000-0000-0000-00000000000a' and entidade in ('usuarios', 'usuario_permissoes', 'usuario_setores')
             and entidade_id = 'd2600000-0000-0000-0000-00000000000d') > 0, 'auditoria guarda o administrador que salvou');

-- Pessoa nova sem a chave horario_acesso começa no padrão do spec (P4); quem já existe não é tocado.
select lives_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000e',
    '{"nome":"Padrão S","email":"padrao@salvar.local","papel":"atendente"}') $$, 'cria sem informar o horário');
select is((select horario_acesso from public.usuarios where id = 'd2600000-0000-0000-0000-00000000000e'),
  '{"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}'::jsonb, 'pessoa nova: seg a sex, 08 às 18 (P4)');

-- Setor repetido e "niveis": null (lista vazia no formulário) não quebram o salvar.
select lives_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000b', jsonb_build_object(
    'nome', 'Bia S', 'papel', 'atendente', 'niveis', null,
    'setores', (select jsonb_build_array(id, id) from public.setores where nome = 'Fiscal'))) $$, 'setor repetido e níveis nulos');

select * from finish();
rollback;
