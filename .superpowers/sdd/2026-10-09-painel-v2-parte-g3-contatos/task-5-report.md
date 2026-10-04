# Task 5 report
Feito: marcarEmpresaDoContato e vincularEmpresaAoContato em contatos/acoes.ts + acoes-empresas.test.ts (brief verbatim, mais 1 teste extra: erro cru do Postgres não chega à tela).
Desvios do brief (para atender a regra de mensagem segura): erros de update/insert que não são 23505 passam por erroSeguro (P0001 -> mensagemDoBanco; resto -> "Não foi possível salvar agora. Tente de novo."), em vez de error.message cru. Revalidação acrescenta /atendimento (layout), pois a conversa aberta mostra as marcações (contato-da-conversa.tsx).
RED: vitest acoes-empresas.test.ts -> "marcarEmpresaDoContato is not a function" (acoes.ts original).
GREEN: 2 arquivos / 10 testes; suíte painel 84 arquivos / 619 testes; typecheck limpo.
Sem banco local/e2e nesta task (brief não pede).
