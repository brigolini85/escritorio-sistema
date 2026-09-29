import { createHash } from 'node:crypto';
import { FUSO_HORARIO, type PedidoVendaSalvo } from '@escritorio/core';
import type { ProdutoEmpresa, UnidadeParceiro } from '@escritorio/db';

export type ItemPedido = { produto: ProdutoEmpresa | null; texto: string; quantidade: number; unidade: string; preco: number | null; precoInformado?: boolean };

export function formatarReais(valor: number): string {
  const [inteiro, centavos] = valor.toFixed(2).split('.') as [string, string];
  return `R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`;
}

/** Unidades de contagem: "10 PAC" de um produto cadastrado em PC é a mesma coisa (bug do pedido 21, 2026-09-29). */
const CONTAGEM = new Set(['un', 'und', 'unid', 'unidade', 'pc', 'pç', 'peca', 'peça', 'pac', 'pct', 'pacote']);

/** Mesma unidade, ou as duas de contagem. Peso, volume e embalagens com várias unidades (CX, FD) mudam o preço: continuam diferentes. */
export function mesmaUnidade(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || (CONTAGEM.has(x) && CONTAGEM.has(y));
}

/** Unidade pedida que não bate com a do cadastro: o sistema não calcula o valor e deixa para o Fiscal conferir. */
const unidadeDiferente = (i: ItemPedido) => i.produto !== null && i.unidade.trim() !== '' && !mesmaUnidade(i.unidade, i.produto.unidade);

const numero = (q: number) => String(q).replace('.', ',');
export const cnpjFormatado = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

/** Título e resumo da demanda de nota. Preço só aparece em venda e só vem da tabela (campo `preco`). */
export function montarPedidoNota(p: {
  tipo: 'venda' | 'devolucao'; destino: UnidadeParceiro | null; textoDestinatario: string;
  itens: ItemPedido[]; pedidoOriginal: string; semPermissao: boolean;
}): { titulo: string; resumo: string } {
  const venda = p.tipo === 'venda';
  const rotulo = venda ? 'Destinatário' : 'Fornecedor';
  const titulo = p.destino
    ? `NF de ${venda ? 'venda' : 'devolução'} – ${p.destino.rede} / ${p.destino.unidade}`
    : `NF de ${venda ? 'venda' : 'devolução'} – ${venda ? 'destinatário' : 'fornecedor'} não cadastrado`;

  const linhas: string[] = [];
  if (p.destino) {
    const partes = [`${p.destino.rede} / ${p.destino.unidade}`];
    if (p.destino.razaoSocial) partes.push(p.destino.razaoSocial);
    if (p.destino.cnpj) partes.push(`CNPJ ${cnpjFormatado(p.destino.cnpj)}`);
    if (p.destino.ie) partes.push(`IE ${p.destino.ie}`);
    linhas.push(`${rotulo}: ${partes.join(' – ')}`);
  } else {
    linhas.push(`${rotulo}: NÃO CADASTRADO – "${p.textoDestinatario}"`);
  }

  let total = 0;
  let algumPreco = false;
  for (const i of p.itens) {
    if (!i.produto) {
      // Preço informado pela equipe para item não cadastrado: entra no total, como no pedido e no CSV.
      if (venda && i.precoInformado && i.preco !== null) {
        const subtotal = Math.round(i.quantidade * i.preco * 100) / 100;
        total += subtotal;
        algumPreco = true;
        linhas.push(`${numero(i.quantidade)} ${i.unidade.trim().toUpperCase() || 'UN'} ${i.texto} (não cadastrado) × ${formatarReais(i.preco)} = ${formatarReais(subtotal)} (preço informado)`);
        continue;
      }
      linhas.push(`${numero(i.quantidade)} ${i.unidade} ${i.texto} – PRODUTO NÃO CADASTRADO`);
      continue;
    }
    // Preço informado pela equipe vale na unidade informada, mesmo diferente da cadastrada.
    if (i.precoInformado && i.preco !== null) {
      const subtotal = Math.round(i.quantidade * i.preco * 100) / 100;
      total += subtotal;
      algumPreco = true;
      linhas.push(`${numero(i.quantidade)} ${i.unidade} ${i.produto.descricao} (cód. ${i.produto.codigo}) × ${formatarReais(i.preco)} = ${formatarReais(subtotal)} (preço informado)`);
      continue;
    }
    // Unidade pedida diferente da cadastrada (ex.: kg × PAC): mantém a do cliente e não calcula, para o Fiscal conferir.
    if (unidadeDiferente(i)) {
      linhas.push(`${numero(i.quantidade)} ${i.unidade} ${i.produto.descricao} (cód. ${i.produto.codigo}) – ATENÇÃO: pedido em ${i.unidade}, produto cadastrado em ${i.produto.unidade}; sem cálculo`);
      continue;
    }
    const base = `${numero(i.quantidade)} ${i.produto.unidade} ${i.produto.descricao} (cód. ${i.produto.codigo})`;
    if (!venda) linhas.push(base);
    else if (i.preco === null) linhas.push(`${base} – sem preço cadastrado`);
    else {
      const subtotal = Math.round(i.quantidade * i.preco * 100) / 100;
      total += subtotal;
      algumPreco = true;
      linhas.push(`${base} × ${formatarReais(i.preco)} = ${formatarReais(subtotal)}`);
    }
  }
  if (venda && algumPreco) linhas.push(`Total (itens com preço): ${formatarReais(total)}`);
  if (p.semPermissao) linhas.push('Observação: contato sem permissão para pedir nota.');
  linhas.push('', `Pedido original: "${p.pedidoOriginal}"`);
  return { titulo, resumo: linhas.join('\n') };
}

type Texto = string | null | undefined;

/** Dados do pedido de venda guardados na demanda, para o painel gerar o arquivo do Bling (pedido do dono, 2026-09-29). */
export function montarPedidoVenda(p: {
  agora: Date; destino: UnidadeParceiro | null; textoDestinatario: string; itens: ItemPedido[];
  extras: {
    data_prevista?: Texto; forma_pagamento?: Texto; valor_frete?: number | null; tipo_frete?: 'R' | 'D' | null;
    transportadora?: Texto; observacoes?: Texto;
    entrega?: { endereco: string; numero?: Texto; complemento?: Texto; bairro?: Texto; cidade?: Texto; uf?: Texto; cep?: Texto } | null;
  };
}): PedidoVendaSalvo {
  const x = p.extras;
  return {
    unidade_id: p.destino?.id ?? null, texto_destinatario: p.textoDestinatario,
    data: new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_HORARIO, day: '2-digit', month: '2-digit', year: 'numeric' }).format(p.agora),
    itens: p.itens.map((i) => {
      if (i.precoInformado && i.preco !== null) {
        return { produto: i.produto?.descricao ?? i.texto, sku: i.produto?.codigo ?? null, un: i.unidade.trim().toUpperCase() || 'UN', quantidade: i.quantidade, valor_unitario: i.preco };
      }
      // Unidade pedida diferente da cadastrada: mantém a do cliente e deixa o valor para o Fiscal conferir.
      const diferente = unidadeDiferente(i);
      return {
        produto: i.produto?.descricao ?? i.texto, sku: i.produto?.codigo ?? null,
        un: (diferente || !i.produto ? i.unidade.trim() : i.produto.unidade).toUpperCase() || 'UN',
        quantidade: i.quantidade, valor_unitario: i.produto && !diferente ? i.preco : null,
      };
    }),
    data_prevista: x.data_prevista ?? null, forma_pagamento: x.forma_pagamento ?? null, valor_frete: x.valor_frete ?? null,
    tipo_frete: x.tipo_frete ?? null, transportadora: x.transportadora ?? null, observacoes: x.observacoes ?? null,
    entrega: entregaDoPedido(x.entrega),
  };
}

type Endereco = { endereco?: Texto; numero?: Texto; complemento?: Texto; bairro?: Texto; cidade?: Texto; uf?: Texto; cep?: Texto };

/** Endereço de entrega como fica guardado no pedido: campos ausentes viram null, UF em maiúsculas e CEP só com dígitos. */
export function entregaDoPedido(e: (Endereco & { endereco: string }) | null | undefined): PedidoVendaSalvo['entrega'] {
  return e ? {
    endereco: e.endereco, numero: e.numero ?? null, complemento: e.complemento ?? null, bairro: e.bairro ?? null,
    cidade: e.cidade ?? null, uf: e.uf?.toUpperCase() ?? null, cep: e.cep ? e.cep.replace(/\D/g, '') : null,
  } : null;
}

/** "Rua Salinas, 1200, loja 2 – Santa Efigênia – Belo Horizonte/MG – CEP 30150-230"; null se não houver nada. */
export function enderecoPorExtenso(e: Endereco): string | null {
  const rua = [e.endereco, e.numero, e.complemento].filter(Boolean).join(', ');
  const cidade = e.cidade ? (e.uf ? `${e.cidade}/${e.uf}` : e.cidade) : e.uf ?? '';
  const cep = (e.cep ?? '').replace(/\D/g, '');
  const partes = [rua, e.bairro ?? '', cidade, cep.length === 8 ? `CEP ${cep.slice(0, 5)}-${cep.slice(5)}` : cep ? `CEP ${cep}` : ''].filter(Boolean);
  return partes.length ? partes.join(' – ') : null;
}

/** Resumo de uma nota para o cliente conferir no WhatsApp antes de ir para o Fiscal (pedido do dono, 2026-09-29). */
export function montarResumoParaCliente(p: {
  tipo: 'venda' | 'devolucao'; destino: UnidadeParceiro | null; textoDestinatario: string; itens: ItemPedido[];
  extras: {
    data_prevista?: Texto; forma_pagamento?: Texto; valor_frete?: number | null; tipo_frete?: 'R' | 'D' | null; transportadora?: Texto; observacoes?: Texto;
    entrega?: Endereco | null;
  };
}): string {
  const venda = p.tipo === 'venda';
  const linhas = [venda ? '*Nota de venda*' : '*Nota de devolução*'];
  if (p.destino) {
    const d = p.destino;
    linhas.push(`Para: ${[d.razaoSocial ?? `${d.rede} ${d.unidade}`, ...(d.cnpj ? [`CNPJ ${cnpjFormatado(d.cnpj)}`] : [])].join(' – ')}`);
    linhas.push(`Endereço: ${enderecoPorExtenso(d) ?? 'não cadastrado, a equipe confere'}`);
  } else {
    linhas.push(`Para: ${p.textoDestinatario} (não cadastrado, a equipe confere)`);
  }
  const entrega = p.extras.entrega ? enderecoPorExtenso(p.extras.entrega) : null;
  if (entrega) linhas.push(`Entrega em: ${entrega}`);

  let total = 0;
  let faltouPreco = false;
  for (const i of p.itens) {
    const diferente = unidadeDiferente(i);
    const un = (diferente || !i.produto ? i.unidade.trim() : i.produto.unidade).toUpperCase() || 'UN';
    const nome = i.produto ? `${i.produto.descricao} (cód. ${i.produto.codigo})` : i.texto;
    let linha = `• ${numero(i.quantidade)} ${un} ${nome}`;
    if (!i.produto) {
      linha += ' – produto não cadastrado, a equipe confere';
      faltouPreco = true;
    } else if (venda && diferente) {
      linha += ` – sem preço: produto cadastrado em ${i.produto.unidade}, a equipe confere`;
      faltouPreco = true;
    } else if (venda && i.preco === null) {
      linha += ' – sem preço na tabela, a equipe confere';
      faltouPreco = true;
    } else if (venda && i.preco !== null) {
      const subtotal = Math.round(i.quantidade * i.preco * 100) / 100;
      total += subtotal;
      linha += ` – ${formatarReais(i.preco)} = ${formatarReais(subtotal)}`;
    }
    linhas.push(linha);
  }

  const x = p.extras;
  if (venda) {
    const frete = x.valor_frete ?? 0;
    const obs = [frete > 0 ? `com frete de ${formatarReais(frete)}` : '', faltouPreco ? 'itens sem preço de fora' : ''].filter(Boolean);
    linhas.push(`Total: ${formatarReais(Math.round((total + frete) * 100) / 100)}${obs.length ? ` (${obs.join('; ')})` : ''}`);
  }
  const combinado = [
    x.forma_pagamento ? `Pagamento: ${x.forma_pagamento}` : '',
    x.data_prevista ? `Entrega: ${x.data_prevista}` : '',
    x.tipo_frete ? `Frete: ${x.tipo_frete === 'R' ? 'por conta de quem vende' : 'por conta do destinatário'}` : '',
    x.transportadora ? `Transportadora: ${x.transportadora}` : '',
    x.observacoes ? `Obs.: ${x.observacoes}` : '',
  ].filter(Boolean);
  if (combinado.length) linhas.push(combinado.join(' · '));
  return linhas.join('\n');
}

/** Identifica o pedido que o cliente conferiu: destinatário e itens (quantidade e unidade). A demanda só abre se bater com um resumo enviado. */
export function chaveConferencia(p: {
  tipo: 'venda' | 'devolucao'; unidade_id: string | null; itens: { produto_id: string | null; texto: string; quantidade: number; unidade: string }[];
}): string {
  const itens = p.itens.map((i) => [i.produto_id ?? i.texto.trim().toLowerCase(), i.quantidade, i.unidade.trim().toLowerCase()]);
  return createHash('sha1').update(JSON.stringify([p.tipo, p.unidade_id, itens])).digest('hex').slice(0, 16);
}
