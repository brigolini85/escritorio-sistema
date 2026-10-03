import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

(globalThis as { React?: unknown }).React = React;

describe('FormularioConfig', () => {
  it('formulário com nome, rodapé com contagem, Descartar e o Salvar do cartão', async () => {
    const { FormularioConfig, RodapeConfig } = await import('./formulario-config');
    const html = renderToStaticMarkup(React.createElement(FormularioConfig, { acao: async () => ({ ok: true as const, mensagem: 'ok' }), rotulo: 'Expediente' },
      React.createElement(RodapeConfig, { salvar: 'Salvar expediente', aviso: 'Usado no cálculo dos prazos.' })));
    expect(html).toContain('aria-label="Expediente"');
    expect(html).toContain('Sem alterações');
    expect(html).toContain('Descartar');
    expect(html).toContain('Salvar expediente');
    expect(html).toContain('Usado no cálculo dos prazos.');
    expect(html).not.toContain('role="alert"');
  });
});
