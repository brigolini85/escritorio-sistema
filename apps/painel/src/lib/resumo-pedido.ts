import type { CompradorCadastrado, EnderecoBling, PedidoVendaSalvo } from '@escritorio/core';
import { mascararCEP, mascararDocumento } from './formatos';

/**
 * Pedido de nota de venda (chamados.pedido_venda, jsonb no formato PedidoVendaSalvo) pronto para o OrderSummary.
 * O comprador (CNPJ, endereço) vem do cadastro da unidade, como no CSV do Bling; sem cadastro, vale o texto que o cliente mandou.
 * Item sem valor unitário (ex.: pedido em kg, litro, caixa ou fardo de produto cadastrado em outra unidade) fica "a conferir pelo Fiscal".
 */

export type ItemResumo = {
  produto: string;
  codigo: string | null;
  unidade: string;
  quantidade: number | null;
  valorUnitario: number | null;
  subtotal: number | null;
  aConferir: boolean;
};

export type ResumoPedido = {
  destinatario: { nome: string; documento: string | null; endereco: string | null; cadastrado: boolean };
  data: string | null;
  itens: ItemResumo[];
  total: number;
  /** Algum item sem valor: o total não é o final. */
  totalParcial: boolean;
  itensAConferir: number;
  pagamento: string | null;
  dataPrevista: string | null;
  frete: { valor: number | null; tipo: string | null };
  transportadora: string | null;
  observacoes: string | null;
  entrega: string | null;
};

export const TIPO_FRETE: Record<'R' | 'D', string> = { R: 'por conta de quem vende', D: 'por conta do destinatário' };

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const centavos = (n: number) => Math.round(n * 100) / 100;

/** "Rua X, 123, sala 2 - Centro, Belo Horizonte/MG, CEP 30110-000"; sem nada, null. */
export function enderecoPorExtenso(e: Partial<EnderecoBling> | null | undefined): string | null {
  if (!e) return null;
  const rua = [texto(e.endereco), texto(e.numero), texto(e.complemento)].filter(Boolean).join(', ');
  const cidade = [texto(e.cidade), texto(e.uf)].filter(Boolean).join('/');
  const cep = texto(e.cep);
  const partes = [[rua, texto(e.bairro)].filter(Boolean).join(' - '), cidade, cep ? `CEP ${mascararCEP(cep)}` : ''].filter(Boolean);
  return partes.length ? partes.join(', ') : null;
}

/** Lê o jsonb com cuidado (dado antigo ou incompleto não quebra a tela); formato irreconhecível → null. */
export function resumirPedido(bruto: unknown, comprador: CompradorCadastrado | null = null): ResumoPedido | null {
  if (!bruto || typeof bruto !== 'object' || !Array.isArray((bruto as { itens?: unknown }).itens)) return null;
  const p = bruto as Partial<Record<keyof PedidoVendaSalvo, unknown>> & { itens: unknown[] };

  const itens = p.itens.flatMap((cru): ItemResumo[] => {
    if (!cru || typeof cru !== 'object') return [];
    const i = cru as Record<string, unknown>;
    const quantidade = numero(i.quantidade);
    const valor = numero(i.valor_unitario);
    const temValor = valor !== null && valor > 0;
    return [{
      produto: texto(i.produto) ?? texto(i.sku) ?? 'Produto sem nome',
      codigo: texto(i.sku),
      unidade: (texto(i.un) ?? 'UN').toUpperCase(),
      quantidade,
      valorUnitario: temValor ? valor : null,
      subtotal: temValor && quantidade !== null ? centavos(quantidade * valor) : null,
      aConferir: !temValor || quantidade === null || quantidade <= 0,
    }];
  });

  const tipoFrete = p.tipo_frete === 'R' || p.tipo_frete === 'D' ? TIPO_FRETE[p.tipo_frete] : null;
  const itensAConferir = itens.filter((i) => i.aConferir).length;
  return {
    destinatario: comprador
      ? {
          nome: comprador.razao_social ?? comprador.nome_unidade,
          documento: comprador.cnpj ? mascararDocumento(comprador.cnpj) : null,
          endereco: enderecoPorExtenso(comprador),
          cadastrado: true,
        }
      : { nome: texto(p.texto_destinatario) ?? 'Destinatário não informado', documento: null, endereco: null, cadastrado: false },
    data: texto(p.data),
    itens,
    total: centavos(itens.reduce((s, i) => s + (i.subtotal ?? 0), 0)),
    totalParcial: itensAConferir > 0,
    itensAConferir,
    pagamento: texto(p.forma_pagamento),
    dataPrevista: texto(p.data_prevista),
    frete: { valor: numero(p.valor_frete), tipo: tipoFrete },
    transportadora: texto(p.transportadora),
    observacoes: texto(p.observacoes),
    entrega: p.entrega && typeof p.entrega === 'object' ? enderecoPorExtenso(p.entrega as EnderecoBling) : null,
  };
}
