-- supabase/migrations/20261006000200_painel_v2_gastos_antigos.sql
-- Painel v2, Parte F (Prompt F): registros antigos ganham funcionalidade pela regra única (com conversa → agente_clientes,
-- sem → nao_identificado) e a empresa da época. As contagens foram mostradas ao dono antes (Entrega, item 3).
-- (Subconsulta, não lateral: o Postgres não deixa o lateral olhar a tabela do update.)

update public.uso_ia u
set funcionalidade = (select c.funcionalidade from public.uso_ia_classificacao(u.conversa_id, u.criado_em) c),
    cliente_id = coalesce(u.cliente_id, (select c.cliente_id from public.uso_ia_classificacao(u.conversa_id, u.criado_em) c))
where u.funcionalidade is null;

-- Sugestões da Parte E já tinham funcionalidade, mas não empresa.
update public.uso_ia u
set cliente_id = (select c.cliente_id from public.uso_ia_classificacao(u.conversa_id, u.criado_em) c)
where u.cliente_id is null and u.conversa_id is not null and u.funcionalidade = 'sugerir_resposta';

alter table public.uso_ia alter column funcionalidade set not null;
