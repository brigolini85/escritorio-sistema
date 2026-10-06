import { describe, expect, it } from 'vitest';
import {
  acharAgente, ehPedidoAoAgente, lerPrazoDesejado, lerSubpasta, mensagemPausada, mensagemPendencias, mensagemPronta, quemAprova, rotuloTarefa,
  semAcento, textoCustoEstimado,
} from '../src/index';

const SETORES = ['Fiscal', 'Contábil', 'Pessoal', 'Legalização', 'Comercial', 'Direção'];

describe('ehPedidoAoAgente (D2)', () => {
  it('pedido com verbo e setor ou "agente"', () => {
    expect(ehPedidoAoAgente('pede pro contábil fazer o fechamento de outubro da Padaria Sol', SETORES)).toBe(true);
    expect(ehPedidoAoAgente('Manda o agente fiscal conferir as notas de setembro', SETORES)).toBe(true);
    expect(ehPedidoAoAgente('solicita ao DP a folha da Padaria', SETORES)).toBe(true);
    expect(ehPedidoAoAgente('faz o fechamento no contabil', SETORES)).toBe(true);
  });
  it('as mensagens dos 4 cenários de hoje não disparam (o pedido à IA fica igual)', () => {
    for (const t of ['quais notas estão abertas?', 'quanto vendi pro Supermercado Brasil em setembro de 2026?',
      'o pedido 12 era 15 PAC de costela, corrige e me manda o CSV', 'sim, pode gravar', 'o pedido 12 era 15 PAC, corrige', 'sim, pode']) {
      expect(ehPedidoAoAgente(t, SETORES)).toBe(false);
    }
  });
  it('setor sem verbo de pedido, ou verbo sem setor, não dispara', () => {
    expect(ehPedidoAoAgente('quais demandas do contábil estão abertas?', SETORES)).toBe(false);
    expect(ehPedidoAoAgente('manda o CSV', SETORES)).toBe(false);
    expect(ehPedidoAoAgente('', SETORES)).toBe(false);
  });
  it('não confunde pedaço de palavra ("fiscalização" não é "fiscal"; "pedido" não é "pede")', () => {
    expect(ehPedidoAoAgente('faz a fiscalização', ['Fiscal'])).toBe(false);
    expect(ehPedidoAoAgente('o pedido do fiscal', ['Fiscal'])).toBe(false);
  });
});

describe('acharAgente', () => {
  const A = [{ id: 'f', nome: 'Agente Fiscal', setor: 'Fiscal' }, { id: 'c', nome: 'Agente Contábil', setor: 'Contábil' }];
  it('pelo setor, pelo nome, sem acento e com "agente"/"o"', () => {
    expect(acharAgente('contabil', A)).toEqual({ ok: true, agente: A[1] });
    expect(acharAgente('o Agente Fiscal', A)).toEqual({ ok: true, agente: A[0] });
    expect(acharAgente('Contábil', A)).toEqual({ ok: true, agente: A[1] });
  });
  it('fora da lista: diz a quem a pessoa pode pedir; lista vazia: diz que não pode pedir', () => {
    expect(acharAgente('pessoal', A)).toEqual({ ok: false, erro: 'Não achei esse agente entre os que você pode pedir: Agente Fiscal, Agente Contábil.' });
    expect(acharAgente('fiscal', [])).toEqual({ ok: false,
      erro: 'Você não pode pedir tarefas a nenhum agente agora (seus setores, o estado dos agentes ou a sua permissão).' });
  });
});

describe('lerPrazoDesejado (D7)', () => {
  const AGORA = new Date('2026-10-06T13:00:00Z'); // 10:00 em Brasília
  it('data e hora de Brasília; só a data vale 18h', () => {
    expect(lerPrazoDesejado('08/10/2026 12:00', AGORA)).toEqual({ ok: true, iso: '2026-10-08T15:00:00.000Z' });
    expect(lerPrazoDesejado('08/10/2026', AGORA)).toEqual({ ok: true, iso: '2026-10-08T21:00:00.000Z' });
  });
  it('passado, mais de 90 dias, data que não existe e lixo', () => {
    expect(lerPrazoDesejado('05/10/2026', AGORA)).toEqual({ ok: false, erro: 'O prazo desejado precisa ser depois de agora e em até 90 dias.' });
    expect(lerPrazoDesejado('10/01/2027 10:00', AGORA)).toEqual({ ok: false, erro: 'O prazo desejado precisa ser depois de agora e em até 90 dias.' });
    expect(lerPrazoDesejado('31/02/2027', AGORA)).toEqual({ ok: false, erro: 'Prazo inválido (use DD/MM/AAAA ou DD/MM/AAAA HH:MM).' });
    expect(lerPrazoDesejado('sexta', AGORA)).toEqual({ ok: false, erro: 'Prazo inválido (use DD/MM/AAAA ou DD/MM/AAAA HH:MM).' });
  });
});

describe('lerSubpasta (D7)', () => {
  it('limpa as barras e os espaços; vazio = pasta inteira', () => {
    expect(lerSubpasta(' Fiscal / 2026-09 ')).toEqual({ ok: true, valor: 'Fiscal/2026-09' });
    expect(lerSubpasta('/Contabil/')).toEqual({ ok: true, valor: 'Contabil' });
    expect(lerSubpasta('')).toEqual({ ok: true, valor: null });
    expect(lerSubpasta(null)).toEqual({ ok: true, valor: null });
  });
  it('recusa ".." e mais de 3 níveis', () => {
    const erro = { ok: false, erro: 'Subpasta inválida: use nomes separados por /, até 3 níveis.' };
    expect(lerSubpasta('../outro')).toEqual(erro);
    expect(lerSubpasta('a/b/c/d')).toEqual(erro);
    expect(lerSubpasta('x'.repeat(101))).toEqual(erro);
  });
});

describe('custo, rótulo e mensagens', () => {
  it('textoCustoEstimado (D13)', () => {
    expect(textoCustoEstimado({ n: 5, min: 0.3, max: 1, limite: 2 })).toBe('Tarefa de trabalho: costuma custar US$ 0,30–1,00; entra em Gastos com IA.');
    expect(textoCustoEstimado({ n: 4, min: 0.5, max: 0.5, limite: 2 })).toBe('Tarefa de trabalho: costuma custar US$ 0,50; entra em Gastos com IA.');
    expect(textoCustoEstimado({ n: 2, min: null, max: null, limite: 2 })).toBe('Tarefa de trabalho: até US$ 2,00 por tarefa (o limite do agente); entra em Gastos com IA.');
  });
  it('rotuloTarefa', () => {
    expect(rotuloTarefa(142)).toBe('T-0142');
    expect(rotuloTarefa(12345)).toBe('T-12345');
  });
  it('quemAprova (D9)', () => {
    expect(quemAprova({ responsavel: 'Cláudia', pedeNoSetor: true, setor: 'Contábil' })).toBe('Falta Cláudia aprovar no painel.');
    expect(quemAprova({ responsavel: null, pedeNoSetor: true, setor: 'Contábil' })).toBe('Falta você ou alguém do Contábil aprovar no painel.');
    expect(quemAprova({ responsavel: null, pedeNoSetor: false, setor: 'Contábil' })).toBe('Falta alguém do Contábil aprovar no painel.');
  });
  it('mensagemPendencias: perguntas do analista numeradas, opções e o aviso das do cliente', () => {
    const m = mensagemPendencias({ tarefa: 142, agente: 'Agente Contábil', demanda: 1061, empresa: 'Padaria Sol', setor: 'Contábil',
      analista: [{ numero: 2, pergunta: 'PIX de R$ 3.200 em 12/10 para o sócio: o que é?', detalhe: null, opcoes: ['pró-labore', 'lucro', 'empréstimo'] }],
      cliente: 1 });
    expect(m).toBe([
      'Agente Contábil · T-0142 (demanda #1061, Padaria Sol)',
      'Tenho 1 pergunta para você:',
      '2. PIX de R$ 3.200 em 12/10 para o sócio: o que é? (pró-labore / lucro / empréstimo)',
      'Responda aqui mesmo (ex.: "2: empréstimo") ou na tarefa, no painel.',
      'E 1 pendência do cliente: o pedido ao cliente só sai quando alguém do Contábil aprovar no painel.',
    ].join('\n'));
  });
  it('mensagemPendencias só do cliente', () => {
    expect(mensagemPendencias({ tarefa: 7, agente: 'Agente Fiscal', demanda: 9, empresa: null, setor: 'Fiscal', analista: [], cliente: 2 }))
      .toBe('Agente Fiscal · T-0007 (demanda #9)\nParei em 2 pendências do cliente: o pedido ao cliente só sai quando alguém do Fiscal aprovar no painel.');
  });
  it('mensagemPronta: resumo cortado, linhas, provisórias e quem aprova', () => {
    const m = mensagemPronta({ tarefa: 142, agente: 'Agente Contábil', demanda: 1061, empresa: 'Padaria Sol', resumo: 'x'.repeat(700),
      linhas: 214, provisorias: 2, comPlanilha: true, quemAprova: 'Falta Cláudia aprovar no painel.' });
    expect(m.split('\n')[0]).toBe('Agente Contábil · T-0142 (demanda #1061, Padaria Sol)');
    expect(m).toContain(`Pronto: ${'x'.repeat(599)}…`);
    expect(m).toContain('214 linhas no rascunho, 2 provisórias. A planilha vai anexa.');
    expect(m.endsWith('Falta Cláudia aprovar no painel.')).toBe(true);
  });
  it('mensagemPausada usa o texto do motivo', () => {
    expect(mensagemPausada({ tarefa: 3, agente: 'Agente Contábil', demanda: 5, motivo: 'limite_custo' }))
      .toBe('Agente Contábil · T-0003 (demanda #5)\nPausada: chegou ao limite de custo desta tarefa. Veja na tarefa, no painel.');
  });
  it('semAcento', () => { expect(semAcento('Contábil LEGALIZAÇÃO')).toBe('contabil legalizacao'); });
});
