-- Aviso de privacidade padrão sem mencionar IA (decisão do dono, 2026-09-28).
-- Só troca se ainda for o texto original: uma edição feita pelo painel é preservada.
update public.configuracoes
set mensagens = jsonb_set(mensagens, '{aviso_lgpd}',
  to_jsonb('Olá! Suas mensagens ficam registradas para podermos te atender melhor.'::text))
where id = 1
  and mensagens->>'aviso_lgpd' = 'Olá! Este atendimento é feito com apoio de inteligência artificial e a conversa fica registrada para podermos te atender melhor. Sempre que precisar, uma pessoa da nossa equipe assume.';
