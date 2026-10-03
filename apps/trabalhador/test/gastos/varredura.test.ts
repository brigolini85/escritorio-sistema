import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Prompt F: todo lugar que chama a IA (ou grava uso_ia) está nesta lista e tem teste em caminhos.test.ts / processar-conversa.test.ts.
// Caminho novo = este teste falha até alguém o pôr aqui E escrever o teste da funcionalidade dele.
const SRC = join(__dirname, '../../src');
const ESPERADO = {
  chamaIa: { 'agente/executar.ts': 1, 'agente/simular.ts': 1, 'assistente/executar.ts': 1, 'sugestao/processar.ts': 1 },
  gravaUso: { 'agente/executar.ts': 1, 'agente/simular.ts': 1, 'assistente/executar.ts': 1, 'sugestao/processar.ts': 1, 'sugestao/ferramentas.ts': 1 },
  transcreve: { 'processar-conversa.ts': 1 },
  sdk: { 'agente/cliente-ia.ts': 1 }, // o único lugar que fala com a Anthropic direto
};

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'cenarios' ? [] : arquivos(p); // cenários só rodam à mão, com o mesmo código
    return p.endsWith('.ts') ? [p] : [];
  });
}
function contar(re: RegExp): Record<string, number> {
  const r: Record<string, number> = {};
  for (const p of arquivos(SRC)) {
    const n = (readFileSync(p, 'utf8').match(re) ?? []).length;
    if (n) r[relative(SRC, p).replaceAll('\\', '/')] = n;
  }
  return r;
}

describe('varredura dos caminhos de IA', () => {
  it('chamadas à Anthropic', () => expect(contar(/\bia\.criar\(/g)).toEqual(ESPERADO.chamaIa));
  it('gravações em uso_ia', () => expect(contar(/\.registrarUsoIa\(/g)).toEqual(ESPERADO.gravaUso));
  it('transcrições', () => expect(contar(/transcritor\.transcrever\(/g)).toEqual(ESPERADO.transcreve));
  it('SDK da Anthropic', () => expect(contar(/messages\.(create|stream)\(/g)).toEqual(ESPERADO.sdk));
});
