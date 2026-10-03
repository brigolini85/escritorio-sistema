export type PrecoModelo = { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number };
export type UsoTokens = { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number };

/** Preços em US$ por milhão de tokens. */
export function calcularCustoUsd(uso: UsoTokens, preco: PrecoModelo): number {
  return (
    uso.entrada * preco.entrada +
    uso.saida * preco.saida +
    uso.cacheLeitura * preco.cacheLeitura +
    uso.cacheEscrita * preco.cacheEscrita
  ) / 1_000_000;
}

/** Quem gastou com IA (uso_ia.funcionalidade, spec 7B.2). A regra do banco (20261005000400) tem a mesma lista. */
export const FUNCIONALIDADES_IA = [
  'agente_clientes', 'assistente_site', 'assistente_whatsapp', 'sugerir_resposta',
  'testar_agente', 'transcricao_audio', 'especialista_setor', 'nao_identificado',
] as const;
export type FuncionalidadeIa = (typeof FUNCIONALIDADES_IA)[number];

/** O que o código pode gravar: 'nao_identificado' é só dos registros antigos (gasto novo assim é bug, Prompt F). */
export type FuncionalidadeGravavel = Exclude<FuncionalidadeIa, 'nao_identificado'>;

/** uso_ia.provedor (regra do banco 20261006000100). */
export const PROVEDORES_IA = ['anthropic', 'groq'] as const;
export type ProvedorIa = (typeof PROVEDORES_IA)[number];

/** Tokens de uma resposta da Anthropic (input_tokens já não inclui os de cache). */
export function usoDaResposta(u: {
  input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null;
}): UsoTokens {
  return { entrada: u.input_tokens, saida: u.output_tokens, cacheLeitura: u.cache_read_input_tokens ?? 0, cacheEscrita: u.cache_creation_input_tokens ?? 0 };
}

/** Transcrição: US$ por minuto de Configurações (P9). Sem preço ou sem duração, 0 (a tela avisa). */
export function custoTranscricaoUsd(segundos: number | null, custoMinutoUsd: number | null): number {
  if (!segundos || !custoMinutoUsd || segundos <= 0 || custoMinutoUsd <= 0) return 0;
  return Math.round((segundos / 60) * custoMinutoUsd * 1_000_000) / 1_000_000;
}

/**
 * Empresa de um gasto com IA (uso_ia.cliente_id), a mesma regra em todo caminho: a empresa em foco, se é do contato;
 * senão a única empresa do contato; senão nenhuma (várias empresas sem foco não viram a primeira da lista).
 */
export function empresaDoUso(clienteEmFoco: string | null, empresas: readonly { id: string }[]): string | null {
  if (clienteEmFoco && empresas.some((e) => e.id === clienteEmFoco)) return clienteEmFoco;
  return empresas.length === 1 ? empresas[0]!.id : null;
}
