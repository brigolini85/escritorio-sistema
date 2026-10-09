import { FUSO_HORARIO } from './fuso';

/** Modelo oficial de importação de pedidos de venda do Bling (pedido do dono, 2026-09-29): 41 colunas, separadas por vírgula. */
export const CABECALHO_VENDA_BLING = [
  'Número pedido', 'Nome Comprador', 'Data', 'CPF/CNPJ Comprador', 'Endereço Comprador', 'Bairro Comprador', 'Número Comprador',
  'Complemento Comprador', 'CEP Comprador', 'Cidade Comprador', 'UF Comprador', 'Telefone Comprador', 'Celular Comprador', 'E-mail Comprador',
  'Produto', 'SKU', 'Un', 'Quantidade', 'Valor Unitário', 'Valor Total', 'Total Pedido', 'Valor Frete Pedido', 'Valor Desconto Pedido',
  'Outras despesas', 'Nome Entrega', 'Endereço Entrega', 'Número Entrega', 'Complemento Entrega', 'Cidade Entrega', 'UF Entrega',
  'CEP Entrega', 'Bairro Entrega', 'Transportadora', 'Serviço', 'Tipo Frete', 'Observações', 'Qtd Parcela', 'Data Prevista', 'Vendedor',
  'Forma Pagamento', 'ID Forma Pagamento',
] as const;

/** Máximo de pedidos por arquivo; acima disso a exportação é dividida em partes. */
export const PEDIDOS_POR_ARQUIVO_BLING = 500;

type Texto = string | null;
export type ItemVendaBling = { produto: Texto; sku: Texto; un: Texto; quantidade: number | null; valor_unitario: number | null };
export type EnderecoBling = { endereco: Texto; numero: Texto; complemento: Texto; bairro: Texto; cidade: Texto; uf: Texto; cep: Texto };

export type PedidoVendaBling = {
  numero: number; data: string;
  comprador: EnderecoBling & { nome: Texto; documento: Texto; telefone: Texto; celular: Texto; email: Texto };
  itens: ItemVendaBling[];
  frete: number; desconto: number; outras_despesas: number;
  entrega: (EnderecoBling & { nome: Texto }) | null;
  transportadora: Texto; servico: Texto; tipo_frete: Texto; observacoes: Texto; qtd_parcela: number;
  data_prevista: Texto; vendedor: Texto; forma_pagamento: Texto; id_forma_pagamento: Texto;
};

/**
 * O que o agente guarda na demanda de nota de venda; o comprador é lido do cadastro na hora de gerar o arquivo.
 * Auditoria 6.3 (revisão 2): a anonimização (guarda de 1 ano ou LGPD) tira entrega, observações e transportadora do
 * pedido guardado; por isso os três são opcionais na leitura.
 */
export type PedidoVendaSalvo = {
  unidade_id: string | null; texto_destinatario: string; data: string; itens: ItemVendaBling[];
  data_prevista: Texto; forma_pagamento: Texto; valor_frete: number | null; tipo_frete: 'R' | 'D' | null;
  transportadora?: Texto; observacoes?: Texto; entrega?: EnderecoBling | null;
};

/** Campos do cadastro do cliente (unidade) que entram no arquivo. */
export type CompradorCadastrado = {
  razao_social: Texto; nome_unidade: string; cnpj: Texto; endereco: Texto; numero: Texto; complemento: Texto;
  bairro: Texto; cidade: Texto; uf: Texto; cep: Texto; telefone: Texto;
};

export function pedidoVendaBling(numero: number, s: PedidoVendaSalvo, u: CompradorCadastrado | null): PedidoVendaBling {
  const nome = u ? u.razao_social ?? u.nome_unidade : s.texto_destinatario;
  const endereco: EnderecoBling = {
    endereco: u?.endereco ?? null, numero: u?.numero ?? null, complemento: u?.complemento ?? null,
    bairro: u?.bairro ?? null, cidade: u?.cidade ?? null, uf: u?.uf ?? null, cep: u?.cep ?? null,
  };
  return {
    numero, data: s.data,
    comprador: { nome, documento: u?.cnpj ?? null, ...endereco, telefone: null, celular: u?.telefone ?? null, email: null },
    itens: s.itens,
    frete: s.valor_frete ?? 0, desconto: 0, outras_despesas: 0,
    // Sem endereço de entrega combinado na conversa, a entrega é no endereço do comprador.
    entrega: { nome, ...(s.entrega ?? endereco) },
    transportadora: s.transportadora ?? null, servico: null, tipo_frete: s.tipo_frete, observacoes: s.observacoes ?? null, qtd_parcela: 0,
    data_prevista: s.data_prevista, vendedor: null, forma_pagamento: s.forma_pagamento, id_forma_pagamento: null,
  };
}

/** O que impede a importação: o painel mostra estes avisos em vez de gerar o arquivo. */
export function problemasPedidoBling(p: PedidoVendaBling): string[] {
  const problemas: string[] = [];
  if (!p.numero) problemas.push('Pedido sem Número pedido');
  if (!p.comprador.nome?.trim()) problemas.push(`Pedido ${p.numero}: falta Nome Comprador`);
  if (p.itens.length === 0) problemas.push(`Pedido ${p.numero}: nenhum produto`);
  p.itens.forEach((i, n) => {
    if (!i.produto?.trim() && !i.sku?.trim()) problemas.push(`Pedido ${p.numero}, item ${n + 1}: falta Produto/SKU`);
    if (!i.quantidade || i.quantidade <= 0) problemas.push(`Pedido ${p.numero}, item ${n + 1}: falta Quantidade`);
    // O Bling recusa venda sem total.
    else if (i.valor_unitario === null || i.valor_unitario <= 0) {
      problemas.push(`Pedido ${p.numero}, item ${n + 1} (${i.produto ?? i.sku}): falta Valor Unitário. Confira o preço na tabela da rede ou a unidade pedida`);
    }
  });
  return problemas;
}

const centavos = (n: number) => Math.round(n * 100) / 100;
/** 50 → 50; 50.01 → 50,01; 10.1 → 10,1 (como no modelo). */
const numero = (n: number | null) => (n === null ? '' : String(centavos(n)).replace('.', ','));
const digitos = (t: Texto) => (t ?? '').replace(/\D/g, '');

/** Campo com vírgula ou aspas vai entre aspas (aspas internas dobradas); quebra de linha vira espaço. */
function campo(v: string | number | null): string {
  const t = String(v ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim();
  return /[",]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function linhas(p: PedidoVendaBling): string[] {
  const c = p.comprador;
  const e = p.entrega ?? { ...c };
  const totalItem = (i: ItemVendaBling) => (i.quantidade !== null && i.valor_unitario !== null ? centavos(i.quantidade * i.valor_unitario) : null);
  const totalPedido = centavos(p.itens.reduce((s, i) => s + (totalItem(i) ?? 0), 0) + p.frete - p.desconto + p.outras_despesas);
  return p.itens.map((i) => [
    String(p.numero), c.nome, p.data, digitos(c.documento), c.endereco, c.bairro, c.numero, c.complemento, digitos(c.cep),
    c.cidade, c.uf, c.telefone, c.celular, c.email,
    i.produto, i.sku, i.un || 'UN', numero(i.quantidade), numero(i.valor_unitario), numero(totalItem(i)),
    numero(totalPedido), numero(p.frete), numero(p.desconto), numero(p.outras_despesas),
    e.nome, e.endereco, e.numero, e.complemento, e.cidade, e.uf, digitos(e.cep), e.bairro,
    p.transportadora, p.servico, p.tipo_frete, p.observacoes, String(p.qtd_parcela), p.data_prevista, p.vendedor,
    p.forma_pagamento, p.id_forma_pagamento,
  ].map(campo).join(','));
}

/** Arquivo igual ao modelo do Bling: UTF-8 sem BOM, quebra de linha só LF, uma linha por produto. */
export function montarCsvVendaBling(pedidos: PedidoVendaBling[]): string {
  return [CABECALHO_VENDA_BLING.join(','), ...pedidos.flatMap(linhas)].join('\n') + '\n';
}

/** Divide a exportação em arquivos de até 500 pedidos, sem partir um pedido entre arquivos. */
export function dividirPedidosBling<T>(pedidos: T[], porArquivo = PEDIDOS_POR_ARQUIVO_BLING): T[][] {
  const partes: T[][] = [];
  for (let i = 0; i < pedidos.length; i += porArquivo) partes.push(pedidos.slice(i, i + porArquivo));
  return partes;
}

/** pedidos_venda_bling_AAAAMMDD_HHMM.csv (Brasília), com _parteN quando a exportação é dividida. */
export function nomeArquivoVendaBling(geradoEm: Date, parte?: number): string {
  const d = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_HORARIO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(geradoEm).map((x) => [x.type, x.value]));
  return `pedidos_venda_bling_${d.year}${d.month}${d.day}_${d.hour}${d.minute}${parte ? `_parte${parte}` : ''}.csv`;
}
