/**
 * "Ensinar o agente" no Atendimento: a situação vem das últimas mensagens do cliente e a orientação nasce como
 * "Situação: …\nO que fazer: …". O texto do cliente não é confiável: vira instrução da equipe depois de salvo, por isso
 * a orientação nasce desligada (alguém revisa e liga) e, nas linhas citadas do cliente (e no título sugerido a partir
 * delas), os sinais < e > viram ‹ e ›. O texto da equipe fica como foi escrito: o trabalhador troca < e > ao montar o prompt.
 */

/** Quantas mensagens do cliente entram na situação e até quantos caracteres cada uma. */
export const MENSAGENS_SITUACAO = 5;
export const LIMITE_MENSAGEM_SITUACAO = 200;
const LIMITE_TITULO_SUGERIDO = 60;
const PALAVRAS_TITULO = 8;
export const TITULO_PADRAO = 'Situação no atendimento';

/** < e > viram ‹ e › (o texto não abre nem fecha marcações no prompt). */
export function neutralizar(texto: string): string {
  return texto.replace(/</g, '‹').replace(/>/g, '›');
}

function cortar(texto: string, limite: number): string {
  return texto.length > limite ? `${texto.slice(0, limite - 1).trimEnd()}…` : texto;
}

/** Últimas mensagens do cliente (na ordem da conversa) como linhas citadas: Cliente: “…”. */
export function situacaoDasMensagens(mensagens: (string | null | undefined)[]): string {
  return mensagens
    .map((m) => (m ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(-MENSAGENS_SITUACAO)
    .map((m) => `Cliente: “${cortar(neutralizar(m), LIMITE_MENSAGEM_SITUACAO)}”`)
    .join('\n');
}

/** Título sugerido: as primeiras palavras da situação (sem o "Cliente: “" da citação). */
export function sugerirTitulo(situacao: string): string {
  const linha = situacao.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  // Tira só a citação da linha (Cliente: “…”); aspas que o cliente escreveu ficam.
  const limpa = neutralizar(linha.replace(/^Cliente:\s*“?/i, '').replace(/”$/, '')).replace(/\s+/g, ' ').trim();
  const palavras = limpa.split(' ').filter(Boolean).slice(0, PALAVRAS_TITULO).join(' ');
  const titulo = cortar(palavras.replace(/[\s.,;:!?…-]+$/, ''), LIMITE_TITULO_SUGERIDO);
  return titulo || TITULO_PADRAO;
}

const normalizar = (t: string) => t.replace(/\r\n?/g, '\n').trim();

/** Texto da orientação: "Situação: …\nO que fazer: …" (sem situação, só "O que fazer: …"). Mesmo resultado no navegador e no servidor. */
export function comporTexto(situacao: string, fazer: string): string {
  const s = normalizar(situacao);
  const f = normalizar(fazer);
  return s ? `Situação: ${s}\nO que fazer: ${f}` : `O que fazer: ${f}`;
}
