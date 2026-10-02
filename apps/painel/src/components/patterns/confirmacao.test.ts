import { describe, expect, it } from 'vitest';
import { APARENCIA_CONFIRMACAO, textoConfere, tipoPadrao } from './confirmacao';

describe('textoConfere', () => {
  it('ignora espaços extras e maiúsculas', () => {
    expect(textoConfere('  joão   lima ', 'João Lima')).toBe(true);
  });
  it('acento e nome diferente não confirmam', () => {
    expect(textoConfere('Joao Lima', 'João Lima')).toBe(false);
    expect(textoConfere('João', 'João Lima')).toBe(false);
  });
  it('esperado vazio nunca confirma', () => {
    expect(textoConfere('', '')).toBe(false);
    expect(textoConfere(' ', '  ')).toBe(false);
  });
});

describe('aparência da confirmação (spec 4.5)', () => {
  it('arquivar champanhe com botão vinho, excluir grafite, concluir verde', () => {
    expect(APARENCIA_CONFIRMACAO.arquivar).toEqual({ anel: 'border-champagne', icone: 'text-champagne-text', botao: 'primary' });
    expect(APARENCIA_CONFIRMACAO.excluir).toEqual({ anel: 'border-grafite', icone: 'text-foreground', botao: 'grafite' });
    expect(APARENCIA_CONFIRMACAO.concluir).toEqual({ anel: 'border-success', icone: 'text-success', botao: 'success' });
    expect(APARENCIA_CONFIRMACAO.perigo).toEqual({ anel: 'border-danger', icone: 'text-danger', botao: 'danger' });
    expect(APARENCIA_CONFIRMACAO.neutro).toEqual({ anel: 'border-brand', icone: 'text-brand', botao: 'primary' });
  });
  it('sem tipo, a variante antiga decide', () => {
    expect(tipoPadrao('danger')).toBe('perigo');
    expect(tipoPadrao('primary')).toBe('neutro');
    expect(tipoPadrao(undefined)).toBe('perigo'); // o padrão de hoje do ConfirmDialog é danger
  });
});
