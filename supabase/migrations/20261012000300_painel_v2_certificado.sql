-- supabase/migrations/20261012000300_painel_v2_certificado.sql
-- Painel v2, Parte H1 (spec 7D.1 item 7): certificado perto de vencer vira demanda automática no Fiscal, para o responsável
-- do Fiscal da empresa, uma por certificado e vencimento. O trabalhador chama todo dia (fila certificados-vencendo, D21).

create table public.certificado_avisos (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  vencimento date not null,
  chamado_id uuid references public.chamados (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (cliente_id, vencimento)
);
alter table public.certificado_avisos enable row level security;
create policy leitura on public.certificado_avisos for select to authenticated using (public.eh_usuario_ativo());
revoke insert, update, delete on public.certificado_avisos from anon, authenticated;

create function public.rotulo_certificado(p_tipo text) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo when 'e_cnpj_a1' then 'e-CNPJ A1' when 'e_cnpj_a3' then 'e-CNPJ A3'
                     when 'e_cpf_a1' then 'e-CPF A1' when 'e_cpf_a3' then 'e-CPF A3' end
$$;

-- p_hoje: o dia em São Paulo (o trabalhador manda; os testes fixam). Devolve quantas demandas criou.
create function public.gerar_demandas_certificado(p_hoje date default (now() at time zone 'America/Sao_Paulo')::date)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_fiscal uuid := (select id from public.setores where nome = 'Fiscal' and ativo);
  v_resp uuid;
  v_chamado uuid;
  v_dias int;
  v_prazo timestamptz;
  n int := 0;
begin
  for r in
    select c.id, c.razao_social, c.certificado_tipo, c.certificado_vencimento
    from public.clientes c
    where c.ativo and c.certificado_vencimento is not null and coalesce(c.certificado_tipo, '') <> 'sem'
      and c.certificado_vencimento - c.certificado_avisar_dias <= p_hoje
      and not exists (select 1 from public.certificado_avisos a where a.cliente_id = c.id and a.vencimento = c.certificado_vencimento)
  loop
    -- A linha do aviso vem primeiro: duas execuções ao mesmo tempo não criam duas demandas.
    insert into public.certificado_avisos (cliente_id, vencimento) values (r.id, r.certificado_vencimento) on conflict do nothing;
    if not found then continue; end if;
    v_dias := r.certificado_vencimento - p_hoje;
    v_resp := (select cr.usuario_id from public.cliente_responsaveis cr join public.usuarios u on u.id = cr.usuario_id
               where cr.cliente_id = r.id and cr.setor_id = v_fiscal and u.ativo);
    -- Prazo: 18:00 da véspera do vencimento; se a véspera já passou, fica o prazo da prioridade (gatilho da Parte C).
    v_prazo := case when r.certificado_vencimento - 1 >= p_hoje
                    then ((r.certificado_vencimento - 1)::timestamp + time '18:00') at time zone 'America/Sao_Paulo' end;
    insert into public.chamados (cliente_id, setor_id, responsavel_id, titulo, resumo, prioridade, prazo_em, origem)
    values (r.id, v_fiscal, v_resp,
            case when v_dias < 0 then 'Certificado digital vencido em ' else 'Certificado digital vence em ' end
              || to_char(r.certificado_vencimento, 'DD/MM/YYYY'),
            'Renovar o certificado digital' || coalesce(' (' || public.rotulo_certificado(r.certificado_tipo) || ')', '')
              || ' de ' || r.razao_social || '. Aviso automático da ficha do cliente.',
            (case when v_dias <= 7 then 'alta' else 'normal' end)::public.prioridade_demanda, v_prazo, 'sistema')
    returning id into v_chamado;
    update public.certificado_avisos set chamado_id = v_chamado where cliente_id = r.id and vencimento = r.certificado_vencimento;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.gerar_demandas_certificado(date) from public, anon, authenticated;
grant execute on function public.gerar_demandas_certificado(date) to service_role;
