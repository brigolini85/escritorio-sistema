'use client';

import type { ReactNode } from 'react';
import { ChaveAgenteContato, useAgenteContato } from '@/components/patterns/switch-agente-contato';

/**
 * Linha de um contato na aba Contatos da ficha. O texto "Nome · telefone · pode pedir nota… · agente desligado"
 * e a chave do agente usam o mesmo estado (otimista), então a linha nunca se contradiz enquanto grava.
 */
export function LinhaContato({ nome, telefone, marcacoes, desligado, acao, pode, children }: {
  nome: string;
  telefone: string;
  /** " · pode pedir nota · pode mudar preço…" (texto de sempre). */
  marcacoes: string;
  desligado: boolean;
  acao: () => Promise<void>;
  pode: boolean;
  /** Remover, Apagar dados (LGPD). */
  children?: ReactNode;
}) {
  const estado = useAgenteContato({ acao, desligado, nome });
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
      <p className="min-w-0 text-base text-foreground">
        <span className="font-medium">{nome}</span>
        <span className="tabular text-muted"> · {telefone}</span>
        <span className="text-muted">{marcacoes}</span>
        {!estado.atende && <span className="text-agent-paused"> · agente desligado</span>}
      </p>
      <div className="flex items-center gap-1">
        <span className="mr-2 inline-flex"><ChaveAgenteContato nome={nome} pode={pode} {...estado} /></span>
        {children}
      </div>
    </li>
  );
}
