import type { CampoLegivel } from '@/lib/decisoes';

/** Campos legíveis de uma decisão do agente (Recebeu / Resultado). */
export function CamposDecisao({ titulo, campos }: { titulo: string; campos: CampoLegivel[] }) {
  if (campos.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-subtle">{titulo}</p>
      <dl className="flex flex-col gap-0.5 text-xs">
        {campos.map((c, i) => (
          <div key={i} className="flex gap-2">
            <dt className="shrink-0 text-muted">{c.chave}</dt>
            <dd className="min-w-0 flex-1 text-foreground">
              {c.bloco
                ? <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-surface-muted p-1.5 font-mono text-xs">{c.valor}</pre>
                : <span className="break-words">{c.valor}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
