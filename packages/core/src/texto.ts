export function formatarMensagem(modelo: string, variaveis: Record<string, string>): string {
  return modelo.replace(/\{(\w+)\}/g, (inteiro, nome: string) => variaveis[nome] ?? inteiro);
}
