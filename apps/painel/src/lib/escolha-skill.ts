import { LIMITE_ENVIO_SKILL, recusaPelaExtensao } from '@escritorio/core';

type Item = { caminho: string; tamanho: number };
const nomeDe = (caminho: string) => caminho.split('/').at(-1) ?? caminho;

/**
 * O que a tela manda ao subir uma skill (revisão final, Important 1). Uma pasta de contador costuma ter PDFs: eles saem
 * já aqui, com a mesma frase do servidor (D7), e não pesam no envio. Um .zip sozinho segue (o servidor confere o conteúdo).
 */
export function escolherArquivosSkill<T extends Item>(lista: T[]): { escolhidos: T[]; aviso: string | null; deFora: string[] } {
  if (lista.length === 1 && /\.zip$/i.test(lista[0]!.caminho)) return { escolhidos: [...lista], aviso: null, deFora: [] };
  const escolhidos: T[] = [];
  const recusas: { nome: string; frase: string }[] = [];
  for (const item of lista) {
    const frase = recusaPelaExtensao(nomeDe(item.caminho));
    if (frase) recusas.push({ nome: nomeDe(item.caminho), frase });
    else escolhidos.push(item);
  }
  const pdf = recusas.find((r) => /\.pdf$/i.test(r.nome));
  return { escolhidos, aviso: (pdf ?? recusas[0])?.frase ?? null, deFora: recusas.map((r) => r.nome) };
}

/** Acima do teto do servidor (10 MB somados): a tela avisa sem mandar (o Next recusaria o corpo acima de 15 MB). */
export const passaDoEnvio = (lista: Item[]): boolean => lista.reduce((s, i) => s + i.tamanho, 0) > LIMITE_ENVIO_SKILL;
