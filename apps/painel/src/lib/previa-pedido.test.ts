import { describe, expect, it } from 'vitest';
import { compararPrevia, interpretarPrevia, interpretarPrevias, type LinhaComparada } from './previa-pedido';

// Formato real (apps/trabalhador/test/assistente/corrigir.test.ts).
const REAL = 'Prévia do pedido #1042:\nAntes:\nDestinatário: Supermercado Brasil / Santa Efigênia\n• 10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00\nTotal: R$ 95,00\nDepois:\nDestinatário: Supermercado Brasil / Santa Efigênia\n• 15 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 142,50\nTotal: R$ 142,50';

const resumo = (l: LinhaComparada) =>
  l.tipo === 'item' ? `${l.mudanca} item ${l.item.quantidade} ${l.item.produto}` : l.tipo === 'campo' ? `${l.mudanca} ${l.rotulo}: ${l.valor}` : `${l.mudanca} ${l.texto}`;

describe('interpretarPrevia', () => {
  it('lê cabeçalho, itens e campos do formato do assistente', () => {
    const p = interpretarPrevia(REAL)!;
    expect(p.cabecalho).toBe('Prévia do pedido #1042:');
    expect(p.rodape).toBe('');
    expect(p.antes.linhas[1]).toEqual({
      tipo: 'item',
      item: {
        chave: 'cód 12', quantidade: '10', unidade: 'PAC', produto: 'Costela com Requeijão', codigo: '12',
        preco: 'R$ 9,50', subtotal: 'R$ 95,00', semPreco: false, texto: '10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00',
      },
    });
  });
  it('item sem preço, linha combinada com " · " e frase solta no fim viram rodapé', () => {
    const p = interpretarPrevia('Antes:\n• 2 KG Queijo minas – sem preço\nTotal: R$ 0,00\nDepois:\n• 2 KG Queijo minas × R$ 40,00 = R$ 80,00\nTotal: R$ 80,00\nPagamento: Pix · Entrega: 02/10\nPosso gravar?')!;
    expect(p.antes.linhas[0]).toMatchObject({ tipo: 'item', item: { chave: 'queijo minas', semPreco: true, preco: null, codigo: null } });
    expect(p.depois.linhas.slice(2)).toEqual([
      { tipo: 'campo', campo: { rotulo: 'Pagamento', valor: 'Pix' } },
      { tipo: 'campo', campo: { rotulo: 'Entrega', valor: '02/10' } },
    ]);
    expect(p.rodape).toBe('Posso gravar?');
  });
  it('linha em branco encerra o "depois"; CRLF funciona', () => {
    const p = interpretarPrevia('Antes:\r\nTotal: R$ 1,00\r\nDepois:\r\nTotal: R$ 2,00\r\n\r\nConfirma?')!;
    expect(p.depois.linhas).toHaveLength(1);
    expect(p.rodape).toBe('Confirma?');
  });
  it('observação com quebra de linha e com " · " no texto continua sendo um campo', () => {
    const texto = [
      'Antes:', 'Total: R$ 1,00', 'Observações: entregar · pela manhã',
      'Depois:', 'Total: R$ 1,00', 'Observações: entregar pela manhã', 'na doca 2', '', 'Posso gravar?',
    ].join('\n');
    const p = interpretarPrevia(texto)!;
    expect(p.antes.linhas[1]).toEqual({ tipo: 'campo', campo: { rotulo: 'Observações', valor: 'entregar · pela manhã' } });
    expect(p.depois.linhas[1]).toEqual({ tipo: 'campo', campo: { rotulo: 'Observações', valor: 'entregar pela manhã\nna doca 2' } });
    expect(p.rodape).toBe('Posso gravar?');
    expect(compararPrevia(p).map((l) => l.mudanca)).toEqual(['igual', 'alterado']);
  });
  it('fora do formato: null (a tela mostra o texto puro)', () => {
    expect(interpretarPrevia('Pronto, gravei o pedido.')).toBeNull();
    expect(interpretarPrevia('Antes:\nTotal: R$ 1,00')).toBeNull();
    expect(interpretarPrevia('Antes:\nqualquer coisa\nDepois:\noutra coisa')).toBeNull();
  });
});

describe('interpretarPrevias', () => {
  it('uma prévia por pedido na mesma resposta (executar.ts junta com linha em branco)', () => {
    const outra = REAL.replace('#1042', '#1043').replace(/15 PAC/, '20 PAC');
    const ps = interpretarPrevias(['Posso gravar os dois?', '', REAL, '', outra].join('\n'))!;
    expect(ps).toHaveLength(2);
    expect(ps[0]!.cabecalho).toBe('Posso gravar os dois?\n\nPrévia do pedido #1042:');
    expect(ps[0]!.rodape).toBe('');
    expect(ps[1]!.cabecalho).toBe('Prévia do pedido #1043:');
    expect(compararPrevia(ps[1]!)[1]).toMatchObject({ mudanca: 'alterado', item: { quantidade: '20' } });
    expect(interpretarPrevias('nada')).toBeNull();
  });
});

describe('compararPrevia', () => {
  it('quantidade alterada: marca o item e o total como alterados, com o valor antigo', () => {
    const c = compararPrevia(interpretarPrevia(REAL)!);
    expect(c.map(resumo)).toEqual([
      'igual Destinatário: Supermercado Brasil / Santa Efigênia',
      'alterado item 15 Costela com Requeijão',
      'alterado Total: R$ 142,50',
    ]);
    const item = c[1] as Extract<LinhaComparada, { tipo: 'item' }>;
    expect(item.anterior?.quantidade).toBe('10');
    expect(item.alteracoes).toEqual({ quantidade: true, unidade: false, produto: false, preco: false, subtotal: true });
    expect(c[2]).toMatchObject({ anterior: 'R$ 95,00' });
  });
  it('item adicionado, removido no lugar onde estava, e campo novo', () => {
    const texto = [
      'Antes:', '• 10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00', '• 5 UN Pão de alho (cód. 7) × R$ 6,00 = R$ 30,00',
      '• 3 CX Coxinha (cód. 9) × R$ 20,00 = R$ 60,00', 'Total: R$ 185,00',
      'Depois:', '• 10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00', '• 3 CX Coxinha (cód. 9) × R$ 20,00 = R$ 60,00',
      '• 2 FD Guaraná (cód. 30) × R$ 25,00 = R$ 50,00', 'Total: R$ 205,00', 'Observações: entregar pela manhã',
    ].join('\n');
    expect(compararPrevia(interpretarPrevia(texto)!).map(resumo)).toEqual([
      'igual item 10 Costela com Requeijão',
      'removido item 5 Pão de alho',
      'igual item 3 Coxinha',
      'adicionado item 2 Guaraná',
      'alterado Total: R$ 205,00',
      'adicionado Observações: entregar pela manhã',
    ]);
  });
  it('sem código, reconhece pela descrição (ignora caixa); unidade trocada é alteração', () => {
    const texto = 'Antes:\n• 2 KG queijo Minas – sem preço\nDepois:\n• 3 PC Queijo minas × R$ 40,00 = R$ 120,00';
    const [l] = compararPrevia(interpretarPrevia(texto)!);
    expect(l).toMatchObject({ tipo: 'item', mudanca: 'alterado', alteracoes: { quantidade: true, unidade: true, produto: false, preco: true, subtotal: true } });
  });
  it('mesmo código com nome novo: alteração do nome', () => {
    const texto = 'Antes:\n• 1 UN Bolo (cód. 1) × R$ 5,00 = R$ 5,00\nDepois:\n• 1 UN Bolo de fubá (cód. 1) × R$ 5,00 = R$ 5,00';
    const [l] = compararPrevia(interpretarPrevia(texto)!);
    expect(l).toMatchObject({ mudanca: 'alterado', anterior: { produto: 'Bolo' }, alteracoes: { produto: true, quantidade: false } });
  });
  it('o mesmo produto duas vezes: cada ocorrência tem par próprio', () => {
    const texto = 'Antes:\n• 1 UN Bolo (cód. 1) × R$ 5,00 = R$ 5,00\n• 1 UN Bolo (cód. 1) × R$ 5,00 = R$ 5,00\nDepois:\n• 1 UN Bolo (cód. 1) × R$ 5,00 = R$ 5,00';
    expect(compararPrevia(interpretarPrevia(texto)!).map((l) => l.mudanca)).toEqual(['igual', 'removido']);
  });
});
