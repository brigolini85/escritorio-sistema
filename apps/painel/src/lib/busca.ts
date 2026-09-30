// Busca global do painel (Ctrl/Cmd + K): regras puras. As consultas ficam em app/api/busca/route.ts (RLS do usuário).

import { mascararCNPJ } from './formatos';

export const MINIMO_BUSCA = 2;
export const LIMITE_POR_GRUPO = 5;
/** Texto mais longo que isso é cortado: evita filtros ilike enormes. */
export const MAXIMO_BUSCA = 80;

export type ConsultaBusca = {
  /** Texto seguro para o filtro `or`/`ilike` do PostgREST (sem vírgula, parênteses, *, %, aspas, barra invertida). */
  termo: string;
  /** Só os dígitos (CNPJ, telefone); vazio se não houver. */
  digitos: string;
  /** Número da demanda quando a busca é "#123" ou "123". */
  numero: number | null;
};

export type ItemBusca = { id: string; titulo: string; detalhe: string; href: string };
export type ResultadoBusca = { empresas: ItemBusca[]; contatos: ItemBusca[]; demandas: ItemBusca[] };

export const RESULTADO_VAZIO: ResultadoBusca = { empresas: [], contatos: [], demandas: [] };

/**
 * Texto seguro para um filtro `or`/`ilike` do PostgREST: vírgula, parênteses, * e aspas têm significado no `or`;
 * % e \ mudam o ilike. Viram espaço (espaços repetidos viram um), e o texto é cortado em `MAXIMO_BUSCA`.
 * Usado pela busca global, pela lista de conversas e pelas listas de clientes e contatos.
 */
export function termoSeguroPostgrest(texto: string | null | undefined): string {
  return (texto ?? '').slice(0, MAXIMO_BUSCA).replace(/[,()*%\\"]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Interpreta o que foi digitado (cortado em 80 caracteres); null se for curto demais (menos de 2) ou não sobrar nada buscável. */
export function interpretarBusca(q: string | null | undefined): ConsultaBusca | null {
  const bruto = (q ?? '').trim().slice(0, MAXIMO_BUSCA).trim();
  if (bruto.length < MINIMO_BUSCA) return null;
  const m = /^#?\s*(\d{1,12})$/.exec(bruto);
  const numero = m ? Number(m[1]) : null;
  const termo = termoSeguroPostgrest(bruto.replace(/^#/, ''));
  if (!termo) return null;
  return { termo, digitos: termo.replace(/\D/g, ''), numero };
}

export function linkEmpresa(id: string): string {
  return `/clientes/${id}`;
}

/** A lista de contatos filtra por ?q= (nome ou telefone); o telefone é único. */
export function linkContato(telefone: string): string {
  return `/contatos?q=${encodeURIComponent(telefone)}`;
}

/** Demanda com conversa abre a conversa; sem conversa, a lista de demandas. */
export function linkDemanda(d: { conversa_id: string | null }): string {
  return d.conversa_id ? `/atendimento/${d.conversa_id}` : '/demandas';
}

const STATUS: Record<string, string> = {
  aberto: 'Aberta',
  em_andamento: 'Em andamento',
  aguardando_cliente: 'Aguardando cliente',
  concluido: 'Concluída',
};

type EmpresaLinha = { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string };
type ContatoLinha = { id: string; nome: string; telefone: string };
type DemandaLinha = {
  id: string; numero: number; titulo: string; status: string; conversa_id: string | null;
  clientes: { razao_social: string; nome_fantasia: string | null } | null;
};

export function itemEmpresa(e: EmpresaLinha): ItemBusca {
  const detalhe = [e.nome_fantasia ? e.razao_social : null, `CNPJ ${mascararCNPJ(e.cnpj)}`].filter(Boolean).join(' · ');
  return { id: e.id, titulo: e.nome_fantasia ?? e.razao_social, detalhe, href: linkEmpresa(e.id) };
}

export function itemContato(c: ContatoLinha): ItemBusca {
  return { id: c.id, titulo: c.nome, detalhe: c.telefone, href: linkContato(c.telefone) };
}

export function itemDemanda(d: DemandaLinha): ItemBusca {
  const empresa = d.clientes ? d.clientes.nome_fantasia ?? d.clientes.razao_social : null;
  const detalhe = [empresa, STATUS[d.status] ?? d.status].filter(Boolean).join(' · ');
  return { id: d.id, titulo: `#${d.numero} ${d.titulo}`, detalhe, href: linkDemanda(d) };
}
