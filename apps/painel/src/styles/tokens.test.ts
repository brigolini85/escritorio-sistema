import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Lê tokens.css e confere: nomes obrigatórios, comentário em cada token, blocos escuros idênticos
// e contraste WCAG AA dos pares de uso real nos dois temas.

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function bloco(seletor: string, fonte = css): string {
  const i = fonte.indexOf(`${seletor} {`);
  if (i < 0) throw new Error(`bloco ${seletor} não encontrado`);
  const inicio = fonte.indexOf('{', i) + 1;
  return fonte.slice(inicio, fonte.indexOf('}', inicio));
}

function declaracoes(corpo: string): Map<string, string> {
  const semComentarios = corpo.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = new Map<string, string>();
  for (const [, nome, valor] of semComentarios.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) m.set(nome!, valor!.trim());
  return m;
}

const blocoClaro = bloco(':root');
const claro = declaracoes(blocoClaro);
const escuroCookie = declaracoes(bloco(':root[data-theme="dark"]'));
const escuroSistema = declaracoes(bloco(':root:not([data-theme="light"])', css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))));
const escuro = new Map([...claro, ...escuroCookie]);

function resolver(tema: Map<string, string>, nome: string): string {
  let v = tema.get(nome);
  if (!v) throw new Error(`token ${nome} ausente`);
  for (let i = 0; i < 5 && v.startsWith('var('); i++) v = tema.get(v.slice(4, -1).trim())!;
  return v;
}

type Rgb = [number, number, number]; // sRGB linear, sem cortar (sai de 0..1 quando a cor passa do gamut)

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function hslLinear(h: number, s: number, l: number): Rgb {
  const a = s * Math.min(l, 1 - l);
  const canal = (n: number) => {
    const k = (n + h / 30) % 12;
    return linear(l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [canal(0), canal(8), canal(4)];
}

// OKLab/OKLCH (Björn Ottosson): as mesmas contas que o navegador faz para oklch(from ...).
function paraOklch([r, g, b]: Rgb): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

function deOklch(L: number, C: number, H: number): Rgb {
  const A = C * Math.cos((H * Math.PI) / 180);
  const B = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Canal de oklch(from ...): palavra-chave (l, c, h), número ou min(expr, número). */
function canal(expr: string, base: Record<string, number>): number {
  const min = /^min\(\s*(\w+)\s*,\s*([\d.]+)\s*\)$/.exec(expr);
  if (min) return Math.min(canal(min[1]!, base), Number(min[2]));
  if (expr in base) return base[expr]!;
  const n = Number(expr);
  if (Number.isNaN(n)) throw new Error(`canal não entendido: ${expr}`);
  return n;
}

const CANAL = String.raw`(min\([^)]*\)|\S+)`;
const RELATIVA = new RegExp(String.raw`^oklch\(from var\((--[\w-]+)\)\s+${CANAL}\s+${CANAL}\s+${CANAL}\)$`);

/** Cor do token em sRGB linear: hsl(h s% l%) ou oklch(from var(--x) L C H), com canais relativos. */
function cor(tema: Map<string, string>, nome: string): Rgb {
  const valor = resolver(tema, nome);
  const hsl = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(valor);
  if (hsl) return hslLinear(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100);
  const rel = RELATIVA.exec(valor);
  if (rel) {
    const [l, c, h] = paraOklch(cor(tema, rel[1]!));
    const base = { l, c, h };
    return deOklch(canal(rel[2]!, base), canal(rel[3]!, base), canal(rel[4]!, base));
  }
  throw new Error(`cor não suportada no teste: ${nome} = ${valor}`);
}

/** Luminância relativa (WCAG), cortando os canais fora do gamut como o navegador faz ao pintar. */
function luminancia(rgb: Rgb): number {
  const [r, g, b] = rgb.map((x) => Math.min(1, Math.max(0, x))) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(tema: Map<string, string>, frente: string, fundo: string): number {
  const [a, b] = [luminancia(cor(tema, frente)), luminancia(cor(tema, fundo))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** O mesmo tema com outra cor de marca (só a linha --brand-base muda, como o dono faria). */
function comMarca(tema: Map<string, string>, base: string): Map<string, string> {
  return new Map([...tema, ['--brand-base', base]]);
}

// Marcas plausíveis de outros escritórios: vermelho, verde, roxo, laranja, amarelo, ciano, rosa, cinza.
const OUTRAS_MARCAS = [
  'hsl(0 72% 42%)', 'hsl(150 60% 32%)', 'hsl(270 60% 45%)', 'hsl(30 90% 50%)', 'hsl(55 95% 50%)',
  'hsl(190 80% 40%)', 'hsl(330 70% 45%)', 'hsl(120 50% 40%)', 'hsl(0 0% 30%)', 'hsl(221 83% 70%)',
];

const OBRIGATORIOS = [
  '--brand-base', '--brand', '--brand-foreground', '--background', '--surface', '--surface-muted', '--border', '--ring',
  '--text', '--text-muted', '--text-subtle',
  ...['success', 'warning', 'danger', 'info'].flatMap((s) => [`--${s}`, `--${s}-foreground`, `--${s}-soft`]),
  '--agent-active', '--agent-paused', '--human-owned', '--assistant', '--internal-note',
  '--radius-sm', '--radius-md', '--radius-lg', '--shadow-sm', '--shadow-md', '--font-sans', '--font-mono',
];

const ESTADOS = ['success', 'warning', 'danger', 'info', 'agent-active', 'agent-paused', 'human-owned', 'assistant'];

// [frente, fundo, mínimo]
const PARES: [string, string, number][] = [
  ...['--text', '--text-muted', '--text-subtle'].flatMap((t) =>
    ['--background', '--surface', '--surface-muted'].map((f): [string, string, number] => [t, f, 4.5])),
  ['--brand-foreground', '--brand', 4.5],
  ['--brand', '--surface', 4.5],
  ['--brand', '--background', 4.5],
  ['--brand', '--brand-soft', 4.5],
  ['--text', '--brand-soft', 4.5],
  ...ESTADOS.flatMap((s): [string, string, number][] => [
    [`--${s}-foreground`, `--${s}`, 4.5],
    [`--${s}`, `--${s}-soft`, 4.5],
    [`--${s}`, '--surface', 4.5],
    ['--text', `--${s}-soft`, 4.5],
  ]),
  ['--text', '--internal-note', 4.5],
  ['--text-muted', '--internal-note', 4.5],
  ['--text-subtle', '--internal-note', 4.5],
  ['--text-subtle', '--brand-soft', 4.5],
  ['--text-muted', '--brand-soft', 4.5],
  ['--internal-note-foreground', '--internal-note', 4.5],
  ['--border-input', '--surface', 3],
  ['--border-input', '--background', 3],
  ['--ring', '--surface', 3],
  ['--ring', '--background', 3],
];

describe('tokens.css', () => {
  it('tem todos os tokens pedidos na spec 5.2', () => {
    for (const nome of OBRIGATORIOS) expect(claro.has(nome), nome).toBe(true);
  });

  it('cada token do bloco claro tem comentário de uma linha dizendo onde é usado', () => {
    const semComentario = blocoClaro.split('\n').filter((l) => /^\s*--[\w-]+\s*:/.test(l) && !l.includes('/*'));
    expect(semComentario).toEqual([]);
  });

  it('os dois blocos escuros (cookie e sistema) são idênticos', () => {
    expect([...escuroSistema]).toEqual([...escuroCookie]);
  });

  it('toda cor do tema claro tem valor no tema escuro', () => {
    // --brand-base é a fonte única da marca (vale para os dois temas); as derivadas dela aparecem no escuro.
    const cores = [...claro].filter(([n, v]) => n !== '--brand-base' && /^(hsl|oklch)\(/.test(v)).map(([n]) => n);
    expect(cores.filter((n) => !escuroCookie.has(n))).toEqual([]);
  });

  for (const [nomeTema, tema] of [['claro', claro], ['escuro', escuro]] as const) {
    it(`contraste AA no tema ${nomeTema}`, () => {
      const falhas = PARES.map(([f, b, min]) => ({ par: `${f} sobre ${b}`, razao: contraste(tema, f, b), min }))
        .filter((p) => p.razao < p.min)
        .map((p) => `${p.par}: ${p.razao.toFixed(2)} < ${p.min}`);
      expect(falhas).toEqual([]);
    });
  }

  it('trocar a marca é uma linha: só --brand-base tem valor próprio; as outras cores de marca derivam dela', () => {
    expect(claro.get('--brand-base')).toMatch(/^hsl\(/);
    for (const mapa of [claro, escuroCookie]) {
      for (const nome of ['--brand', '--brand-soft']) expect(mapa.get(nome), nome).toMatch(/^oklch\(from var\(--brand-base\)/);
    }
    expect(escuroCookie.get('--brand-foreground')).toMatch(/^oklch\(from var\(--brand-base\)/);
    expect(escuroCookie.has('--brand-base')).toBe(false);
    expect(claro.get('--ring')).toBe('var(--brand)');
  });

  for (const base of OUTRAS_MARCAS) {
    it(`contraste AA nos dois temas com a marca ${base}`, () => {
      const falhas = [['claro', comMarca(claro, base)], ['escuro', comMarca(escuro, base)]].flatMap(([nomeTema, tema]) =>
        PARES.map(([f, b, min]) => ({ par: `${nomeTema}: ${f} sobre ${b}`, razao: contraste(tema as Map<string, string>, f, b), min }))
          .filter((p) => p.razao < p.min)
          .map((p) => `${p.par}: ${p.razao.toFixed(2)} < ${p.min}`));
      expect(falhas).toEqual([]);
    });
  }
});
