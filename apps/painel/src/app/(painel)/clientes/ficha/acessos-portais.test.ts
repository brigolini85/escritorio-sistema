import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Spec 7D.1 item 8 (D5–D8): o bloco de acessos é componente do navegador; o painel não tem testes de componente,
// então a guarda lê o código e confere o que não pode faltar (o e2e da Task 13 confere o comportamento).
const codigo = readFileSync(new URL('./acessos-portais.tsx', import.meta.url), 'utf8');

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
