-- Auditoria 6.2: depois de carregar uma cópia, nada pode ser reenviado aos clientes. A cópia pode ter até 7 dias: o que
-- estava "para sair" naquele instante quase certamente já saiu de verdade (ou deixou de fazer sentido).
-- O restaurar.ts roda este arquivo na MESMA transação da carga dos dados, antes do commit (não há instante em que o banco
-- restaurado tenha saídas pendentes visíveis) e com o trabalhador desligado. Parâmetros (set local):
--   copia.momento: início da cópia (manifesto.criada_em);
--   copia.ambiente: o ambiente que o banco deve ter ('' = deixa o da cópia).
-- Pode rodar sozinho (psql) num banco já restaurado: sem copia.momento, vale "agora".

-- 1. Saídas que estavam pendentes ou incertas viram "falhou" (a pessoa vê e decide se manda de novo), com a nota na
--    conversa ("Por que o agente fez isso?").
with marcadas as (
  update public.mensagens set status_envio = 'falhou', envio_reservado_em = null
   where direcao = 'saida' and status_envio in ('pendente', 'incerto')
  returning id, conversa_id, cliente_id
)
insert into public.decisoes_agente (conversa_id, cliente_id, etapa, saida, justificativa)
select conversa_id, (array_agg(cliente_id) filter (where cliente_id is not null))[1], 'restauracao',
       jsonb_build_object('mensagens', jsonb_agg(id order by id)),
       'restauração: saída que estava pendente ou sem confirmação na cópia ficou como falhou e não foi reenviada.'
  from marcadas group by conversa_id;

-- 2. Entradas de cliente não processadas, mais antigas que a cópia, ficam processadas, com a decisão "restauracao"
--    (o agente não responde de novo a mensagens de dias atrás).
with marcadas as (
  update public.mensagens set processada_em = now(), turno_agente_entrada = null, turno_agente_entrada_em = null
   where direcao = 'entrada' and processada_em is null
     and criado_em < coalesce(nullif(current_setting('copia.momento', true), '')::timestamptz, now())
  returning id, conversa_id, cliente_id
)
insert into public.decisoes_agente (conversa_id, cliente_id, etapa, entrada, justificativa)
select conversa_id, (array_agg(cliente_id) filter (where cliente_id is not null))[1], 'restauracao',
       jsonb_build_object('mensagens', jsonb_agg(id order by id)),
       'restauração: mensagem do cliente sem resposta na cópia ficou como processada, sem resposta automática.'
  from marcadas group by conversa_id;

-- 3. Fila do pg-boss: nenhum job esperando, repetindo ou rodando (enviar-mensagem, processar-conversa, avisos...). O
--    histórico (concluídos, falhos) fica. Sem o esquema pgboss (projeto novo), nada: o trabalhador cria na partida.
do $$
begin
  if to_regclass('pgboss.job') is not null then
    delete from pgboss.job where state in ('created', 'retry', 'active');
  end if;
end $$;

-- 4. Outros envios guardados para depois também não saem sozinhos:
--    Radar aprovado e não enviado;
update public.radar_envios set estado = 'nao_enviado', reservado_em = null where estado = 'aguardando';
--    aviso de tarefa ao WhatsApp da equipe (o mesmo "não enviado por falha" do batimento);
update public.agente_tarefa_avisos set estado = 'nao_enviado', motivo = 'falha'
 where canal = 'whatsapp' and estado in ('pendente', 'segurado', 'enviando');
--    pedido ao cliente aprovado e não enviado: o batimento só retoma pedidos das últimas 24 h; o pedido passa a contar
--    como de mais de 24 h atrás e a pessoa pede de novo pelo painel, se ainda fizer sentido.
update public.agente_pendencias set pedido_em = least(pedido_em, now() - interval '25 hours'), pedido_enviado_em = null
 where estado = 'aberta' and pedido_em is not null and mensagem_id is null;

-- 5. Travas e instâncias do trabalhador são do processo que rodava na época: somem.
delete from public.travas_trabalhador;
delete from public.instancias_trabalhador;

-- 6. Ambiente do banco (Auditoria 4.3): a cópia da produção traz 'producao'; numa homologação ou no banco local, o
--    trabalhador de lá se recusaria a consumir. O restaurar.ts manda --ambiente, ou o que o destino já tinha.
update public.configuracoes set ambiente = current_setting('copia.ambiente', true)
 where id = 1 and coalesce(current_setting('copia.ambiente', true), '') <> '';
