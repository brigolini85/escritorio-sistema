import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// Sem DOM: confere o primeiro desenho (nada alterado). O comportamento com digitação é coberto pelos e2e de Configurações.
(globalThis as { React?: unknown }).React = React;

describe('peças de Configurações no FormularioAlteravel', () => {
  it('Descartar começa desabilitado; contagem diz "Sem alterações"; antes não aparece', async () => {
    const { Antes, BotaoDescartar, FormularioAlteravel, IndicadorAlteracoes } = await import('./formulario-alteravel');
    const html = renderToStaticMarkup(React.createElement(FormularioAlteravel, { marcarAlterados: true },
      React.createElement(IndicadorAlteracoes, { contar: true }),
      React.createElement(Antes, { campo: 'x', texto: '18:00' }),
      React.createElement(BotaoDescartar, null)));
    expect(html).toContain('Sem alterações');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Descartar<\/button>/);
    expect(html).not.toContain('antes:');
    // marcarAlterados e salvarParaSair não vão para o HTML do formulário.
    expect(html).not.toContain('marcarAlterados');
    expect(html).not.toContain('marcaralterados');
  });
  it('sem contar: o indicador de sempre (Parte D), escondido', async () => {
    const { FormularioAlteravel, IndicadorAlteracoes } = await import('./formulario-alteravel');
    const html = renderToStaticMarkup(React.createElement(FormularioAlteravel, null, React.createElement(IndicadorAlteracoes, null)));
    expect(html).toContain('sr-only');
    expect(html).not.toContain('Sem alterações');
  });
});

// Sem jsdom no painel: classes mínimas no lugar das do navegador, só com o que o rastreador de alterações lê.
class FakeCampo {
  name = '';
  id = '';
  private attrs = new Map<string, string>();
  getAttribute(n: string) { return this.attrs.get(n) ?? null; }
  setAttribute(n: string, v: string) { this.attrs.set(n, v); }
  toggleAttribute(n: string, f: boolean) { if (f) this.attrs.set(n, ''); else this.attrs.delete(n); return f; }
  setCustomValidity() {}
}
class FakeInput extends FakeCampo { type = 'text'; value = ''; defaultValue = ''; checked = false; defaultChecked = false; }
class FakeTextArea extends FakeCampo { value = ''; defaultValue = ''; }
type Opcao = { value: string; selected: boolean; defaultSelected: boolean };
class FakeSelect extends FakeCampo {
  multiple = false;
  options: Opcao[] = [];
  get selectedIndex() { return this.options.findIndex((o) => o.selected); }
  set selectedIndex(i: number) { this.options.forEach((o, j) => { o.selected = j === i; }); }
}
class FakeButton extends FakeCampo { clicks = 0; click() { this.clicks += 1; } }
const g = globalThis as Record<string, unknown>;
g.HTMLInputElement ??= FakeInput;
g.HTMLTextAreaElement ??= FakeTextArea;
g.HTMLSelectElement ??= FakeSelect;
g.HTMLButtonElement ??= FakeButton;

function formFalso(elements: FakeCampo[]) {
  const eventos: string[] = [];
  return { form: { elements, dispatchEvent: (e: Event) => { eventos.push(e.type); return true; } } as unknown as HTMLFormElement, eventos };
}
function selectSalvo(nome: string, valores: string[], salvo: string) {
  const s = new FakeSelect();
  s.name = nome;
  s.options = valores.map((v) => ({ value: v, selected: v === salvo, defaultSelected: v === salvo }));
  return s;
}

describe('fixarComoSalvo (salvar sem recarregar)', () => {
  it('select trocado e salvo: deixa de contar como alteração e avisa o formulário', async () => {
    const { contarAlteracoes, fixarComoSalvo } = await import('./formulario-alteravel');
    const modelo = selectSalvo('modelo', ['a', 'b'], 'a');
    const texto = new FakeInput();
    texto.name = 'nome';
    texto.defaultValue = 'Fiscal';
    texto.value = 'Fiscal 2';
    const caixa = new FakeInput();
    caixa.type = 'checkbox';
    caixa.name = 'ativo';
    caixa.checked = true;
    const area = new FakeTextArea();
    area.name = 'resposta';
    area.value = 'nova';
    const { form, eventos } = formFalso([modelo, texto, caixa, area]);
    modelo.selectedIndex = 1;
    expect(contarAlteracoes(form)).toBe(4);
    fixarComoSalvo(form);
    expect(contarAlteracoes(form)).toBe(0);
    expect(modelo.options.map((o) => o.defaultSelected)).toEqual([false, true]);
    expect(texto.defaultValue).toBe('Fiscal 2');
    expect(caixa.defaultChecked).toBe(true);
    expect(area.defaultValue).toBe('nova');
    // O evento "input" faz o FormularioAlteravel conferir de novo e tirar o data-alterado (âmbar).
    expect(eventos).toContain('input');
  });
  it('Switch do Radix mudado e salvo: o valor de agora vira o inicial', async () => {
    const { contarAlteracoes, fixarComoSalvo } = await import('./formulario-alteravel');
    const chave = new FakeButton();
    chave.name = 'ativo';
    chave.setAttribute('data-inicial', 'false');
    chave.setAttribute('aria-checked', 'true');
    const { form } = formFalso([chave]);
    expect(contarAlteracoes(form)).toBe(1);
    fixarComoSalvo(form);
    expect(contarAlteracoes(form)).toBe(0);
  });
});

describe('restaurarCampos', () => {
  it('Switch do Radix mudado volta com um clique; o que não mudou não é clicado', async () => {
    const { restaurarCampos } = await import('./formulario-alteravel');
    const mudada = new FakeButton();
    mudada.setAttribute('data-inicial', 'false');
    mudada.setAttribute('aria-checked', 'true');
    const igual = new FakeButton();
    igual.setAttribute('data-inicial', 'true');
    igual.setAttribute('aria-checked', 'true');
    const enviar = new FakeButton();
    const modelo = selectSalvo('modelo', ['a', 'b'], 'a');
    modelo.selectedIndex = 1;
    const { form, eventos } = formFalso([mudada, igual, enviar, modelo]);
    restaurarCampos(form);
    expect(mudada.clicks).toBe(1);
    expect(igual.clicks).toBe(0);
    expect(enviar.clicks).toBe(0);
    expect(modelo.selectedIndex).toBe(0);
    expect(eventos).toContain('input');
  });
});
