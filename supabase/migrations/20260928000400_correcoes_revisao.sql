-- Correções da revisão de código de 2026-09-28.

-- Item 1: soma do gasto com IA feita no banco (a API devolve no máximo 1000 linhas por consulta).
create function public.custo_ia_periodo(p_inicio timestamptz, p_fim timestamptz) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(custo_usd), 0) from uso_ia where criado_em >= p_inicio and criado_em < p_fim
$$;
revoke execute on function public.custo_ia_periodo(timestamptz, timestamptz) from public, anon, authenticated;

-- Item 2: reserva de envio, para duas tarefas da fila não mandarem a mesma resposta ao mesmo tempo.
alter table public.mensagens add column envio_reservado_em timestamptz;

-- Item 6: desfazer vínculos da ficha (serviço, responsável, contato) é edição, não exclusão de cadastro.
do $$
declare t text;
begin
  foreach t in array array['cliente_responsaveis', 'cliente_servicos', 'contato_clientes'] loop
    execute format('drop policy excluir on public.%I', t);
    execute format('create policy excluir on public.%I for delete to authenticated using (tem_permissao(''editar_clientes''))', t);
  end loop;
end $$;
