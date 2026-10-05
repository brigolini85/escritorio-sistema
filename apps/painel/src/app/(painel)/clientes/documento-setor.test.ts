import { describe, expect, it } from 'vitest';
import { lerSetorDoDocumento } from './documento-setor';

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
