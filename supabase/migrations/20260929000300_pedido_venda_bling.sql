-- Pedido de venda para importar no Bling (pedido do dono, 2026-09-29).
-- A demanda de nota de venda guarda os dados do pedido; o comprador (endereço, CEP...) é lido do cadastro na hora de gerar o arquivo.
alter table public.parceiros_unidades
  add column numero text,
  add column complemento text,
  add column cep text check (cep is null or cep ~ '^\d{8}$'),
  add column telefone text;

alter table public.chamados add column pedido_venda jsonb;
