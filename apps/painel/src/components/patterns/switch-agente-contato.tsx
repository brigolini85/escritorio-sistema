'use client';

import { useOptimistic, useTransition } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';
import { PermissionGate } from './permission-gate';

/**
 * Liga/desliga o agente só para um contato. Chama a mesma server action de antes (alternarAgenteContato, já com os
 * argumentos presos por .bind no servidor); a chave muda na hora (otimista) e volta se a ação falhar, com aviso.
 * Nome acessível: a ação ("Ligar o agente para Maria" / "Desligar o agente para Maria"); o estado vai no aria-checked.
 * `mostrarEstado`: texto ao lado ("agente atende" / "agente desligado").
 * Sem permissão (`pode` falso): a chave aparece desabilitada, com o motivo no tooltip.
 */
export function SwitchAgenteContato({
  acao,
  desligado,
  nome,
  pode,
  mostrarEstado = false,
  className,
}: {
  acao: () => Promise<void>;
  desligado: boolean;
  nome: string;
  pode: boolean;
  mostrarEstado?: boolean;
  className?: string;
}) {
  const [atende, setAtende] = useOptimistic(!desligado);
  const [, iniciar] = useTransition();
  const rotulo = `${atende ? 'Desligar' : 'Ligar'} o agente para ${nome}`;

  const mudar = (v: boolean) => {
    iniciar(async () => {
      setAtende(v);
      try {
        await acao();
      } catch {
        toast.error(`Não consegui ${v ? 'ligar' : 'desligar'} o agente para ${nome}. Tente de novo.`);
      }
    });
  };

  return (
    <span className={cn('inline-flex items-center gap-2', className)} data-sem-clique-linha>
      <PermissionGate permitido={pode} modo="desabilitar" motivo="Só quem pode editar clientes liga ou desliga o agente. Peça ao administrador na aba Usuários.">
        <Switch checked={atende} onCheckedChange={mudar} aria-label={rotulo} title={rotulo} />
      </PermissionGate>
      {mostrarEstado && (
        <span className={cn('text-sm', atende ? 'text-agent-active' : 'text-agent-paused')}>{atende ? 'agente atende' : 'agente desligado'}</span>
      )}
    </span>
  );
}
