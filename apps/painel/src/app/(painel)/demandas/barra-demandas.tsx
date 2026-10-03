import { ArrowDown, ArrowUp, X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import {
  OPCOES_ORIGEM, OPCOES_STATUS, ORDENS, etiquetasFiltros, opcoesResponsavel, statusAoAlternar, type FiltrosDemandas, type StatusFiltro,
} from '@/lib/demandas';
import { hrefComParams, type Ordem, type ParamsBusca } from '@/lib/tabela-url';
import { BuscaDemandas, FiltrarDemandas } from './filtros-demandas';

const chip = 'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-base transition-colors duration-150 ease-out';
const ligado = 'border-grafite bg-grafite text-grafite-foreground';
const desligado = 'border-input bg-surface text-foreground hover:bg-surface-muted';
/** Parâmetros que o "Filtrar" troca; os outros ficam como estão. */
const AVANCADOS = ['setor', 'responsavel', 'prioridade', 'tipo', 'periodo', 'prazo'];

export type ContagensDemandas = Partial<Record<StatusFiltro | 'vencidas', number | null>>;

/**
 * Busca, filtros rápidos com contador e filtros avançados (spec 6.1, imagem 03). Tudo é link ou formulário na URL:
 * a página lê os mesmos parâmetros e o CSV do Bling também.
 */
export function BarraDemandas({ params, f, contagens, setores, pessoas, euId, mostrarStatus = true, ordem, extra }: {
  params: ParamsBusca;
  f: FiltrosDemandas;
  contagens: ContagensDemandas;
  setores: { id: string; nome: string }[];
  pessoas: { id: string; nome: string; ativo: boolean }[];
  euId: string;
  /** No quadro as colunas já são os status (decisão 15). */
  mostrarStatus?: boolean;
  /** Na tabela, o seletor de ordem. */
  ordem?: Ordem;
  extra?: ReactNode;
}) {
  const href = (mudancas: Record<string, string | null>) => `/demandas${hrefComParams(params, { ...mudancas, demanda: null })}`;
  const numero = (n: number | null | undefined) => (n === null || n === undefined ? null : <strong className="tabular">{n}</strong>);
  const etiquetas = etiquetasFiltros(f, { setores, pessoas });
  const manter = Object.entries(params)
    .filter(([k]) => !AVANCADOS.includes(k) && k !== 'pagina' && k !== 'demanda')
    .flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string])));

  return (
    <div className="mb-3 flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <BuscaDemandas inicial={f.q ?? ''} />
        <nav aria-label="Filtros rápidos" className="flex flex-wrap items-center gap-2">
          {mostrarStatus && OPCOES_STATUS.map((o) => {
            const ativo = f.status.includes(o.valor);
            return (
              <Link key={o.valor} href={href({ status: statusAoAlternar(f.status, o.valor) })} scroll={false}
                aria-current={ativo ? 'true' : undefined} className={cn(chip, ativo ? ligado : desligado)}>
                {o.rotulo}{o.valor !== 'concluido' && numero(contagens[o.valor])}
              </Link>
            );
          })}
          {mostrarStatus && <span aria-hidden className="mx-1 h-6 border-l border-border" />}
          {OPCOES_ORIGEM.map((o) => {
            const ativo = f.origem === o.valor;
            return (
              <Link key={o.valor} href={href({ origem: ativo ? null : o.valor })} scroll={false}
                aria-current={ativo ? 'true' : undefined} className={cn(chip, ativo ? ligado : desligado)}>
                {o.rotulo}
              </Link>
            );
          })}
          <Link href={href({ vencidas: f.vencidas ? null : '1' })} scroll={false} aria-current={f.vencidas ? 'true' : undefined}
            className={cn(chip, f.vencidas ? 'border-danger bg-danger text-danger-foreground' : 'border-danger/40 bg-surface text-danger hover:bg-danger-soft')}>
            Vencidas{numero(contagens.vencidas)}
          </Link>
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-md border border-input bg-surface px-2 py-1">
          {etiquetas.length === 0 && <span className="px-1 text-muted">Sem filtros avançados</span>}
          {etiquetas.map((e) => (
            <Link key={e.param} href={href({ [e.param]: null })} scroll={false} aria-label={`Tirar filtro ${e.rotulo}`}
              className="inline-flex items-center gap-1 rounded-sm bg-brand-soft px-2 py-0.5 text-sm font-semibold text-brand hover:bg-brand-soft/70">
              {e.rotulo}<X aria-hidden size={14} strokeWidth={2} />
            </Link>
          ))}
        </div>
        <FiltrarDemandas
          manter={manter}
          setores={setores.map((s) => ({ valor: s.id, rotulo: s.nome }))}
          responsaveis={opcoesResponsavel(pessoas, euId, f.responsavel)}
          valores={{ setor: f.setor === 'todos' ? '' : f.setor, responsavel: f.responsavel ?? '', prioridade: f.prioridade ?? '', tipo: f.tipo ?? '', periodo: f.periodo ?? '' }}
        />
        {extra}
      </div>

      {ordem && (
        <nav aria-label="Ordenar" className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>Ordenar por:</span>
          {ORDENS.map((o) => {
            const atual = ordem.coluna === o.coluna;
            const direcao = atual ? (ordem.direcao === 'asc' ? 'desc' : 'asc') : o.direcao;
            const Seta = (atual ? ordem.direcao : o.direcao) === 'asc' ? ArrowUp : ArrowDown;
            return (
              <Link key={o.coluna} href={href({ ordem: o.coluna, direcao })} scroll={false} aria-current={atual ? 'true' : undefined}
                className={cn('inline-flex items-center gap-1 hover:text-foreground', atual && 'font-bold text-foreground')}>
                {o.rotulo}{atual && <Seta aria-hidden size={14} strokeWidth={2} />}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
