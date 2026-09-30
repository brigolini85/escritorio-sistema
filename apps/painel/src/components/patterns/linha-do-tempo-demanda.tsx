import { cn } from '@/lib/cn';
import { formatarDataHora } from '@/lib/formatos';

/** Evento de chamado_eventos, com o nome de quem fez (usuarios.nome). */
export type EventoDemanda = { tipo: string; texto: string | null; criado_em: string; usuario: string | null };

const EVENTO: Record<string, string> = {
  criacao: 'Demanda aberta',
  assumido: 'Assumida',
  transferencia: 'Transferida',
  nota_interna: 'Nota interna',
  conclusao: 'Concluída',
};

/** Linha do tempo de uma demanda (painel da conversa e painel lateral de Demandas). */
export function LinhaDoTempoDemanda({ numero, eventos, className }: { numero: number; eventos: EventoDemanda[]; className?: string }) {
  if (eventos.length === 0) return null;
  return (
    <ol aria-label={`Linha do tempo da demanda #${numero}`} className={cn('ml-1 flex flex-col gap-2 border-l border-border pl-3', className)}>
      {eventos.map((e, i) => (
        <li key={i} className="relative text-xs">
          <span aria-hidden className="absolute -left-4 top-1 size-2 rounded-full bg-border" />
          <p className="text-muted">
            <span className="font-medium text-foreground">{EVENTO[e.tipo] ?? e.tipo}</span>
            {e.usuario ? ` por ${e.usuario}` : ''} · <time dateTime={e.criado_em} className="tabular">{formatarDataHora(e.criado_em)}</time>
          </p>
          {e.texto && <p className="whitespace-pre-wrap text-foreground">{e.texto}</p>}
        </li>
      ))}
    </ol>
  );
}
