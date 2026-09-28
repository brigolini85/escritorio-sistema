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

export async function buscarProdutos(repos: Repos, clienteId: string, textos: string[]): Promise<{ texto: string; candidatos: CandidatoProduto[] }[]> {
  const produtos = await repos.produtosDaEmpresa(clienteId);
  const candidatos = produtos.map((p) => ({ item: p, termos: [p.descricao, p.codigo, ...p.apelidos] }));
  return textos.map((texto) => ({
    texto,
    candidatos: melhoresCandidatos(texto, candidatos).map((p) => ({ id: p.id, codigo: p.codigo, descricao: p.descricao, unidade: p.unidade })),
  }));
}
