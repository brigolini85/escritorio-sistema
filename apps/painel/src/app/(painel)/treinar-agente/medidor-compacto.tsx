import { CircleAlert, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Medidor } from '@/lib/orientacoes';
import { textoMedidor } from './tela';

/**
 * Medidor compacto do alto da lista (spec 7C.5): a conversa mais pesada (gerais + setor + a empresa com mais texto)
 * contra o limite de 12.000 caracteres. Aviso de uma linha a partir de 80%; no limite, o que fica de fora.
 */
export function MedidorCompacto({ medidor, empresa }: { medidor: Medidor; empresa: string | null }) {
  const t = textoMedidor(medidor, empresa);
  const cor = medidor.nivel === 'excesso' ? 'bg-danger' : medidor.nivel === 'aviso' ? 'bg-warning' : 'bg-brand';
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-xs font-bold uppercase tracking-wide text-brand">Espaço usado</span>
        <span className="tabular text-foreground"><span className="font-bold">{t.valor}</span> · {t.percentual}</span>
      </p>
      <div
        role="progressbar"
        aria-label="Espaço usado pelas orientações ligadas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={medidor.percentual}
        aria-valuetext={t.descricao}
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className={cn('h-full rounded-full', cor)} style={{ width: `${medidor.percentual}%` }} />
      </div>
      {t.aviso && (
        <p className={cn('flex items-start gap-1.5 text-sm', medidor.nivel === 'excesso' ? 'text-danger' : 'text-warning')}>
          {medidor.nivel === 'excesso'
            ? <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            : <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />}
          {t.aviso}
        </p>
      )}
    </div>
  );
}
