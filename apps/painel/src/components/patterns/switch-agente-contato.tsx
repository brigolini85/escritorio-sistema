'use client';

import { useOptimistic, useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { PermissionGate } from './permission-gate';

type Props = {
  /** alternarAgenteContato já com os argumentos presos por .bind no servidor (o estado anterior vai junto). */
  acao: () => Promise<void>;
  desligado: boolean;
  nome: string;
  pode: boolean;
};

/**
 * Estado do agente para um contato, otimista: muda na hora e volta (com aviso) se a ação falhar.
 * Enquanto grava, fica "pendente": a chave não aceita outro clique, porque a action traz o estado anterior preso
 * pelo .bind e um segundo clique antes do servidor responder gravaria de novo o mesmo valor.
 */
export function useAgenteContato({ acao, desligado, nome }: Omit<Props, 'pode'>) {
  const [atende, setAtende] = useOptimistic(!desligado);
  const [pendente, iniciar] = useTransition();
  const mudar = (v: boolean) => {
    if (pendente) return;
    iniciar(async () => {
      setAtende(v);
      try {
        await acao();
      } catch {
        toast.error(`Não consegui ${v ? 'ligar' : 'desligar'} o agente para ${nome}. Tente de novo.`);
      }
    });
  };
  return { atende, pendente, mudar };
}

/** A chave em si (para quem já tem o estado de useAgenteContato, ex.: a linha da ficha que também mostra o texto). */
export function ChaveAgenteContato({ nome, pode, atende, pendente, mudar }: { nome: string; pode: boolean } & ReturnType<typeof useAgenteContato>) {
  const rotulo = `${atende ? 'Desligar' : 'Ligar'} o agente para ${nome}`;
  return (
    <PermissionGate permitido={pode} modo="desabilitar" motivo="Só quem pode editar clientes liga ou desliga o agente. Peça ao administrador na aba Usuários.">
      <Switch checked={atende} onCheckedChange={mudar} disabled={pendente} aria-busy={pendente || undefined} aria-label={rotulo} title={pendente ? 'Gravando…' : rotulo} />
    </PermissionGate>
  );
}

/**
 * Liga/desliga o agente só para um contato (mesma server action de antes).
 * Nome acessível: a ação ("Ligar o agente para Maria" / "Desligar o agente para Maria"); o estado vai no aria-checked.
 * `mostrarEstado`: texto ao lado ("agente atende" / "agente desligado"), que muda junto com a chave.
 * Sem permissão (`pode` falso): a chave aparece desabilitada, com o motivo no tooltip.
 */
export function SwitchAgenteContato({ mostrarEstado = false, className, ...props }: Props & { mostrarEstado?: boolean; className?: string }) {
  const estado = useAgenteContato(props);
  return (
    <span className={cn('inline-flex items-center gap-2', className)} data-sem-clique-linha>
      <ChaveAgenteContato nome={props.nome} pode={props.pode} {...estado} />
      {mostrarEstado && (
        <span className={cn('text-sm', estado.atende ? 'text-agent-active' : 'text-agent-paused')}>{estado.atende ? 'agente atende' : 'agente desligado'}</span>
      )}
    </span>
  );
}
