-- supabase/migrations/20261007000200_painel_v2_cargos.sql
-- Painel v2, Parte G1 (spec 7C.4 e seção 9): a lista de cargos que a ficha da pessoa sugere passa a ser editável em
-- Configurações › Cargos ("Configurações: Sim", como Setores). Só sugestão: o cargo de quem já tem não muda (D10).

create function public.cargos_validos(p text[]) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and cardinality(p) <= 30
     and not exists (select 1 from unnest(p) c where c is null or c <> btrim(c) or char_length(c) not between 1 and 60)
     and (select count(distinct lower(c)) from unnest(p) c) = cardinality(p)
$$;

alter table public.configuracoes
  add column cargos text[] not null default '{Auxiliar,Analista,Coordenador,Sócio}' check (public.cargos_validos(cargos));
