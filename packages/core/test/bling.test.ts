import { describe, expect, it } from 'vitest';
import {
  CABECALHO_VENDA_BLING, dividirPedidosBling, montarCsvVendaBling, nomeArquivoVendaBling, pedidoVendaBling, problemasPedidoBling,
  type PedidoVendaBling, type PedidoVendaSalvo,
} from '../src/bling';

// Modelo oficial de importação de pedidos de venda do Bling (enviado pelo dono, 2026-09-29).
const CABECALHO_OFICIAL = 'Número pedido,Nome Comprador,Data,CPF/CNPJ Comprador,Endereço Comprador,Bairro Comprador,Número Comprador,Complemento Comprador,CEP Comprador,Cidade Comprador,UF Comprador,Telefone Comprador,Celular Comprador,E-mail Comprador,Produto,SKU,Un,Quantidade,Valor Unitário,Valor Total,Total Pedido,Valor Frete Pedido,Valor Desconto Pedido,Outras despesas,Nome Entrega,Endereço Entrega,Número Entrega,Complemento Entrega,Cidade Entrega,UF Entrega,CEP Entrega,Bairro Entrega,Transportadora,Serviço,Tipo Frete,Observações,Qtd Parcela,Data Prevista,Vendedor,Forma Pagamento,ID Forma Pagamento';
const LINHA_OFICIAL_1 = '1019,João da Silva,06/04/2023,76784235789,Rua Barão do Rio Branco,Centro,111,Complemento Comprador,95708100,Bento Gonçalves,RS,(54) 34515555,54 96662233,joao@bling.com.br,Caneta,2030,UN,1,"50,01","50,01","62,95",20,"10,1",0,João da Silva,Rua Sao João,3665,,Bento Gonçalves,RS,95708100,Centro,Transportadora,,R,Observação,0,10/04/2023,,Dinheiro,';
const LINHA_OFICIAL_2 = '1020,Maria Vasconcelos,06/04/2023,84848411818,Rua Barão do Rio Branco,Centro,111,Complemento Comprador,95708100,Bento Gonçalves,RS,(54) 34515555,54 96662233,maria@bling.com.br,Caneta,2030,UN,1,50,50,60,20,10,0,João da Silva,Rua Sao João,563,,Bento Gonçalves,RS,95708100,Centro,Transportadora,,D,Observação,4,10/04/2023,,Cheque,';

const comprador = (nome: string, documento: string, email: string) => ({
  nome, documento, endereco: 'Rua Barão do Rio Branco', bairro: 'Centro', numero: '111', complemento: 'Complemento Comprador', cep: '95708-100',
  cidade: 'Bento Gonçalves', uf: 'RS', telefone: '(54) 34515555', celular: '54 96662233', email,
});
const entrega = (numero: string) => ({ nome: 'João da Silva', endereco: 'Rua Sao João', numero, complemento: null, cidade: 'Bento Gonçalves', uf: 'RS', cep: '95708100', bairro: 'Centro' });
const extras = { transportadora: 'Transportadora', servico: null, observacoes: 'Observação', data_prevista: '10/04/2023', vendedor: null, id_forma_pagamento: null };

const joao: PedidoVendaBling = {
  numero: 1019, data: '06/04/2023', comprador: comprador('João da Silva', '767.842.357-89', 'joao@bling.com.br'),
  itens: [{ produto: 'Caneta', sku: '2030', un: 'UN', quantidade: 1, valor_unitario: 50.01 }],
  frete: 20, desconto: 10.1, outras_despesas: 0, entrega: entrega('3665'), tipo_frete: 'R', qtd_parcela: 0, forma_pagamento: 'Dinheiro', ...extras,
};
const maria: PedidoVendaBling = {
  numero: 1020, data: '06/04/2023', comprador: comprador('Maria Vasconcelos', '848.484.118-18', 'maria@bling.com.br'),
  itens: [{ produto: 'Caneta', sku: '2030', un: 'UN', quantidade: 1, valor_unitario: 50 }],
  frete: 20, desconto: 10, outras_despesas: 0, entrega: entrega('563'), tipo_frete: 'D', qtd_parcela: 4, forma_pagamento: 'Cheque', ...extras,
};
/** Separa as colunas de uma linha CSV mantendo as aspas como estão (para conferir onde o arquivo usa aspas). */
function colunas(linha: string): string[] {
  const saida: string[] = [];
  let atual = '';
  let entreAspas = false;
  for (const ch of linha) {
    if (ch === '"') entreAspas = !entreAspas;
    if (ch === ',' && !entreAspas) { saida.push(atual); atual = ''; } else atual += ch;
  }
  saida.push(atual);
  return saida;
}

describe('CSV de pedido de venda do Bling (pedido do dono, 2026-09-29)', () => {
  it('cabeçalho exato, 41 colunas, separador vírgula', () => {
    expect(CABECALHO_VENDA_BLING).toHaveLength(41);
    expect(montarCsvVendaBling([maria]).split('\n')[0]).toBe(CABECALHO_OFICIAL);
  });

  it('compara linha a linha com o modelo oficial', () => {
    const [cab, l1, l2, ...resto] = montarCsvVendaBling([joao, maria]).split('\n');
    expect(cab).toBe(CABECALHO_OFICIAL);
    expect(l2).toBe(LINHA_OFICIAL_2);
    // No exemplo do Bling, o Total Pedido da 1ª linha não fecha (50,01 + 20 − 10,1 = 59,91, e não 62,95); o resto é idêntico.
    const esperado = colunas(LINHA_OFICIAL_1);
    esperado[20] = '"59,91"';
    expect(colunas(l1!)).toEqual(esperado);
    expect(resto).toEqual(['']);   // termina com uma quebra de linha e nenhuma linha em branco
  });

  it('sem BOM, sem \\r e 41 colunas em toda linha', () => {
    const csv = montarCsvVendaBling([joao, maria]);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect([...Buffer.from(csv, 'utf8').subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(csv).not.toContain('\r');
    for (const l of csv.trimEnd().split('\n')) expect(colunas(l)).toHaveLength(41);
  });

  it('decimais com vírgula entre aspas, inteiros sem aspas; CPF/CNPJ e CEP só com dígitos', () => {
    const l = colunas(montarCsvVendaBling([joao]).split('\n')[1]!);
    expect(l[18]).toBe('"50,01"');
    expect(l[17]).toBe('1');
    expect(l[3]).toBe('76784235789');
    expect(l[8]).toBe('95708100');
  });

  it('vários produtos: uma linha por item, Valor Total por item e Total Pedido igual em todas', () => {
    const p: PedidoVendaBling = { ...maria, frete: 15, desconto: 0, itens: [
      { produto: 'Costela com Requeijão', sku: '12', un: 'PAC', quantidade: 20, valor_unitario: 9.5 },
      { produto: 'Frango com Requeijão', sku: '14', un: 'PAC', quantidade: 3, valor_unitario: 8.33 },
    ] };
    const [, a, b] = montarCsvVendaBling([p]).split('\n').map((x) => (x ? colunas(x) : []));
    expect([a![14], a![15], a![16], a![17], a![18], a![19]]).toEqual(['Costela com Requeijão', '12', 'PAC', '20', '"9,5"', '190']);
    expect([b![17], b![18], b![19]]).toEqual(['3', '"8,33"', '"24,99"']);
    expect(a![20]).toBe('"229,99"');   // 190 + 24,99 + 15 de frete
    expect(b![20]).toBe(a![20]);
    expect(a!.slice(0, 14)).toEqual(b!.slice(0, 14));
  });

  it('texto com vírgula ou aspas vai entre aspas; quebra de linha vira espaço', () => {
    const l = montarCsvVendaBling([{ ...maria, observacoes: 'Entregar na Rua X, 123\ndepois das "14h"' }]).split('\n')[1]!;
    expect(colunas(l)[35]).toBe('"Entregar na Rua X, 123 depois das ""14h"""');
  });

  it('campo sem informação fica vazio, nunca null', () => {
    const csv = montarCsvVendaBling([{ ...maria, comprador: { ...maria.comprador, email: null, telefone: null }, forma_pagamento: null }]);
    expect(csv).not.toMatch(/null|undefined|N\/A/);
    expect(colunas(csv.split('\n')[1]!)[13]).toBe('');
  });
});

describe('problemas antes de gerar', () => {
  it('avisa qual pedido e qual campo falta', () => {
    expect(problemasPedidoBling(maria)).toEqual([]);
    expect(problemasPedidoBling({ ...maria, comprador: { ...maria.comprador, nome: null },
      itens: [{ produto: null, sku: null, un: 'UN', quantidade: null, valor_unitario: 1 }] })).toEqual([
      'Pedido 1020: falta Nome Comprador',
      'Pedido 1020, item 1: falta Produto/SKU',
      'Pedido 1020, item 1: falta Quantidade',
    ]);
  });
  it('item sem valor não vai para o Bling, que recusa venda sem total (pedido 21, 2026-09-29)', () => {
    expect(problemasPedidoBling({ ...maria, numero: 21, itens: [{ produto: 'Pastel de angu', sku: '00070341434147', un: 'PAC', quantidade: 10, valor_unitario: null }] }))
      .toEqual(['Pedido 21, item 1 (Pastel de angu): falta Valor Unitário. Confira o preço na tabela da rede ou a unidade pedida']);
  });
});

describe('arquivos', () => {
  it('nome pedidos_venda_bling_AAAAMMDD_HHMM.csv em Brasília, com _parteN quando divide', () => {
    expect(nomeArquivoVendaBling(new Date('2026-09-29T17:30:00Z'))).toBe('pedidos_venda_bling_20260929_1430.csv');
    expect(nomeArquivoVendaBling(new Date('2026-09-30T02:05:00Z'), 2)).toBe('pedidos_venda_bling_20260929_2305_parte2.csv');
  });
  it('divide a cada 500 pedidos, sem partir um pedido', () => {
    const muitos = Array.from({ length: 1001 }, (_, i) => ({ ...maria, numero: i + 1 }));
    const partes = dividirPedidosBling(muitos);
    expect(partes.map((p) => p.length)).toEqual([500, 500, 1]);
    expect(partes[1]![0]!.numero).toBe(501);
  });
});

describe('pedido salvo na demanda + cadastro do comprador', () => {
  const salvo: PedidoVendaSalvo = {
    unidade_id: 'u1', texto_destinatario: 'Brasil Santa Efigênia', data: '29/09/2026',
    itens: [{ produto: 'Costela com Requeijão', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 9.5 }],
    data_prevista: null, forma_pagamento: 'PIX', valor_frete: null, tipo_frete: null, transportadora: null, observacoes: null, entrega: null,
  };
  const unidade = { razao_social: 'Armazém Brasil Ltda', nome_unidade: 'Santa Efigênia', cnpj: '19714252000534', endereco: 'Rua A', numero: '10', complemento: null,
    bairro: 'Santa Efigênia', cidade: 'Conselheiro Lafaiete', uf: 'MG', cep: '36400000', telefone: '31 99999-0000' };

  it('comprador vem do cadastro; sem entrega separada, repete os dados do comprador', () => {
    const p = pedidoVendaBling(16, salvo, unidade);
    expect(p.comprador).toMatchObject({ nome: 'Armazém Brasil Ltda', documento: '19714252000534', cep: '36400000', celular: '31 99999-0000', telefone: null, email: null });
    expect(p.entrega).toEqual({ nome: 'Armazém Brasil Ltda', endereco: 'Rua A', numero: '10', complemento: null, cidade: 'Conselheiro Lafaiete', uf: 'MG', cep: '36400000', bairro: 'Santa Efigênia' });
    expect(p).toMatchObject({ numero: 16, frete: 0, desconto: 0, outras_despesas: 0, qtd_parcela: 0, forma_pagamento: 'PIX' });
  });
  it('entrega combinada na conversa substitui o endereço do comprador', () => {
    const p = pedidoVendaBling(16, { ...salvo, entrega: { endereco: 'Rua B', numero: '5', complemento: 'loja 2', bairro: 'Centro', cidade: 'Itabira', uf: 'MG', cep: '35900000' } }, unidade);
    expect(p.entrega).toMatchObject({ nome: 'Armazém Brasil Ltda', endereco: 'Rua B', cidade: 'Itabira' });
  });
  it('destinatário não cadastrado: nome como o cliente escreveu, sem documento', () => {
    const p = pedidoVendaBling(16, { ...salvo, unidade_id: null }, null);
    expect(p.comprador).toMatchObject({ nome: 'Brasil Santa Efigênia', documento: null });
  });
});

describe('pedido anonimizado pela guarda ou pela LGPD (auditoria 6.3, revisão 2)', () => {
  it('sem entrega, observações e transportadora: vira nulo e o arquivo sai', () => {
    const salvo = {
      unidade_id: null, texto_destinatario: '[texto apagado pela guarda de 1 ano]', data: '01/10/2024',
      itens: [{ produto: 'Arroz', sku: null, un: 'UN', quantidade: 2, valor_unitario: 10 }],
      data_prevista: null, forma_pagamento: 'Pix', valor_frete: 5, tipo_frete: 'R',
    } as PedidoVendaSalvo;
    const p = pedidoVendaBling(7, salvo, null);
    expect([p.transportadora, p.observacoes]).toEqual([null, null]);
    expect(p.entrega).toMatchObject({ endereco: null, cidade: null });
    expect(montarCsvVendaBling([p]).split('\n')[1]).not.toContain('undefined');
  });
});
