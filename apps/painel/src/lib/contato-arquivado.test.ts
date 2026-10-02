// apps/painel/src/lib/contato-arquivado.test.ts
import { describe, expect, it } from 'vitest';
import { lerContatoArquivado, marcacoesDoVinculo, TEXTO_LGPD } from './contato-arquivado';

// Sobra 5 da Parte B: a tela pergunta quais empresas de antes voltam; a da ação sempre entra e não aparece.
const W = '16000000-0000-4000-8000-000000000001';
const X = '16000000-0000-4000-8000-000000000002';
const bruto = {
  id: 'c1', nome: 'Zé Antigo', anonimizado: false,
  vinculos: [
    { cliente_id: W, razao_social: 'Indústria W Ltda', nome_fantasia: null, pode_pedir_nota: true, pode_atualizar_preco: false },
    { cliente_id: X, razao_social: 'Indústria X Ltda', nome_fantasia: 'Indústria X', pode_pedir_nota: false, pode_atualizar_preco: true },
  ],
};

describe('lerContatoArquivado', () => {
  it('telefone livre ou contato ativo: nada a perguntar', () => {
    expect(lerContatoArquivado(null, null)).toEqual({ situacao: 'livre' });
  });
  it('contato apagado (LGPD)', () => {
    expect(lerContatoArquivado({ id: 'c1', anonimizado: true, vinculos: [] }, null)).toEqual({ situacao: 'anonimizado' });
    expect(TEXTO_LGPD).toBe('Os dados deste contato foram apagados (LGPD). Ele não volta.');
  });
  it('arquivado: empresas de antes com o nome que a equipe conhece e as marcações', () => {
    expect(lerContatoArquivado(bruto, null)).toEqual({
      situacao: 'arquivado', nome: 'Zé Antigo', empresaNova: null,
      vinculos: [
        { clienteId: W, empresa: 'Indústria W Ltda', podePedirNota: true, podeMudarPreco: false },
        { clienteId: X, empresa: 'Indústria X', podePedirNota: false, podeMudarPreco: true },
      ],
    });
  });
  it('a empresa da ação não aparece na pergunta (sempre entra)', () => {
    const r = lerContatoArquivado(bruto, W);
    expect(r.situacao === 'arquivado' && r.vinculos.map((v) => v.clienteId)).toEqual([X]);
  });
  it('resposta estranha do banco vira erro', () => {
    expect(() => lerContatoArquivado({ vinculos: 'x' }, null)).toThrow('Resposta inválida do banco.');
  });
});

describe('marcacoesDoVinculo', () => {
  it('diz o que a pessoa podia naquela empresa', () => {
    expect(marcacoesDoVinculo({ clienteId: W, empresa: 'W', podePedirNota: true, podeMudarPreco: true }))
      .toBe('pode pedir nota · pode mudar preço e cadastrar produto');
    expect(marcacoesDoVinculo({ clienteId: W, empresa: 'W', podePedirNota: false, podeMudarPreco: false }))
      .toBe('Só conversa (não pede nota nem muda preço)');
  });
});
