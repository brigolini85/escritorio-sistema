import type Anthropic from '@anthropic-ai/sdk';
import { LIMITES_TAREFA, leituraDoArquivo } from '@escritorio/core';
import type { ArquivoDaTarefa } from '@escritorio/db';
import type { ArmazenamentoMidia } from '../midia/armazenamento';

/** Parte I3a (D15): o que o agente recebe de um arquivo da tarefa. PDF e imagem como blocos nativos do Claude; o resto como texto. */
export type ConteudoFerramenta = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam>;
export type LeituraArquivo = { ok: true; conteudo: ConteudoFerramenta; detalhe: string | null } | { ok: false; erro: string };

export const AVISOS_ARQUIVO = {
  tipo: (nome: string) => `O agente não lê este tipo de arquivo: ${nome}. Se ele for necessário, abra uma pendência pedindo PDF, XML, CSV, TXT, OFX, JPG ou PNG.`,
  grande: (nome: string) => `${nome} é grande demais para ler de uma vez (mais de 4 MB). Abra uma pendência pedindo o arquivo em partes (por exemplo, um PDF por mês).`,
  naoTexto: (nome: string) => `${nome} não é texto legível. Abra uma pendência pedindo outro formato.`,
  parte: 'Essa parte não existe: veja "partes" na primeira leitura.',
  semArquivo: 'O arquivo não foi encontrado no armazenamento. Abra uma pendência pedindo o arquivo de novo.',
};

/** Só para o detalhe "6 págs" na tela; nada é decidido por ele. */
export function paginasDoPdf(bytes: Uint8Array): number | null {
  const n = (Buffer.from(bytes).toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
  return n > 0 ? n : null;
}

/** UTF-8; se não for, Windows-1252 (extrato e OFX de banco brasileiro). Byte nulo = binário. */
export function decodificarTexto(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** F24: só "não encontrado" vira instrução para o agente; queda de rede ou do Storage sobe (a vez falha e é refeita). */
const NAO_ENCONTRADO = /not found|não encontrad|nao encontrad|404/i;

export async function lerArquivoDaTarefa(midia: Pick<ArmazenamentoMidia, 'ler'>, a: ArquivoDaTarefa, parte = 1): Promise<LeituraArquivo> {
  const leitura = leituraDoArquivo(a.nome);
  if (!leitura) return { ok: false, erro: AVISOS_ARQUIVO.tipo(a.nome) };
  let bytes: Uint8Array;
  try {
    bytes = await midia.ler(a.caminho, a.bucket);
  } catch (e) {
    if (e instanceof Error && NAO_ENCONTRADO.test(e.message)) return { ok: false, erro: AVISOS_ARQUIVO.semArquivo };
    throw e;
  }
  if (leitura === 'pdf' || leitura === 'imagem') {
    if (bytes.length > LIMITES_TAREFA.blocoBytes) return { ok: false, erro: AVISOS_ARQUIVO.grande(a.nome) };
    const data = Buffer.from(bytes).toString('base64');
    if (leitura === 'pdf') {
      const paginas = paginasDoPdf(bytes);
      return {
        ok: true, detalhe: paginas ? `${paginas} pág${paginas > 1 ? 's' : ''}` : null,
        conteudo: [{ type: 'text', text: `Arquivo ${a.nome} (PDF).` }, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: a.nome }],
      };
    }
    const media = /\.png$/i.test(a.nome) ? 'image/png' : 'image/jpeg';
    return { ok: true, detalhe: 'imagem', conteudo: [{ type: 'text', text: `Arquivo ${a.nome} (imagem).` }, { type: 'image', source: { type: 'base64', media_type: media, data } }] };
  }
  const texto = decodificarTexto(bytes);
  if (texto === null) return { ok: false, erro: AVISOS_ARQUIVO.naoTexto(a.nome) };
  const tamanho = LIMITES_TAREFA.parteTexto;
  const partes = Math.max(1, Math.ceil(texto.length / tamanho));
  if (parte < 1 || parte > partes) return { ok: false, erro: AVISOS_ARQUIVO.parte };
  const linhas = texto.split('\n').filter((l) => l.trim()).length;
  return {
    ok: true, detalhe: `${linhas} linha${linhas === 1 ? '' : 's'}`,
    // JSON: o conteúdo do arquivo vai como dado (aspas e quebras escapadas), nunca como instrução.
    conteudo: JSON.stringify({ arquivo: a.nome, parte, partes, texto: texto.slice((parte - 1) * tamanho, parte * tamanho) }),
  };
}
