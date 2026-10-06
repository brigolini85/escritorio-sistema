'use client';
import { Pause, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import type { EstadoTarefa, MotivoPausa } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { continuarTarefa, pausarTarefa } from '@/lib/tarefas-acoes';

/** D4, D13: Pausar enquanto trabalha ou espera; Continuar na pausa (no limite, soma mais um limite do agente). */
export function BotoesTarefa({ id, estado, motivoPausa }: { id: string; estado: EstadoTarefa; motivoPausa: MotivoPausa | null }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const rodar = (acao: () => Promise<{ ok: true } | { ok: false; erro: string }>, aviso: string) => iniciar(async () => {
    const r = await acao();
    if (r.ok) { toast(aviso); router.refresh(); } else toast.error(r.erro);
  });
  if (estado === 'trabalhando' || estado === 'aguardando_pendencias') {
    return <Button variant="outline" size="sm" disabled={enviando} onClick={() => rodar(() => pausarTarefa(id), 'Tarefa pausada.')}><Pause aria-hidden size={16} /> Pausar</Button>;
  }
  if (estado !== 'pausada') return null;
  const limite = motivoPausa === 'limite_custo' || motivoPausa === 'limite_tempo';
  return (
    <Button size="sm" disabled={enviando} onClick={() => rodar(() => continuarTarefa(id), 'O agente voltou a trabalhar.')}>
      <Play aria-hidden size={16} /> {limite ? 'Continuar com mais um limite' : 'Continuar'}
    </Button>
  );
}
