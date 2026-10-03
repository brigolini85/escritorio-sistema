'use client';

import { Hand } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { minutosDeEspera, textoEspera } from '@/lib/atendimento';

/** Faixa de passagem (spec 7A.1): "O agente passou para uma pessoa há N min. Motivo: …" + Ver decisão (rola até o cartão). */
export function FaixaPassagem({ desde, motivo, turno }: { desde: string; motivo: string | null; turno: string | null }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const min = minutosDeEspera(desde, agora);
  const verDecisao = () => {
    const alvo = turno ? document.getElementById(`turno-${turno}`) : null;
    alvo?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    alvo?.focus({ preventScroll: true });
  };
  return (
    // aria-live="off": a faixa fica dentro do role="log"; sem isto o log anunciaria o tempo que muda a cada 30 s.
    <div role="note" aria-live="off" aria-label="Passagem para pessoa" className="flex items-start gap-2 border-b border-border bg-warning-soft px-4 py-2 text-sm text-foreground">
      <Hand aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
      <p className="min-w-0 flex-1" suppressHydrationWarning>
        <strong>O agente passou para uma pessoa {min < 1 ? 'agora' : `há ${textoEspera(min)}`}.</strong>{' '}
        Motivo: {motivo || 'sem motivo registrado'}
      </p>
      {turno && <Button type="button" size="sm" variant="ghost" onClick={verDecisao}>Ver decisão</Button>}
    </div>
  );
}
