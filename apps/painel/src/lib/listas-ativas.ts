import 'server-only';
import { nomeEmpresa } from './contatos';
import { lerEmPaginas } from './paginas';
import type { supabaseServidor } from './supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/**
 * Revisão geral (painel I4): os seletores de empresa e de contato liam "tudo" numa ida só, e o PostgREST corta em 1000
 * linhas sem erro (a empresa 1001 sumia do seletor). Agora leem em páginas (até 10.000) e dizem quando a lista veio
 * incompleta (`parcial`) ou com erro (`erro`), para a tela avisar em vez de mostrar uma lista menor como se fosse inteira.
 */
export type ListaAtiva<T> = { linhas: T[]; parcial: boolean; erro: boolean };
const MAX_PAGINAS = 10;

/** Empresas ativas por razão social; `detalhe` é o CNPJ (a busca do EscolherEmpresa). */
export async function lerEmpresasAtivasDoSeletor(sb: Sb): Promise<ListaAtiva<{ id: string; nome: string; detalhe: string }>> {
  const r = await lerEmPaginas((de, ate) => sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj').eq('ativo', true)
    .order('razao_social').order('id').range(de, ate), { maxPaginas: MAX_PAGINAS });
  if (r.error) console.error('[listas] empresas ativas', r.error);
  return { linhas: r.data.map((c) => ({ id: c.id, nome: nomeEmpresa(c), detalhe: c.cnpj })), parcial: r.parcial, erro: r.error !== null };
}

/** Contatos ativos por nome (o "vincular contato existente" da empresa). */
export async function lerContatosAtivos(sb: Sb): Promise<ListaAtiva<{ id: string; nome: string; telefone: string }>> {
  const r = await lerEmPaginas((de, ate) => sb.from('contatos').select('id, nome, telefone').eq('ativo', true)
    .order('nome').order('id').range(de, ate), { maxPaginas: MAX_PAGINAS });
  if (r.error) console.error('[listas] contatos ativos', r.error);
  return { linhas: r.data.map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone })), parcial: r.parcial, erro: r.error !== null };
}

/** Aviso curto para a tela quando a lista do seletor não veio inteira. */
export function avisoDaLista(l: { parcial: boolean; erro: boolean }, oQue: 'empresas' | 'contatos'): string | null {
  if (l.erro) return `Não consegui carregar todas as ${oQue} agora. Recarregue a página antes de escolher.`;
  if (l.parcial) return `Mostrando só as primeiras ${(MAX_PAGINAS * 1000).toLocaleString('pt-BR')} ${oQue} (em ordem alfabética); as outras não aparecem nesta lista.`;
  return null;
}
