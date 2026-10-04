// Minha mesa (spec 7C.1, Opção B): regras sem React. Tudo o que chega aqui já passou pela regra de leitura da pessoa (RLS).
import type { Niveis } from '@escritorio/core';
import { hrefSecao } from './configuracoes';
import type { Prioridade, StatusFiltro } from './demandas';
import { FUSO } from './formatos';
import { temNivel, usaAssistente } from './permissoes';

export type DemandaMesa = {
  id: string; numero: number; titulo: string; empresa: string | null; setor: string | null; status: StatusFiltro;
  prioridade: Prioridade; prazo_em: string | null; prazo_pausado_desde: string | null; vencida: boolean;
};

/** Linhas de demandas_lista (as colunas de visão chegam como possivelmente nulas). */
export function lerDemandasMesa(bruto: unknown): DemandaMesa[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.map((r: Record<string, unknown>) => ({
    id: String(r.id), numero: Number(r.numero), titulo: String(r.titulo ?? ''),
    empresa: (r.empresa as string | null) ?? null, setor: (r.setor as string | null) ?? null,
    status: ((r.status as StatusFiltro | null) ?? 'aberto'), prioridade: ((r.prioridade as Prioridade | null) ?? 'normal'),
    prazo_em: (r.prazo_em as string | null) ?? null, prazo_pausado_desde: (r.prazo_pausado_desde as string | null) ?? null,
    vencida: r.vencida === true,
  }));
}

const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Vencida · Vencem hoje · Próximos dias (D11): "Com o cliente" (pausada) e sem prazo ficam em Próximos dias. */
export function agruparPorPrazo<T extends DemandaMesa>(lista: T[], agora: Date): { vencidas: T[]; hoje: T[]; proximos: T[] } {
  const hojeSP = DIA.format(agora);
  const venceHoje = (d: T) => !d.vencida && !d.prazo_pausado_desde && d.prazo_em !== null && DIA.format(new Date(d.prazo_em)) === hojeSP;
  return {
    vencidas: lista.filter((d) => d.vencida),
    hoje: lista.filter(venceHoje),
    proximos: lista.filter((d) => !d.vencida && !venceHoje(d)),
  };
}

const STATUS_MESA: Record<StatusFiltro, string> = { aberto: 'nova', em_andamento: 'resolvendo', aguardando_cliente: 'com o cliente', concluido: 'concluída' };

/** "Mercado Central · Pessoal · resolvendo" (imagem B), em partes: a empresa vai em vinho. */
export function detalheDaDemanda(d: Pick<DemandaMesa, 'empresa' | 'setor' | 'status'>): [string, string, string] {
  return [d.empresa ?? 'sem empresa', d.setor ?? 'Triagem', STATUS_MESA[d.status]];
}

export type Atalho = { rotulo: string; href: string; icone: 'nova' | 'empresa' | 'respostas' | 'assistente' | 'notas' | 'contatos' };

/** Atalhos que a pessoa pode usar (D17): nenhum leva a "sem acesso". */
export function atalhosDaMesa(u: { papel: 'admin' | 'atendente'; niveis: Niveis }): Atalho[] {
  const lista: Atalho[] = [
    { rotulo: 'Nova demanda', href: '/demandas?nova=1', icone: 'nova' },
    { rotulo: 'Buscar empresa', href: '/clientes', icone: 'empresa' },
  ];
  if (temNivel(u, 'configuracoes', 'sim')) lista.push({ rotulo: 'Respostas prontas', href: hrefSecao('respostas'), icone: 'respostas' });
  if (usaAssistente(u)) lista.push({ rotulo: 'Assistente', href: '/assistente', icone: 'assistente' });
  if (temNivel(u, 'notas', 'ver')) lista.push({ rotulo: 'Pedidos de nota', href: '/demandas?tipo=venda', icone: 'notas' });
  lista.push({ rotulo: 'Contatos', href: '/contatos', icone: 'contatos' });
  return lista;
}

export const ROTULOS_MESA = {
  esperando: (n: number) => (n === 1 ? 'conversa esperando você' : 'conversas esperando você'),
  vencidas: (n: number) => (n === 1 ? 'minha demanda vencida' : 'minhas demandas vencidas'),
  hoje: (n: number) => (n === 1 ? 'vence hoje' : 'vencem hoje'),
  semResponsavel: (_n: number) => 'sem responsável nos meus setores',
};

export function textoConcluidasHoje(n: number): string {
  if (n === 0) return 'Você ainda não concluiu demandas hoje.';
  return n === 1 ? 'Você concluiu 1 demanda hoje.' : `Você concluiu ${n} demandas hoje.`;
}

export const textoComAgenteHoje = (n: number): string => (n === 0 ? 'nenhuma com o agente hoje' : `${n} com o agente hoje`);

export const subtituloMinhas = (total: number): string => `${total} comigo · ordenadas pelo que vence primeiro`;
