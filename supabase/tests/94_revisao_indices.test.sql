-- Revisão geral, área 1, I4: índices completos (sem "where") nas colunas que as regras de leitura do Atendimento e as
-- junções frequentes usam. O de chamados(conversa_id) era parcial (status <> 'concluido') e não servia a pode_ver_conversa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create temp view indice_completo as
  select t.relname as tabela, a.attname as coluna
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
   where n.nspname = 'public' and i.indpred is null;

select ok(exists (select 1 from indice_completo where tabela = 'chamados' and coluna = 'conversa_id'), 'chamados(conversa_id) completo');
select ok(exists (select 1 from indice_completo where tabela = 'chamados' and coluna = 'responsavel_id'), 'chamados(responsavel_id)');
select ok(exists (select 1 from indice_completo where tabela = 'chamados' and coluna = 'setor_id'), 'chamados(setor_id)');
select ok(exists (select 1 from indice_completo where tabela = 'chamados' and coluna = 'cliente_id'), 'chamados(cliente_id)');
select ok(exists (select 1 from indice_completo where tabela = 'chamados' and coluna = 'contato_id'), 'chamados(contato_id)');
select ok(exists (select 1 from indice_completo where tabela = 'conversas' and coluna = 'atendente_id'), 'conversas(atendente_id)');
select ok(exists (select 1 from indice_completo where tabela = 'conversas' and coluna = 'contato_id'), 'conversas(contato_id)');

-- A busca de pode_ver_conversa_de ("meus_setores": demandas da conversa, de qualquer status) usa um índice.
set local enable_seqscan = off;
create temp table plano (linha text);
do $$
declare r record;
begin
  for r in execute 'explain select 1 from public.chamados c where c.conversa_id = ''00000000-0000-0000-0000-000000000001''' loop
    insert into plano values (r."QUERY PLAN");
  end loop;
end $$;
select ok(exists (select 1 from plano where linha ~ 'Index.*chamados_conversa_completo_idx'),
  'busca de demandas da conversa (qualquer status) usa o índice completo');

select * from finish();
rollback;
