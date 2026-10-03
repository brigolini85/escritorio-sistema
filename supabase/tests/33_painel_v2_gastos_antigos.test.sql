-- Parte F, Task 2 (Prompt F): registros antigos classificados pela mesma regra; nenhum nulo; a coluna fica travada.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select col_not_null('public', 'uso_ia', 'funcionalidade', 'funcionalidade obrigatória');
select is((select count(*) from public.uso_ia where funcionalidade is null), 0::bigint, 'nenhum registro sem funcionalidade');
-- Mesmo com o gatilho desligado, o banco recusa nulo (a trava é da coluna).
alter table public.uso_ia disable trigger completar;
select throws_ok($$ insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd) values ('m', 0, 0, 0) $$,
  '23502', null, 'nulo recusado pela coluna');
alter table public.uso_ia enable trigger completar;
select lives_ok($$ insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd) values ('m', 0, 0, 0) $$,
  'com o gatilho, o trabalhador antigo continua gravando');
select is((select funcionalidade from public.uso_ia order by criado_em desc limit 1), 'nao_identificado', 'e entra classificado');

select * from finish();
rollback;
