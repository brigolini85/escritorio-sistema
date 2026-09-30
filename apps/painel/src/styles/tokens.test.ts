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

function luminancia(valor: string): number {
  const m = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(valor);
  if (!m) throw new Error(`cor não é hsl opaca: ${valor}`);
  const h = Number(m[1]), s = Number(m[2]) / 100, l = Number(m[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const canal = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(8) + 0.0722 * canal(4);
}

function contraste(tema: Map<string, string>, frente: string, fundo: string): number {
  const [a, b] = [luminancia(resolver(tema, frente)), luminancia(resolver(tema, fundo))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const OBRIGATORIOS = [
  '--brand', '--brand-foreground', '--background', '--surface', '--surface-muted', '--border', '--ring',
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
    const cores = [...claro].filter(([, v]) => v.startsWith('hsl(')).map(([n]) => n);
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
});
