import { describe, expect, it } from 'vitest';
import { PedidoTeste } from '../app/(painel)/treinar-agente/simulacao';
import { comoTestar } from './testar-setor';

describe('comoTestar (D11)', () => {
  it('Thiago, setor com Conversa, só Trabalho, banco sem a I3b', () => {
    expect(comoTestar({ portaDeEntrada: true, tipos: ['conversa'] }, false)).toBe('thiago');
    expect(comoTestar({ portaDeEntrada: false, tipos: ['conversa'] }, true)).toBe('setor');
    expect(comoTestar({ portaDeEntrada: false, tipos: ['conversa', 'trabalho'] }, true)).toBe('setor');
    expect(comoTestar({ portaDeEntrada: false, tipos: ['trabalho'] }, true)).toBe('trabalho');
    expect(comoTestar({ portaDeEntrada: false, tipos: ['conversa'] }, false)).toBe('sem_i3b');
  });
});

describe('PedidoTeste com agente e modo', () => {
  it('aceita o endereço do agente e um dos três modos; recusa o resto', () => {
    expect(PedidoTeste.safeParse({ mensagem: 'Oi', clienteId: null, rascunho: null, agente: 'fiscal', modo: 'por_tras' }).success).toBe(true);
    expect(PedidoTeste.safeParse({ mensagem: 'Oi', clienteId: null, rascunho: null, agente: 'Fiscal!', modo: null }).success).toBe(false);
    expect(PedidoTeste.safeParse({ mensagem: 'Oi', clienteId: null, rascunho: null, agente: 'fiscal', modo: 'gritando' }).success).toBe(false);
  });
});
