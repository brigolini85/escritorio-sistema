// Telas de três colunas abrem com o menu recolhido (spec 4.3; Assistente, 7C.3). Abrir o menu ali vale só até sair da tela (P17).
export function telaComMenuRecolhido(caminho: string): boolean {
  return caminho === '/atendimento' || caminho.startsWith('/atendimento/') || caminho === '/assistente';
}

/** Qual tela de menu recolhido está aberta: trocar de uma para a outra também esquece o "aberto aqui" (D13). */
export function telaRecolhida(caminho: string): string | null {
  return telaComMenuRecolhido(caminho) ? caminho.split('/')[1] ?? null : null;
}

export function menuRecolhidoVisivel(caminho: string, preferido: boolean, abertoNaTela: boolean): boolean {
  return telaComMenuRecolhido(caminho) ? !abertoNaTela : preferido;
}
