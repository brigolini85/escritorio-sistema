import { describe, expect, it } from 'vitest';
import { interpretarPrevia } from './previa-pedido';
import {
  historicoDoPedido, montarPedidoNoPainel, origemDoPedido, PREFIXO_GRAVADO, quandoNoHistorico, seloGravado, TEXTO_MUDAR, textoAoMudar,
  textoDoSelo,
  type DemandaDoPedido, type EventoPedido,
} from './pedido-assistente';
import type { MensagemTela } from './resultados-assistente';

const lado = (linhas: string[]) => linhas.join('\n');
const BASE = [
  'Destinatário: Rede Bom Preço / Unidade Centro',
  '• 10 PAC Pão de queijo congelado 1kg (cód. 12) × R$ 18,50 = R$ 185,00',
  '• 6 UN Bolo de fubá 400g (cód. 31) × R$ 14,00 = R$ 84,00',
  'Total: R$ 269,00',
  'Pagamento: Boleto 28 dias · Entrega: 03/10',
];
const previa = (antes: string[], depois: string[]) => interpretarPrevia(`Prévia do pedido #536:\nAntes:\n${lado(antes)}\nDepois:\n${lado(depois)}`)!;

describe('montarPedidoNoPainel (D2: tudo da prévia)', () => {
  it('destinatário em rede e unidade; pagamento, entrega e endereço do cadastro; itens comparados; total antes/depois', () => {
    const depois = [...BASE];
    depois[1] = '• 15 PAC Pão de queijo congelado 1kg (cód. 12) × R$ 18,50 = R$ 277,50';
    depois[3] = 'Total: R$ 361,50';
    const p = montarPedidoNoPainel(previa(BASE, depois));
    expect(p.destinatario).toEqual({ rede: 'Rede Bom Preço', unidade: 'Unidade Centro', anterior: null });
    expect(p.pagamento).toEqual({ valor: 'Boleto 28 dias', anterior: null, mudou: false });
    expect(p.entrega).toEqual({ valor: '03/10', anterior: null, mudou: false });
    expect(p.enderecoEntrega).toEqual({ valor: null, anterior: null, mudou: false });
    expect(p.total).toEqual({ valor: 'R$ 361,50', anterior: 'R$ 269,00', mudou: true });
    expect(p.itens.map((i) => i.mudanca)).toEqual(['alterado', 'igual']);
    expect(p.itens[0]!.anterior?.quantidade).toBe('10');
    expect(p.itens[0]!.item).toMatchObject({ quantidade: '15', unidade: 'PAC', codigo: '12', subtotal: 'R$ 277,50' });
    expect(p.outros).toEqual([]);
  });

  it('endereço de entrega novo, destinatário trocado, item removido e observação nova', () => {
    const depois = ['Destinatário: Mercado Central / Loja 2', 'Entrega em: Rua A, 10 - Centro', BASE[1]!, 'Total: R$ 185,00',
      'Pagamento: Pix · Entrega: 03/10', 'Observações: entregar cedo'];
    const p = montarPedidoNoPainel(previa(BASE, depois));
    expect(p.destinatario).toEqual({ rede: 'Mercado Central', unidade: 'Loja 2', anterior: 'Rede Bom Preço / Unidade Centro' });
    expect(p.enderecoEntrega).toEqual({ valor: 'Rua A, 10 - Centro', anterior: null, mudou: true });
    expect(p.pagamento).toEqual({ valor: 'Pix', anterior: 'Boleto 28 dias', mudou: true });
    expect(p.itens.map((i) => [i.item.produto, i.mudanca])).toEqual([['Pão de queijo congelado 1kg', 'igual'], ['Bolo de fubá 400g', 'removido']]);
    expect(p.outros).toEqual([expect.objectContaining({ rotulo: 'Observações', valor: 'entregar cedo', mudanca: 'adicionado' })]);
  });
});

const DEMANDA: DemandaDoPedido = {
  id: 'd1', numero: 536, titulo: 'NF de venda', setor: 'Fiscal', empresa: 'Padaria Sol ME', status: 'aberto', origem: 'agente',
  contato: 'Carla Mendes', criadoEm: '2026-10-01T13:00:00Z', criadoPorNome: null,
};

describe('origemDoPedido (D3)', () => {
  it('agente: contato e WhatsApp; sem contato, "Contato sem cadastro"; equipe: quem abriu e Painel', () => {
    expect(origemDoPedido(DEMANDA)).toEqual({ quem: 'Carla Mendes', como: 'WhatsApp · 01/10' });
    expect(origemDoPedido({ ...DEMANDA, contato: null })).toEqual({ quem: 'Contato sem cadastro', como: 'WhatsApp · 01/10' });
    expect(origemDoPedido({ ...DEMANDA, origem: 'equipe', criadoPorNome: 'Bruno' })).toEqual({ quem: 'Bruno', como: 'Painel · 01/10' });
  });
});

const ANA = 'u-ana';
const nota = (em: string, usuarioId: string | null, texto: string, usuario = 'Ana Lima'): EventoPedido =>
  ({ tipo: 'nota_interna', texto, criado_em: em, usuario_id: usuarioId, usuario });
const GRAVOU = `${PREFIXO_GRAVADO}Ana Lima.\nAntes:\n…\nDepois:\n…`;

describe('seloGravado (D5)', () => {
  const PREVIA_EM = '2026-10-10T18:40:00Z';
  it('nota da gravação da própria pessoa depois da prévia: selo com a hora e o nome', () => {
    expect(seloGravado([nota('2026-10-10T18:41:00Z', ANA, GRAVOU)], ANA, PREVIA_EM)).toEqual({ em: '2026-10-10T18:41:00Z', por: 'Ana Lima' });
  });
  it('nota de outra pessoa, antes da prévia ou com outro texto: sem selo', () => {
    expect(seloGravado([nota('2026-10-10T18:41:00Z', 'u-bruno', GRAVOU, 'Bruno')], ANA, PREVIA_EM)).toBeNull();
    expect(seloGravado([nota('2026-10-10T18:39:00Z', ANA, GRAVOU)], ANA, PREVIA_EM)).toBeNull();
    expect(seloGravado([nota('2026-10-10T18:41:00Z', ANA, 'Cliente ligou.')], ANA, PREVIA_EM)).toBeNull();
  });
});

describe('textoDoSelo', () => {
  const AGORA = '2026-10-10T20:00:00Z';
  it('gravado hoje (Brasília): "Gravado às HH:MM por …"', () => {
    expect(textoDoSelo({ em: '2026-10-10T18:41:00Z', por: 'você' }, AGORA)).toBe('Gravado às 15:41 por você');
  });
  it('gravado em outro dia: "Gravado em dd/mm HH:MM por …"', () => {
    expect(textoDoSelo({ em: '2026-10-07T18:41:00Z', por: 'Ana Lima' }, AGORA)).toBe('Gravado em 07/10 15:41 por Ana Lima');
  });
});

describe('textoAoMudar (MUDAR OUTRA COISA não apaga o que a pessoa já digitou)', () => {
  it('campo vazio ou só com espaços: o começo da frase', () => {
    expect(textoAoMudar('')).toBe(TEXTO_MUDAR);
    expect(textoAoMudar('  \n ')).toBe(TEXTO_MUDAR);
  });
  it('campo com texto: o começo da frase na frente e o texto da pessoa mantido', () => {
    expect(textoAoMudar('o bolo era 8 UN')).toBe(`${TEXTO_MUDAR}o bolo era 8 UN`);
    expect(textoAoMudar('  o bolo era 8 UN ')).toBe(`${TEXTO_MUDAR}o bolo era 8 UN`);
  });
  it('clicar de novo não repete o começo da frase', () => {
    expect(textoAoMudar(TEXTO_MUDAR)).toBe(TEXTO_MUDAR);
    expect(textoAoMudar(`${TEXTO_MUDAR}o bolo era 8 UN`)).toBe(`${TEXTO_MUDAR}o bolo era 8 UN`);
  });
});

describe('historicoDoPedido (D4)', () => {
  const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const m = (n: number, conteudo: string, arquivo: unknown = null): MensagemTela =>
    ({ id: ID(n), papel: 'assistente', conteudo, arquivo, processada_em: 'x', criado_em: `2026-10-10T18:${String(n).padStart(2, '0')}:00Z` });
  const PREVIA_TXT = `Prévia do pedido #536:\nAntes:\n${lado(BASE)}\nDepois:\n${lado(BASE)}`;
  const eventos: EventoPedido[] = [
    { tipo: 'criacao', texto: 'resumo do cliente', criado_em: '2026-10-01T13:00:00Z', usuario_id: null, usuario: null },
    nota('2026-10-10T18:41:00Z', ANA, GRAVOU),
    { tipo: 'status_alterado', texto: 'em_andamento', criado_em: '2026-10-10T18:42:00Z', usuario_id: 'u-bruno', usuario: 'Bruno' },
    nota('2026-10-10T18:43:00Z', 'u-bruno', 'Cliente confirmou por telefone.\nsegunda linha', 'Bruno'),
  ];

  it('eventos da demanda e momentos da conversa, em ordem; CSV só com a demanda e com "Corrigir e gerar"', () => {
    const marcos = historicoDoPedido({ demanda: DEMANDA, eventos, pessoa: 'Ana', podeCsv: true, mensagens: [
      m(40, PREVIA_TXT), m(44, 'Feito.', { tipo: 'csv_bling', chamados: ['d1'], nome: 'x.csv', partes: 1 }),
      m(45, 'Outro.', { tipo: 'csv_bling', chamados: ['d9'], nome: 'y.csv', partes: 1 }),
    ] });
    expect(marcos.map((x) => [x.tipo, x.texto])).toEqual([
      ['abertura', 'Agente abriu o pedido pelo WhatsApp de Carla Mendes'],
      ['previa', 'Prévia mostrada a Ana'],
      ['gravado', 'Ana Lima gravou a correção pelo assistente'],
      ['evento', 'Bruno status Resolvendo'],
      ['evento', 'Bruno nota interna: Cliente confirmou por telefone.'],
      ['arquivo', 'CSV do Bling gerado'],
    ]);
    expect(historicoDoPedido({ demanda: DEMANDA, eventos: [], pessoa: 'Ana', podeCsv: false,
      mensagens: [m(44, 'Feito.', { tipo: 'csv_bling', chamados: ['d1'], nome: 'x.csv', partes: 1 })] })).toEqual([]);
  });

  it('demanda aberta pela equipe', () => {
    const [abertura] = historicoDoPedido({ demanda: { ...DEMANDA, origem: 'equipe', criadoPorNome: 'Bruno' }, pessoa: 'Ana', podeCsv: true, mensagens: [],
      eventos: [{ tipo: 'criacao', texto: null, criado_em: '2026-10-01T13:00:00Z', usuario_id: 'u-bruno', usuario: 'Bruno' }] });
    expect(abertura).toMatchObject({ tipo: 'abertura', texto: 'Bruno abriu a demanda no painel' });
  });
});

describe('quandoNoHistorico', () => {
  it('hoje: hora; outro dia: dd/mm (Brasília)', () => {
    const agora = new Date('2026-10-10T18:50:00Z');
    expect(quandoNoHistorico('2026-10-10T18:41:00Z', agora)).toBe('15:41');
    expect(quandoNoHistorico('2026-10-01T13:00:00Z', agora)).toBe('01/10');
  });
});
