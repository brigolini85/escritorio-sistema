/** Mensagens do banco (raise exception) que dizem "inativa"; no painel o cadastro é "arquivado". */
const TROCAS: Record<string, string> = {
  'Esta empresa está inativa. Escolha outra empresa ou reative o cadastro.':
    'Esta empresa está arquivada. Escolha outra empresa ou traga o cadastro de volta.',
};

/** Texto para a pessoa a partir da mensagem do banco: usa o vocabulário do painel, sem mudar o banco. */
export function mensagemDoBanco(mensagem: string): string {
  return TROCAS[mensagem] ?? mensagem;
}
