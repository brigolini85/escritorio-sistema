import { TriangleAlert } from 'lucide-react';

/** "N contatos aguardando definir acesso" (spec 7D.2): Básico conversa e abre demanda, mas não consulta nem recebe documentos. */
export function FaixaAguardando({ n }: { n: number }) {
  const um = n === 1;
  return (
    <p role="status" className="flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-foreground">
      <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-warning" />
      <span>
        <strong className="font-semibold">{n} {um ? 'contato aguardando' : 'contatos aguardando'} definir acesso.</strong>{' '}
        {um ? 'Até lá ele conversa e abre demanda' : 'Até lá eles conversam e abrem demanda'}, mas não consulta{um ? '' : 'm'} dados nem recebe{um ? '' : 'm'} documentos.
      </span>
    </p>
  );
}
