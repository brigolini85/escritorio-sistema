import { describe, expect, it } from 'vitest';
import { detalheEstadoAgente, estadoDaConversa, estadoGeralDoAgente, estadoPelaPausaGeral, tituloEstadoAgente } from './estado-agente';

describe('estado do agente', () => {
  it('pausa geral vem da configuração; sem leitura (RLS) não mostra nada', () => {
    expect(estadoPelaPausaGeral(null)).toBeNull();
    expect(estadoPelaPausaGeral(false)).toEqual({ tipo: 'ativo' });
    expect(estadoPelaPausaGeral(true)).toEqual({ tipo: 'pausado', motivo: 'geral' });
  });
  it('títulos', () => {
    expect(tituloEstadoAgente({ tipo: 'ativo' })).toBe('Agente ativo');
    expect(tituloEstadoAgente({ tipo: 'pausado', motivo: 'teto_ia' })).toBe('Agente pausado');
    expect(tituloEstadoAgente({ tipo: 'assumido', por: 'Maria Souza' })).toBe('Assumida por Maria Souza');
  });
  it('motivos, com complemento quando houver', () => {
    expect(detalheEstadoAgente({ tipo: 'pausado', motivo: 'geral' })).toBe('Pausa geral');
    expect(detalheEstadoAgente({ tipo: 'pausado', motivo: 'teto_ia' })).toBe('Teto de gasto com IA atingido');
    expect(detalheEstadoAgente({ tipo: 'pausado', motivo: 'contato', detalhe: 'João Lima' })).toBe('Pausado para este contato: João Lima');
    expect(detalheEstadoAgente({ tipo: 'pausado', motivo: 'empresa' })).toBe('Pausado para esta empresa');
    expect(detalheEstadoAgente({ tipo: 'pausado' })).toBeNull();
    expect(detalheEstadoAgente({ tipo: 'ativo' })).toBe('Respondendo aos clientes');
  });
});

describe('estadoDaConversa', () => {
  it('assumida > pausa geral > empresa > contato > ativo', () => {
    const base = { assumidaPor: null, pausaGeral: false, empresaPausada: false, contatoPausado: false };
    expect(estadoDaConversa({ ...base, assumidaPor: 'Ana', pausaGeral: true })).toEqual({ tipo: 'assumido', por: 'Ana' });
    expect(estadoDaConversa({ ...base, pausaGeral: true, empresaPausada: true })).toEqual({ tipo: 'pausado', motivo: 'geral' });
    expect(estadoDaConversa({ ...base, empresaPausada: true, contatoPausado: true })).toEqual({ tipo: 'pausado', motivo: 'empresa' });
    expect(estadoDaConversa({ ...base, contatoPausado: true })).toEqual({ tipo: 'pausado', motivo: 'contato' });
    expect(estadoDaConversa(base)).toEqual({ tipo: 'ativo' });
  });
  it('pausa geral desconhecida (sem permissão de leitura): nunca afirma ativo', () => {
    expect(estadoDaConversa({ assumidaPor: null, pausaGeral: null })).toEqual({ tipo: 'com_agente' });
    expect(tituloEstadoAgente({ tipo: 'com_agente' })).toBe('Com o agente');
    expect(estadoDaConversa({ assumidaPor: null, pausaGeral: null, contatoPausado: true })).toEqual({ tipo: 'pausado', motivo: 'contato' });
    expect(estadoDaConversa({ assumidaPor: 'Ana', pausaGeral: null })).toEqual({ tipo: 'assumido', por: 'Ana' });
  });
});

describe('estadoGeralDoAgente', () => {
  it('pausa geral > teto de IA > ativo; sem leitura, null', () => {
    expect(estadoGeralDoAgente(null, true)).toBeNull();
    expect(estadoGeralDoAgente(true, true)).toEqual({ tipo: 'pausado', motivo: 'geral' });
    expect(estadoGeralDoAgente(false, true)).toEqual({ tipo: 'pausado', motivo: 'teto_ia' });
    expect(estadoGeralDoAgente(false, null)).toEqual({ tipo: 'ativo' });
  });
});
