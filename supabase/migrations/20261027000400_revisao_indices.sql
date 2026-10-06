-- Revisão geral, área 1, I4: índices para as regras de leitura do Atendimento e as junções frequentes.
-- pode_ver_conversa_de ("meus_setores") procura as demandas da conversa de QUALQUER status; o único índice em
-- chamados(conversa_id) era parcial (status <> 'concluido') e não servia: cada conversa varria chamados inteira, em toda
-- leitura de caixa_entrada / contatos_lista e em cada mensagem do Realtime. O índice completo também atende as consultas
-- que filtram status <> 'concluido', então o parcial sai. Os demais são das colunas usadas em RLS e junções (FKs sem índice).
-- pode_ver_conversa não foi reescrita: com o índice, a busca vira uma leitura de índice por conversa e o portão 22 fica igual.

create index chamados_conversa_completo_idx on public.chamados (conversa_id);
drop index public.chamados_conversa_idx;
create index chamados_responsavel_idx on public.chamados (responsavel_id);
create index chamados_setor_idx on public.chamados (setor_id);
create index chamados_cliente_idx on public.chamados (cliente_id);
create index chamados_contato_idx on public.chamados (contato_id);
create index conversas_atendente_idx on public.conversas (atendente_id);
create index conversas_contato_idx on public.conversas (contato_id);
