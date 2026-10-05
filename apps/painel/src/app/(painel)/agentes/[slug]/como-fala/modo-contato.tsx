'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { INFO_MODO, MODOS_CONTATO, type ModoContato } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { salvarAgente } from '@/lib/agentes-acoes';
import { cn } from '@/lib/cn';

/** Modo padrão (spec 7E.3): Por trás · Mesma voz · Passa a conversa. Só o dono escolhe. */
export function ModoContatoEscolha({ slug, atual, editavel }: { slug: string; atual: ModoContato | null; editavel: boolean }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const escolher = (modo: ModoContato) => iniciar(async () => {
    const r = await salvarAgente(slug, { modoContato: modo });
    if (r.ok) { toast(`Modo padrão: ${INFO_MODO[modo].rotulo}.`); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <fieldset className="grid gap-3 md:grid-cols-3" disabled={!editavel || enviando}>
      <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Modo padrão</legend>
      {MODOS_CONTATO.map((m) => (
        <label key={m} className={cn('flex cursor-pointer flex-col gap-2 rounded-md border p-3 text-sm', atual === m ? 'border-brand bg-brand-soft' : 'border-border bg-surface')}>
          <span className="flex items-center gap-2 font-bold">
            <input type="radio" name="modo" value={m} checked={atual === m} onChange={() => escolher(m)} />{INFO_MODO[m].rotulo}
            {atual === m && <Badge variant="brand" className="ml-auto uppercase">padrão</Badge>}
          </span>
          <span>{INFO_MODO[m].explicacao}</span>
          <span className="text-muted"><b>Bom para:</b> {INFO_MODO[m].bomPara}</span>
        </label>
      ))}
    </fieldset>
  );
}
