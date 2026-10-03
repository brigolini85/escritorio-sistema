// Atendimento (spec 7A.1): grupos da lista, cronômetro de espera, linha de estado e prévia. Sem React: testável.
import { ehPedidoDoCliente } from '@escritorio/core';
import { formatarData } from './formatos';

export type LimitesEspera = { verde: number; ambar: number };
export const LIMITES_PADRAO: LimitesEspera = { verde: 5, ambar: 15 };

/** Colunas da caixa_entrada que a lista usa (as da Parte E incluídas). */
export type LinhaAtendimento = {
  id: string; telefone: string; nome_contato: string | null; empresa: string | null;
  estado: 'agente' | 'humano' | null; atendente_id: string | null;
  ultima_mensagem: string | null; ultima_em: string | null; ultima_tipo: string | null; ultima_autor: string | null; ultima_transcricao: string | null;
  chamados_abertos: number | null; aguardando_pessoa_desde: string | null; motivo_pessoa: string | null; concluida_em: string | null;
  espera_desde: string | null; esperando_pessoa: boolean | null; esperando_voce: boolean | null; nao_lidas: number | null;
  contato_pausado: boolean | null; empresa_pausada: boolean | null; agente_respondendo: boolean | null;
};

const ms = (iso: string | null): number => (iso ? new Date(iso).getTime() : Number.NaN);

/** Concluída hoje (Brasília), ninguém esperando e o cliente não escreveu depois (decisão 10). */
export function concluidaHoje(l: Pick<LinhaAtendimento, 'concluida_em' | 'esperando_pessoa' | 'ultima_autor' | 'ultima_em'>, agora: Date): boolean {
  if (!l.concluida_em || l.esperando_pessoa) return false;
  if (formatarData(l.concluida_em) !== formatarData(agora)) return false;
  return !(l.ultima_autor === 'cliente' && ms(l.ultima_em) > ms(l.concluida_em));
}

/** Esperando pessoa (quem espera há mais tempo primeiro; sem cronômetro por último) · Com o agente · Concluídas hoje. */
export function agruparConversas<T extends LinhaAtendimento>(linhas: T[], agora: Date): { esperando: T[]; comAgente: T[]; concluidasHoje: T[] } {
  const chave = (l: T) => (l.espera_desde ? ms(l.espera_desde) : Number.POSITIVE_INFINITY);
  const recente = (a: T, b: T) => (ms(b.ultima_em) || 0) - (ms(a.ultima_em) || 0);
  const esperando = linhas.filter((l) => l.esperando_pessoa).sort((a, b) => (chave(a) - chave(b)) || recente(a, b));
  const resto = linhas.filter((l) => !l.esperando_pessoa);
  return {
    esperando,
    comAgente: resto.filter((l) => !concluidaHoje(l, agora)),
    concluidasHoje: resto.filter((l) => concluidaHoje(l, agora)),
  };
}

export function minutosDeEspera(desde: string, agora: number): number {
  return Math.max(0, Math.floor((agora - new Date(desde).getTime()) / 60_000));
}

export function corDaEspera(min: number, l: LimitesEspera): 'verde' | 'ambar' | 'vermelho' {
  return min <= l.verde ? 'verde' : min <= l.ambar ? 'ambar' : 'vermelho';
}

export function textoEspera(min: number): string {
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
  return `${Math.floor(min / (24 * 60))} d`;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O cronômetro para o leitor de tela: a cor nunca fala sozinha (spec 4.6). */
export function rotuloEsperaLeitor(min: number): string {
  if (min < 1) return 'esperando há menos de 1 minuto';
  if (min < 60) return `esperando há ${plural(min, 'minuto', 'minutos')}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `esperando há ${plural(h, 'hora', 'horas')}${m ? ` e ${plural(m, 'minuto', 'minutos')}` : ''}`;
}

export const textoNaoLidas = (n: number): string => (n > 9 ? '9+' : String(n));

/** limites_espera() do banco; qualquer coisa estranha (ou fora do horário: null) vira o padrão. */
export function lerLimites(v: unknown): LimitesEspera {
  const o = v as { verde?: unknown; ambar?: unknown } | null;
  return o && typeof o.verde === 'number' && typeof o.ambar === 'number' && o.ambar > o.verde ? { verde: o.verde, ambar: o.ambar } : LIMITES_PADRAO;
}

export type TipoEstado = 'pessoa' | 'pausado' | 'pedido' | 'passou' | 'respondendo' | 'resolvido' | 'agente';

/** A linha de estado de cada conversa (decisão 11): a primeira que valer. */
export function linhaDeEstado(
  l: LinhaAtendimento,
  ctx: { usuarioId: string; nomes: Map<string, string>; pausaGeral: boolean | null },
): { tipo: TipoEstado; texto: string } {
  if (l.estado === 'humano') {
    return { tipo: 'pessoa', texto: l.atendente_id === ctx.usuarioId ? 'com você' : `com ${(l.atendente_id && ctx.nomes.get(l.atendente_id)) || 'a equipe'}` };
  }
  if (ctx.pausaGeral) return { tipo: 'pausado', texto: 'agente pausado' };
  if (l.empresa_pausada) return { tipo: 'pausado', texto: 'agente pausado para esta empresa' };
  if (l.contato_pausado) return { tipo: 'pausado', texto: 'agente pausado para este contato' };
  if (l.aguardando_pessoa_desde) {
    return ehPedidoDoCliente(l.motivo_pessoa)
      ? { tipo: 'pedido', texto: 'pediu para falar com pessoa' }
      : { tipo: 'passou', texto: `agente passou: ${l.motivo_pessoa || 'sem motivo registrado'}` };
  }
  if (l.agente_respondendo) return { tipo: 'respondendo', texto: 'respondendo' };
  if (l.ultima_autor === 'agente' && (l.chamados_abertos ?? 0) === 0) return { tipo: 'resolvido', texto: 'resolvido pelo agente' };
  return { tipo: 'agente', texto: 'com o agente' };
}

/** Prévia da última mensagem: áudio mostra a transcrição (spec 7A.1); a do agente leva "Agente:". */
export function previaDaUltima(l: Pick<LinhaAtendimento, 'ultima_tipo' | 'ultima_mensagem' | 'ultima_transcricao' | 'ultima_autor' | 'ultima_em'>): string {
  if (l.ultima_tipo === 'audio') return l.ultima_transcricao ? `Áudio: “${l.ultima_transcricao}”` : 'Áudio';
  const texto = l.ultima_mensagem?.trim();
  if (!texto) return l.ultima_em ? 'Anexo' : 'Sem mensagens';
  return l.ultima_autor === 'agente' ? `Agente: ${texto}` : texto;
}

/** "Carla Mendes" → "CM"; sem letras (só o telefone) → "#". */
export function iniciais(nome: string): string {
  const palavras = nome.split(/\s+/).filter((p) => /\p{L}/u.test(p));
  if (palavras.length === 0) return '#';
  const primeira = palavras[0]![0]!;
  const ultima = palavras.length > 1 ? palavras.at(-1)![0]! : '';
  return (primeira + ultima).toLocaleUpperCase('pt-BR');
}
