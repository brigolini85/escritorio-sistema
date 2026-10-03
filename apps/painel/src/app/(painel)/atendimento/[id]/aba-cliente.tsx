import { Download, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DocumentText } from '@/components/patterns/document-text';
import { MoneyText } from '@/components/patterns/money-text';
import { PrazoTexto, PrioridadeTexto } from '@/components/patterns/prioridade-prazo';
import type { Prioridade } from '@/lib/demandas';
import { formatarData } from '@/lib/formatos';
import { ContatoDaConversa } from './contato-da-conversa';

export type EmpresaDaAba = { id: string; nome: string; cnpj: string | null; regime: string | null; servicos: string[] };
export type DemandaDaEmpresa = { id: string; numero: number; titulo: string; prioridade: Prioridade; prazo_em: string | null; prazo_pausado_desde: string | null; daConversa: boolean };
export type PedidoRecente = { id: string; criado_em: string; destino: string; total: number };

/** Rótulo de seção (spec 4.2): caixa alta, vinho e negrito, com contagem à direita quando houver. */
function Secao({ titulo, total, acao, children }: { titulo: string; total?: number; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0">
      <h3 className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-brand">
        <span>{titulo}</span>
        {acao ?? (total !== undefined && <span className="tabular">{total}</span>)}
      </h3>
      {children}
    </section>
  );
}

const SimNao = ({ v }: { v: boolean }) => <span className={v ? 'font-semibold text-success' : 'text-foreground'}>{v ? 'Sim' : 'Não'}</span>;

/** Aba CLIENTE (spec 7A.1). `pedidos` null = "Pedidos de nota: Sem acesso" (P11): a seção nem aparece. */
export function AbaCliente({ conversaId, empresa, contato, podeEditarContato, marcas, demandas, detalheDaConversa, pedidos, documentos, agora }: {
  conversaId: string;
  empresa: EmpresaDaAba | null;
  contato: { id: string; nome: string; agente_pausado: boolean } | null;
  podeEditarContato: boolean;
  marcas: { podePedirNota: boolean; podeMudarPreco: boolean } | null;
  demandas: DemandaDaEmpresa[];
  /** Demandas desta conversa, já montadas (DemandaDaConversa), pelo id. */
  detalheDaConversa: Map<string, ReactNode>;
  pedidos: PedidoRecente[] | null;
  documentos: { id: string; nome: string }[];
  agora: Date;
}) {
  return (
    <div className="flex flex-col text-sm">
      <Secao titulo="Empresa" acao={empresa ? (
        <Link href={`/clientes/${empresa.id}`} className="inline-flex items-center gap-1 font-normal normal-case tracking-normal text-muted hover:text-foreground">
          abrir ficha <ExternalLink aria-hidden size={14} strokeWidth={1.75} />
        </Link>
      ) : undefined}>
        {empresa ? (
          <div className="flex flex-col gap-1">
            <p className="font-bold text-foreground">{empresa.nome}</p>
            <p className="text-muted">
              {empresa.cnpj && <DocumentText tipo="cnpj" valor={empresa.cnpj} />}
              {empresa.cnpj && empresa.regime && <span aria-hidden> · </span>}
              {empresa.regime}
            </p>
            {empresa.servicos.length > 0 && (
              <ul className="flex flex-wrap gap-1" aria-label="Serviços contratados">
                {empresa.servicos.map((s) => <li key={s} className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-xs text-foreground">{s}</li>)}
              </ul>
            )}
          </div>
        ) : <p className="text-muted">Nenhuma empresa ligada a esta conversa.</p>}
      </Secao>

      <Secao titulo="Contato">
        <ContatoDaConversa conversaId={conversaId} contato={contato} pode={podeEditarContato} />
        {marcas && (
          <dl className="grid grid-cols-2 gap-y-1">
            <dt className="text-muted">Pode pedir nota</dt><dd className="text-right"><SimNao v={marcas.podePedirNota} /></dd>
            <dt className="text-muted">Pode mudar preço</dt><dd className="text-right"><SimNao v={marcas.podeMudarPreco} /></dd>
          </dl>
        )}
      </Secao>

      <Secao titulo="Demandas abertas" total={demandas.length}>
        {demandas.length === 0 ? <p className="text-muted">Nenhuma demanda aberta desta empresa.</p> : (
          <ul className="flex flex-col divide-y divide-border">
            {demandas.map((d) => {
              const linha = (
                <span className="flex w-full items-baseline justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate"><span className="tabular font-bold">#{d.numero}</span> {d.titulo}</span>
                  <span className="flex shrink-0 items-baseline gap-1 text-xs">
                    <PrioridadeTexto prioridade={d.prioridade} caixaAlta />
                    <span aria-hidden>·</span>
                    <PrazoTexto prazo={d.prazo_em} pausadoDesde={d.prazo_pausado_desde} concluidaEm={null} agora={agora} />
                  </span>
                </span>
              );
              const detalhe = detalheDaConversa.get(d.id);
              return (
                <li key={d.id}>
                  {detalhe ? (
                    <details className="group">
                      <summary className="cursor-pointer list-none">{linha}</summary>
                      <div className="pb-2">{detalhe}</div>
                    </details>
                  ) : <Link href={`/demandas?demanda=${d.id}`} className="block hover:bg-surface-muted">{linha}</Link>}
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      {pedidos !== null && (
        <Secao titulo="Últimos pedidos de nota">
          {pedidos.length === 0 ? <p className="text-muted">Nenhum pedido de nota desta empresa.</p> : (
            <ul className="flex flex-col divide-y divide-border">
              {pedidos.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate"><span className="tabular">{formatarData(p.criado_em).slice(0, 5)}</span> · {p.destino}</span>
                  <MoneyText valor={p.total} className="tabular shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </Secao>
      )}

      <Secao titulo="Documentos liberados" total={documentos.length}>
        {documentos.length === 0 ? <p className="text-muted">Nenhum documento liberado para o agente.</p> : (
          <ul className="flex flex-col gap-1">
            {documentos.map((doc) => (
              <li key={doc.id}>
                <a href={`/api/documentos?id=${doc.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 text-brand underline-offset-4 hover:underline">
                  <span className="truncate">{doc.nome}</span>
                  <Download aria-hidden size={14} strokeWidth={1.75} className="shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}
