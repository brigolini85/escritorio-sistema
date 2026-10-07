/**
 * Rotas abertas sem login (segurança do login, item 1). Lista exata: "começa com" deixaria pública, sem querer,
 * qualquer rota futura de nome parecido (/entrar-x). Nenhuma delas tem sub-rotas; a barra final é tolerada.
 */
const PUBLICAS = new Set(['/entrar', '/auth/confirm', '/definir-senha', '/esqueci-senha']);

export function ehRotaPublica(caminho: string): boolean {
  const semBarraFinal = caminho.length > 1 && caminho.endsWith('/') ? caminho.slice(0, -1) : caminho;
  return PUBLICAS.has(semBarraFinal);
}
