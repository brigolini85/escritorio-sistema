-- Setores novos do Treinar o agente: IRPF, Comercial e Direção (os mesmos criados à mão em homologação).
-- Idempotente pelo NOME: setor que já existe não é tocado (nem a descrição, que a equipe pode ter ajustado na tela).
-- Rodar em cada ambiente ANTES do seed das orientações (orientacoes-skill-dono.sql), que fala desses setores.
-- Homologação já tem os três; em produção, rodar uma vez, com aprovação do dono:
--   psql "<Session pooler do ambiente>" -v ON_ERROR_STOP=1 -f supabase/dados/setores-novos.sql

begin;

insert into public.setores (nome, descricao_assuntos) values
  ('IRPF', 'Imposto de renda pessoa física: declaração, restituição, malha fina de pessoa física, carnê-leão, venda de imóvel ou bem com lucro (ganho de capital), aluguel recebido, espólio'),
  ('Comercial', 'Quem ainda não é cliente: abrir empresa com o escritório, trocar de contador para o escritório, orçamento, serviços fora do contrato'),
  ('Direção', 'Reclamação séria, possível erro do escritório, pedido de cancelamento ou troca de contador, fiscalização no local, intimação com prazo curto ou valor alto, assunto sensível (pedidos fora da regra), pedido de parecer estratégico e casos que não se encaixam em outro setor')
on conflict (nome) do nothing;

commit;
