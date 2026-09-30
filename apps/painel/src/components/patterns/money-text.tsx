import { cn } from '@/lib/cn';
import { formatarBRL } from '@/lib/formatos';

/** Valor em reais ("R$ 1.280,00"), com números tabulares. Sem valor mostra o texto de `vazio`. */
export function MoneyText({ valor, vazio = '—', className }: { valor: number | null | undefined; vazio?: string; className?: string }) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) {
    return <span className={cn('text-subtle', className)}>{vazio}</span>;
  }
  return <span className={cn('tabular whitespace-nowrap', valor < 0 && 'text-danger', className)}>{formatarBRL(valor)}</span>;
}
