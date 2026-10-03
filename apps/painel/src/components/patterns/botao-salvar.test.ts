import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// Formulário enviado à mão: o useFormStatus não vê o envio, então "enviando" é quem trava o botão (duplo clique).
// O vitest compila o JSX do componente no modo clássico (sem o runtime automático do Next): React vai para o global.
(globalThis as { React?: unknown }).React = React;

async function botao(props: { enviando?: boolean }) {
  const { BotaoSalvar } = await import('./formulario-alteravel');
  return renderToStaticMarkup(React.createElement(BotaoSalvar, props, 'Salvar'));
}

describe('BotaoSalvar enviando', () => {
  it('enviando: desabilitado e ocupado', async () => {
    const html = await botao({ enviando: true });
    expect(html).toMatch(/ disabled=""/);
    expect(html).toContain('aria-busy="true"');
  });
  it('sem enviando: habilitado', async () => {
    const html = await botao({});
    expect(html).not.toMatch(/ disabled=""/);
    expect(html).not.toContain('aria-busy');
  });
});
