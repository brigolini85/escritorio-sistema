'use client';

import { useOptimistic, useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { alternarOrientacao } from './acoes';

/**
 * Liga/desliga a orientação na própria linha da tabela, otimista: muda na hora e volta (com aviso e o motivo)
 * se o banco recusar. Enquanto grava, não aceita outro clique.
 */
export function ChaveOrientacao({ id, titulo, ligada }: { id: string; titulo: string; ligada: boolean }) {
  const [estado, setEstado] = useOptimistic(ligada);
  const [pendente, iniciar] = useTransition();
  const rotulo = `${estado ? 'Desligar' : 'Ligar'} a orientação ${titulo}`;

  const mudar = (v: boolean) => {
    if (pendente) return;
    iniciar(async () => {
      setEstado(v);
      try {
        const { erro } = await alternarOrientacao(id, v);
        if (erro) toast.error(`Não consegui ${v ? 'ligar' : 'desligar'} a orientação "${titulo}". ${erro}`);
      } catch {
        toast.error(`Não consegui ${v ? 'ligar' : 'desligar'} a orientação "${titulo}". Tente de novo.`);
      }
    });
  };

  return (
    <span className="inline-flex items-center gap-2" data-sem-clique-linha>
      <Switch checked={estado} onCheckedChange={mudar} disabled={pendente} aria-busy={pendente || undefined} aria-label={rotulo} title={pendente ? 'Gravando…' : rotulo} />
      <span className={cn('text-sm', estado ? 'text-agent-active' : 'text-muted')}>{estado ? 'Ligada' : 'Desligada'}</span>
    </span>
  );
}
