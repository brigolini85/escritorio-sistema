// apps/painel/src/lib/arquivados.ts
import 'server-only';
import { NOME_ANONIMIZADO, type TipoCadastro } from './arquivo';
import { mascararCNPJ, mascararTelefone } from './formatos';
import type { supabaseServidor } from './supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
export type LinhaArquivada = { id: string; nome: string; detalhe: string | null; arquivadoEm: string | null; arquivadoPor: string | null };
export type FiltroArquivados = { clienteId?: string; tipoParceiro?: 'cliente' | 'fornecedor' };
type Bruta = { id: string; nome: string; detalhe: string | null; arquivado_em: string | null; arquivado_por: string | null };
type Lida = { brutas: Bruta[]; erro: boolean };

const RECENTES = { ascending: false, nullsFirst: false } as const;
const lida = <T,>(r: { data: T[] | null; error: unknown }, mapa: (l: T) => Bruta): Lida => ({ brutas: (r.data ?? []).map(mapa), erro: Boolean(r.error) });

async function lerBrutas(sb: Sb, tipo: TipoCadastro, f: FiltroArquivados): Promise<Lida> {
  switch (tipo) {
    case 'cliente':
      return lida(await sb.from('clientes').select('id, razao_social, cnpj, arquivado_em, arquivado_por').eq('ativo', false).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.razao_social, detalhe: `CNPJ ${mascararCNPJ(l.cnpj)}`, arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
    case 'contato':
      // Contato anonimizado (LGPD) não é "arquivado": não aparece nem volta.
      return lida(await sb.from('contatos').select('id, nome, telefone, arquivado_em, arquivado_por').eq('ativo', false).neq('nome', NOME_ANONIMIZADO).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.nome, detalhe: mascararTelefone(l.telefone), arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
    case 'usuario':
      return lida(await sb.from('usuarios').select('id, nome, email, arquivado_em, arquivado_por').eq('ativo', false).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.nome, detalhe: l.email, arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
    case 'produto':
      return lida(await sb.from('produtos').select('id, codigo, descricao, arquivado_em, arquivado_por').eq('cliente_id', f.clienteId!).eq('ativo', false).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.descricao, detalhe: `Código ${l.codigo}`, arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
    case 'rede':
      return lida(await sb.from('parceiros_grupos').select('id, nome, arquivado_em, arquivado_por').eq('cliente_id', f.clienteId!).eq('tipo', f.tipoParceiro!).eq('ativo', false).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.nome, detalhe: null, arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
    case 'unidade':
      return lida(await sb.from('parceiros_unidades').select('id, nome_unidade, arquivado_em, arquivado_por, parceiros_grupos!inner(nome, tipo)')
        .eq('cliente_id', f.clienteId!).eq('parceiros_grupos.tipo', f.tipoParceiro!).eq('ativo', false).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.nome_unidade, detalhe: `Unidade de ${l.parceiros_grupos.nome}`, arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
  }
}

/** Arquivados de um tipo, mais recentes primeiro, com o nome de quem arquivou. */
export async function lerArquivados(sb: Sb, tipo: TipoCadastro, filtro: FiltroArquivados = {}): Promise<{ linhas: LinhaArquivada[]; erro: boolean }> {
  const { brutas, erro } = await lerBrutas(sb, tipo, filtro);
  if (erro) console.error('[arquivados] falha ao ler', tipo);
  const ids = [...new Set(brutas.flatMap((l) => (l.arquivado_por ? [l.arquivado_por] : [])))];
  const { data: pessoas } = ids.length ? await sb.from('usuarios').select('id, nome').in('id', ids) : { data: [] as { id: string; nome: string }[] };
  const nomes = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));
  return {
    erro,
    linhas: brutas.map((l) => ({
      id: l.id, nome: l.nome, detalhe: l.detalhe, arquivadoEm: l.arquivado_em,
      arquivadoPor: l.arquivado_por ? nomes.get(l.arquivado_por) ?? 'pessoa removida' : null,
    })),
  };
}

/** Número do botão "Arquivados (n)" das telas de lista. */
export async function contarArquivados(sb: Sb, tipo: 'cliente' | 'contato' | 'usuario'): Promise<number> {
  const conta = { count: 'exact', head: true } as const;
  const r = tipo === 'cliente' ? await sb.from('clientes').select('id', conta).eq('ativo', false)
    : tipo === 'contato' ? await sb.from('contatos').select('id', conta).eq('ativo', false).neq('nome', NOME_ANONIMIZADO)
    : await sb.from('usuarios').select('id', conta).eq('ativo', false);
  return r.count ?? 0;
}

/** Nome de quem arquivou (aviso nas fichas). */
export async function nomeDaPessoa(sb: Sb, id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await sb.from('usuarios').select('nome').eq('id', id).maybeSingle();
  return data?.nome ?? 'pessoa removida';
}
