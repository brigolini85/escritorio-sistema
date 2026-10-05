import 'server-only';
import { unzipSync } from 'fflate';
import type { ArquivoSkill } from '@escritorio/core';

const LIMITE_ENVIO = 10 * 1024 * 1024;
const LIMITE_ZIP_ABERTO = 3 * 1024 * 1024;
const MAX_ENTRADAS_ZIP = 60;
const TEXTO = /\.(md|txt|csv)$/i;

export type ArquivosLidos = { ok: true; arquivos: ArquivoSkill[] } | { ok: false; erro: string };
const erro = (e: string) => ({ ok: false as const, erro: e });

/** Texto em UTF-8 ou null. Só .md/.txt/.csv são lidos; os outros seguem vazios e o core recusa pela extensão (D7). */
function lerTexto(caminho: string, bytes: Uint8Array): string | null {
  if (!TEXTO.test(caminho)) return '';
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Arquivos do formulário de subida (D8): vários (pasta), um .zip ou um .md.
 * O Next descarta a parte de pasta do nome do File nas server actions; por isso a tela manda também o campo paralelo
 * `caminhos` (um por arquivo, na mesma ordem) e o caminho vem dele; sem ele, cai no nome do arquivo (F7).
 */
export async function arquivosDoFormulario(form: FormData): Promise<ArquivosLidos> {
  const caminhos = form.getAll('caminhos');
  const escolhidos = form
    .getAll('arquivos')
    .map((f, i) => {
      const c = caminhos[i];
      return { f, caminho: typeof c === 'string' && c !== '' ? c : f instanceof File ? f.name : '' };
    })
    .filter((e): e is { f: File; caminho: string } => e.f instanceof File && e.f.size > 0);
  if (!escolhidos.length) return erro('Escolha uma pasta, um .zip ou um .md.');
  if (escolhidos.reduce((s, e) => s + e.f.size, 0) > LIMITE_ENVIO) return erro('Os arquivos passam de 10 MB.');
  const brutos: { caminho: string; bytes: Uint8Array }[] = [];
  if (escolhidos.length === 1 && /\.zip$/i.test(escolhidos[0]!.f.name)) {
    let entradas = 0;
    let aberto = 0;
    let conteudo: Record<string, Uint8Array>;
    try {
      // Trava contra .zip que "explode" ao abrir: conta e soma (pelo tamanho declarado) antes de descompactar cada arquivo.
      conteudo = unzipSync(new Uint8Array(await escolhidos[0]!.f.arrayBuffer()), {
        filter: (f) => {
          if (f.name.endsWith('/')) return false;
          entradas += 1;
          aberto += f.originalSize;
          return entradas <= MAX_ENTRADAS_ZIP && aberto <= LIMITE_ZIP_ABERTO;
        },
      });
    } catch {
      return erro('Não consegui abrir o .zip. Confira se o arquivo está inteiro e sem senha.');
    }
    if (entradas > MAX_ENTRADAS_ZIP) return erro('O .zip tem arquivos demais (até 60).');
    if (aberto > LIMITE_ZIP_ABERTO) return erro('O .zip aberto passa de 3 MB.');
    // Confere também o tamanho real (o declarado no cabeçalho pode mentir).
    const real = Object.values(conteudo).reduce((s, b) => s + b.length, 0);
    if (real > LIMITE_ZIP_ABERTO) return erro('O .zip aberto passa de 3 MB.');
    for (const [caminho, bytes] of Object.entries(conteudo)) brutos.push({ caminho, bytes });
  } else {
    for (const e of escolhidos) brutos.push({ caminho: e.caminho, bytes: new Uint8Array(await e.f.arrayBuffer()) });
  }
  const arquivos: ArquivoSkill[] = [];
  for (const b of brutos) {
    const conteudo = lerTexto(b.caminho, b.bytes);
    if (conteudo === null) return erro(`O arquivo "${b.caminho.split('/').at(-1)}" não é texto em UTF-8.`);
    arquivos.push({ caminho: b.caminho, conteudo });
  }
  return { ok: true, arquivos };
}
