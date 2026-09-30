/**
 * "Digite o nome para confirmar" do ConfirmDialog: espaços extras e maiúsculas/minúsculas não importam,
 * acentos importam (o nome tem que ser o mesmo). Texto esperado vazio nunca confirma.
 */
export function textoConfere(digitado: string, esperado: string): boolean {
  const normal = (t: string) => t.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
  const alvo = normal(esperado);
  return alvo.length > 0 && normal(digitado) === alvo;
}
