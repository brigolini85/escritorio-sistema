import { describe, expect, it } from 'vitest';
import { camposLegiveis, rotuloEtapa } from './decisoes';

describe('rotuloEtapa', () => {
  it('ferramenta conhecida em português; desconhecida humanizada', () => {
    expect(rotuloEtapa('abrir_chamado')).toBe('Abriu uma demanda');
    expect(rotuloEtapa('orientacoes_cortadas')).toBe('Orientações cortadas');
    expect(rotuloEtapa('classificar_intencao')).toBe('Classificar intencao');
    expect(rotuloEtapa('assistente:listar')).toBe('Assistente listar');
  });
});

describe('camposLegiveis', () => {
  it('objeto vira linhas; valores simples em texto, estruturas em bloco', () => {
    expect(camposLegiveis({ setor: 'Fiscal', urgente: true, valor_frete: 12.5, itens: ['a', 'b'], vazio: null, pedido: { x: 1 } })).toEqual([
      { chave: 'Setor', valor: 'Fiscal', bloco: false },
      { chave: 'Urgente', valor: 'sim', bloco: false },
      { chave: 'Valor frete', valor: '12,5', bloco: false },
      { chave: 'Itens', valor: 'a, b', bloco: false },
      { chave: 'Vazio', valor: '—', bloco: false },
      { chave: 'Pedido', valor: '{\n  "x": 1\n}', bloco: true },
    ]);
  });
  it('texto longo em bloco; nada ou valor solto', () => {
    expect(camposLegiveis({ texto: 'x'.repeat(100) })[0]!.bloco).toBe(true);
    expect(camposLegiveis(null)).toEqual([]);
    expect(camposLegiveis('ok')).toEqual([{ chave: 'Valor', valor: 'ok', bloco: false }]);
  });
});

it('passar_para_pessoa tem rótulo', () => expect(rotuloEtapa('passar_para_pessoa')).toBe('Passou para uma pessoa'));
