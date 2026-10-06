import { describe, expect, it } from 'vitest';
import { textoComoAtua } from './faixas';

const base = { semI2: false, estado: 'desligado' as const, modo: 'mesma_voz' as const, tipos: ['conversa' as const], setor: 'Fiscal', contatosTeste: 0 };

describe('faixa da ficha pelo estado (D14)', () => {
  it('cada situação, na ordem de prioridade', () => {
    expect(textoComoAtua({ ...base, semI2: true, estado: 'ligado' })).toEqual({
      texto: 'Os agentes dos setores passam a atender quando a atualização do banco da Parte I2 for aplicada.', aviso: true });
    expect(textoComoAtua({ ...base, tipos: ['trabalho'], estado: 'ligado' }).texto).toBe('Ligado: recebe tarefas das demandas do setor Fiscal.');
    expect(textoComoAtua(base)).toEqual({ texto: 'Desligado: o Thiago atende como sempre.', aviso: false });
    expect(textoComoAtua({ ...base, estado: 'teste', modo: null })).toEqual({ texto: 'Escolha como fala com o cliente: sem isso o agente não atende.', aviso: true });
    expect(textoComoAtua({ ...base, estado: 'teste', contatosTeste: 2 }).texto)
      .toBe('Em teste: atende só os contatos da lista (2). Com os outros, o Thiago segue como sempre.');
    expect(textoComoAtua({ ...base, estado: 'ligado' }).texto).toBe('Ligado: atende quando o Thiago identifica um assunto do setor Fiscal.');
  });
});
