import { describe, expect, it } from 'vitest';
import { detalheEstadoAgente, estadoPelaPausaGeral, tituloEstadoAgente } from './estado-agente';

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
