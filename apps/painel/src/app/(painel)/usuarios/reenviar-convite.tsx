'use client';

import { useTransition } from 'react';
import { toast } from '@/components/ui/toaster';
import { reenviarConvite } from './acoes';

/** "reenviar convite" do rodapé da ficha: manda o e-mail de novo e avisa. */
export function ReenviarConvite({ id }: { id: string }) {
  const [enviando, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={enviando}
      onClick={() => iniciar(async () => {
        const r = await reenviarConvite(id);
        if (r.ok) toast.success(r.mensagem);
        else toast.error(r.erro);
      })}
      className="text-foreground underline underline-offset-4 hover:text-brand disabled:opacity-60"
    >
      reenviar convite
    </button>
  );
}
