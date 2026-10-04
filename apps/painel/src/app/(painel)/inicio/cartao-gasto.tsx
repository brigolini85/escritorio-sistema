import { CircleDollarSign } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { formatarUSD } from '@/lib/formatos';
import { emReais, percentual, previsaoFechamento } from '@/lib/gastos';
import { diasDoMes, situacaoTeto } from '@/lib/inicio';
import type { UsuarioPainel } from '@/lib/sessao';
import { paginaInicio } from './dados-inicio';
import { lerConfigSituacao, lerCotacaoSituacao, lerGastoSituacao } from './dados-situacao';

/** Gasto com IA × teto (imagem A, spec 7B.3): só o administrador (D1). Marca de aviso em 80% e previsão de fechamento. */
export async function CartaoGasto({ u }: { u: UsuarioPainel }) {
  const [cfg, gasto, cotacao, { agora }] = await Promise.all([lerConfigSituacao(), lerGastoSituacao(u.id), lerCotacaoSituacao(), paginaInicio()]);
  if (!cfg || !gasto) {
    return <Card data-testid="inicio-gasto" className="p-4 text-sm text-muted">O gasto com IA não pôde ser lido agora.</Card>;
  }
  const teto = Number(cfg.teto_ia_usd);
  const nivel = situacaoTeto(gasto.total, teto).nivel;
  const pct = percentual(gasto.total, teto);
  const reais = emReais(gasto.total, cotacao);
  const { primeiro, ultimo } = diasDoMes(agora);
  return (
    <Card data-testid="inicio-gasto" className="gap-2 border-t-4 border-t-brand p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Gasto com IA × teto</h2>
        <span className="tabular text-sm text-subtle">teto {formatarUSD(teto)}</span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="tabular text-3xl font-extrabold text-foreground">{formatarUSD(gasto.total)}</span>
        <span className="tabular text-sm font-semibold text-muted">{[reais && `≈ ${reais}`, `${pct}%`].filter(Boolean).join(' · ')}</span>
      </p>
      <div
        role="progressbar" aria-label="Gasto do mês em relação ao teto" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)} aria-valuetext={`${pct}% do teto`}
        className="relative mt-1 h-2 rounded-full bg-surface-muted"
      >
        <div className={cn('h-full rounded-full', nivel === 'atingido' ? 'bg-danger' : nivel === 'perto' ? 'bg-warning' : 'bg-brand')} style={{ width: `${Math.min(100, pct)}%` }} />
        {/* Marca do aviso de 80% (o alerta do teto dispara aí). */}
        <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded-sm bg-warning-decor" style={{ left: '80%' }} />
      </div>
      <p aria-hidden className="tabular flex justify-between text-xs text-subtle"><span>{primeiro}</span><span>aviso em 80%</span><span>{ultimo}</span></p>
      <p className="text-sm text-muted">Previsão até o fim do mês: <strong className="tabular font-bold text-foreground">{formatarUSD(previsaoFechamento(gasto.total, agora))}</strong></p>
      <Link href="/gastos-ia" className="mt-auto flex items-center gap-1 text-sm font-semibold text-brand underline-offset-4 hover:underline">
        <CircleDollarSign aria-hidden size={16} strokeWidth={1.75} />Ver Gastos com IA <span aria-hidden>→</span>
      </Link>
    </Card>
  );
}
