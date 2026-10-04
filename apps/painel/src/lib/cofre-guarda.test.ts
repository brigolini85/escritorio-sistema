import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Spec 7D.1: a senha nunca vai para logs nem exportações. Só quem precisa importa o cofre.
const SRC = fileURLToPath(new URL('..', import.meta.url));
const PERMITIDOS = new Set([
  'lib/cofre.test.ts',
  'app/(painel)/clientes/ficha/acessos-acoes.ts',
  'app/(painel)/clientes/ficha/acessos-acoes.test.ts',
  // A página só pergunta se há chave (cofreConfigurado), para o aviso do D8.
  'app/(painel)/clientes/ficha/dados-ficha.tsx',
]);
// Quem pode citar a coluna da cifra: só a ação dos acessos (e o seu teste). Este arquivo cita para procurar.
const CITAM_A_CIFRA = new Set([
  'lib/cofre-guarda.test.ts',
  'app/(painel)/clientes/ficha/acessos-acoes.ts',
  'app/(painel)/clientes/ficha/acessos-acoes.test.ts',
]);

// Qualquer caminho que termine em "/cofre" ("@/lib/cofre", "./cofre", "../../lib/cofre"), por import estático ou dinâmico.
const IMPORTA_COFRE = /(?:from\s*|import\s*\(\s*)['"][^'"]*\/cofre(?:\.ts)?['"]/;
// cliente_acessos lido com "*" (ou sem colunas, que é o mesmo) direto ou embutido noutra consulta.
const SELECT_TUDO = [
  /from\(\s*['"`]cliente_acessos['"`]\s*\)\s*\.select\(\s*(?:['"`]\s*\*\s*['"`]\s*)?[,)]/,
  /cliente_acessos\s*(?:![\w]+)?\s*\(\s*\*\s*\)/,
];

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}
const ESTE = 'lib/cofre-guarda.test.ts';
// Este arquivo fica fora da procura de import e de "*": ele só lê arquivos e traz exemplos ruins para provar as procuras.
const arquivos = () => listar(SRC).map((f) => ({ rel: relative(SRC, f).split(sep).join('/'), texto: readFileSync(f, 'utf8') }));

describe('guarda do cofre', () => {
  it('só a ação dos acessos (e a página, para saber se há chave) importa o cofre', () => {
    const quem = arquivos()
      .filter((f) => f.rel !== ESTE && IMPORTA_COFRE.test(f.texto))
      .map((f) => f.rel);
    expect(quem.filter((f) => !PERMITIDOS.has(f))).toEqual([]);
  });

  it('o cofre não escreve no console', () => {
    expect(readFileSync(join(SRC, 'lib/cofre.ts'), 'utf8')).not.toMatch(/console\./);
  });

  it('ninguém lê cliente_acessos com "*", e só a ação dos acessos cita senha_cifrada', () => {
    const todos = arquivos().filter((f) => f.rel !== ESTE);
    expect(todos.filter((f) => SELECT_TUDO.some((r) => r.test(f.texto))).map((f) => f.rel)).toEqual([]);
    expect(arquivos().filter((f) => f.texto.includes('senha_cifrada') && !CITAM_A_CIFRA.has(f.rel)).map((f) => f.rel)).toEqual([]);
  });

  it('as procuras acima pegam os jeitos de escrever que importam', () => {
    for (const ruim of [
      "import { cifrar } from '@/lib/cofre';",
      'import { decifrar } from "../../../lib/cofre";',
      "const m = await import('@/lib/cofre');",
    ]) expect(IMPORTA_COFRE.test(ruim), ruim).toBe(true);
    expect(IMPORTA_COFRE.test("import { x } from '@/lib/cofre-de-outra-coisa';")).toBe(false);
    for (const ruim of [
      "supabase.from('cliente_acessos').select('*')",
      "supabase.from('cliente_acessos')\n  .select( '*' , { count: 'exact' })",
      'supabase.from("cliente_acessos").select()',
      "supabase.from('clientes').select('id, cliente_acessos(*)')",
      "supabase.from('clientes').select('id, cliente_acessos!inner( * )')",
    ]) expect(SELECT_TUDO.some((r) => r.test(ruim)), ruim).toBe(true);
    expect(SELECT_TUDO.some((r) => r.test("supabase.from('cliente_acessos').select('id, portal, usuario')"))).toBe(false);
  });
});
