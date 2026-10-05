import { describe, expect, it } from 'vitest';
import { lerSetorDoDocumento, lerSetoresDeDocumento, setoresEscolhiveis } from './documento-setor';

// Parte H2 (D11): documento com setor (sem setor = da empresa) e "Tem valores".
const form = (c: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(c)) f.append(k, v); return f; };
describe('lerSetorDoDocumento', () => {
  it('sem o campo (banco sem a migração): null, e o envio fica como antes', () => {
    expect(lerSetorDoDocumento(form({ nome: 'x' }), ['s1'])).toBeNull();
  });
  it('vazio = documento da empresa; caixa marcada = tem valores', () => {
    expect(lerSetorDoDocumento(form({ setor_id: '', tem_valores: 'on' }), ['s1'])).toEqual({ setor_id: null, tem_valores: true });
    expect(lerSetorDoDocumento(form({ setor_id: 's1' }), ['s1'])).toEqual({ setor_id: 's1', tem_valores: false });
  });
  it('setor que não está na lista é recusado', () => {
    expect(lerSetorDoDocumento(form({ setor_id: 'zz' }), ['s1'])).toEqual({ erro: 'Escolha um setor da lista.' });
  });
});

// Fix round 1: o setor atual nunca some sem querer (um documento sem setor iria para todos os contatos com documentos).
describe('setor atual e setores que não podem ser escolhidos', () => {
  it('setor atual fora da lista = mantém', () => {
    expect(lerSetorDoDocumento(form({ setor_id: 'velho', tem_valores: 'on' }), ['s1'], 'velho')).toEqual({ setor_id: 'velho', tem_valores: true });
  });
  it('escolher setor inativo novo = recusa', () => {
    expect(lerSetorDoDocumento(form({ setor_id: 'inativo' }), ['s1'], 's1')).toEqual({ erro: 'Escolha um setor da lista.' });
    expect(lerSetorDoDocumento(form({ setor_id: 'inativo' }), ['s1'], null)).toEqual({ erro: 'Escolha um setor da lista.' });
  });
  it('escolhíveis: ativos menos Direção', () => {
    expect(setoresEscolhiveis([
      { id: 'a', nome: 'Fiscal', ativo: true }, { id: 'b', nome: 'Direção', ativo: true }, { id: 'c', nome: 'Antigo', ativo: false },
    ]).map((s) => s.id)).toEqual(['a']);
  });
  it('erro ao ler setores não vira lista vazia', async () => {
    const sb = { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: null, error: { code: '500' } }) }) }) };
    await expect(lerSetoresDeDocumento(sb as never)).rejects.toThrow('Não foi possível ler os setores agora. Tente de novo.');
  });
});
