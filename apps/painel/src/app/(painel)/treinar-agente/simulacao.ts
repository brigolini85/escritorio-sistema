import { MODOS_CONTATO } from '@escritorio/core';
import { z } from 'zod';
import { TIPOS, type TipoOrientacao } from '../../../lib/orientacoes';
import { ehUuid, type DadosOrientacao } from './esquemas';

/**
 * "Testar o agente" (spec 2026-09-30 §4 e §5): o que o painel manda para criar_simulacao e como lê o resultado que o
 * trabalhador grava em simulacoes_agente (fila simular_agente, apps/trabalhador/src/agente/simular.ts).
 */

export const LIMITE_MENSAGEM_TESTE = 2000;
/** Quanto o painel espera a resposta. O banco considera abandonado um teste pendente há mais de 5 minutos. */
export const PRAZO_ESPERA_MS = 5 * 60_000;
/** Consulta de reserva enquanto pendente, caso o tempo real não entregue o evento. */
export const INTERVALO_CONSULTA_MS = 3000;

export const MENSAGEM_FALHA_TESTE = 'Não consegui fazer o teste agora. Tente de novo em alguns minutos.';
export const MENSAGEM_SEM_RESPOSTA = 'O agente não respondeu a tempo. Tente de novo em alguns minutos.';
export const MENSAGEM_FILA_FORA = 'Não consegui mandar o teste para o agente agora. Tente de novo em alguns minutos.';
export const MENSAGEM_TESTE_PENDENTE = 'Você já tem um teste em andamento: a resposta dele aparece aqui. Depois dela, teste de novo.';
/** Começo da mensagem do banco quando a pessoa já tem um teste pendente (criar_simulacao). */
export const ERRO_BANCO_PENDENTE = 'Já existe um teste em andamento';

const uuidOuNulo = z.string().nullable().refine((v) => v === null || ehUuid(v), 'Rascunho da orientação inválido.');

/** Rascunho da orientação no formato que criar_simulacao aceita (só estas chaves; o banco valida de novo). */
export const RascunhoTeste = z.object({
  id: uuidOuNulo,
  titulo: z.string(),
  texto: z.string(),
  tipo: z.enum(TIPOS as [TipoOrientacao, ...TipoOrientacao[]], { message: 'Escolha o tipo da orientação.' }),
  cliente_id: uuidOuNulo,
  setor_id: uuidOuNulo,
}).strict();
export type RascunhoTeste = z.infer<typeof RascunhoTeste>;

/** Pedido do Dialog de teste. Mesmas mensagens do banco; quebras de linha do navegador (CRLF) contam como uma. */
export const PedidoTeste = z.object({
  mensagem: z.string().transform((t) => t.replace(/\r\n/g, '\n').trim())
    .pipe(z.string().min(1, 'Escreva a mensagem do cliente para o teste.')
      .max(LIMITE_MENSAGEM_TESTE, `A mensagem de teste pode ter no máximo ${LIMITE_MENSAGEM_TESTE} caracteres.`)),
  clienteId: z.string().nullable().refine((v) => v === null || ehUuid(v), 'Empresa não encontrada.'),
  rascunho: RascunhoTeste.nullable(),
  skillId: z.string().nullish().refine((v) => !v || ehUuid(v), 'Skill não encontrada.'),
  /** I3b (D11): endereço do agente do setor e o modo de falar com o cliente. */
  agente: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, 'Agente não encontrado.').nullish(),
  modo: z.enum(MODOS_CONTATO).nullish(),
});
export type PedidoTeste = z.input<typeof PedidoTeste>;

/** O formulário da orientação (ainda sem salvar) vira o rascunho do teste; `id` quando edita uma orientação salva. */
export function rascunhoDoFormulario(d: DadosOrientacao, id: string | null): RascunhoTeste {
  return { id, titulo: d.titulo, texto: d.texto, tipo: d.tipo, cliente_id: d.clienteId, setor_id: d.setorId };
}

export type RespostasSimulacao = {
  mensagens: string[];
  acoes: { ferramenta: string; resumo: string }[];
  observacoes: string[];
};

const textos = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);

/** Lê `respostas` sem confiar no formato (jsonb): o que não for texto fica de fora. */
export function lerRespostas(json: unknown): RespostasSimulacao {
  const o = json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  const acoes = Array.isArray(o.acoes)
    ? o.acoes.flatMap((a) => {
      const x = a && typeof a === 'object' ? (a as Record<string, unknown>) : {};
      return typeof x.resumo === 'string' && x.resumo.trim() ? [{ ferramenta: typeof x.ferramenta === 'string' ? x.ferramenta : '', resumo: x.resumo }] : [];
    })
    : [];
  return { mensagens: textos(o.mensagens), acoes, observacoes: textos(o.observacoes) };
}

export type LinhaSimulacao = { id: string; status: string; mensagem: string; criado_em: string; respostas: unknown; erro: string | null };

export type ResultadoTeste =
  | { fase: 'pensando' }
  | { fase: 'pronta'; respostas: RespostasSimulacao }
  | { fase: 'erro'; erro: string };

/** Fase do teste pela linha do banco (o "não respondeu a tempo" é decidido pelo relógio de quem espera). */
export function resultadoDaLinha(l: Pick<LinhaSimulacao, 'status' | 'respostas' | 'erro'>): ResultadoTeste {
  if (l.status === 'pronta') return { fase: 'pronta', respostas: lerRespostas(l.respostas) };
  if (l.status === 'erro') return { fase: 'erro', erro: l.erro?.trim() || MENSAGEM_FALHA_TESTE };
  return { fase: 'pensando' };
}

/**
 * Até quando esperar um teste (epoch ms). Pelo `criado_em` do banco (um teste retomado já esperou parte do prazo),
 * mas nunca menos de 30 s nem mais que o prazo inteiro a partir de agora (relógios diferentes).
 */
export function prazoDoTeste(criadoEm: string, agora: number): number {
  const peloBanco = Date.parse(criadoEm) + PRAZO_ESPERA_MS;
  if (!Number.isFinite(peloBanco)) return agora + PRAZO_ESPERA_MS;
  return Math.min(Math.max(peloBanco, agora + 30_000), agora + PRAZO_ESPERA_MS);
}
