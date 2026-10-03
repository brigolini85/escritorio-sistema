import type { CompradorCadastrado, PedidoVendaSalvo } from '@escritorio/core';
import { Building2, ChevronRight, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BlingExportButton } from '@/components/patterns/bling-export-button';
import { DocumentText } from '@/components/patterns/document-text';
import { OrderSummary } from '@/components/patterns/order-summary';
import { RelativeTime } from '@/components/patterns/relative-time';
import { StatusBadge, type StatusDemanda } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { camposLegiveis, rotuloEtapa } from '@/lib/decisoes';
import { formatarDataHora } from '@/lib/formatos';
import { pendenciasCsvBling, resumirPedido } from '@/lib/resumo-pedido';
import { LinhaDoTempoDemanda, type EventoDemanda } from '@/components/patterns/linha-do-tempo-demanda';
import { MoneyText } from '@/components/patterns/money-text';
import { CamposDecisao } from './campos-decisao';
import { ContatoDaConversa } from './contato-da-conversa';
import { VerPedido } from './ver-pedido';

export type DemandaDetalhe = {
  id: string;
  numero: number;
  titulo: string;
  resumo: string;
  status: StatusDemanda;
  setor: string | null;
  responsavel: string | null;
  fora_do_contrato: boolean;
  criado_em: string;
  pedido_venda: unknown;
  eventos: EventoDemanda[];
};

export type Decisao = { etapa: string; entrada: unknown; saida: unknown; justificativa: string | null; criado_em: string };

function Secao({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">{titulo}</h3>
      {children}
    </section>
  );
}

/**
 * Aba Detalhes do painel da conversa: empresa, contato (cadastrar ou ligar/desligar o agente), demandas abertas
 * com a linha do tempo, pedido de nota com o CSV do Bling (só com a permissão) e as decisões do agente.
 */
export function DetalhesConversa({
  conversaId,
  empresa,
  outrasEmpresas,
  contato,
  podeEditarContato,
  demandas,
  compradores,
  podeCsv,
  decisoes,
}: {
  conversaId: string;
  empresa: { id: string; nome: string; cnpj: string | null } | null;
  /** Outras empresas pelas quais o contato fala (só leitura). */
  outrasEmpresas: { id: string; nome: string }[];
  contato: { id: string; nome: string; agente_pausado: boolean } | null;
  podeEditarContato: boolean;
  demandas: DemandaDetalhe[];
  /** Cadastro da unidade compradora (parceiros_unidades) por id, como no CSV do Bling. */
  compradores: Map<string, CompradorCadastrado>;
  podeCsv: boolean;
  decisoes: Decisao[];
}) {
  return (
    <div className="flex flex-col text-sm">
      <Secao titulo="Empresa">
        {empresa ? (
          <Link href={`/clientes/${empresa.id}`} className="group flex items-center gap-2 rounded-md text-foreground">
            <Building2 aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium group-hover:underline">{empresa.nome}</span>
              {empresa.cnpj && <DocumentText tipo="cnpj" valor={empresa.cnpj} className="text-xs text-muted" />}
            </span>
            <ChevronRight aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-subtle" />
          </Link>
        ) : (
          <p className="text-muted">Nenhuma empresa ligada a esta conversa.</p>
        )}
        {outrasEmpresas.length > 0 && (
          <div className="text-xs text-muted">
            <p>O contato também fala por:</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {outrasEmpresas.map((e) => (
                <li key={e.id}><Link href={`/clientes/${e.id}`} className="text-brand underline-offset-4 hover:underline">{e.nome}</Link></li>
              ))}
            </ul>
          </div>
        )}
      </Secao>

      <Secao titulo="Contato">
        <ContatoDaConversa conversaId={conversaId} contato={contato} pode={podeEditarContato} />
      </Secao>

      <Secao titulo={`Demandas abertas (${demandas.length})`}>
        {demandas.length === 0 && <p className="text-muted">Nenhuma demanda aberta nesta conversa.</p>}
        {demandas.map((d) => {
          const salvo = d.pedido_venda as PedidoVendaSalvo | null;
          const comprador = salvo?.unidade_id ? compradores.get(salvo.unidade_id) ?? null : null;
          const problemas = pendenciasCsvBling(d.numero, d.pedido_venda, comprador);
          return (
            <article key={d.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-foreground">
                  <span className="tabular text-muted">#{d.numero}</span> · {d.titulo}
                </h4>
                <StatusBadge tipo="demanda" status={d.status} className="mt-0.5" />
              </div>
              <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                <span>{d.setor ?? 'Triagem'}</span>
                <span aria-hidden>·</span>
                <span>{d.responsavel ?? 'Sem responsável'}</span>
                <span aria-hidden>·</span>
                <span>aberta <RelativeTime data={d.criado_em} /></span>
                {d.fora_do_contrato && <Badge variant="warning">Fora do contrato</Badge>}
              </p>
              {d.resumo && <p className="whitespace-pre-wrap text-foreground">{d.resumo}</p>}
              {d.pedido_venda ? (
                <ResumoPedidoCurto numero={d.numero} pedido={d.pedido_venda} comprador={comprador}>
                  {podeCsv && <BlingExportButton href={`/api/csv-bling?id=${d.id}`} problemas={problemas} />}
                </ResumoPedidoCurto>
              ) : null}
              <LinhaDoTempoDemanda numero={d.numero} eventos={d.eventos} />
            </article>
          );
        })}
      </Secao>

      <section className="p-3">
        <details className="group rounded-md border border-border">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 font-medium text-foreground">
            <Lightbulb aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
            Por que o agente fez isso?
            <ChevronRight aria-hidden size={16} strokeWidth={1.75} className="ml-auto text-subtle transition-transform duration-150 ease-out group-open:rotate-90" />
          </summary>
          {decisoes.length === 0 ? (
            <p className="border-t border-border px-3 py-2 text-muted">O agente ainda não registrou decisões nesta conversa.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border border-t border-border">
              {decisoes.map((d, i) => (
                <li key={i} className="flex flex-col gap-1.5 px-3 py-2">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{rotuloEtapa(d.etapa)}</span>
                    <time dateTime={d.criado_em} className="tabular text-xs text-subtle">{formatarDataHora(d.criado_em)}</time>
                  </p>
                  {d.justificativa && <p className="text-muted">{d.justificativa}</p>}
                  <CamposDecisao titulo="Recebeu" campos={camposLegiveis(d.entrada)} />
                  <CamposDecisao titulo="Resultado" campos={camposLegiveis(d.saida)} />
                </li>
              ))}
            </ol>
          )}
        </details>
      </section>
    </div>
  );
}

/** Pedido de nota em poucas linhas (cabe nos 360px); o completo, com a tabela de itens, abre em "Ver pedido". */
function ResumoPedidoCurto({ numero, pedido, comprador, children }: { numero: number; pedido: unknown; comprador: CompradorCadastrado | null; children?: ReactNode }) {
  const r = resumirPedido(pedido, comprador);
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-muted p-2.5">
      {r ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-muted">Pedido de nota</p>
          <p className="font-medium text-foreground">{r.destinatario.nome}</p>
          <p className="text-xs text-muted">
            {r.itens.length === 1 ? '1 item' : `${r.itens.length} itens`} · {r.totalParcial ? 'Total parcial' : 'Total'}{' '}
            <MoneyText valor={r.total} className="font-medium text-foreground" />
          </p>
          {r.itensAConferir > 0 && (
            <p className="text-xs text-warning">
              {r.itensAConferir === 1 ? '1 item sem valor' : `${r.itensAConferir} itens sem valor`}: a conferir pelo Fiscal
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted">Não foi possível ler este pedido.</p>
      )}
      <div className="flex flex-wrap items-start gap-2">
        <VerPedido numero={numero}>
          <OrderSummary pedido={pedido} comprador={comprador} />
        </VerPedido>
        {children}
      </div>
    </div>
  );
}
