import { describe, expect, it } from 'vitest';
import { ClienteForm, ContatoForm } from './esquemas';

describe('ClienteForm', () => {
  it('normaliza o CNPJ e recusa inválido', () => {
    expect(ClienteForm.parse({ razao_social: 'Indústria X', cnpj: '11.222.333/0001-81' }).cnpj).toBe('11222333000181');
    expect(ClienteForm.safeParse({ razao_social: 'X', cnpj: '11222333000182' }).success).toBe(false);
  });
});

describe('ContatoForm', () => {
  it('normaliza o telefone e converte caixas de seleção', () => {
    const c = ContatoForm.parse({ nome: 'João', telefone: '(31) 99999-0001', pode_pedir_nota: 'on' });
    expect(c).toEqual({ nome: 'João', telefone: '5531999990001', pode_pedir_nota: true, pode_atualizar_preco: false });
  });
  it('recusa telefone inválido', () => {
    expect(ContatoForm.safeParse({ nome: 'João', telefone: '123' }).success).toBe(false);
  });
});
