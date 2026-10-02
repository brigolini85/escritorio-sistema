// apps/painel/src/lib/arquivo.ts
import { formatarData } from './formatos';

/** Cadastros que têm "Excluir…": arquivar, restaurar e excluir de vez (spec painel v2, seção 5). */
export const TIPOS_CADASTRO = ['cliente', 'contato', 'produto', 'rede', 'unidade', 'usuario'] as const;
export type TipoCadastro = (typeof TIPOS_CADASTRO)[number];
export type UsoDoCadastro = { contagens: Record<string, number>; abertas: number[] };
export type ModoExclusao = 'arquivar' | 'excluir';
export type TextosJanela = { modo: ModoExclusao; verbo: string; descricao: string; aviso: string | null; confirmar: string; enviando: string };

/** Nome que anonimizar_contato (LGPD) grava: esse contato não aparece nos arquivados nem volta. */
export const NOME_ANONIMIZADO = 'Contato removido';

/** Texto da área "Excluir…" no fim das fichas. */
export const AJUDA_EXCLUIR = 'Com histórico, vai para os arquivados e pode voltar. Nunca usado, o administrador exclui de vez.';

/** Telas que mostram cada tipo (revalidadas depois de arquivar, restaurar ou excluir). */
export const ROTAS_DO_TIPO: Record<TipoCadastro, string[]> = {
  cliente: ['/clientes'], contato: ['/contatos', '/clientes'], produto: ['/clientes'], rede: ['/clientes'], unidade: ['/clientes'], usuario: ['/usuarios'],
};

export const ehTipoCadastro = (v: unknown): v is TipoCadastro =>
  typeof v === 'string' && (TIPOS_CADASTRO as readonly string[]).includes(v);

// Ordem das contagens na frase (o jsonb do banco não guarda ordem) e como cada uma se escreve.
const ROTULOS: [chave: string, singular: string, plural: string, genero: 'f' | 'm'][] = [
  ['demandas', 'demanda', 'demandas', 'f'],
  ['precos', 'preço', 'preços', 'm'],
  ['conversas', 'conversa', 'conversas', 'f'],
  ['mensagens', 'mensagem', 'mensagens', 'f'],
  ['produtos', 'produto', 'produtos', 'm'],
  ['redes', 'rede', 'redes', 'f'],
  ['unidades', 'unidade', 'unidades', 'f'],
  ['documentos', 'documento', 'documentos', 'm'],
  ['contatos', 'contato', 'contatos', 'm'],
  ['pedidos', 'pedido de nota', 'pedidos de nota', 'm'],
  ['precos_alterados', 'preço alterado', 'preços alterados', 'm'],
  ['eventos', 'registro em demandas', 'registros em demandas', 'm'],
  ['assistente', 'pergunta ao assistente', 'perguntas ao assistente', 'f'],
  ['orientacoes', 'orientação do agente', 'orientações do agente', 'f'],
  ['responsabilidades', 'empresa sob responsabilidade', 'empresas sob responsabilidade', 'f'],
];

const SAIDA: Record<TipoCadastro, string> = {
  cliente: 'Sai das listas e do agente.', contato: 'Sai das listas e do agente.', produto: 'Sai das listas e do agente.',
  rede: 'Sai das listas e do agente.', unidade: 'Sai das listas e do agente.', usuario: 'Sai das listas e não entra mais no painel.',
};

const NUNCA_USADO: Record<TipoCadastro, string> = {
  cliente: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
  contato: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
  produto: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
  rede: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
  unidade: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
  usuario: 'Nunca atendeu: nenhuma conversa, demanda ou preço. O acesso ao login também é removido. Não dá para desfazer.',
};

export function lerUso(v: unknown): UsoDoCadastro {
  const o = v as { contagens?: unknown; abertas?: unknown } | null;
  const contagens = o?.contagens;
  const valido = !!o && typeof contagens === 'object' && contagens !== null && !Array.isArray(contagens)
    && Object.values(contagens).every((n) => Number.isInteger(n) && (n as number) >= 0)
    && Array.isArray(o.abertas) && o.abertas.every((n) => Number.isInteger(n));
  if (!valido) throw new Error('Resposta inválida do banco.');
  return { contagens: contagens as Record<string, number>, abertas: o!.abertas as number[] };
}

export const temHistorico = (u: UsoDoCadastro) => Object.values(u.contagens).some((n) => n > 0);

// O banco recusa de novo; aqui só escolhe a janela.
export const modoDaExclusao = (u: UsoDoCadastro, admin: boolean): ModoExclusao => (admin && !temHistorico(u) ? 'excluir' : 'arquivar');

const juntar = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`);

export function fraseDoUso(tipo: TipoCadastro, u: UsoDoCadastro): string {
  const conhecidas = new Set(ROTULOS.map(([k]) => k));
  // Contagem que o banco ganhou e a tela ainda não conhece: aparece pelo nome da chave.
  const extras = Object.keys(u.contagens).filter((k) => !conhecidas.has(k))
    .map((k): [string, string, string, 'f' | 'm'] => [k, k.replace(/_/g, ' '), k.replace(/_/g, ' '), 'm']);
  const usados = [...ROTULOS, ...extras].filter(([k]) => (u.contagens[k] ?? 0) > 0);
  if (usados.length === 0) return `Nunca foi usado. ${SAIDA[tipo]}`;
  const itens = usados.map(([k, s, p]) => `${u.contagens[k]} ${u.contagens[k] === 1 ? s : p}`);
  const um = usados.length === 1 && u.contagens[usados[0]![0]] === 1;
  const feminino = usados.every(([, , , g]) => g === 'f');
  const verbo = um ? `fica guardad${feminino ? 'a' : 'o'}` : `ficam guardad${feminino ? 'as' : 'os'}`;
  return `${juntar(itens)} ${verbo}. ${SAIDA[tipo]}`;
}

export function avisoAbertas(abertas: number[]): string | null {
  if (abertas.length === 0) return null;
  const mostrar = abertas.slice(0, 3).map((n) => `#${n}`);
  const resto = abertas.length - mostrar.length;
  const lista = resto > 0 ? `${mostrar.join(', ')} e mais ${resto}` : mostrar.join(', ');
  return abertas.length === 1 ? `1 demanda ainda aberta (${lista})` : `${abertas.length} demandas ainda abertas (${lista})`;
}

export function textosDaJanela(tipo: TipoCadastro, u: UsoDoCadastro, admin: boolean): TextosJanela {
  if (modoDaExclusao(u, admin) === 'excluir') {
    return { modo: 'excluir', verbo: 'Excluir de vez', descricao: NUNCA_USADO[tipo], aviso: null, confirmar: 'Excluir de vez', enviando: 'Excluindo…' };
  }
  return { modo: 'arquivar', verbo: 'Arquivar', descricao: fraseDoUso(tipo, u), aviso: avisoAbertas(u.abertas), confirmar: 'Sim, arquivar', enviando: 'Arquivando…' };
}

export function descreverArquivamento(arquivadoEm: string | null, arquivadoPor: string | null): string {
  if (!arquivadoEm) return 'Arquivado antes do registro de datas.';
  return `Arquivado em ${formatarData(arquivadoEm)}${arquivadoPor ? ` por ${arquivadoPor}` : ''}.`;
}
