import { LoaderCircle, Search } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { classeCaixa } from '../estilos';
import type { Bloco } from './ficha';

/** Cartão de um bloco da ficha (imagem 00-cliente-cadastro): região com nome e âncora para o índice. */
export function BlocoFicha({ id, titulo, aside, pode = true, destaque = false, className, children }: {
  id: Bloco; titulo: string; aside?: ReactNode; pode?: boolean; destaque?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <section id={`bloco-${id}`} data-bloco={id} aria-labelledby={`titulo-${id}`}
      className={cn('scroll-mt-4 rounded-lg border border-border bg-surface p-5', destaque && 'border-l-4 border-l-warning', className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {/* tabIndex -1: o link do índice leva o foco para cá (o próximo Tab segue dentro do bloco). */}
        <h2 id={`titulo-${id}`} tabIndex={-1} className="text-sm font-extrabold uppercase tracking-wide text-brand">{titulo}</h2>
        {aside && <div className="text-sm text-muted">{aside}</div>}
      </div>
      {/* "Só ver": os campos ficam à vista e desligados (não vão no envio). */}
      <fieldset disabled={!pode} className="m-0 min-w-0 border-0 p-0">{children}</fieldset>
    </section>
  );
}

/** Campo com lupa à direita (busca pública). Recebe id/aria do FormField e repassa ao input. */
export function CampoComLupa({ rotuloLupa, aoBuscar, buscando, mostrarLupa, className, ...props }: ComponentProps<'input'> & {
  rotuloLupa: string; aoBuscar: () => void; buscando: boolean; mostrarLupa: boolean;
}) {
  return (
    <div className="relative">
      <Input {...props} className={cn(mostrarLupa && 'pr-10', className)} />
      {mostrarLupa && (
        // aria-disabled em vez de disabled: botão desligado perde o foco (cai no body) durante a busca.
        <button type="button" onClick={() => { if (!buscando) aoBuscar(); }} aria-disabled={buscando || undefined} aria-busy={buscando || undefined}
          aria-label={rotuloLupa} title={rotuloLupa}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted hover:text-foreground disabled:opacity-50 aria-disabled:cursor-wait aria-disabled:opacity-50">
          {buscando ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" /> : <Search aria-hidden size={16} strokeWidth={1.75} />}
        </button>
      )}
    </div>
  );
}

/** Valor em reais: o "R$" fica ao lado, o campo guarda "1.250,00". */
export function CampoDinheiro({ className, ...props }: ComponentProps<'input'>) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">R$</span>
      <Input inputMode="decimal" autoComplete="off" {...props} className={cn('tabular pl-9', className)} />
    </div>
  );
}

export function Caixa({ rotulo, ...props }: Omit<ComponentProps<'input'>, 'type'> & { rotulo: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 text-base font-medium text-foreground">
      <input type="checkbox" className={classeCaixa} {...props} />
      {rotulo}
    </label>
  );
}

/** Rótulo de grupo (legend) no mesmo visual do Label dos campos. */
export const classeLegenda = 'mb-1.5 text-xs font-bold uppercase tracking-wider text-brand';
