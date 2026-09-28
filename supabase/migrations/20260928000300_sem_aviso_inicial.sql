-- O dono não quer mensagem automática de privacidade no primeiro contato (2026-09-28).
-- Vazio = o trabalhador não envia. Só troca se o texto ainda for um dos padrões; edição pelo painel é preservada.
update public.configuracoes
set mensagens = jsonb_set(mensagens, '{aviso_lgpd}', to_jsonb(''::text))
where id = 1
  and mensagens->>'aviso_lgpd' in (
    'Olá! Suas mensagens ficam registradas para podermos te atender melhor.',
    'Olá! Este atendimento é feito com apoio de inteligência artificial e a conversa fica registrada para podermos te atender melhor. Sempre que precisar, uma pessoa da nossa equipe assume.'
  );
