import { CircleCheck, ExternalLink, FileSpreadsheet, Minus, PenLine, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { variantesBotao } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatarHoraOuDia } from '@/lib/formatos';
import { historicoDoPedido, montarPedidoNoPainel, origemDoPedido, seloGravado, textoDoSelo, type ItemComparado } from '@/lib/pedido-assistente';
import { arquivoDoPedido, type LeituraConversa, type MensagemTela, type ResultadoPedido } from '@/lib/resultados-assistente';
import type { LeituraDemanda } from './dados-assistente';
import { HistoricoPedido } from './historico-pedido';
import { LinksCsv } from './links-csv';

const LINHA: Record<ItemComparado['mudanca'], string> = { igual: '', alterado: 'bg-warning-soft', adicionado: 'bg-success-soft text-success', removido: 'bg-danger-soft text-danger' };
const MARCA = {
  alterado: { Icone: PenLine, cor: 'text-warning', rotulo: 'Alterado' },
  adicionado: { Icone: Plus, cor: 'text-success', rotulo: 'Adicionado' },
  removido: { Icone: Minus, cor: 'text-danger', rotulo: 'Removido' },
} as const;

function Antes({ valor }: { valor: string }) {
  return <span className="block text-xs font-normal text-muted">antes: <del className="text-danger">{valor}</del></span>;
}

function Dado({ rotulo, valor, detalhe, anterior }: { rotulo: string; valor: string; detalhe?: string | null; anterior?: string | null }) {
  return (
    <div className="border-b border-r border-border px-5 py-3">
      <dt className="text-xs font-extrabold uppercase tracking-wide text-muted">{rotulo}</dt>
      <dd className="font-bold text-foreground">{valor}</dd>
      {detalhe && <dd className="text-sm text-muted">{detalhe}</dd>}
      {anterior && <dd><Antes valor={anterior} /></dd>}
    </div>
  );
}

function LinhaItem({ l }: { l: ItemComparado }) {
  const { item: i, anterior: a, alteracoes: m } = l;
  const Texto = l.mudanca === 'removido' ? 'del' : 'span';
  const marca = l.mudanca === 'igual' ? null : MARCA[l.mudanca];
  const qtdMudou = !!m && (m.quantidade || m.unidade);
  return (
    <tr className={cn('border-b border-border last:border-0', LINHA[l.mudanca])}>
      <td className="w-8 py-2.5 pl-5">
        {marca && (<><marca.Icone aria-hidden size={14} strokeWidth={2} className={marca.cor} /><span className="sr-only">{marca.rotulo}</span></>)}
      </td>
      <td className="py-2.5 pr-3">{i.codigo ?? '—'}</td>
      <td className="py-2.5 pr-3"><Texto>{i.produto}</Texto>{m?.produto && a && <Antes valor={a.produto} />}</td>
      <td className="py-2.5 pr-3"><Texto className={qtdMudou ? 'font-bold' : undefined}>{i.quantidade} {i.unidade}</Texto>{qtdMudou && a && <Antes valor={`${a.quantidade} ${a.unidade}`} />}</td>
      <td className="py-2.5 pr-3 text-right">{i.semPreco ? 'sem preço' : <Texto>{i.preco}</Texto>}{m?.preco && a && <Antes valor={a.preco ?? 'sem preço'} />}</td>
      <td className="py-2.5 pr-5 text-right"><Texto className={m?.subtotal ? 'font-bold' : undefined}>{i.subtotal ?? '—'}</Texto>{m?.subtotal && a && <Antes valor={a.subtotal ?? '—'} />}</td>
    </tr>
  );
}

/**
 * Painel do pedido (spec 7C.3). O pedido vem da prévia mostrada (D2); a demanda, do banco, pela regra de leitura (D17).
 * `rodape`: onde ficam SIM, GRAVAR / MUDAR OUTRA COISA (Task 7), só quando a página decide que podem aparecer.
 */
export function PainelPedido({ resultado, leituraDemanda, leitura, mensagens, usuario, podeCsv, rodape }: {
  resultado: ResultadoPedido; leituraDemanda: LeituraDemanda | null; leitura: LeituraConversa; mensagens: MensagemTela[];
  usuario: { id: string; nome: string }; podeCsv: boolean; rodape?: (gravado: boolean) => ReactNode;
}) {
  const pedido = montarPedidoNoPainel(resultado.previa);
  const ok = leituraDemanda?.estado === 'ok' ? leituraDemanda : null;
  const d = ok?.demanda ?? null;
  const selo = ok ? seloGravado(ok.eventos, usuario.id, resultado.em) : null;
  const origem = d ? origemDoPedido(d) : null;
  const arquivo = d && podeCsv ? arquivoDoPedido(leitura, d.id) : null;
  const pessoa = usuario.nome.split(' ')[0] ?? usuario.nome;
  const marcos = ok && d ? historicoDoPedido({ demanda: d, eventos: ok.eventos, mensagens, pessoa, podeCsv }) : [];
  const { entrega, enderecoEntrega } = pedido;
  const antesEntrega = entrega.mudou ? entrega.anterior ?? 'sem data' : enderecoEntrega.mudou ? enderecoEntrega.anterior ?? 'endereço do cadastro' : null;

  return (
    <div className="flex flex-col gap-4">
      <article aria-labelledby="titulo-pedido" className="overflow-hidden rounded-lg border border-border bg-surface">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest text-brand">{d ? `Nota de venda · ${d.setor ? `Setor ${d.setor}` : 'Triagem'}` : 'Prévia de pedido'}</p>
            <h3 id="titulo-pedido" className="text-2xl font-light text-foreground">
              Pedido{resultado.numero !== null && <> <b className="font-extrabold text-brand">#{resultado.numero}</b></>}
              {d?.empresa && <> · <b className="font-extrabold">{d.empresa}</b></>}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selo && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-2.5 py-1 text-sm font-bold text-success">
                <CircleCheck aria-hidden size={16} strokeWidth={2} />
                {textoDoSelo(selo)}
              </span>
            )}
            {d && (
              <Link href={`/demandas?demanda=${d.id}`} className={variantesBotao({ variant: 'outline', size: 'sm' })}>
                <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
                Abrir demanda
              </Link>
            )}
          </div>
        </header>
        {!d && leituraDemanda && (
          <p className="border-b border-border px-5 py-2 text-sm text-muted">
            {leituraDemanda.estado === 'fora' ? 'Esta demanda não está entre as que você vê; a prévia continua aqui.' : 'Não consegui ler a demanda agora. A prévia continua aqui.'}
          </p>
        )}
        <dl className="grid grid-cols-2 xl:grid-cols-4">
          <Dado rotulo="Destinatário" valor={pedido.destinatario.rede ?? 'não informado'} detalhe={pedido.destinatario.unidade} anterior={pedido.destinatario.anterior} />
          <Dado rotulo="Pagamento" valor={pedido.pagamento.valor ?? 'não informado'} anterior={pedido.pagamento.mudou ? pedido.pagamento.anterior ?? 'não informado' : null} />
          <Dado rotulo="Entrega" valor={entrega.valor ?? 'sem data'} detalhe={enderecoEntrega.valor ?? 'endereço do cadastro'} anterior={antesEntrega} />
          {origem && <Dado rotulo="Pedido veio de" valor={origem.quem} detalhe={origem.como} />}
        </dl>
        {pedido.outros.length > 0 && (
          <dl className="grid grid-cols-2 border-b border-border xl:grid-cols-4">
            {pedido.outros.map((o) => (
              <Dado key={o.rotulo} rotulo={o.rotulo} valor={o.mudanca === 'removido' ? 'removido' : o.valor}
                anterior={o.mudanca === 'removido' ? o.valor : o.anterior} />
            ))}
          </dl>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-4">
          <h4 className="text-xs font-extrabold uppercase tracking-widest text-brand">O que mudou</h4>
          <p className="flex flex-wrap gap-3.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><Plus aria-hidden size={14} strokeWidth={2} className="text-success" />adicionado</span>
            <span className="inline-flex items-center gap-1"><Minus aria-hidden size={14} strokeWidth={2} className="text-danger" /><s>removido</s></span>
            <span className="inline-flex items-center gap-1"><PenLine aria-hidden size={14} strokeWidth={2} className="text-warning" />alterado</span>
          </p>
        </div>
        <table className="w-full text-sm tabular">
          <caption className="sr-only">Itens do pedido, com o que mudou na prévia</caption>
          <thead className="border-y border-border bg-background text-xs font-extrabold uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="w-8 py-2 pl-5"><span className="sr-only">Mudança</span></th>
              <th scope="col" className="py-2 pr-3 text-left">Cód.</th>
              <th scope="col" className="py-2 pr-3 text-left">Produto</th>
              <th scope="col" className="py-2 pr-3 text-left">Qtd</th>
              <th scope="col" className="py-2 pr-3 text-right">Preço</th>
              <th scope="col" className="py-2 pr-5 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>{pedido.itens.map((l, i) => <LinhaItem key={i} l={l} />)}</tbody>
          <tfoot>
            <tr className={cn('border-t border-border', pedido.total.mudou && 'bg-warning-soft')}>
              <td colSpan={5} className="py-3 pr-3 text-right text-muted">Total do pedido</td>
              <td className="py-3 pr-5 text-right">
                <b className="text-xl text-foreground">{pedido.total.valor ?? '—'}</b>
                {pedido.total.mudou && pedido.total.anterior && <Antes valor={pedido.total.anterior} />}
              </td>
            </tr>
          </tfoot>
        </table>
        {rodape?.(Boolean(selo))}
      </article>
      {d && (
        <div className="grid gap-4 xl:grid-cols-2">
          {podeCsv && (
            <section aria-labelledby="titulo-arquivo-pedido" className="rounded-lg border border-border bg-surface px-5 py-4">
              <h4 className="mb-2.5 flex justify-between text-xs font-extrabold uppercase tracking-widest text-brand">
                <span id="titulo-arquivo-pedido">Arquivo para o Bling</span>
                <span className="font-semibold normal-case tracking-normal text-subtle">{arquivo ? 'pronto' : 'ainda não gerado'}</span>
              </h4>
              {arquivo ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-success-soft text-success">
                      <FileSpreadsheet size={20} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold text-foreground">{arquivo.arquivo.nome}</span>
                      <span className="block text-sm text-muted">
                        {arquivo.arquivo.chamados.length === 1 ? '1 pedido' : `${arquivo.arquivo.chamados.length} pedidos`} · gerado {formatarHoraOuDia(arquivo.em)}
                      </span>
                    </span>
                  </div>
                  <LinksCsv mensagemId={arquivo.mensagemId} arquivo={arquivo.arquivo} onde="painel" variante="primary" />
                </div>
              ) : <p className="text-sm text-muted">Depois de gravar, peça ao assistente o CSV do Bling deste pedido.</p>}
            </section>
          )}
          <HistoricoPedido marcos={marcos} agora={new Date()} />
        </div>
      )}
    </div>
  );
}
