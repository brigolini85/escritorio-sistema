-- Caixa de entrada do painel (respeita o RLS de quem consulta) e tempo real.

create view public.caixa_entrada with (security_invoker = true) as
select
  c.id,
  c.telefone,
  coalesce(ct.nome, c.telefone) as nome_contato,
  coalesce(cl.nome_fantasia, cl.razao_social) as empresa,
  c.estado,
  c.atendente_id,
  (select m.conteudo from public.mensagens m where m.conversa_id = c.id order by m.criado_em desc limit 1) as ultima_mensagem,
  (select max(m.criado_em) from public.mensagens m where m.conversa_id = c.id) as ultima_em,
  coalesce((select array_agg(distinct ch.setor_id) from public.chamados ch
            where ch.conversa_id = c.id and ch.status <> 'concluido' and ch.setor_id is not null), '{}') as setores_abertos,
  exists (select 1 from public.chamados ch where ch.conversa_id = c.id and ch.status <> 'concluido' and ch.responsavel_id is null) as sem_responsavel,
  exists (select 1 from public.chamados ch where ch.conversa_id = c.id and ch.status = 'aguardando_cliente') as aguardando_cliente,
  (select count(*) from public.chamados ch where ch.conversa_id = c.id and ch.status <> 'concluido')::int as chamados_abertos
from public.conversas c
left join public.contatos ct on ct.id = c.contato_id
left join public.clientes cl on cl.id = c.cliente_em_foco;

grant select on public.caixa_entrada to authenticated;

create function public.alterar_status_chamado(p_chamado uuid, p_status public.status_chamado) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pode_ver_chamado(p_chamado) then raise exception 'sem acesso a este chamado'; end if;
  if p_status = 'concluido' then raise exception 'use concluir_chamado'; end if;
  update chamados set status = p_status, atualizado_em = now() where id = p_chamado;
end $$;

alter publication supabase_realtime add table public.mensagens, public.conversas, public.chamados;
