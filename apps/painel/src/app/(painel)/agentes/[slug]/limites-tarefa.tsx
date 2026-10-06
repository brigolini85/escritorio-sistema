'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { salvarLimitesTarefa } from '@/lib/agentes-acoes';
import { formatarUSD } from '@/lib/formatos';

/** D13: cada tarefa copia estes limites; ao passar, pausa e pergunta. Só o dono muda. */
export function LimitesTarefa({ slug, limites, dono }: { slug: string; limites: { usd: number; minutos: number }; dono: boolean }) {
  const router = useRouter();
  const [usd, setUsd] = useState(limites.usd.toFixed(2).replace('.', ','));
  const [minutos, setMinutos] = useState(String(limites.minutos));
  const [enviando, iniciar] = useTransition();
  const salvar = () => iniciar(async () => {
    const r = await salvarLimitesTarefa(slug, Number(usd.replace(',', '.')), Number(minutos));
    if (r.ok) { toast('Limites salvos.'); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <Card className="flex flex-col gap-2 p-4" role="region" aria-label="Limites de cada tarefa">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Limites de cada tarefa</h2>
      <p className="text-sm text-muted">Passou de um deles, a tarefa pausa e pergunta se continua.</p>
      {dono ? (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
          <div className="flex flex-col gap-1"><Label htmlFor="limite-usd">Custo (US$)</Label>
            <Input id="limite-usd" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} className="w-28" /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="limite-min">Tempo (minutos)</Label>
            <Input id="limite-min" inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value)} className="w-28" /></div>
          <Button type="submit" size="sm" disabled={enviando}>Salvar limites</Button>
        </form>
      ) : <p className="text-sm">{formatarUSD(limites.usd)} e {limites.minutos} minutos por tarefa. Só o dono altera.</p>}
    </Card>
  );
}
