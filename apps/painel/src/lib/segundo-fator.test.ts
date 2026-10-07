import { describe, expect, it } from 'vitest';
import { codigoDoFormulario, destinoDepoisDoFator, ehTelaDoSegundoFator } from './segundo-fator';

describe('segundo fator: regras puras (item 8)', () => {
  it('código: só 6 números (espaços do aplicativo são aceitos)', () => {
    expect(codigoDoFormulario('123456')).toBe('123456');
    expect(codigoDoFormulario(' 123 456 ')).toBe('123456');
    expect(codigoDoFormulario('12345')).toBeNull();
    expect(codigoDoFormulario('1234567')).toBeNull();
    expect(codigoDoFormulario('12a456')).toBeNull();
    expect(codigoDoFormulario(null)).toBeNull();
  });
  it('destino depois do código: lista fixa (sem redirecionamento aberto)', () => {
    expect(destinoDepoisDoFator('senha')).toBe('/definir-senha');
    expect(destinoDepoisDoFator(undefined)).toBe('/inicio');
    expect(destinoDepoisDoFator('https://malicioso.example')).toBe('/inicio');
    expect(destinoDepoisDoFator('/clientes')).toBe('/inicio');
  });
  it('tela do segundo fator: caminho exato', () => {
    expect(ehTelaDoSegundoFator('/segundo-fator')).toBe(true);
    expect(ehTelaDoSegundoFator('/segundo-fator/')).toBe(true);
    expect(ehTelaDoSegundoFator('/segundo-fator-x')).toBe(false);
    expect(ehTelaDoSegundoFator('/inicio')).toBe(false);
  });
});
