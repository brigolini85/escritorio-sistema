import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Spec 7D.1 item 8 (D5–D8): o bloco de acessos é componente do navegador; o painel não tem testes de componente,
// então a guarda lê o código e confere o que não pode faltar (o e2e da Task 13 confere o comportamento).
const codigo = readFileSync(new URL('./acessos-portais.tsx', import.meta.url), 'utf8');

/** Conteúdo de cada (…) ou {…} que começa logo depois de cada achado de `inicio`, com o equilíbrio de abre/fecha. */
function trechos(texto: string, inicio: RegExp, abre: string, fecha: string): string[] {
  return [...texto.matchAll(inicio)].map((m) => {
    let i = (m.index ?? 0) + m[0].length;
    const de = i;
    for (let n = 1; n > 0 && i < texto.length; i++) {
      if (texto[i] === abre) n++;
      else if (texto[i] === fecha) n--;
    }
    return texto.slice(de, i - 1);
  });
}
/** Tira o texto fixo das aspas e das crases (fica só o código, inclusive o de dentro de ${…}). */
function semLiterais(e: string): string {
  let saida = '';
  // Pilha: 'c' = código (o número conta as chaves abertas dentro de ${…}), '`' = texto de crase.
  const pilha: { modo: 'c' | '`'; chaves: number }[] = [{ modo: 'c', chaves: 0 }];
  for (let i = 0; i < e.length; i++) {
    const ch = e[i];
    const topo = pilha[pilha.length - 1] ?? { modo: 'c', chaves: 0 };
    if (topo.modo === '`') {
      if (ch === '\\') i++;
      else if (ch === '`') pilha.pop();
      else if (ch === '$' && e[i + 1] === '{') { pilha.push({ modo: 'c', chaves: 0 }); i++; }
      continue;
    }
    if (ch === "'" || ch === '"') {
      const fim = e.indexOf(ch, i + 1);
      i = fim < 0 ? e.length : fim;
      saida += ' ';
    } else if (ch === '`') pilha.push({ modo: '`', chaves: 0 });
    else if (ch === '{') { topo.chaves++; saida += ch; }
    else if (ch === '}' && topo.chaves === 0 && pilha.length > 1) pilha.pop();
    else { if (ch === '}') topo.chaves--; saida += ch; }
  }
  return saida;
}

describe('bloco Acessos de portais', () => {
  it('é componente do navegador e mora no bloco "acessos" (o índice aponta para #bloco-acessos)', () => {
    expect(codigo.startsWith("'use client';")).toBe(true);
    expect(codigo).toMatch(/<BlocoFicha id="acessos" titulo="Acessos de portais"/);
  });

  it('nunca recebe a cifra nem importa o cofre: a senha só chega pela resposta de revelar/copiar', () => {
    // Nome da coluna montado aqui: só a ação dos acessos pode citá-lo (cofre-guarda.test.ts).
    expect(codigo).not.toContain(['senha', 'cifrada'].join('_'));
    expect(codigo).not.toMatch(/['"][^'"]*\/cofre['"]/);
    expect(codigo).toMatch(/export type AcessoLinha = \{ id: string; portal: string; usuario: string \| null; tem_senha: boolean \};/);
    expect(codigo).toMatch(/await revelarAcesso\(a\.id\)/);
    expect(codigo).toMatch(/await copiarAcesso\(a\.id\)/);
  });

  it('a senha fica só no estado do componente: mascarada no início, some em 30 s, nunca em console, URL ou armazenamento', () => {
    expect(codigo).toMatch(/const MOSTRAR_POR_MS = 30_000;/);
    expect(codigo).toMatch(/useState<string \| null>\(null\)/);
    expect(codigo).toMatch(/setTimeout\(\(\) => setSenha\(null\), MOSTRAR_POR_MS\)/);
    expect(codigo).toMatch(/return \(\) => clearTimeout\(t\)/);
    expect(codigo).not.toMatch(/console\.|localStorage|sessionStorage|indexedDB|searchParams|router\.push|router\.replace|location\./);
  });

  it('a senha aberta só tem dois destinos: o estado (revelar) e a área de transferência (copiar)', () => {
    expect(codigo).toMatch(/const \[senha, setSenha\] = useState<string \| null>\(null\);/);
    expect(codigo.match(/r\.senha/g)).toEqual(['r.senha', 'r.senha']);
    expect(codigo).toMatch(/setSenha\(r\.senha\)/);
    expect(codigo).toMatch(/writeText\(r\.senha\)/);
  });

  it('a senha só aparece na tela dentro do <code> de quem revelou', () => {
    expect(codigo.match(/\{senha\}/g)).toEqual(['{senha}']);
    expect(codigo).toMatch(/<code [^>]*>\{senha\}<\/code>/);
  });

  it('a senha nunca entra em toast, title, data-* ou aria-label (só "senha !== null" para escolher o rótulo)', () => {
    const expressoes = [
      ...trechos(codigo, /toast\.\w+\(/g, '(', ')'),
      ...trechos(codigo, /(?:title|aria-label|data-[\w-]+)=\{/g, '{', '}'),
    ];
    expect(expressoes.length).toBeGreaterThan(0);
    for (const e of expressoes) expect(semLiterais(e.replace(/\bsenha [!=]== null\b/g, '')), e).not.toMatch(/\bsenha\b/);
  });

  it('copiar escreve na área de transferência a resposta da ação (auditada) e não mostra a senha', () => {
    expect(codigo).toMatch(/navigator\.clipboard\.writeText\(r\.senha\)/);
    const copiar = codigo.slice(codigo.indexOf('const copiar'), codigo.indexOf('return (', codigo.indexOf('const copiar')));
    expect(copiar).not.toMatch(/setSenha/);
  });

  it('adicionar e editar só para quem edita Clientes, tem "Ver acessos de portais" e com a chave no ambiente (D6, D8)', () => {
    const gatilhos = codigo.match(/\{[^{}]*&& \(\s*<JanelaAcesso/g) ?? [];
    expect(gatilhos).toHaveLength(2);
    for (const g of gatilhos) expect(g).toMatch(/\{podeEditar && podeVer && cofreOk && \(/);
  });

  it('remover pede edição e "Ver acessos de portais", mas continua sem a chave (D6, D8)', () => {
    expect(codigo).toMatch(/\{podeEditar && podeVer && \(\s*<ConfirmDialog/);
  });

  it('revelar e copiar ficam desligados sem a permissão ou sem a chave, com o motivo à vista', () => {
    expect(codigo).toMatch(/const motivo = !podeVer \? SEM_PERMISSAO_VER : !cofreOk \? SEM_CHAVE : null;/);
    expect(codigo.match(/disabled=\{Boolean\(motivo\) \|\| ocupado\}/g)).toHaveLength(2);
    expect(codigo).toMatch(/\{!cofreOk && <p[^>]*>\{SEM_CHAVE\}<\/p>\}/);
  });
});
