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
