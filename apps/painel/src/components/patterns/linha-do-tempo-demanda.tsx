import { cn } from '@/lib/cn';
import { formatarDataHora } from '@/lib/formatos';
import { fraseDoEvento, type EventoDemanda } from '@/lib/linha-do-tempo';

export type { EventoDemanda };

/** Linha do tempo de uma demanda (painel lateral de Demandas e painel da conversa): quem fez, o que fez e quando. */
export function LinhaDoTempoDemanda({ numero, eventos, origem = 'agente', className }: {
  numero: number; eventos: EventoDemanda[]; origem?: string; className?: string;
}) {
  if (eventos.length === 0) return null;
  return (
    <ol aria-label={`Linha do tempo da demanda #${numero}`} className={cn('ml-1 flex flex-col gap-2 border-l-2 border-border pl-3', className)}>
      {eventos.map((e, i) => {
        const f = fraseDoEvento(e, origem);
        return (
          <li key={i} className="text-sm">
            <p className="text-muted">
              <span className="font-semibold text-foreground">{f.ator}</span> {f.acao} · <time dateTime={e.criado_em} className="tabular">{formatarDataHora(e.criado_em)}</time>
            </p>
            {f.detalhe && <p className="whitespace-pre-wrap text-foreground">{f.detalhe}</p>}
          </li>
        );
      })}
    </ol>
  );
}
