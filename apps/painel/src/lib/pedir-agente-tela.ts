import { LIMITES_TAREFA, leituraDoArquivo, textoCustoEstimado, type CustoEstimado } from '@escritorio/core';

export type AgenteParaPedirTela = { id: string; nome: string; descricao: string; setor: string; estado: 'teste' | 'ligado';
  destino: 'esta_demanda' | 'nova'; procedimentos: { nome: string; titulo: string; descricao: string }[]; custo: CustoEstimado | null };
export type DadosPedir = { i4: boolean; agentes: AgenteParaPedirTela[]; whatsapp: string | null; donoVeTodos: boolean };
export const TEXTO_SEM_I4 = 'Prazo, avisos e pedir sem demanda aparecem quando a atualização do banco da Parte I4 for aplicada.';

/** D6: a pessoa vê onde a tarefa vai cair antes de enviar. */
export const textoDestino = (a: Pick<AgenteParaPedirTela, 'destino' | 'setor'>, demandaNumero: number | null): string =>
  a.destino === 'esta_demanda' && demandaNumero !== null ? `Nesta demanda #${demandaNumero}` : `Demanda nova no ${a.setor}`;
export const textoCusto = (a: Pick<AgenteParaPedirTela, 'custo'>): string | null => (a.custo ? textoCustoEstimado(a.custo) : null);
export function podeEnviar(p: { agenteId: string; pedido: string; temEmpresa: boolean; destino: 'esta_demanda' | 'nova' | null }): boolean {
  return p.agenteId !== '' && p.pedido.trim().length >= 3 && (p.destino === 'esta_demanda' || p.temEmpresa);
}
/** O mesmo que o compartimento "tarefas" aceita (I3a, D14): recusa antes de criar a tarefa. */
export function arquivosRecusados(arquivos: { name: string; size: number }[]): string[] {
  if (arquivos.length > LIMITES_TAREFA.arquivos) return ['No máximo 30 arquivos por tarefa.'];
  return arquivos.flatMap((a) => !leituraDoArquivo(a.name) ? [`${a.name}: o agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.`]
    : a.size > LIMITES_TAREFA.arquivoBytes ? [`${a.name}: passa de 10 MB.`] : []);
}
