import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// A ação do servidor (server-only) não entra neste teste: só o botão é conferido.
vi.mock('@/lib/contato-arquivado-acoes', () => ({ consultarContatoArquivado: vi.fn() }));

// O vitest compila o JSX do componente no modo clássico (sem o runtime automático do Next): React vai para o global.
(globalThis as { React?: unknown }).React = React;

async function botao(verificando: boolean) {
  const { BotaoCadastrarContato, ContextoCadastroContato } = await import('./form-cadastro-contato');
  return renderToStaticMarkup(
    React.createElement(ContextoCadastroContato.Provider, { value: { verificando } },
      React.createElement(BotaoCadastrarContato, { size: 'sm' }, 'Cadastrar contato')),
  );
}

describe('BotaoCadastrarContato (conferência do telefone)', () => {
  it('conferindo o telefone: desabilitado e ocupado, com o texto de sempre', async () => {
    const html = await botao(true);
    expect(html).toMatch(/ disabled=""/);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Cadastrar contato');
  });
  it('fora da conferência: habilitado', async () => {
    const html = await botao(false);
    expect(html).not.toMatch(/ disabled=""/);
    expect(html).not.toContain('aria-busy');
  });
});
