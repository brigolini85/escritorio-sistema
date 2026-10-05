import { pedidoVendaBling, problemasPedidoBling, type CompradorCadastrado, type PedidoVendaSalvo } from './bling';
import { FUSO_HORARIO } from './fuso';

/** Parte I2 (D9): conferência do pedido de nota sem IA. O `resultado` gravado vira a tarefa da I3 (mesmo formato). */
export const SITUACOES_PRE_ANALISE = ['falta', 'atencao', 'ok'] as const;
export type SituacaoPreAnalise = (typeof SITUACOES_PRE_ANALISE)[number];
export const ROTULO_SITUACAO_PRE_ANALISE: Record<SituacaoPreAnalise, string> = { falta: 'Falta', atencao: 'Atenção', ok: 'OK' };
export type LinhaPreAnalise = { situacao: SituacaoPreAnalise; texto: string };
export type PreAnaliseNota = { versao: 1; linhas: LinhaPreAnalise[]; contagem: Record<SituacaoPreAnalise, number> };
/** Preço vigente que começou nos últimos 30 dias, com o valor de antes (sku = código do produto). */
export type MudancaPreco = { sku: string; anterior: number; desde: string };

const reais = (v: number) => {
  const [i, c] = v.toFixed(2).split('.') as [string, string];
  return `R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${c}`;
};
const diaMes = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_HORARIO, day: '2-digit', month: '2-digit' }).format(new Date(iso));
const cnpj = (c: string) => c.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const ENDERECO = [['endereco', 'rua'], ['cidade', 'cidade'], ['uf', 'UF'], ['cep', 'CEP']] as const;

export function preAnalisarPedidoNota(p: { numero: number; pedido: PedidoVendaSalvo; comprador: CompradorCadastrado | null; mudancas: MudancaPreco[] }): PreAnaliseNota {
  const linhas: LinhaPreAnalise[] = [];
  const add = (situacao: SituacaoPreAnalise, texto: string) => linhas.push({ situacao, texto });
  const c = p.comprador;
  if (!c) {
    add('falta', p.pedido.unidade_id
      ? 'Cadastro do destinatário não encontrado: confira o cliente da empresa.'
      : `Destinatário não cadastrado: "${p.pedido.texto_destinatario}". Cadastre antes de emitir.`);
  } else {
    const nome = c.razao_social ?? c.nome_unidade;
    if (c.cnpj?.trim()) add('ok', `Destinatário: ${nome} · CNPJ ${cnpj(c.cnpj)}.`);
    else add('falta', `Destinatário ${nome} sem CNPJ.`);
    const faltam = ENDERECO.filter(([k]) => !c[k]?.trim()).map(([, r]) => r);
    if (faltam.length) add('atencao', `Endereço do destinatário incompleto: falta ${faltam.join(', ')}.`);
  }
  let comPreco = 0;
  p.pedido.itens.forEach((i, n) => {
    const nomeItem = `Item ${n + 1} (${i.produto ?? i.sku ?? 'sem nome'})`;
    if (!i.sku?.trim()) { add('falta', `${nomeItem}: produto não cadastrado.`); return; }
    if (i.valor_unitario === null || i.valor_unitario <= 0) {
      add('falta', `${nomeItem}: sem preço. Confira a tabela da rede ou a unidade pedida (${i.un || 'UN'}).`);
      return;
    }
    const m = p.mudancas.find((x) => x.sku === i.sku);
    if (m && m.anterior !== i.valor_unitario) {
      add('atencao', `${nomeItem}: preço mudou em ${diaMes(m.desde)}, de ${reais(m.anterior)} para ${reais(i.valor_unitario)}.`);
      return;
    }
    comPreco++;
  });
  if (comPreco) add('ok', comPreco === 1 ? '1 item com produto e preço da tabela.' : `${comPreco} itens com produto e preço da tabela.`);
  // Sem comprador, o "Falta" do destinatário já diz que não sai: o arquivo só é conferido com o cadastro.
  if (c) {
    const problemas = problemasPedidoBling(pedidoVendaBling(p.numero, p.pedido, c));
    if (problemas.length) add('falta', `Arquivo do Bling: ainda não sai (${problemas.length} pendência${problemas.length > 1 ? 's' : ''}).`);
    else add('ok', 'Arquivo do Bling: pronto para gerar.');
  }
  const ordem = (s: SituacaoPreAnalise) => SITUACOES_PRE_ANALISE.indexOf(s);
  const ordenadas = linhas.map((l, i) => ({ l, i })).sort((a, b) => ordem(a.l.situacao) - ordem(b.l.situacao) || a.i - b.i).map((x) => x.l);
  const contagem: Record<SituacaoPreAnalise, number> = { falta: 0, atencao: 0, ok: 0 };
  for (const l of ordenadas) contagem[l.situacao]++;
  return { versao: 1, linhas: ordenadas, contagem };
}

/** "2 falta · 1 atenção · 2 OK" (só as que existem). */
export function resumoPreAnalise(a: PreAnaliseNota): string {
  const partes = [[a.contagem.falta, 'falta'], [a.contagem.atencao, 'atenção'], [a.contagem.ok, 'OK']] as const;
  return partes.filter(([n]) => n > 0).map(([n, r]) => `${n} ${r}`).join(' · ');
}

/** O que vem do banco (jsonb) só é mostrado se tiver o formato da versão 1. */
export function ehPreAnaliseNota(x: unknown): x is PreAnaliseNota {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.versao === 1 && Array.isArray(o.linhas) && typeof o.contagem === 'object' && o.contagem !== null
    && o.linhas.every((l) => !!l && typeof l === 'object'
      && (SITUACOES_PRE_ANALISE as readonly string[]).includes((l as LinhaPreAnalise).situacao) && typeof (l as LinhaPreAnalise).texto === 'string');
}
