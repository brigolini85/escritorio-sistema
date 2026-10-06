/** I3b (D11, D17): Testar no painel para os agentes dos setores. */
export const TEXTO_TESTE_TRABALHO = 'Agente de trabalho: para testar, deixe-o em Teste e peça uma tarefa numa demanda de teste (em Teste, só o dono e o administrador pedem).';
export const TEXTO_TESTE_SEM_I3B = 'O teste deste agente no painel aparece quando a atualização do banco da Parte I3b for aplicada.';
export const TEXTO_TESTE_SETOR = 'Escreva como cliente e veja o que o agente responderia no modo escolhido. Nada é enviado nem gravado; o custo conta em Gastos com IA como "Testar o agente", neste agente.';

/** D19: entram sozinhas no tipo Trabalho (a lista do trabalhador em src/tarefa/ferramentas.ts). Nenhuma envia ao cliente. */
export const FERRAMENTAS_DAS_TAREFAS = [
  { rotulo: 'Ler os arquivos da tarefa', descricao: 'PDF, XML, CSV, TXT, OFX e imagem; só leitura.' },
  { rotulo: 'Ler os dados cadastrais da empresa', descricao: 'Razão social, CNPJ, regime e endereço; nunca honorários nem acessos.' },
  { rotulo: 'Marcar etapas e anotar', descricao: 'A barra de etapas e o que falta, para a próxima vez.' },
  { rotulo: 'Abrir pendência', descricao: 'Para o cliente (uma pessoa do setor manda) ou para o analista.' },
  { rotulo: 'Entregar o resultado', descricao: 'Rascunho com a fonte de cada valor; só vale com a aprovação.' },
];
