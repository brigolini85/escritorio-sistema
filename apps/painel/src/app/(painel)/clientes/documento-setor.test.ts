import { describe, expect, it, vi } from 'vitest';
import { lerDocumentosDaEmpresa, lerSetorDoDocumento, lerSetoresDeDocumento, setoresEscolhiveis } from './documento-setor';
vi.mock('server-only', () => ({}));

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

// Onda final (Minor 4): erro ao ler os documentos não vira "Nenhum documento" com o envio sem setor (iria para todos).
describe('lerDocumentosDaEmpresa', () => {
  // Cada leitura devolve a próxima resposta da fila (a 1ª com setor; a 2ª, sem a migração, como antes).
  const sbCom = (...respostas: { data: unknown; error: { code: string } | null }[]) => ({
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve(respostas.shift()) }) }) }),
  });
  const doc = { id: 'd1', nome: 'Contrato', arquivo_nome: 'c.pdf', ia_pode_enviar: true };
  it('com a H2: lista com setor', async () => {
    expect(await lerDocumentosDaEmpresa(sbCom({ data: [{ ...doc, setor_id: null, tem_valores: false }], error: null }) as never, 'c1'))
      .toEqual({ lista: [{ ...doc, setor_id: null, tem_valores: false }], comSetor: true });
  });
  it('banco sem a migração: lê como antes, sem setor', async () => {
    expect(await lerDocumentosDaEmpresa(sbCom({ data: null, error: { code: '42703' } }, { data: [doc], error: null }) as never, 'c1'))
      .toEqual({ lista: [doc], comSetor: false });
  });
  it('erro de verdade: null (a tela avisa e esconde o envio)', async () => {
    expect(await lerDocumentosDaEmpresa(sbCom({ data: null, error: { code: '500' } }) as never, 'c1')).toBeNull();
    expect(await lerDocumentosDaEmpresa(sbCom({ data: null, error: { code: '42703' } }, { data: null, error: { code: '500' } }) as never, 'c1')).toBeNull();
  });
});
