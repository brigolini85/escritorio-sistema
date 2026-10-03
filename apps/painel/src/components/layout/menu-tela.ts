// Telas de três colunas abrem com o menu recolhido (spec 4.3). Abrir o menu ali vale só até sair da tela (P17).
export function telaComMenuRecolhido(caminho: string): boolean {
  return caminho === '/atendimento' || caminho.startsWith('/atendimento/');
}

export function menuRecolhidoVisivel(caminho: string, preferido: boolean, abertoNaTela: boolean): boolean {
  return telaComMenuRecolhido(caminho) ? !abertoNaTela : preferido;
}
