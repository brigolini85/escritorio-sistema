import { CircleAlert } from 'lucide-react';

/** Aviso da última tentativa que falhou (?erro= que as server actions devolvem). O texto começa como antes. */
export function AvisoErro({ erro }: { erro?: string }) {
  if (!erro) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
      <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <span>Não foi possível salvar: {erro}</span>
    </p>
  );
}
