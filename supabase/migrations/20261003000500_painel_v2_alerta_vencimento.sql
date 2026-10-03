-- supabase/migrations/20261003000500_painel_v2_alerta_vencimento.sql
-- Painel v2, Parte C (spec 6.5): o alerta de demanda vencida avisa o responsável; sem responsável, o setor.

alter table public.alertas add column usuario_id uuid references public.usuarios (id) on delete cascade;

-- Alerta com pessoa é só dela (e do administrador); sem pessoa, continua do setor.
drop policy leitura on public.alertas;
create policy leitura on public.alertas for select to authenticated using (
  public.eh_admin()
  or (public.eh_usuario_ativo() and usuario_id = auth.uid())
  or (usuario_id is null and setor_id is not null and setor_id in (select public.meus_setores()))
);

create or replace function public.marcar_alerta_lido(p_alerta uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.alertas set lido_em = now()
  where id = p_alerta and (
    public.eh_admin()
    or (public.eh_usuario_ativo() and usuario_id = auth.uid())
    or (usuario_id is null and setor_id is not null and setor_id in (select public.meus_setores()))
  );
end $$;

-- ---------- Sobras da Parte C (Task 2) ----------

-- A lista da tela exige login: anon não lê.
revoke select on public.demandas_lista from anon;

-- vencida nunca é nula (demanda sem prazo não vence).
create or replace view public.demandas_lista with (security_invoker = true) as
select
  c.id, c.numero, c.titulo, c.resumo, c.status, c.prioridade, c.prazo_em, c.prazo_pausado_desde,
  c.criado_em, c.atualizado_em, c.concluido_em, c.origem, c.conversa_id, c.cliente_id, c.setor_id,
  c.responsavel_id, c.contato_id, c.criado_por, c.fora_do_contrato, c.pedido_venda,
  c.pedido_venda is not null as tem_pedido,
  coalesce(cl.nome_fantasia, cl.razao_social) as empresa,
  s.nome as setor,
  r.nome as responsavel,
  ct.nome as contato,
  cp.nome as criado_por_nome,
  coalesce(c.status <> 'concluido' and c.prazo_pausado_desde is null and c.prazo_em < now(), false) as vencida
from public.chamados c
left join public.clientes cl on cl.id = c.cliente_id
left join public.setores s on s.id = c.setor_id
left join public.usuarios r on r.id = c.responsavel_id
left join public.contatos ct on ct.id = c.contato_id
left join public.usuarios cp on cp.id = c.criado_por;

-- Se calcular_prazo não devolve prazo (sem dia útil nas Configurações), o prazo que já existe fica e não há evento.
create or replace function public.definir_prioridade_prazo(
  p_chamado uuid, p_prioridade public.prioridade_demanda default null, p_prazo timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype; v_prazo timestamptz;
begin
  v := public.demanda_para_agir(p_chamado);
  if p_prazo is not null and p_prazo <= now() then raise exception 'O prazo precisa ser depois de agora.'; end if;
  if p_prioridade is not null and p_prioridade <> v.prioridade then
    v_prazo := coalesce(p_prazo, public.calcular_prazo(p_prioridade, now()), v.prazo_em);
    update public.chamados set prioridade = p_prioridade, prazo_em = v_prazo where id = p_chamado;
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (p_chamado, v.cliente_id, 'prioridade_alterada', auth.uid(), p_prioridade::text);
    if v_prazo is distinct from v.prazo_em then
      insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
        values (p_chamado, v.cliente_id, 'prazo_alterado', case when p_prazo is not null then auth.uid() end, public.texto_prazo(v_prazo));
    end if;
  elsif p_prazo is not null and p_prazo is distinct from v.prazo_em then
    update public.chamados set prazo_em = p_prazo where id = p_chamado;
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (p_chamado, v.cliente_id, 'prazo_alterado', auth.uid(), public.texto_prazo(p_prazo));
  end if;
  return (select jsonb_build_object('prioridade', c.prioridade, 'prazo_em', c.prazo_em) from public.chamados c where c.id = p_chamado);
end $$;
