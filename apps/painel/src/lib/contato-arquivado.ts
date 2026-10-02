// apps/painel/src/lib/contato-arquivado.ts
/** Contato arquivado cadastrado de novo: a tela pergunta quais empresas de antes voltam (sobra 5 da Parte B). */
export type VinculoAntigo = { clienteId: string; empresa: string; podePedirNota: boolean; podeMudarPreco: boolean };
export type ConsultaContatoArquivado =
  | { situacao: 'livre' }
  | { situacao: 'anonimizado' }
  | { situacao: 'arquivado'; nome: string; vinculos: VinculoAntigo[]; empresaNova: string | null }
  | { situacao: 'erro'; erro: string };

/** A mesma frase do banco (restaurar_cadastro e cadastrar_contato). */
export const TEXTO_LGPD = 'Os dados deste contato foram apagados (LGPD). Ele não volta.';

type VinculoBruto = { cliente_id?: unknown; razao_social?: unknown; nome_fantasia?: unknown; pode_pedir_nota?: unknown; pode_atualizar_preco?: unknown };

/** Lê a resposta de contato_arquivado_do_telefone. A empresa da ação (`clienteAtual`) sempre entra: não aparece na pergunta. */
export function lerContatoArquivado(v: unknown, clienteAtual: string | null): Exclude<ConsultaContatoArquivado, { situacao: 'erro' }> {
  if (v === null || v === undefined) return { situacao: 'livre' };
  const o = v as { nome?: unknown; anonimizado?: unknown; vinculos?: unknown };
  if (o.anonimizado === true) return { situacao: 'anonimizado' };
  if (typeof o.nome !== 'string' || !Array.isArray(o.vinculos)) throw new Error('Resposta inválida do banco.');
  const vinculos = (o.vinculos as VinculoBruto[]).flatMap((b): VinculoAntigo[] => {
    if (typeof b.cliente_id !== 'string' || typeof b.razao_social !== 'string' || b.cliente_id === clienteAtual) return [];
    const empresa = typeof b.nome_fantasia === 'string' && b.nome_fantasia ? b.nome_fantasia : b.razao_social;
    return [{ clienteId: b.cliente_id, empresa, podePedirNota: b.pode_pedir_nota === true, podeMudarPreco: b.pode_atualizar_preco === true }];
  });
  return { situacao: 'arquivado', nome: o.nome, vinculos, empresaNova: null };
}

/** Linha de baixo de cada empresa na pergunta: o que a pessoa podia ali. */
export function marcacoesDoVinculo(v: VinculoAntigo): string {
  const m = [v.podePedirNota && 'pode pedir nota', v.podeMudarPreco && 'pode mudar preço e cadastrar produto'].filter(Boolean);
  return m.length ? m.join(' · ') : 'Só conversa (não pede nota nem muda preço)';
}
