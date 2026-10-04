import { Bell } from 'lucide-react';
import { HealthSignal } from '@/components/patterns/health-signal';
import { RelativeTime } from '@/components/patterns/relative-time';
import { Card } from '@/components/ui/card';
import { LIMITES_BATIMENTO } from '@/lib/inicio';
import { lerAvisos } from './dados-inicio';
import { lerSinaisSituacao } from './dados-situacao';

/** Sinais de vida (imagem A). `id="sinais-de-vida"`: a faixa de alertas leva até aqui. */
export async function CartaoSinais() {
  const [sinais, avisos] = await Promise.all([lerSinaisSituacao(), lerAvisos()]);
  return (
    <Card id="sinais-de-vida" className="scroll-mt-4 gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Sinais de vida</h2>
        <span className="text-sm text-subtle">batimento a cada minuto</span>
      </div>
      {sinais ? (
        <>
          <HealthSignal rotulo="WhatsApp (Z-API)" ultimoSinal={sinais.whatsapp} limites={LIMITES_BATIMENTO} />
          <HealthSignal rotulo="Fila de tarefas" ultimoSinal={sinais.fila} limites={LIMITES_BATIMENTO} />
          <p className="flex justify-between gap-2 border-t border-border pt-2 text-sm text-foreground">
            Último batimento
            {sinais.ultimo ? <RelativeTime data={sinais.ultimo} focavel className="tabular font-semibold" /> : <span className="font-semibold text-danger">nenhum registrado</span>}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Os sinais de vida não puderam ser lidos agora.</p>
      )}
      <a href="#avisos" className="flex items-center justify-between gap-2 border-t border-border pt-2 text-sm text-foreground hover:underline">
        <span className="flex items-center gap-1"><Bell aria-hidden size={14} strokeWidth={1.75} />Avisos não vistos</span>
        <span className="tabular font-bold">{avisos?.total ?? '—'}</span>
      </a>
    </Card>
  );
}
