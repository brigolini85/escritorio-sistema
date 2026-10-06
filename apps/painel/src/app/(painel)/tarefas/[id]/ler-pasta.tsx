'use client';
import { FolderSync } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { lerPastaDeNovo } from '@/lib/tarefas-acoes';

/** D7: pede ao trabalhador para ler a pasta do cliente no Drive outra vez (só leitura). */
export function LerPasta({ tarefaId }: { tarefaId: string }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const pedir = () => iniciar(async () => {
    const r = await lerPastaDeNovo(tarefaId);
    if (r.ok) {
      toast.success('Pedi para ler a pasta do Drive. Os arquivos novos aparecem aqui em instantes.');
      setTimeout(() => router.refresh(), 5000);
    } else toast.error(r.erro);
  });
  return <Button type="button" variant="outline" size="sm" disabled={enviando} onClick={pedir}><FolderSync aria-hidden size={16} /> Ler a pasta de novo</Button>;
}
