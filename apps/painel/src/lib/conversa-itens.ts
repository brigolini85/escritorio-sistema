// Conversa aberta (spec 7A.1): "por quê?" das respostas do agente, cartões de decisão e marcos. Sem React: testável.
import { rotuloEtapa } from './decisoes';
import { ROTULO_PRIORIDADE } from './demandas';
import { AVISO_SEM_ACESSO_PEDIDO } from './pedido-nota';

export type DecisaoBruta = { id: string; etapa: string; entrada: unknown; saida: unknown; justificativa: string | null; criado_em: string; turno: string | null };

/** Ferramentas que gravam ou passam para pessoa: viram cartão de decisão na conversa (decisão 5). */
export const ETAPAS_DE_ACAO = new Set([
  'abrir_chamado', 'abrir_pedido_nota', 'sinalizar_nao_entendido', 'passar_para_pessoa', 'alterar_preco', 'cadastrar_produto', 'enviar_documento', 'selecionar_empresa',
]);
/** Etapas cujo conteúdo é o pedido de nota (P11). */
export const ETAPAS_DE_PEDIDO = new Set(['resumir_pedido_nota', 'abrir_pedido_nota']);

export function ocultarPedidoDasDecisoes<D extends DecisaoBruta>(d: D[], verPedidos: boolean): D[] {
  if (verPedidos) return d;
  return d.map((x) => (ETAPAS_DE_PEDIDO.has(x.etapa) ? { ...x, entrada: null, saida: { aviso: AVISO_SEM_ACESSO_PEDIDO } } : x));
}

const tempo = (iso: string) => new Date(iso).getTime();

function porTurno(decisoes: DecisaoBruta[]): Map<string, DecisaoBruta[]> {
  const m = new Map<string, DecisaoBruta[]>();
  for (const d of [...decisoes].sort((a, b) => tempo(a.criado_em) - tempo(b.criado_em))) {
    if (!d.turno) continue;
    m.set(d.turno, [...(m.get(d.turno) ?? []), d]);
  }
  return m;
}

/** Para a última mensagem do agente de cada turno: as decisões do turno, menos o próprio "responder". */
export function porQueDasMensagens(
  mensagens: { id: string; autor: string; turno_agente: string | null; criado_em: string }[],
  decisoes: DecisaoBruta[],
): Map<string, DecisaoBruta[]> {
  const turnos = porTurno(decisoes);
  const ultima = new Map<string, { id: string; t: number }>();
  for (const m of mensagens) {
    if (m.autor !== 'agente' || !m.turno_agente) continue;
    const atual = ultima.get(m.turno_agente);
    if (!atual || tempo(m.criado_em) >= atual.t) ultima.set(m.turno_agente, { id: m.id, t: tempo(m.criado_em) });
  }
  const r = new Map<string, DecisaoBruta[]>();
  for (const [turno, { id }] of ultima) {
    const ds = (turnos.get(turno) ?? []).filter((d) => d.etapa !== 'responder');
    if (ds.length) r.set(id, ds);
  }
  return r;
}

export function resumoPorQue(d: DecisaoBruta[]): string {
  return [...new Set(d.map((x) => rotuloEtapa(x.etapa).toLocaleLowerCase('pt-BR')))].join(' · ');
}

function detalheDaSaida(d: DecisaoBruta): string {
  const s = (d.saida ?? {}) as Record<string, unknown>;
  if (typeof s.numero === 'number' && typeof s.setor === 'string') return `#${s.numero} no ${s.setor}`;
  if (typeof s.documento === 'string') return s.documento;
  if (typeof s.empresa === 'string') return s.empresa;
  return '';
}

export type CartaoDecisao = { id: string; turno: string; criado_em: string; linha: string };

/** Um cartão por turno que teve ação (abriu demanda, passou para pessoa, enviou documento…). */
export function cartoesDeDecisao(decisoes: DecisaoBruta[]): CartaoDecisao[] {
  const r: CartaoDecisao[] = [];
  for (const [turno, ds] of porTurno(decisoes)) {
    const acoes = ds.filter((d) => ETAPAS_DE_ACAO.has(d.etapa));
    if (!acoes.length) continue;
    const linha = acoes.map((d) => { const x = detalheDaSaida(d); return `${rotuloEtapa(d.etapa)}${x ? ` (${x})` : ''}`; }).join(' → ');
    r.push({ id: `cartao-${turno}`, turno, criado_em: acoes[0]!.criado_em, linha });
  }
  return r;
}

export type Marco = { id: string; criado_em: string; texto: string };
type EventoConversa = { id: string; tipo: string; texto: string | null; criado_em: string; usuario: string | null };

const TEXTO_EVENTO: Record<string, (e: EventoConversa) => string> = {
  passou_para_pessoa: (e) => `O agente passou para uma pessoa: ${e.texto || 'sem motivo registrado'}`,
  assumida: (e) => `${e.usuario ?? 'Alguém da equipe'} assumiu`,
  devolvida: (e) => `Devolvido ao agente${e.usuario ? ` por ${e.usuario}` : ''}`,
  concluida: (e) => `Atendimento concluído${e.usuario ? ` por ${e.usuario}` : ''}`,
  empresa_trocada: (e) => (e.texto ? `Empresa trocada: ${e.texto}` : 'Empresa trocada'),
};

/** Marcos centralizados na conversa (decisão 6). Nunca mostram título nem texto de pedido (P11). */
export function marcosDaConversa(p: {
  eventos: EventoConversa[];
  demandas: { id: string; numero: number; setor: string | null; prioridade: string; criado_em: string; concluido_em: string | null }[];
  transferencias: { id: string; numero: number; setor: string | null; criado_em: string }[];
}): Marco[] {
  const prioridade = (v: string) => (ROTULO_PRIORIDADE[v as keyof typeof ROTULO_PRIORIDADE] ?? v).toLocaleLowerCase('pt-BR');
  return [
    ...p.eventos.flatMap((e) => (TEXTO_EVENTO[e.tipo] ? [{ id: `evento-${e.id}`, criado_em: e.criado_em, texto: TEXTO_EVENTO[e.tipo]!(e) }] : [])),
    ...p.demandas.map((d) => ({ id: `aberta-${d.id}`, criado_em: d.criado_em, texto: `Demanda #${d.numero} aberta ${d.setor ? `no ${d.setor}` : 'na Triagem'} · ${prioridade(d.prioridade)}` })),
    ...p.demandas.flatMap((d) => (d.concluido_em ? [{ id: `concluida-${d.id}`, criado_em: d.concluido_em, texto: `Demanda #${d.numero} concluída` }] : [])),
    ...p.transferencias.map((t) => ({ id: `transferida-${t.id}`, criado_em: t.criado_em, texto: `Demanda #${t.numero} transferida para ${t.setor ?? 'outro setor'}` })),
  ];
}

/** Aba AGENTE: grupos por turno (sem turno: cada decisão sozinha), o mais novo primeiro. */
export function agruparPorTurno(decisoes: DecisaoBruta[]): { turno: string | null; criado_em: string; decisoes: DecisaoBruta[] }[] {
  const grupos: { turno: string | null; criado_em: string; decisoes: DecisaoBruta[] }[] = [];
  for (const [turno, ds] of porTurno(decisoes)) grupos.push({ turno, criado_em: ds[0]!.criado_em, decisoes: ds });
  for (const d of decisoes.filter((x) => !x.turno)) grupos.push({ turno: null, criado_em: d.criado_em, decisoes: [d] });
  return grupos.sort((a, b) => tempo(b.criado_em) - tempo(a.criado_em));
}

/** "Ver decisão" da faixa de passagem: o turno mais novo até a passagem. */
export function ultimoTurnoAntes(decisoes: DecisaoBruta[], ate: string | null): string | null {
  if (!ate) return null;
  const antes = decisoes.filter((d) => d.turno && tempo(d.criado_em) <= tempo(ate)).sort((a, b) => tempo(b.criado_em) - tempo(a.criado_em));
  return antes[0]?.turno ?? null;
}
