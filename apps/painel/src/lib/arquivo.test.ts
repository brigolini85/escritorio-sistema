// apps/painel/src/lib/arquivo.test.ts
import { describe, expect, it } from 'vitest';
import { avisoAbertas, descreverArquivamento, ehTipoCadastro, fraseDoUso, lerRestauroUnidade, lerUso, modoDaExclusao, temHistorico, textosDaJanela, textosRestaurarComRede } from './arquivo';

const uso = (contagens: Record<string, number>, abertas: number[] = []) => ({ contagens, abertas });

describe('uso do cadastro', () => {
  it('lê o jsonb do banco e recusa formato estranho', () => {
    expect(lerUso({ contagens: { demandas: 3, precos: 0 }, abertas: [1038] })).toEqual(uso({ demandas: 3, precos: 0 }, [1038]));
    expect(() => lerUso(null)).toThrow('Resposta inválida do banco.');
    expect(() => lerUso({ contagens: { demandas: '3' }, abertas: [] })).toThrow('Resposta inválida do banco.');
    expect(() => lerUso({ contagens: {}, abertas: 'x' })).toThrow('Resposta inválida do banco.');
  });
  it('qualquer contagem acima de zero é histórico', () => {
    expect(temHistorico(uso({ demandas: 0, precos: 0 }))).toBe(false);
    expect(temHistorico(uso({ demandas: 0, pedidos: 1 }))).toBe(true);
  });
  it('apaga de vez só o que nunca foi usado, e só para o administrador', () => {
    expect(modoDaExclusao(uso({ demandas: 0 }), true)).toBe('excluir');
    expect(modoDaExclusao(uso({ demandas: 0 }), false)).toBe('arquivar');
    expect(modoDaExclusao(uso({ demandas: 1 }), true)).toBe('arquivar');
  });
  it('tipos de cadastro', () => {
    expect(ehTipoCadastro('rede')).toBe(true);
    expect(ehTipoCadastro('banana')).toBe(false);
  });
});

describe('textos da janela (spec 4.6 e 5.1)', () => {
  it('a frase do exemplo do spec', () => {
    expect(fraseDoUso('cliente', uso({ demandas: 3, conversas: 47, precos: 14, mensagens: 0 })))
      .toBe('3 demandas, 14 preços e 47 conversas ficam guardados. Sai das listas e do agente.');
  });
  it('singular, plural e feminino', () => {
    expect(fraseDoUso('contato', uso({ conversas: 1, demandas: 0 }))).toBe('1 conversa fica guardada. Sai das listas e do agente.');
    expect(fraseDoUso('produto', uso({ precos: 1, pedidos: 0 }))).toBe('1 preço fica guardado. Sai das listas e do agente.');
    expect(fraseDoUso('cliente', uso({ demandas: 2, conversas: 5 }))).toBe('2 demandas e 5 conversas ficam guardadas. Sai das listas e do agente.');
  });
  it('pessoa: sai das listas e não entra mais', () => {
    expect(fraseDoUso('usuario', uso({ demandas: 4 }))).toBe('4 demandas ficam guardadas. Sai das listas e não entra mais no painel.');
  });
  it('arquivar o que nunca foi usado (quem não é administrador)', () => {
    expect(fraseDoUso('produto', uso({ precos: 0, pedidos: 0 }))).toBe('Nunca foi usado. Sai das listas e do agente.');
  });
  it('contagem nova que a tela não conhece ainda aparece', () => {
    expect(fraseDoUso('cliente', uso({ boletos_enviados: 2 }))).toBe('2 boletos enviados ficam guardados. Sai das listas e do agente.');
  });
  it('demandas abertas: avisa com os números, sem bloquear', () => {
    expect(avisoAbertas([])).toBeNull();
    expect(avisoAbertas([1038])).toBe('1 demanda ainda aberta (#1038)');
    expect(avisoAbertas([1038, 1040])).toBe('2 demandas ainda abertas (#1038, #1040)');
    expect(avisoAbertas([1, 2, 3, 4, 5])).toBe('5 demandas ainda abertas (#1, #2, #3 e mais 2)');
  });
  it('janela de arquivar e de excluir de vez (imagens 01 e 02)', () => {
    expect(textosDaJanela('cliente', uso({ demandas: 3 }, [1038]), true)).toEqual({
      modo: 'arquivar', verbo: 'Arquivar', descricao: '3 demandas ficam guardadas. Sai das listas e do agente.',
      aviso: '1 demanda ainda aberta (#1038)', confirmar: 'Sim, arquivar', enviando: 'Arquivando…',
    });
    expect(textosDaJanela('cliente', uso({ demandas: 0 }), true)).toEqual({
      modo: 'excluir', verbo: 'Excluir de vez',
      descricao: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
      aviso: null, confirmar: 'Excluir de vez', enviando: 'Excluindo…',
    });
    expect(textosDaJanela('usuario', uso({ demandas: 0 }), true).descricao)
      .toBe('Nunca atendeu: nenhuma conversa, demanda ou preço. O acesso ao login também é removido. Não dá para desfazer.');
  });
  it('nenhum texto com "Tem certeza", "por favor" ou "com sucesso"', () => {
    const todos = JSON.stringify([
      textosDaJanela('cliente', uso({ demandas: 1 }, [1]), false), textosDaJanela('usuario', uso({}), true),
      descreverArquivamento(null, null), descreverArquivamento('2026-10-02T15:00:00Z', 'Ana'),
    ]);
    expect(todos).not.toMatch(/tem certeza|por favor|com sucesso/i);
  });
  it('quem e quando arquivou', () => {
    expect(descreverArquivamento('2026-10-02T15:00:00Z', 'Ana')).toBe('Arquivado em 02/10/2026 por Ana.');
    expect(descreverArquivamento('2026-10-02T15:00:00Z', null)).toBe('Arquivado em 02/10/2026.');
    expect(descreverArquivamento(null, null)).toBe('Arquivado antes do registro de datas.');
  });
});

describe('restaurar unidade de rede arquivada (sobra 3)', () => {
  const rede = { id: 'r1', nome: 'Rede Arquivo', tipo: 'cliente' as const };
  it('lê a resposta do banco', () => {
    expect(lerRestauroUnidade({ restaurada: true, rede_restaurada: true })).toEqual({ restaurada: true, redeRestaurada: true });
    expect(lerRestauroUnidade({ restaurada: false, rede_arquivada: rede })).toEqual({ restaurada: false, rede });
    expect(() => lerRestauroUnidade({ restaurada: false })).toThrow('Resposta inválida do banco.');
  });
  it('textos da pergunta, para rede e para fornecedor', () => {
    expect(textosRestaurarComRede(rede, 'Unidade Usada')).toEqual({
      artigo: 'a rede', confirmar: 'Restaurar as duas',
      descricao: 'A rede Rede Arquivo está arquivada. Sem ela, Unidade Usada volta mas não aparece na ficha.',
    });
    expect(textosRestaurarComRede({ ...rede, nome: 'Frigorífico', tipo: 'fornecedor' }, 'Filial 2')).toEqual({
      artigo: 'o fornecedor', confirmar: 'Restaurar os dois',
      descricao: 'O fornecedor Frigorífico está arquivado. Sem ele, Filial 2 volta mas não aparece na ficha.',
    });
  });
});
