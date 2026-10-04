import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export type TomNumero = 'neutro' | 'ok' | 'atencao' | 'perigo';
const COR: Record<TomNumero, string> = { neutro: 'text-foreground', ok: 'text-success', atencao: 'text-warning', perigo: 'text-danger' };
const FAIXA_TOPO: Record<TomNumero, string> = { neutro: 'border-t-border', ok: 'border-t-success', atencao: 'border-t-warning', perigo: 'border-t-danger' };
const FAIXA_LADO: Record<TomNumero, string> = { neutro: 'border-l-border', ok: 'border-l-success', atencao: 'border-l-warning', perigo: 'border-l-danger' };

/**
 * Um número do Início. Situação (imagem A): faixa colorida no topo, título, número grande, detalhe e link.
 * Mesa (imagem B): ícone à esquerda, número e o que ele conta embaixo; o cartão inteiro é o link.
 * `data-numero`/`data-valor` são o contrato dos e2e (D20). A cor nunca fala sozinha: título e detalhe dizem o que é.
 */
export function NumeroInicio({ chave, titulo, valor, tom = 'neutro', detalhe, link, icone: Icone, variante = 'situacao' }: {
  chave: string; titulo: string; valor: number | null; tom?: TomNumero; detalhe?: ReactNode;
  link?: { href: string; rotulo: string }; icone?: LucideIcon; variante?: 'situacao' | 'mesa';
}) {
  const texto = valor ?? '—';
  if (variante === 'mesa') {
    const corpo = (
      <>
        {Icone && (
          <span aria-hidden className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted', COR[tom])}>
            <Icone size={22} strokeWidth={1.75} />
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span data-valor="" className={cn('tabular text-3xl font-extrabold', COR[tom])}>{texto}</span>
          <span data-titulo="" className="text-sm text-foreground">{titulo}</span>
        </span>
      </>
    );
    return (
      <Card data-numero={chave} className={cn('border-l-4 p-0', FAIXA_LADO[tom])}>
        {link
          ? <Link href={link.href} className="flex items-center gap-4 rounded-lg p-4 hover:bg-surface-muted">{corpo}<span className="sr-only">: {link.rotulo}</span></Link>
          : <div className="flex items-center gap-4 p-4">{corpo}</div>}
      </Card>
    );
  }
  return (
    <Card data-numero={chave} className={cn('gap-1 border-t-4 p-4', FAIXA_TOPO[tom])}>
      <p data-titulo="" className="text-sm font-bold uppercase tracking-wide text-foreground">{titulo}</p>
      <p data-valor="" className={cn('tabular text-4xl font-extrabold', COR[tom])}>{texto}</p>
      {detalhe && <p className="text-sm text-muted">{detalhe}</p>}
      {link && (
        <Link href={link.href} className="mt-auto pt-1 text-sm font-semibold text-brand underline-offset-4 hover:underline">
          {link.rotulo} <span aria-hidden>→</span>
        </Link>
      )}
    </Card>
  );
}
