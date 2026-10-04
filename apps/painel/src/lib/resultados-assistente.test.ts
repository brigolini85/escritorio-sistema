import { describe, expect, it } from 'vitest';
import {
  abasVisiveis, arquivoDoPedido, escolherResultado, hrefResultado, lerArquivo, lerChaveResultado, lerConversa, numeroDoCabecalho,
  podeResponderPrevia, type MensagemTela, type ResultadoPedido,
} from './resultados-assistente';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const msg = (n: number, papel: 'usuario' | 'assistente', conteudo: string, extra: Partial<MensagemTela> = {}): MensagemTela => ({
  id: ID(n), papel, conteudo, arquivo: null, processada_em: '2026-10-10T18:00:00Z',
  criado_em: `2026-10-10T18:${String(n).padStart(2, '0')}:00Z`, ...extra,
});
const corpo = (q: number, sub: string, total: string) => [
  'Destinatário: Rede Bom Preço / Unidade Centro',
  `• ${q} PAC Pão de queijo congelado 1kg (cód. 12) × R$ 18,50 = ${sub}`,
  '• 6 UN Bolo de fubá 400g (cód. 31) × R$ 14,00 = R$ 84,00',
  `Total: ${total}`,
  'Pagamento: Boleto 28 dias · Entrega: 03/10',
].join('\n');
const PREVIA = (numero: number, rodape = 'Responda sim para gravar.') =>
  `Prévia do pedido #${numero}:\nAntes:\n${corpo(10, 'R$ 185,00', 'R$ 269,00')}\nDepois:\n${corpo(15, 'R$ 277,50', 'R$ 361,50')}\n\n${rodape}`;
const TABELA = 'São **4 pedidos** em aberto.\n\nPedidos em aberto:\n| Nº | Total |\n|---|---|\n| #1 | R$ 1,00 |\n| #2 | R$ 2,00 |\n| #3 | R$ 3,00 |\n| #4 | R$ 4,00 |\n\nQuer o CSV?';
const CSV = (chamados: string[], partes = 1) => ({ tipo: 'csv_bling', chamados, nome: 'bling-pedidos.csv', partes });

describe('numeroDoCabecalho', () => {
  it('o último "#N" do cabeçalho da prévia; sem número, null (D19)', () => {
    expect(numeroDoCabecalho('Prévia do pedido #536:')).toBe(536);
    expect(numeroDoCabecalho('Corrigi o #12. Prévia do #536:')).toBe(536);
    expect(numeroDoCabecalho('Prévia do pedido:')).toBeNull();
  });
});

describe('lerArquivo', () => {
  it('só o CSV do Bling com nome e demandas; partes no mínimo 1', () => {
    expect(lerArquivo(CSV(['a'], 2))).toEqual({ nome: 'bling-pedidos.csv', partes: 2, chamados: ['a'] });
    expect(lerArquivo({ tipo: 'csv_bling', chamados: ['a'], nome: 'x.csv' })).toEqual({ nome: 'x.csv', partes: 1, chamados: ['a'] });
    expect(lerArquivo({ tipo: 'outro', chamados: [], nome: 'x' })).toBeNull();
    expect(lerArquivo(null)).toBeNull();
  });
});

describe('lerConversa: resposta curta + cartões (D8)', () => {
  it('a tabela sai do balão: texto antes, cartão, texto depois; o título vem da linha "…:" (D9)', () => {
    const l = lerConversa([msg(1, 'usuario', 'quais?'), msg(2, 'assistente', TABELA)], true);
    expect(l.respostas.get(ID(2))).toEqual([
      { tipo: 'texto', texto: 'São **4 pedidos** em aberto.\n\nPedidos em aberto:' },
      { tipo: 'cartao', cartao: { tipo: 'tabela', chave: `tabela-${ID(2)}-0`, rotulo: 'Tabela · 4 linhas' } },
      { tipo: 'texto', texto: 'Quer o CSV?' },
    ]);
    expect(l.resultados).toEqual([expect.objectContaining({
      tipo: 'tabela', chave: `tabela-${ID(2)}-0`, titulo: 'Pedidos em aberto', rotulo: 'Pedidos em aberto (4)', mensagemId: ID(2),
      tabela: { cabecalho: ['Nº', 'Total'], linhas: [['#1', 'R$ 1,00'], ['#2', 'R$ 2,00'], ['#3', 'R$ 3,00'], ['#4', 'R$ 4,00']] },
    })]);
  });

  it('tabela sem título antes: "Tabela das HH:MM" (Brasília)', () => {
    const l = lerConversa([msg(2, 'assistente', '| a | b |\n|---|---|\n| 1 | 2 |')], true);
    expect(l.resultados[0]).toMatchObject({ titulo: 'Tabela das 15:02', rotulo: 'Tabela das 15:02 (1)' });
    expect(l.respostas.get(ID(2))).toEqual([{ tipo: 'cartao', cartao: { tipo: 'tabela', chave: `tabela-${ID(2)}-0`, rotulo: 'Tabela · 1 linha' } }]);
  });

  it('a prévia sai do balão: cabeçalho, cartão "Prévia #N · 1 alteração" (o total não conta) e rodapé', () => {
    const l = lerConversa([msg(3, 'assistente', PREVIA(536))], true);
    expect(l.respostas.get(ID(3))).toEqual([
      { tipo: 'texto', texto: 'Prévia do pedido #536:' },
      { tipo: 'cartao', cartao: { tipo: 'pedido', chave: 'pedido-536', rotulo: 'Prévia #536 · 1 alteração' } },
      { tipo: 'texto', texto: 'Responda sim para gravar.' },
    ]);
    expect(l.resultados[0]).toMatchObject({ tipo: 'pedido', chave: 'pedido-536', numero: 536, rotulo: 'Pedido #536', mensagemId: ID(3), previasNaMensagem: 1 });
  });

  it('o mesmo pedido em duas respostas: uma aba só, com a prévia mais nova (D9)', () => {
    const l = lerConversa([msg(3, 'assistente', PREVIA(536)), msg(5, 'assistente', PREVIA(536, 'Outra?'))], true);
    expect(l.resultados).toHaveLength(1);
    expect(l.resultados[0]).toMatchObject({ chave: 'pedido-536', mensagemId: ID(5) });
  });

  it('prévia sem número: chave pela mensagem, aba "Prévia de pedido" (D19)', () => {
    const l = lerConversa([msg(3, 'assistente', PREVIA(536).replace('#536', ''))], true);
    expect(l.resultados[0]).toMatchObject({ chave: `previa-${ID(3)}-0`, numero: null, rotulo: 'Prévia de pedido' });
  });

  it('duas prévias na mesma resposta: dois cartões e previasNaMensagem = 2', () => {
    const l = lerConversa([msg(3, 'assistente', `${PREVIA(536, '')}\n\n${PREVIA(537)}`)], true);
    expect(l.resultados.map((r) => r.chave).sort()).toEqual(['pedido-536', 'pedido-537']);
    expect((l.resultados[0] as ResultadoPedido).previasNaMensagem).toBe(2);
  });

  it('arquivo: cartão no fim da resposta e aba "Arquivos" por último; sem "Corrigir e gerar", nada (D12)', () => {
    const msgs = [msg(2, 'assistente', TABELA), msg(4, 'assistente', 'Feito.', { arquivo: CSV(['d1']) })];
    const com = lerConversa(msgs, true);
    expect(com.respostas.get(ID(4))?.at(-1)).toEqual({ tipo: 'cartao', cartao: {
      tipo: 'arquivo', chave: 'arquivos', rotulo: 'bling-pedidos.csv', mensagemId: ID(4), arquivo: { nome: 'bling-pedidos.csv', partes: 1, chamados: ['d1'] },
    } });
    expect(com.resultados.map((r) => r.chave)).toEqual([`tabela-${ID(2)}-0`, 'arquivos']);
    const sem = lerConversa(msgs, false);
    expect(sem.respostas.get(ID(4))).toEqual([{ tipo: 'texto', texto: 'Feito.' }]);
    expect(sem.resultados.map((r) => r.chave)).toEqual([`tabela-${ID(2)}-0`]);
  });

  it('aba aberta por padrão: o pedido ou a tabela mais recente; só Arquivos quando não há outra (D9)', () => {
    expect(lerConversa([msg(2, 'assistente', TABELA), msg(3, 'assistente', PREVIA(536)), msg(4, 'assistente', 'Feito.', { arquivo: CSV(['d1']) })], true).padrao)
      .toBe('pedido-536');
    expect(lerConversa([msg(4, 'assistente', 'Feito.', { arquivo: CSV(['d1']) })], true).padrao).toBe('arquivos');
    expect(lerConversa([msg(4, 'assistente', 'Oi.')], true).padrao).toBeNull();
  });

  it('pergunta da pessoa não vira resposta', () => {
    expect(lerConversa([msg(1, 'usuario', TABELA)], true).respostas.size).toBe(0);
  });
});

describe('?resultado= e escolha da aba', () => {
  it('só chaves conhecidas', () => {
    expect(lerChaveResultado('pedido-536')).toBe('pedido-536');
    expect(lerChaveResultado(`tabela-${ID(2)}-0`)).toBe(`tabela-${ID(2)}-0`);
    expect(lerChaveResultado(['arquivos', 'x'])).toBe('arquivos');
    expect(lerChaveResultado('pedido-abc')).toBeNull();
    expect(lerChaveResultado(undefined)).toBeNull();
  });

  it('chave que não existe nesta conversa: volta para a padrão', () => {
    const l = lerConversa([msg(2, 'assistente', TABELA), msg(3, 'assistente', PREVIA(536))], true);
    expect(escolherResultado(l, `tabela-${ID(2)}-0`)?.chave).toBe(`tabela-${ID(2)}-0`);
    expect(escolherResultado(l, 'pedido-999')?.chave).toBe('pedido-536');
    expect(escolherResultado(lerConversa([], true), null)).toBeNull();
  });

  it('href mantém a conversa aberta', () => {
    expect(hrefResultado(null, 'pedido-536')).toBe('/assistente?resultado=pedido-536');
    expect(hrefResultado(ID(9), 'arquivos')).toBe(`/assistente?conversa=${ID(9)}&resultado=arquivos`);
  });

  it('até 5 abas de pedido/tabela, as mais recentes; a escolhida sempre aparece; Arquivos no fim (D9)', () => {
    const tabelas = Array.from({ length: 7 }, (_, i) => msg(i + 1, 'assistente', `| a |\n|---|\n| ${i} |`));
    const l = lerConversa([...tabelas, msg(9, 'assistente', 'Feito.', { arquivo: CSV(['d1']) })], true);
    expect(abasVisiveis(l, `tabela-${ID(7)}-0`).map((r) => r.chave)).toEqual([
      `tabela-${ID(7)}-0`, `tabela-${ID(6)}-0`, `tabela-${ID(5)}-0`, `tabela-${ID(4)}-0`, `tabela-${ID(3)}-0`, 'arquivos',
    ]);
    expect(abasVisiveis(l, `tabela-${ID(1)}-0`).map((r) => r.chave)).toEqual([
      `tabela-${ID(7)}-0`, `tabela-${ID(6)}-0`, `tabela-${ID(5)}-0`, `tabela-${ID(4)}-0`, `tabela-${ID(3)}-0`, `tabela-${ID(1)}-0`, 'arquivos',
    ]);
  });

  it('arquivo mais recente que leva a demanda', () => {
    const l = lerConversa([msg(2, 'assistente', 'a', { arquivo: CSV(['d1']) }), msg(4, 'assistente', 'b', { arquivo: CSV(['d1', 'd2']) })], true);
    expect(arquivoDoPedido(l, 'd1')?.mensagemId).toBe(ID(4));
    expect(arquivoDoPedido(l, 'd9')).toBeNull();
  });
});

describe('podeResponderPrevia (D7)', () => {
  const pedido = (l: ReturnType<typeof lerConversa>) => l.resultados.find((r): r is ResultadoPedido => r.tipo === 'pedido')!;
  it('prévia única, com número, na última mensagem: sim', () => {
    const m = [msg(1, 'usuario', 'corrige'), msg(2, 'assistente', PREVIA(536))];
    expect(podeResponderPrevia(m, pedido(lerConversa(m, true)))).toBe(true);
  });
  it('com pergunta depois (respondida ou pendente): não', () => {
    const m = [msg(2, 'assistente', PREVIA(536)), msg(3, 'usuario', 'sim', { processada_em: null })];
    expect(podeResponderPrevia(m, pedido(lerConversa(m, true)))).toBe(false);
  });
  it('prévia de uma resposta antiga: não', () => {
    const m = [msg(2, 'assistente', PREVIA(536)), msg(3, 'usuario', 'e o 537?'), msg(4, 'assistente', 'Não achei.')];
    expect(podeResponderPrevia(m, pedido(lerConversa(m, true)))).toBe(false);
  });
  it('duas prévias na mesma resposta ou sem número: não', () => {
    const duas = [msg(2, 'assistente', `${PREVIA(536, '')}\n\n${PREVIA(537)}`)];
    expect(podeResponderPrevia(duas, pedido(lerConversa(duas, true)))).toBe(false);
    const sem = [msg(2, 'assistente', PREVIA(536).replace('#536', ''))];
    expect(podeResponderPrevia(sem, pedido(lerConversa(sem, true)))).toBe(false);
  });
});
