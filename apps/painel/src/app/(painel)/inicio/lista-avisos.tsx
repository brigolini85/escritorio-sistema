import type { Database } from '@escritorio/db';
import { Bell } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { RelativeTime } from '@/components/patterns/relative-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { marcarAlertaLido } from './acoes';

type Alerta = Database['public']['Tables']['alertas']['Row'];

const NIVEL_AVISO: Record<string, { rotulo: string; variant: 'danger' | 'warning' | 'info' }> = {
  critico: { rotulo: 'Crítico', variant: 'danger' },
  operacional: { rotulo: 'Operacional', variant: 'warning' },
  aviso: { rotulo: 'Aviso', variant: 'info' },
};

/** Avisos ainda não vistos (os de hoje, com OK). `id="avisos"`: o cartão dos sinais e o bloco Sistema levam até aqui. */
export function ListaAvisos({ dados, extra }: { dados: { alertas: Alerta[]; total: number } | null; extra: string }) {
  const alertas = dados?.alertas ?? [];
  return (
    <section id="avisos" aria-labelledby="titulo-avisos" className="scroll-mt-4">
      <Card className="gap-0 p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
          <h2 id="titulo-avisos" className="text-sm font-bold uppercase tracking-wide text-brand">Avisos</h2>
          <span className="text-sm text-subtle">{extra} · {dados ? `${dados.total} ${dados.total === 1 ? 'não visto' : 'não vistos'}` : 'indisponíveis'}</span>
        </div>
        {alertas.length === 0 ? (
          <EmptyState icone={Bell} titulo="Nenhum aviso." descricao="Os avisos do agente e do sistema aparecem aqui." className="py-6" />
        ) : (
          <ul className="divide-y divide-border">
            {alertas.map((a) => {
              const nivel = NIVEL_AVISO[a.nivel] ?? NIVEL_AVISO.aviso!;
              return (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <Badge variant={nivel.variant} className="mt-0.5">{nivel.rotulo}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-foreground', a.nivel === 'critico' && 'font-medium')}>{a.mensagem}</p>
                    <RelativeTime data={a.criado_em} className="text-xs text-muted" />
                  </div>
                  <form action={marcarAlertaLido.bind(null, a.id)}>
                    <Button type="submit" variant="outline" size="sm" title="Marcar como visto">ok</Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
