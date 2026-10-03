-- supabase/migrations/20261003000400_painel_v2_acoes_demanda.sql
-- Painel v2, Parte C (spec 6.3, 6.4 e 6.6): as ações da demanda sem sair da tela, a lista com nomes e "vencida",
-- a busca e a preferência Tabela/Quadro de cada pessoa.

-- ---------- Preferência Tabela/Quadro (como o tamanho da letra da Parte A) ----------

alter table public.usuarios
  add column visao_demandas text not null default 'tabela' check (visao_demandas in ('tabela', 'quadro'));

create function public.definir_visao_demandas(p_visao text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_visao is null or p_visao not in ('tabela', 'quadro') then raise exception 'Visão inválida.'; end if;
  if not public.eh_usuario_ativo() then raise exception 'Acesso desativado.'; end if;
  update public.usuarios set visao_demandas = p_visao where id = auth.uid();
end $$;

-- ---------- Apoio (só para as funções abaixo) ----------

-- Confere o acesso (setores da pessoa, responsável ou administrador) e trava a demanda até o fim da ação.
create function public.demanda_para_agir(p_chamado uuid, p_aberta boolean default true) returns public.chamados
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype;
begin
  if not public.pode_ver_chamado(p_chamado) then raise exception 'Você não tem acesso a esta demanda.'; end if;
  select * into v from public.chamados where id = p_chamado for update;
  if v.id is null then raise exception 'Você não tem acesso a esta demanda.'; end if;
  if p_aberta and v.status = 'concluido' then raise exception 'Esta demanda está concluída. Reabra antes de mudar.'; end if;
  return v;
end $$;

-- Pessoa ativa do setor (na Triagem, qualquer pessoa ativa) ou administrador.
create function public.pode_ser_responsavel(p_usuario uuid, p_setor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuarios u where u.id = p_usuario and u.ativo
      and (u.papel = 'admin' or p_setor is null
           or exists (select 1 from public.usuario_setores us where us.usuario_id = u.id and us.setor_id = p_setor))
  )
$$;

-- Contato ativo ligado à empresa.
create function public.contato_da_empresa(p_contato uuid, p_cliente uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contato_clientes cc join public.contatos ct on ct.id = cc.contato_id
    where cc.contato_id = p_contato and cc.cliente_id = p_cliente and ct.ativo
  )
$$;

-- ---------- Ações ----------

-- Assumir só a demanda (P2): a conversa continua com o agente até alguém assumi-la no Atendimento.
create function public.assumir_demanda(p_chamado uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype; v_nome text;
begin
  v := public.demanda_para_agir(p_chamado);
  if v.responsavel_id = auth.uid() then return; end if;
  if v.responsavel_id is not null then
    select nome into v_nome from public.usuarios where id = v.responsavel_id;
    raise exception 'A demanda já está com %.', v_nome;
  end if;
  update public.chamados
    set responsavel_id = auth.uid(),
        status = case when status = 'aberto' then 'em_andamento'::public.status_chamado else status end
    where id = p_chamado;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id) values (p_chamado, v.cliente_id, 'assumido', auth.uid());
end $$;

create function public.definir_responsavel(p_chamado uuid, p_responsavel uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype; v_nome text;
begin
  v := public.demanda_para_agir(p_chamado);
  if v.responsavel_id is not distinct from p_responsavel then return; end if;
  if p_responsavel is not null and not public.pode_ser_responsavel(p_responsavel, v.setor_id) then
    raise exception 'Escolha uma pessoa ativa do setor da demanda.';
  end if;
  update public.chamados set responsavel_id = p_responsavel where id = p_chamado;
  select nome into v_nome from public.usuarios where id = p_responsavel;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    values (p_chamado, v.cliente_id, 'responsavel_alterado', auth.uid(), v_nome);
end $$;

-- Mesma assinatura de antes (o Atendimento usa); agora com evento e sem mexer em demanda concluída. A pausa é do gatilho.
create or replace function public.alterar_status_chamado(p_chamado uuid, p_status public.status_chamado) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype;
begin
  if p_status = 'concluido' then raise exception 'use concluir_chamado'; end if;
  v := public.demanda_para_agir(p_chamado);
  if v.status = p_status then return; end if;
  update public.chamados set status = p_status where id = p_chamado;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    values (p_chamado, v.cliente_id, 'status_alterado', auth.uid(), p_status::text);
end $$;

-- Prioridade nova sem prazo escolhido: o prazo é recalculado a partir de agora (P4). Prazo à mão nunca muda a prioridade.
create function public.definir_prioridade_prazo(
  p_chamado uuid, p_prioridade public.prioridade_demanda default null, p_prazo timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype; v_prazo timestamptz;
begin
  v := public.demanda_para_agir(p_chamado);
  if p_prazo is not null and p_prazo <= now() then raise exception 'O prazo precisa ser depois de agora.'; end if;
  if p_prioridade is not null and p_prioridade <> v.prioridade then
    v_prazo := coalesce(p_prazo, public.calcular_prazo(p_prioridade, now()));
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

-- Reabrir: volta para Nova e ganha prazo novo (com o antigo, nasceria vencida).
create function public.reabrir_demanda(p_chamado uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype; v_prazo timestamptz;
begin
  v := public.demanda_para_agir(p_chamado, false);
  if v.status <> 'concluido' then raise exception 'A demanda já está aberta.'; end if;
  v_prazo := public.calcular_prazo(v.prioridade, now());
  update public.chamados set status = 'aberto', concluido_em = null, prazo_em = v_prazo, prazo_pausado_desde = null where id = p_chamado;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id) values (p_chamado, v.cliente_id, 'reaberto', auth.uid());
  if v_prazo is not null then
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, texto)
      values (p_chamado, v.cliente_id, 'prazo_alterado', public.texto_prazo(v_prazo));
  end if;
end $$;

-- Título, descrição (resumo) e contato na empresa. Contato só é conferido quando muda (pode ter sido arquivado depois).
create function public.editar_demanda(p_chamado uuid, p_titulo text, p_descricao text, p_contato uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.chamados%rowtype;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_descricao text := btrim(coalesce(p_descricao, ''));
  v_mudou text[] := '{}';
begin
  v := public.demanda_para_agir(p_chamado, false);
  if char_length(v_titulo) not between 3 and 120 then raise exception 'O título precisa ter de 3 a 120 caracteres.'; end if;
  if char_length(v_descricao) > 4000 then raise exception 'A descrição pode ter até 4000 caracteres.'; end if;
  if p_contato is not null and p_contato is distinct from v.contato_id
     and (v.cliente_id is null or not public.contato_da_empresa(p_contato, v.cliente_id)) then
    raise exception 'Escolha um contato desta empresa.';
  end if;
  if v_titulo <> v.titulo then v_mudou := array_append(v_mudou, 'título'); end if;
  if v_descricao <> v.resumo then v_mudou := array_append(v_mudou, 'descrição'); end if;
  if p_contato is distinct from v.contato_id then v_mudou := array_append(v_mudou, 'contato'); end if;
  if cardinality(v_mudou) = 0 then return; end if;
  update public.chamados set titulo = v_titulo, resumo = v_descricao, contato_id = p_contato where id = p_chamado;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    values (p_chamado, v.cliente_id, 'editado', auth.uid(), array_to_string(v_mudou, ', '));
end $$;

-- Nova demanda pela equipe (ligação, e-mail, balcão). Empresa e setor obrigatórios (P10); prazo vazio = sugerido pelo banco.
create function public.criar_demanda(
  p_cliente uuid, p_setor uuid, p_titulo text, p_descricao text,
  p_prioridade public.prioridade_demanda default 'normal', p_prazo timestamptz default null,
  p_responsavel uuid default null, p_contato uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_descricao text := btrim(coalesce(p_descricao, ''));
  v_id uuid;
  v_numero bigint;
begin
  if not public.eh_usuario_ativo() then raise exception 'Acesso desativado.'; end if;
  if char_length(v_titulo) not between 3 and 120 then raise exception 'O título precisa ter de 3 a 120 caracteres.'; end if;
  if char_length(v_descricao) > 4000 then raise exception 'A descrição pode ter até 4000 caracteres.'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente and ativo) then raise exception 'Escolha uma empresa ativa.'; end if;
  if not exists (select 1 from public.setores where id = p_setor and ativo) then raise exception 'Escolha o setor.'; end if;
  if not public.eh_admin() and p_setor not in (select public.meus_setores()) then raise exception 'Escolha um dos seus setores.'; end if;
  if p_prazo is not null and p_prazo <= now() then raise exception 'O prazo precisa ser depois de agora.'; end if;
  if p_responsavel is not null and not public.pode_ser_responsavel(p_responsavel, p_setor) then
    raise exception 'Escolha uma pessoa ativa do setor da demanda.';
  end if;
  if p_contato is not null and not public.contato_da_empresa(p_contato, p_cliente) then raise exception 'Escolha um contato desta empresa.'; end if;
  insert into public.chamados (cliente_id, setor_id, responsavel_id, contato_id, titulo, resumo, prioridade, prazo_em, origem, criado_por)
    values (p_cliente, p_setor, p_responsavel, p_contato, v_titulo, v_descricao, coalesce(p_prioridade, 'normal'), p_prazo, 'equipe', auth.uid())
    returning id, numero into v_id, v_numero;
  return jsonb_build_object('id', v_id, 'numero', v_numero);
end $$;

-- ---------- Lista da tela (tabela, quadro, contadores e CSV leem daqui) ----------

-- security_invoker: o RLS de chamados vale para quem consulta (atendente só vê os seus setores).
create view public.demandas_lista with (security_invoker = true) as
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
  (c.status <> 'concluido' and c.prazo_pausado_desde is null and c.prazo_em < now()) as vencida
from public.chamados c
left join public.clientes cl on cl.id = c.cliente_id
left join public.setores s on s.id = c.setor_id
left join public.usuarios r on r.id = c.responsavel_id
left join public.contatos ct on ct.id = c.contato_id
left join public.usuarios cp on cp.id = c.criado_por;
grant select on public.demandas_lista to authenticated;

-- Busca por texto no título e na descrição (spec 6.6); ordenação por atualização e prazo.
create extension if not exists pg_trgm with schema extensions;
create index chamados_titulo_trgm_idx on public.chamados using gin (titulo extensions.gin_trgm_ops);
create index chamados_resumo_trgm_idx on public.chamados using gin (resumo extensions.gin_trgm_ops);
create index chamados_atualizado_idx on public.chamados (atualizado_em desc);
create index chamados_prazo_idx on public.chamados (prazo_em) where status <> 'concluido';

-- ---------- Permissões ----------

revoke all on function public.demanda_para_agir(uuid, boolean), public.pode_ser_responsavel(uuid, uuid),
  public.contato_da_empresa(uuid, uuid) from public, anon, authenticated;
revoke all on function public.definir_visao_demandas(text), public.assumir_demanda(uuid), public.definir_responsavel(uuid, uuid),
  public.alterar_status_chamado(uuid, public.status_chamado),
  public.definir_prioridade_prazo(uuid, public.prioridade_demanda, timestamptz), public.reabrir_demanda(uuid),
  public.editar_demanda(uuid, text, text, uuid),
  public.criar_demanda(uuid, uuid, text, text, public.prioridade_demanda, timestamptz, uuid, uuid)
  from public, anon;
grant execute on function public.definir_visao_demandas(text), public.assumir_demanda(uuid), public.definir_responsavel(uuid, uuid),
  public.alterar_status_chamado(uuid, public.status_chamado),
  public.definir_prioridade_prazo(uuid, public.prioridade_demanda, timestamptz), public.reabrir_demanda(uuid),
  public.editar_demanda(uuid, text, text, uuid),
  public.criar_demanda(uuid, uuid, text, text, public.prioridade_demanda, timestamptz, uuid, uuid)
  to authenticated;

-- ---------- Última atualização: empresa e "fora do contrato" também contam (sobra da Task 1) ----------

create or replace function public.chamados_antes_alterar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pausa interval;
begin
  if new.status = 'aguardando_cliente' and old.status <> 'aguardando_cliente' then
    -- Entrou em "Com o cliente": o prazo para de correr.
    new.prazo_pausado_desde := now();
  elsif old.status = 'aguardando_cliente' and new.status <> 'aguardando_cliente' then
    -- Saiu: o prazo anda o tempo útil parado (concluir não mexe; prazo trocado na mesma mudança também não).
    if new.status <> 'concluido' and old.prazo_pausado_desde is not null and new.prazo_em is not null
       and new.prazo_em is not distinct from old.prazo_em then
      v_pausa := public.tempo_util_entre(old.prazo_pausado_desde, now());
      if v_pausa > interval '0' then
        new.prazo_em := public.somar_tempo_util(old.prazo_em, v_pausa);
        insert into public.chamado_eventos (chamado_id, cliente_id, tipo, texto)
          values (new.id, new.cliente_id, 'prazo_alterado', public.texto_prazo(new.prazo_em));
      end if;
    end if;
    new.prazo_pausado_desde := null;
  elsif new.status = 'aguardando_cliente' and new.prazo_em is distinct from old.prazo_em then
    -- Prazo trocado durante a pausa: a pausa conta a partir de agora.
    new.prazo_pausado_desde := now();
  end if;
  if new.prazo_em is distinct from old.prazo_em then new.alertado_vencimento_em := null; end if;
  -- Última atualização: só o que a equipe vê (marcas internas, como alertado_fila_em, não contam).
  if (new.status, new.prioridade, new.prazo_em, new.responsavel_id, new.setor_id, new.titulo, new.resumo, new.contato_id, new.pedido_venda, new.cliente_id, new.fora_do_contrato)
     is distinct from
     (old.status, old.prioridade, old.prazo_em, old.responsavel_id, old.setor_id, old.titulo, old.resumo, old.contato_id, old.pedido_venda, old.cliente_id, old.fora_do_contrato) then
    new.atualizado_em := now();
  end if;
  return new;
end $$;
