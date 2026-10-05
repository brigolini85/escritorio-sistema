import { describe, expect, it } from 'vitest';
import { marcosDaConversa } from './conversa-itens';
import { rotuloEtapa } from './decisoes';

describe('marcos e decisões dos agentes dos setores (D18)', () => {
  it('passou e devolveu a conversa', () => {
    const m = marcosDaConversa({ demandas: [], transferencias: [], eventos: [
      { id: 'e1', tipo: 'agente_assumiu', texto: 'Agente Fiscal', criado_em: '1', usuario: null },
      { id: 'e2', tipo: 'agente_devolveu', texto: 'Agente Fiscal: pediu o boleto', criado_em: '2', usuario: null },
      { id: 'e3', tipo: 'agente_devolveu', texto: 'Agente Fiscal', criado_em: '3', usuario: null },
    ] });
    expect(m.map((x) => x.texto)).toEqual(['Conversa passada ao Agente Fiscal', 'Agente Fiscal devolveu a conversa ao Thiago: pediu o boleto',
      'Agente Fiscal devolveu a conversa ao Thiago']);
  });
  it('rótulos das decisões novas', () => {
    expect(rotuloEtapa('chamar_agente')).toBe('Chamou um agente do setor');
    expect(rotuloEtapa('pre_analise_nota')).toBe('Pré-analisou o pedido de nota');
    expect(rotuloEtapa('nota_interna')).toBe('Sugeriu nota interna');
  });
});
