/**
 * Painel do pedido na tela do Assistente (Parte G4, spec 7C.3). Os dados do pedido vêm da prévia mostrada na conversa,
 * nunca do banco (D2: o "sim" grava exatamente essa prévia). Os da demanda (origem, histórico, selo) vêm do que já está
 * gravado e a pessoa pode ler: demandas_lista e chamado_eventos (D3, D4, D5).
 */
import { formatarData, formatarHora } from './formatos';
import { fraseDoEvento } from './linha-do-tempo';
import { compararPrevia, interpretarPrevias, type LinhaComparada, type PreviaInterpretada } from './previa-pedido';
import { lerArquivo, numeroDoCabecalho, type MensagemTela } from './resultados-assistente';

export type Campo = { valor: string | null; anterior: string | null; mudou: boolean };
export type ItemComparado = Extract<LinhaComparada, { tipo: 'item' }>;
export type CampoComparado = Extract<LinhaComparada, { tipo: 'campo' }>;
export type PedidoNoPainel = {
  destinatario: { rede: string | null; unidade: string | null; anterior: string | null };
  pagamento: Campo; entrega: Campo; enderecoEntrega: Campo; total: Campo;
  /** Frete, tipo de frete, transportadora, observações (o que descreverPedido escreve além dos principais). */
  outros: CampoComparado[];
  itens: ItemComparado[];
};

// Rótulos que descreverPedido (trabalhador) escreve e que têm lugar próprio no painel.
const PRINCIPAIS = ['Destinatário', 'Pagamento', 'Entrega', 'Entrega em', 'Total'];
const mesmo = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;

function campo(linhas: LinhaComparada[], rotulo: string): Campo {
  const l = linhas.find((x): x is CampoComparado => x.tipo === 'campo' && mesmo(x.rotulo, rotulo));
  if (!l) return { valor: null, anterior: null, mudou: false };
  if (l.mudanca === 'removido') return { valor: null, anterior: l.valor, mudou: true };
  return { valor: l.valor, anterior: l.anterior, mudou: l.mudanca !== 'igual' };
}

export function montarPedidoNoPainel(p: PreviaInterpretada): PedidoNoPainel {
  const linhas = compararPrevia(p);
  const dest = campo(linhas, 'Destinatário');
  // "Rede / Unidade" (descreverPedido); sem a barra, tudo é a rede.
  const [rede = null, ...resto] = (dest.valor ?? '').split(' / ').map((s) => s.trim()).filter(Boolean);
  return {
    destinatario: { rede, unidade: resto.join(' / ') || null, anterior: dest.mudou ? dest.anterior : null },
    pagamento: campo(linhas, 'Pagamento'),
    entrega: campo(linhas, 'Entrega'),
    enderecoEntrega: campo(linhas, 'Entrega em'),
    total: campo(linhas, 'Total'),
    outros: linhas.filter((l): l is CampoComparado => l.tipo === 'campo' && !PRINCIPAIS.some((r) => mesmo(r, l.rotulo))),
    itens: linhas.filter((l): l is ItemComparado => l.tipo === 'item'),
  };
}

/** Demanda do pedido como a tela lê (demandas_lista, pela regra de leitura de quem consulta). */
export type DemandaDoPedido = {
  id: string; numero: number; titulo: string; setor: string | null; empresa: string | null; status: string;
  origem: string; contato: string | null; criadoEm: string; criadoPorNome: string | null;
};

const diaMes = (iso: string) => formatarData(iso).slice(0, 5);

/** "Pedido veio de" (D3): o agente pelo WhatsApp de um contato, ou alguém da equipe pelo painel. */
export function origemDoPedido(d: DemandaDoPedido): { quem: string; como: string } {
  if (d.origem === 'agente') return { quem: d.contato ?? 'Contato sem cadastro', como: `WhatsApp · ${diaMes(d.criadoEm)}` };
  return { quem: d.criadoPorNome ?? 'Equipe', como: `Painel · ${diaMes(d.criadoEm)}` };
}

/** Evento da demanda (chamado_eventos), com quem fez. */
export type EventoPedido = { tipo: string; texto: string | null; criado_em: string; usuario_id: string | null; usuario: string | null };

/** Começo da nota interna que o trabalhador grava ao gravar a correção (assistente/ferramentas.ts, registrarNotaInterna). */
export const PREFIXO_GRAVADO = 'Pedido alterado pelo assistente a pedido de ';

const tempo = (iso: string) => new Date(iso).getTime();
const gravacao = (e: EventoPedido) => e.tipo === 'nota_interna' && (e.texto ?? '').startsWith(PREFIXO_GRAVADO);

/** Selo "Gravado às HH:MM por <pessoa>" (D5): a gravação da própria pessoa, depois da prévia mostrada. */
export function seloGravado(eventos: EventoPedido[], usuarioId: string, mostradaEm: string): { em: string; por: string } | null {
  const e = [...eventos].reverse().find((x) => gravacao(x) && x.usuario_id === usuarioId && tempo(x.criado_em) >= tempo(mostradaEm));
  return e ? { em: e.criado_em, por: e.usuario ?? 'você' } : null;
}

export type Marco = { em: string; tipo: 'abertura' | 'previa' | 'gravado' | 'arquivo' | 'evento'; texto: string };

const primeiraLinha = (t: string) => {
  const l = t.split('\n')[0]!.trim();
  return l.length > 80 ? `${l.slice(0, 79)}…` : l;
};

/** Histórico do pedido (D4): eventos da demanda + prévias e arquivos desta conversa, do mais antigo ao mais novo. */
export function historicoDoPedido(p: { demanda: DemandaDoPedido; eventos: EventoPedido[]; mensagens: MensagemTela[]; pessoa: string; podeCsv: boolean }): Marco[] {
  const marcos: Marco[] = [];
  for (const e of p.eventos) {
    if (e.tipo === 'criacao') {
      marcos.push({ em: e.criado_em, tipo: 'abertura', texto: p.demanda.origem === 'agente'
        ? `Agente abriu o pedido pelo WhatsApp${p.demanda.contato ? ` de ${p.demanda.contato}` : ''}`
        : `${e.usuario ?? p.demanda.criadoPorNome ?? 'Equipe'} abriu a demanda no painel` });
      continue;
    }
    if (gravacao(e)) {
      marcos.push({ em: e.criado_em, tipo: 'gravado', texto: `${e.usuario ?? 'Alguém da equipe'} gravou a correção pelo assistente` });
      continue;
    }
    const f = fraseDoEvento({ tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario: e.usuario }, p.demanda.origem);
    marcos.push({ em: e.criado_em, tipo: 'evento', texto: `${f.ator} ${f.acao}${f.detalhe ? `: ${primeiraLinha(f.detalhe)}` : ''}` });
  }
  for (const m of p.mensagens) {
    if (m.papel !== 'assistente') continue;
    if ((interpretarPrevias(m.conteudo) ?? []).some((x) => numeroDoCabecalho(x.cabecalho) === p.demanda.numero)) {
      marcos.push({ em: m.criado_em, tipo: 'previa', texto: `Prévia mostrada a ${p.pessoa}` });
    }
    const arquivo = p.podeCsv ? lerArquivo(m.arquivo) : null;
    if (arquivo?.chamados.includes(p.demanda.id)) marcos.push({ em: m.criado_em, tipo: 'arquivo', texto: 'CSV do Bling gerado' });
  }
  return marcos.sort((a, b) => tempo(a.em) - tempo(b.em));
}

/** Hora (hoje) ou dd/mm (outro dia), no horário de Brasília. */
export function quandoNoHistorico(iso: string, agora: Date): string {
  return formatarData(iso) === formatarData(agora) ? formatarHora(iso) : diaMes(iso);
}
