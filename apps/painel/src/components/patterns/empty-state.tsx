import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Estado vazio: ícone, frase curta, explicação opcional e a ação sugerida. */
export function EmptyState({
  icone: Icone = Inbox,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: LucideIcon;
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-surface-muted text-muted">
        <Icone aria-hidden size={20} strokeWidth={1.75} />
      </span>
      <p className="text-base font-medium text-foreground">{titulo}</p>
      {descricao && <p className="max-w-sm text-sm text-muted">{descricao}</p>}
      {acao && <div className="mt-2 flex flex-wrap justify-center gap-2">{acao}</div>}
    </div>
  );
}
