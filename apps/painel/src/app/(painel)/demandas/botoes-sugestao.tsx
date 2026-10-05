'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { decidirSugestao } from '@/lib/agente-demanda-acoes';

/** D19: só vale quando uma pessoa do setor aprova; o banco confere quem pode e recusa o clique duplo. */
export function BotoesSugestao({ id }: { id: string }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const decidir = (aprovar: boolean) => iniciar(async () => {
    const r = await decidirSugestao(id, aprovar);
    if (r.ok) { toast(aprovar ? 'Aprovada: a nota entrou na linha do tempo.' : 'Sugestão descartada.'); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => decidir(true)} disabled={enviando}>Aprovar</Button>
      <Button size="sm" variant="outline" onClick={() => decidir(false)} disabled={enviando}>Descartar</Button>
    </div>
  );
}
