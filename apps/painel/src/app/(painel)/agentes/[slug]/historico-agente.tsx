'use client';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { Mudanca } from '@/lib/agentes';
import { formatarDataHora } from '@/lib/formatos';

/** HISTÓRICO (D28): todas as mudanças do agente, em frases, da mais nova para a mais antiga. */
export function HistoricoAgente({ nome, mudancas }: { nome: string; mudancas: Mudanca[] }) {
  return (
    <Sheet>
      <SheetTrigger asChild><Button variant="outline"><History aria-hidden size={16} />Histórico</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Histórico de {nome}</SheetTitle><SheetDescription>Quem mudou o quê, e quando.</SheetDescription></SheetHeader>
        <SheetBody>
          {mudancas.length === 0 ? <p className="text-sm text-muted">Nenhuma mudança ainda.</p> : (
            <ol className="flex flex-col gap-2 text-sm">
              {mudancas.map((m) => (
                <li key={m.id} className="border-b border-border pb-2">
                  <p>{m.descricao}</p>
                  <p className="text-xs text-muted">{formatarDataHora(m.quando)}{m.quem ? ` · ${m.quem}` : ''}</p>
                </li>
              ))}
            </ol>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
