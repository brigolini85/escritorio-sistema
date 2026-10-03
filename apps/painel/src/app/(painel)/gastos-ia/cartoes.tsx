import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { FUSO, formatarNumero, formatarUSD } from '@/lib/formatos';
import { emReais, percentual, previsaoFechamento, type Periodo } from '@/lib/gastos';

/** Resumo de gastos_resumo já em números (o PostgREST pode mandar numeric como texto). */
export type Resumo = {
  total_usd: number; chamadas: number; atendimentos: number; custo_atendimentos_usd: number;
  segundos_audio: number; custo_audio_usd: number; economia_cache_usd: number; nao_identificado: number;
};

export function lerResumo(bruto: unknown): Resumo {
  const r = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
  const n = (k: string) => { const v = Number(r[k] ?? 0); return Number.isFinite(v) ? v : 0; };
  return {
    total_usd: n('total_usd'), chamadas: n('chamadas'), atendimentos: n('atendimentos'), custo_atendimentos_usd: n('custo_atendimentos_usd'),
    segundos_audio: n('segundos_audio'), custo_audio_usd: n('custo_audio_usd'), economia_cache_usd: n('economia_cache_usd'), nao_identificado: n('nao_identificado'),
  };
}

const LINK_CONFIG = 'text-brand underline-offset-4 hover:underline';

function Cartao({ id, faixa, titulo, extra, children }: { id: string; faixa: string; titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <Card data-testid={id} className={cn('gap-1 border-t-4 p-4', faixa)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">{titulo}</h2>
        {extra && <span className="tabular whitespace-nowrap text-sm text-subtle">{extra}</span>}
      </div>
      {children}
    </Card>
  );
}
const Numero = ({ children }: { children: ReactNode }) => <p className="tabular text-3xl font-extrabold text-foreground">{children}</p>;
const Linha = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted">{children}</p>;

/** Os quatro cartões do topo (spec 7B.3). O teto é mensal: barra, marca de 80% e previsão só em "Este mês" (P4). */
export function Cartoes({ periodo, resumo, resumoMes, teto, cotacao, custoMinutoConfigurado, agora }: {
  periodo: Periodo; resumo: Resumo; resumoMes: Resumo; teto: number; cotacao: number | null; custoMinutoConfigurado: boolean; agora: Date;
}) {
  const mes = periodo.filtro === 'mes';
  const pctTeto = percentual(resumoMes.total_usd, teto);
  const reais = emReais(resumo.total_usd, cotacao);
  // Média por dia: em "Este mês" só os dias corridos até hoje contam (o resto do mês ainda não aconteceu).
  const diasMedia = mes ? Number(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, day: '2-digit' }).format(agora)) : periodo.dias;
  const mediaDia = diasMedia > 0 ? resumo.chamadas / diasMedia : 0;
  const porAtendimento = resumo.atendimentos > 0 ? resumo.custo_atendimentos_usd / resumo.atendimentos : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Cartao id="gastos-total" faixa="border-t-brand" titulo={mes ? 'Total do mês × teto' : 'Total do período'} extra={mes && teto > 0 ? `teto ${formatarUSD(teto)}` : undefined}>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="tabular text-3xl font-extrabold text-foreground">{formatarUSD(resumo.total_usd)}</span>
            {(reais || (mes && teto > 0)) && (
              <span className="tabular text-sm font-semibold text-muted">
                {[reais && `≈ ${reais}`, mes && teto > 0 && `${pctTeto}%`].filter(Boolean).join(' · ')}
              </span>
            )}
          </p>
          {mes ? (
            <>
              {teto > 0 && (
                <div
                  role="progressbar" aria-label="Gasto do mês em relação ao teto" aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={Math.min(100, pctTeto)} aria-valuetext={`${pctTeto}% do teto`}
                  className="relative mt-2 h-2 rounded-full bg-surface-muted"
                >
                  <div className={cn('h-full rounded-full', pctTeto >= 100 ? 'bg-danger' : 'bg-brand')} style={{ width: `${Math.min(100, pctTeto)}%` }} />
                  {/* Marca do aviso de 80% (o alerta do teto dispara aí). */}
                  <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded-sm bg-warning-decor" style={{ left: '80%' }} />
                </div>
              )}
              <Linha>Previsão até o fim do mês: <strong className="tabular font-bold text-foreground">{formatarUSD(previsaoFechamento(resumo.total_usd, agora))}</strong></Linha>
            </>
          ) : (
            <Linha>
              Este mês: <span className="tabular">{formatarUSD(resumoMes.total_usd)}</span>
              {teto > 0 && <> de <span className="tabular">{formatarUSD(teto)}</span> ({pctTeto}%)</>}
            </Linha>
          )}
          <p className="mt-auto pt-1 text-xs text-subtle">
            {resumo.economia_cache_usd > 0 ? <>Economia com cache: <span className="tabular">{formatarUSD(resumo.economia_cache_usd)}</span></> : 'sem economia de cache ainda'}
          </p>
        </Cartao>

        <Cartao id="gastos-chamadas" faixa="border-t-info" titulo="Chamadas à IA">
          <Numero>{formatarNumero(resumo.chamadas, 0)}</Numero>
          <Linha><span className="tabular">{formatarNumero(mediaDia, mediaDia < 10 ? 1 : 0)}</span> por dia em média</Linha>
        </Cartao>

        <Cartao id="gastos-por-atendimento" faixa="border-t-success" titulo="Custo por atendimento">
          <Numero>{porAtendimento === null ? '—' : formatarUSD(porAtendimento)}</Numero>
          <Linha>
            {resumo.atendimentos > 0
              ? <>média de <span className="tabular">{formatarNumero(resumo.atendimentos, 0)}</span> {resumo.atendimentos === 1 ? 'atendimento' : 'atendimentos'}</>
              : 'nenhum atendimento no período'}
          </Linha>
        </Cartao>

        <Cartao id="gastos-audios" faixa="border-t-warning-decor" titulo="Áudios transcritos">
          <p className="flex items-baseline gap-1.5">
            <span className="tabular text-3xl font-extrabold text-foreground">{formatarNumero(Math.round(resumo.segundos_audio / 60), 0)}</span>
            <span className="text-sm text-muted">min</span>
          </p>
          <Linha>
            {custoMinutoConfigurado
              ? <span className="tabular">{formatarUSD(resumo.custo_audio_usd)}</span>
              : <>custo por minuto não configurado (<Link className={LINK_CONFIG} href="/configuracoes#teto-ia">Configurações</Link>)</>}
          </Linha>
        </Cartao>
      </div>

      {resumo.nao_identificado > 0 && (
        <p data-testid="gastos-aviso-nao-identificado" role="note" className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-foreground">
          <AlertTriangle aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
          {formatarNumero(resumo.nao_identificado, 0)} {resumo.nao_identificado === 1 ? 'chamada' : 'chamadas'} sem funcionalidade neste período. Registros antigos, ou o trabalhador está desatualizado.
        </p>
      )}
    </div>
  );
}
