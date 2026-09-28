import type { ProdutoEmpresa, UnidadeParceiro } from '@escritorio/db';

export type ItemPedido = { produto: ProdutoEmpresa | null; texto: string; quantidade: number; unidade: string; preco: number | null };

export function formatarReais(valor: number): string {
  const [inteiro, centavos] = valor.toFixed(2).split('.') as [string, string];
  return `R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`;
}

const numero = (q: number) => String(q).replace('.', ',');
const cnpjFormatado = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

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
      linhas.push(`${numero(i.quantidade)} ${i.unidade} ${i.texto} – PRODUTO NÃO CADASTRADO`);
      continue;
    }
    // Unidade pedida diferente da cadastrada (ex.: kg × PAC): mantém a do cliente e não calcula, para o Fiscal conferir.
    if (i.unidade.trim() !== '' && i.unidade.trim().toLowerCase() !== i.produto.unidade.toLowerCase()) {
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
