'use client';

import { CircleAlert, Gauge, TriangleAlert } from 'lucide-react';
import { useAgora } from '@/components/patterns/relative-time';
import { cn } from '@/lib/cn';
import { alertasDaFaixa, type AlertaFaixa, type SinaisVida, type SituacaoTeto } from '@/lib/inicio';

/**
 * Faixa de alertas do Início. Recalcula no navegador a cada 15s, como os HealthSignal do cartão de sinais,
 * para a faixa e o cartão nunca discordarem (um sinal que para aparece nos dois sem esperar recarga). O último sinal
 * em si vem do servidor: a página recarrega a cada minuto (RecarregarPeriodico), senão o sinal pareceria parado.
 */
export function FaixaAlertas({ teto, sinais }: { teto: SituacaoTeto | null; sinais: SinaisVida | null }) {
  const agora = useAgora(15_000);
  const faixa = alertasDaFaixa({ teto, sinais, agora: new Date(agora) });
  if (faixa.length === 0) return null;
  return (
    <section aria-label="Alertas" className="flex flex-col gap-2">
      {faixa.map((a) => <ItemFaixa key={a.id} alerta={a} />)}
    </section>
  );
}

function ItemFaixa({ alerta: a }: { alerta: AlertaFaixa }) {
  const perigo = a.nivel === 'perigo';
  const Icone = a.id === 'teto' ? Gauge : perigo ? CircleAlert : TriangleAlert;
  return (
    <div
      role={perigo ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm', perigo ? 'border-danger bg-danger-soft text-danger' : 'border-warning bg-warning-soft text-warning')}
    >
      <Icone aria-hidden size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold" suppressHydrationWarning>{a.titulo}</p>
        <p>{a.texto}</p>
      </div>
    </div>
  );
}
