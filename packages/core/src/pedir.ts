import { LIMITES_DRIVE } from './drive';
import { TEXTO_MOTIVO_PAUSA, type MotivoPausa } from './tarefas';

/** Parte I4 (spec 7E.5): o que o painel, o Assistente e os avisos dividem sobre "pedir ao agente". */
export const semAcento = (t: string): string => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// D2: verbos de pedido (sem acento). Largo de propósito: o falso positivo só oferece a ferramenta; quem decide é o modelo.
const VERBOS = /\b(pede|pedir|peca|manda|mande|mandar|solicita|solicite|solicitar|encaminha|encaminhe|encaminhar|coloca|coloque|bota|faz|faca|fazer|roda|rode|rodar|prepara|prepare|preparar|confere|confira|conferir)\b/;
const OUTROS_NOMES = ['dp', 'departamento pessoal', 'contabilidade'];

/** D2: a mensagem parece um pedido de trabalho a um agente (verbo de pedido + "agente" ou o nome de um setor). */
export function ehPedidoAoAgente(texto: string, setores: readonly string[]): boolean {
  const t = semAcento(texto ?? '');
  if (!VERBOS.test(t)) return false;
  if (/\bagentes?\b/.test(t)) return true;
  return [...setores.map(semAcento), ...OUTROS_NOMES].some((n) => n.length >= 2 && new RegExp(`\\b${escapar(n)}\\b`).test(t));
}

const limparNome = (t: string) => semAcento(t).replace(/\b(o|a|do|da|pro|pra|para|agente)\b/g, ' ').replace(/\s+/g, ' ').trim();

/** O agente que a pessoa citou, só entre os que ela pode pedir (D5). */
export function acharAgente<T extends { nome: string; setor: string }>(texto: string, agentes: readonly T[]):
  { ok: true; agente: T } | { ok: false; erro: string } {
  if (agentes.length === 0) {
    return { ok: false, erro: 'Você não pode pedir tarefas a nenhum agente agora (seus setores, o estado dos agentes ou a sua permissão).' };
  }
  const alvo = limparNome(texto);
  const iguais = agentes.filter((a) => alvo !== '' && (limparNome(a.setor) === alvo || limparNome(a.nome) === alvo));
  const achados = iguais.length ? iguais
    : agentes.filter((a) => alvo !== '' && (alvo.includes(limparNome(a.setor)) || limparNome(a.nome).includes(alvo)));
  if (achados.length === 1) return { ok: true, agente: achados[0]! };
  if (achados.length > 1) return { ok: false, erro: `Mais de um agente serve: ${achados.map((a) => a.nome).join(', ')}. Diga qual.` };
  return { ok: false, erro: `Não achei esse agente entre os que você pode pedir: ${agentes.map((a) => a.nome).join(', ')}.` };
}

export const PRAZO_DESEJADO_MAX_DIAS = 90;
const PRAZO_INVALIDO = 'Prazo inválido (use DD/MM/AAAA ou DD/MM/AAAA HH:MM).';
/** D7: "DD/MM/AAAA" (vale 18h) ou "DD/MM/AAAA HH:MM", hora de Brasília (sem horário de verão desde 2019). */
export function lerPrazoDesejado(texto: string, agora: Date): { ok: true; iso: string } | { ok: false; erro: string } {
  const m = /^\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?\s*$/.exec(texto ?? '');
  if (!m) return { ok: false, erro: PRAZO_INVALIDO };
  const dia = Number(m[1]), mes = Number(m[2]), ano = Number(m[3]), hora = Number(m[4] ?? '18'), minuto = Number(m[5] ?? '00');
  const conferida = new Date(Date.UTC(ano, mes - 1, dia));
  if (conferida.getUTCFullYear() !== ano || conferida.getUTCMonth() !== mes - 1 || conferida.getUTCDate() !== dia || hora > 23 || minuto > 59) {
    return { ok: false, erro: PRAZO_INVALIDO };
  }
  const t = new Date(Date.UTC(ano, mes - 1, dia, hora + 3, minuto));
  if (t.getTime() <= agora.getTime() || t.getTime() > agora.getTime() + PRAZO_DESEJADO_MAX_DIAS * 86_400_000) {
    return { ok: false, erro: 'O prazo desejado precisa ser depois de agora e em até 90 dias.' };
  }
  return { ok: true, iso: t.toISOString() };
}

/** D7: a subpasta da pasta do cliente (nomes, não links); o trabalhador procura por nome, só dentro da pasta do cliente (I3b). */
export function lerSubpasta(texto: string | null | undefined): { ok: true; valor: string | null } | { ok: false; erro: string } {
  const partes = (texto ?? '').split('/').map((p) => p.trim()).filter(Boolean);
  if (partes.length === 0) return { ok: true, valor: null };
  if (partes.length > LIMITES_DRIVE.profundidade || partes.some((p) => p === '.' || p === '..' || p.length > 100)) {
    return { ok: false, erro: 'Subpasta inválida: use nomes separados por /, até 3 níveis.' };
  }
  return { ok: true, valor: partes.join('/') };
}

export type CustoEstimado = { n: number; min: number | null; max: number | null; limite: number };
const usd = (v: number) => v.toFixed(2).replace('.', ',');
/** D13: a faixa do meio das últimas tarefas do agente; com menos de 3, o limite por tarefa. */
export function textoCustoEstimado(c: CustoEstimado): string {
  if (c.n >= 3 && c.min !== null && c.max !== null) {
    const faixa = c.min === c.max ? `US$ ${usd(c.min)}` : `US$ ${usd(c.min)}–${usd(c.max)}`;
    return `Tarefa de trabalho: costuma custar ${faixa}; entra em Gastos com IA.`;
  }
  return `Tarefa de trabalho: até US$ ${usd(c.limite)} por tarefa (o limite do agente); entra em Gastos com IA.`;
}

export const rotuloTarefa = (n: number): string => `T-${String(n).padStart(4, '0')}`;

/** D10: avisos pelo WhatsApp (o banco usa os mesmos números em registrar_avisos_da_tarefa). */
export const LIMITES_AVISOS = { porPessoaDia: 20, escritorioDia: 100, horasSegurado: 24 } as const;

/** D9: quem falta aprovar (o responsável da demanda, se houver; senão o setor). */
export function quemAprova(p: { responsavel: string | null; pedeNoSetor: boolean; setor: string | null }): string {
  const setor = p.setor ?? 'setor';
  if (p.responsavel) return `Falta ${p.responsavel} aprovar no painel.`;
  return p.pedeNoSetor ? `Falta você ou alguém do ${setor} aprovar no painel.` : `Falta alguém do ${setor} aprovar no painel.`;
}

const cabecalho = (p: { agente: string; tarefa: number; demanda: number; empresa?: string | null }) =>
  `${p.agente} · ${rotuloTarefa(p.tarefa)} (demanda #${p.demanda}${p.empresa ? `, ${p.empresa}` : ''})`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export type PerguntaAoAnalista = { numero: number; pergunta: string; detalhe: string | null; opcoes: string[] };
/** D9: as perguntas para quem pediu (respondidas ali mesmo, D11) e quantas são do cliente (só com aprovação no painel). */
export function mensagemPendencias(p: { tarefa: number; agente: string; demanda: number; empresa: string | null; setor: string | null;
  analista: PerguntaAoAnalista[]; cliente: number }): string {
  const setor = p.setor ?? 'setor';
  const doCliente = `${plural(p.cliente, 'pendência do cliente', 'pendências do cliente')}: o pedido ao cliente só sai quando alguém do ${setor} aprovar no painel.`;
  if (p.analista.length === 0) return `${cabecalho(p)}\nParei em ${doCliente}`;
  const linhas = p.analista.map((q) =>
    `${q.numero}. ${q.pergunta}${q.detalhe ? ` — ${q.detalhe}` : ''}${q.opcoes.length ? ` (${q.opcoes.join(' / ')})` : ''}`);
  const exemplo = p.analista[0]!;
  return [
    cabecalho(p),
    `Tenho ${plural(p.analista.length, 'pergunta', 'perguntas')} para você:`,
    ...linhas,
    `Responda aqui mesmo (ex.: "${exemplo.numero}: ${exemplo.opcoes.at(-1) ?? 'sua resposta'}") ou na tarefa, no painel.`,
    ...(p.cliente > 0 ? [`E ${doCliente}`] : []),
  ].join('\n');
}

/** D9, D12: o rascunho pronto, a planilha anexa e quem falta aprovar (nada vale antes da aprovação no painel). */
export function mensagemPronta(p: { tarefa: number; agente: string; demanda: number; empresa: string | null; resumo: string;
  linhas: number; provisorias: number; comPlanilha: boolean; quemAprova: string }): string {
  const resumo = p.resumo.length > 600 ? `${p.resumo.slice(0, 599)}…` : p.resumo;
  const linhas = `${plural(p.linhas, 'linha', 'linhas')} no rascunho${p.provisorias ? `, ${plural(p.provisorias, 'provisória', 'provisórias')}` : ''}.`;
  return [cabecalho(p), `Pronto: ${resumo}`, `${linhas}${p.comPlanilha ? ' A planilha vai anexa.' : ''}`, p.quemAprova].join('\n');
}

export function mensagemPausada(p: { tarefa: number; agente: string; demanda: number; motivo: MotivoPausa }): string {
  return `${cabecalho(p)}\n${TEXTO_MOTIVO_PAUSA[p.motivo]} Veja na tarefa, no painel.`;
}
