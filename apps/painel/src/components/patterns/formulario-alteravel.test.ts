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
