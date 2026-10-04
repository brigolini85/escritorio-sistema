import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { HealthSignal } from '@/components/patterns/health-signal';
import { CardContent } from '@/components/ui/card';
import { LIMITES_BATIMENTO } from '@/lib/inicio';
import { Cartao } from '../cartao';

/** Último sinal de cada serviço (só o administrador, D20). Recarrega a cada minuto com a aba visível. */
export function SecaoIntegracoes({ sinal }: { sinal: (componente: string) => string | null }) {
  return (
    <>
      <RecarregarPeriodico />
      <Cartao id="integracoes" titulo="Integrações" descricao="Último sinal de cada serviço. Sem sinal há mais de 5 minutos, algo parou.">
        <CardContent className="flex flex-col gap-2">
          <HealthSignal rotulo="WhatsApp (Z-API)" ultimoSinal={sinal('whatsapp')} limites={LIMITES_BATIMENTO} />
          {!sinal('whatsapp') && <p className="text-sm text-muted">Sem sinal do WhatsApp: verifique a Z-API.</p>}
          <HealthSignal rotulo="Trabalhador e fila de tarefas" ultimoSinal={sinal('fila')} limites={LIMITES_BATIMENTO} />
        </CardContent>
      </Cartao>
    </>
  );
}
