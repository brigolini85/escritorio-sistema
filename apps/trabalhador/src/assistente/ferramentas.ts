import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ArquivoAssistente, Repos } from '@escritorio/db';
import type { ClienteIa } from '../agente/cliente-ia';
import type { CanalWhatsApp } from '../canal/tipos';
import type { ContextoAssistente } from './contexto';

export type DepsAssistente = { repos: Repos; ia: ClienteIa; canal: CanalWhatsApp };
export type EstadoAssistente = { ctx: ContextoAssistente; resposta: string[]; arquivo: ArquivoAssistente | null; csvs: { nome: string; conteudo: string }[] };

type Resultado = { resultado: string; erro: boolean };
export const ok = (dados: object): Resultado => ({ resultado: JSON.stringify(dados), erro: false });
export const falha = (mensagem: string): Resultado => ({ resultado: JSON.stringify({ erro: mensagem }), erro: true });
export const objeto = (properties: Record<string, object>, required: string[]) =>
  ({ type: 'object' as const, properties, required, additionalProperties: false });

export const FERRAMENTAS_ASSISTENTE: Anthropic.Tool[] = [
  { name: 'responder', description: 'Envia a resposta para a pessoa da equipe.', input_schema: objeto({ texto: { type: 'string' } }, ['texto']) },
];

const Entradas = {
  responder: z.object({ texto: z.string().trim().min(1).max(4000) }),
};

async function executarValidada(_d: DepsAssistente, estado: EstadoAssistente, nome: keyof typeof Entradas, entrada: any): Promise<Resultado> {
  switch (nome) {
    case 'responder':
      estado.resposta.push(entrada.texto);
      return ok({ enviado: true });
  }
}

export async function executarFerramentaAssistente(d: DepsAssistente, estado: EstadoAssistente, nome: string, entrada: unknown): Promise<Resultado> {
  let r: Resultado;
  if (!(nome in Entradas)) r = falha(`Ferramenta desconhecida: ${nome}`);
  else {
    const v = Entradas[nome as keyof typeof Entradas].safeParse(entrada);
    r = v.success ? await executarValidada(d, estado, nome as keyof typeof Entradas, v.data) : falha(`Entrada inválida: ${v.error.issues.map((i) => i.message).join('; ')}`);
  }
  await d.repos.registrarDecisao({ conversaId: estado.ctx.conversaId, clienteId: null, etapa: `assistente:${nome}`, entrada, saida: JSON.parse(r.resultado) });
  return r;
}
