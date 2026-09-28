import { melhoresCandidatos } from '@escritorio/core';
import type { Repos, TipoParceiro } from '@escritorio/db';

export type CandidatoParceiro = { id: string; rede: string; unidade: string; bairro: string | null; cidade: string | null };
export type CandidatoProduto = { id: string; codigo: string; descricao: string; unidade: string };

/** Busca feita pelo código, só nos cadastros da empresa informada. */
export async function buscarParceiros(repos: Repos, clienteId: string, texto: string, tipo: TipoParceiro): Promise<CandidatoParceiro[]> {
  const unidades = await repos.unidadesDaEmpresa(clienteId, tipo);
  const achadas = melhoresCandidatos(texto, unidades.map((u) => ({
    item: u,
    termos: [u.rede, u.unidade, u.bairro ?? '', u.cidade ?? '', u.razaoSocial ?? '', ...u.palavrasChave],
  })));
  return achadas.map((u) => ({ id: u.id, rede: u.rede, unidade: u.unidade, bairro: u.bairro, cidade: u.cidade }));
}

const UNIDADES = new Set(['pac', 'pct', 'kg', 'g', 'un', 'und', 'cx', 'pc', 'l', 'lt', 'fd']);

/** "20 PAC costela" → "costela": quantidade e unidade não podem casar com código de produto. Só número ("20") continua valendo como código. */
function semQuantidade(texto: string): string {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const resto = palavras.filter((p) => !/^\d+([.,]\d+)?$/.test(p) && !UNIDADES.has(p.toLowerCase()));
  return resto.length ? resto.join(' ') : texto;
}

export async function buscarProdutos(repos: Repos, clienteId: string, textos: string[]): Promise<{ texto: string; candidatos: CandidatoProduto[] }[]> {
  const produtos = await repos.produtosDaEmpresa(clienteId);
  const candidatos = produtos.map((p) => ({ item: p, termos: [p.descricao, p.codigo, ...p.apelidos] }));
  return textos.map((texto) => ({
    texto,
    candidatos: melhoresCandidatos(semQuantidade(texto), candidatos).map((p) => ({ id: p.id, codigo: p.codigo, descricao: p.descricao, unidade: p.unidade })),
  }));
}
