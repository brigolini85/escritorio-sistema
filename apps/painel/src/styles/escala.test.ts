import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A letra acompanha a tela (spec 4.2): tudo em rem a partir do <html>; px solto não cresce em tela grande.
const globais = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const SRC = fileURLToPath(new URL('..', import.meta.url));

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('escala que acompanha a tela', () => {
  it('a letra base mora no html em rem (14/15/16px na preferência padrão do navegador, a partir de 1600px e 1920px), mais o extra da pessoa', () => {
    expect(globais).toMatch(/--letra-base:\s*0\.875rem/); // 14px
    expect(globais).toMatch(/@media \(min-width: 1600px\)[\s\S]*?--letra-base:\s*0\.9375rem/); // 15px
    expect(globais).toMatch(/@media \(min-width: 1920px\)[\s\S]*?--letra-base:\s*1rem/); // 16px
    expect(globais).toMatch(/font-size:\s*calc\(var\(--letra-base\) \+ var\(--letra-extra\)\)/);
    expect(globais).toMatch(/\.letra-grande\s*\{[^}]*--letra-extra:\s*calc\(1rem \/ 16\)/); // +1px
    expect(globais).toMatch(/\.letra-maior\s*\{[^}]*--letra-extra:\s*calc\(2rem \/ 16\)/); // +2px
  });

  it('a letra não usa px (px ignoraria a fonte padrão escolhida no navegador)', () => {
    expect(globais).not.toMatch(/--letra-(base|extra):\s*[\d.]+px/);
  });

  it('escala de texto e espaçamento em rem (nenhum px)', () => {
    const escala = globais.slice(globais.indexOf('--text-*: initial'), globais.indexOf('}', globais.indexOf('--text-*: initial')));
    expect(escala).not.toMatch(/\d+px/);
    expect(globais).toMatch(/--spacing:\s*calc\(4rem \/ 14\)/);
  });

  it('larguras de layout dos tokens em rem', () => {
    for (const n of ['--sidebar-width', '--sidebar-width-collapsed', '--conversation-list-width', '--conversation-panel-width', '--reading-width']) {
      expect(new RegExp(`${n}:\\s*calc\\(\\d+rem / 14\\)`).test(tokens), n).toBe(true);
    }
  });

  it('todo tamanho de ícone usado no código tem regra em rem no globals.css', () => {
    const usados = new Set(arquivos(SRC).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/size=\{(\d+)\}/g)].map((m) => m[1]!)));
    const faltando = [...usados].filter((n) => !new RegExp(`svg\\.lucide\\[width="${n}"\\]`).test(globais));
    expect(faltando).toEqual([]);
  });

  it('nenhum valor arbitrário em px nas classes do JSX', () => {
    const achados = arquivos(SRC).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/-\[\d+(\.\d+)?px\]/g)].map((m) => `${f}: ${m[0]}`));
    expect(achados).toEqual([]);
  });

  it('nenhum valor arbitrário em rem nas classes do JSX (rem solto encolhe na base 14)', () => {
    const achados = arquivos(SRC).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/-\[-?\d+(\.\d+)?rem\]/g)].map((m) => `${f}: ${m[0]}`));
    expect(achados).toEqual([]);
  });

  it('tamanhos de container e raios padrão do Tailwind reescritos em calc(Nrem / 14)', () => {
    const container = { '3xs': 256, '2xs': 288, xs: 320, sm: 384, md: 448, lg: 512, xl: 576, '2xl': 672, '3xl': 768, '4xl': 896, '5xl': 1024, '6xl': 1152, '7xl': 1280 };
    for (const [k, v] of Object.entries(container)) {
      expect(globais, `--container-${k}`).toContain(`--container-${k}: calc(${v}rem / 14);`);
    }
    const raio = { xs: 2, xl: 12, '2xl': 16, '3xl': 24, '4xl': 32 };
    for (const [k, v] of Object.entries(raio)) {
      expect(globais, `--radius-${k}`).toContain(`--radius-${k}: calc(${v}rem / 14);`);
    }
  });

  it('os deslocamentos do cabeçalho fixo usam calc(N rem / 14)', () => {
    expect(globais).toMatch(/\+ calc\(24rem \/ 14\)\)/);
    expect(globais).toMatch(/\+ calc\(16rem \/ 14\)\)/);
    expect(globais).not.toMatch(/\+ 1(\.5)?rem\)/);
  });

  it('nenhum px solto em style inline no JSX (cresce só em rem)', () => {
    const achados = arquivos(SRC).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/style=\{\{[^}]*\d+px/g)].map((m) => `${f}: ${m[0]}`));
    expect(achados).toEqual([]);
  });
});
