import type Anthropic from '@anthropic-ai/sdk';
import { ASSUNTO_OUTRO } from '@escritorio/core';
import type { AgenteSetor } from '@escritorio/db';
import { limparTextoOrientacao } from './orientacoes';

/** Parte I2 (D1): o que o Thiago sabe dos agentes dos setores ativos para este contato. Fora do bloco com cache (depende do contato). */
export const CABECALHO_AGENTES_SETOR =
  'AGENTES DOS SETORES (valem só nesta conversa). Estes setores têm um agente que atende com você. Quando o pedido do cliente for de um destes '
  + 'setores (inclusive pedido de nota e dúvida técnica do setor, regras 2, 3 e 3a), chame chamar_agente antes de responder sobre o assunto ou '
  + `abrir demanda nele, com o agente, o assunto da lista que melhor combina (ou "${ASSUNTO_OUTRO}") e o pedido em poucas palavras. `
  + 'O resultado diz o que fazer em seguida. Saudações, agradecimentos, assunto sensível (regra 11) e assuntos de outros setores continuam com você.';

const limpo = (t: string) => limparTextoOrientacao(t).replace(/\s+/g, ' ').trim();
function linha(a: AgenteSetor): string {
  const assuntos = a.regras.length
    ? a.regras.map((r) => `"${limpo(r.assunto)}"${r.exemplo.trim() ? ` (ex.: "${limpo(r.exemplo)}")` : ''}`).join('; ')
    : `nenhum com regra: use "${ASSUNTO_OUTRO}"`;
  return `- agente: ${a.slug} | ${limpo(a.nome)} | setor ${limpo(a.setor)}\n  assuntos: ${assuntos}`;
}

/** null quando não há agente ativo: o pedido do Thiago fica igual ao de antes (retratos da I1). */
export function secaoAgentesSetor(agentes: readonly AgenteSetor[]): string | null {
  return agentes.length ? `${CABECALHO_AGENTES_SETOR}\n${agentes.map(linha).join('\n')}` : null;
}

export const FERRAMENTA_CHAMAR_AGENTE: Anthropic.Tool = {
  name: 'chamar_agente',
  description: 'Passa o assunto ao agente do setor (lista AGENTES DOS SETORES). O sistema decide se ele responde ao cliente, conduz a conversa '
    + 'ou devolve a resposta para você repassar. Uma chamada por vez.',
  input_schema: {
    type: 'object',
    properties: {
      agente: { type: 'string', description: 'O "agente" da lista, ex.: fiscal.' },
      assunto: { type: 'string', description: `Um assunto da lista do agente, escrito igual, ou "${ASSUNTO_OUTRO}".` },
      pedido: { type: 'string', description: 'O que o cliente quer, em poucas palavras.' },
    },
    required: ['agente', 'assunto', 'pedido'],
    additionalProperties: false,
  },
};
