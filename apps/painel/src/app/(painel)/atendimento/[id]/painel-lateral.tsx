'use client';

import { Info, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { useEstadoConversa, type AbaPainel } from './estado-conversa';

/**
 * Coluna da direita (360px, recolhível pelo botão do cabeçalho ou Esc): abas Assistente e Detalhes.
 * Sem a marcação do assistente, só Detalhes. As duas abas ficam montadas (a conversa com o assistente
 * não perde o que foi digitado ao trocar de aba). Abaixo de lg, o painel fica embaixo da conversa.
 */
export function PainelLateral({ assistente, detalhes }: { assistente?: ReactNode; detalhes: ReactNode }) {
  const { painelAberto, aba, setAba } = useEstadoConversa();
  return (
    <aside
      id="painel-conversa"
      aria-label="Assistente e detalhes da conversa"
      className={cn(
        'flex min-h-0 flex-col border-t border-border bg-surface lg:w-painel-conversa lg:shrink-0 lg:border-l lg:border-t-0',
        !painelAberto && 'lg:hidden',
      )}
    >
      {assistente ? (
        <Tabs value={aba} onValueChange={(v) => setAba(v as AbaPainel)} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border p-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="assistente">
                <Sparkles aria-hidden size={14} strokeWidth={1.75} />
                Assistente
              </TabsTrigger>
              <TabsTrigger value="detalhes">
                <Info aria-hidden size={14} strokeWidth={1.75} />
                Detalhes
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="assistente" forceMount className="relative mt-0 min-h-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden">
            {assistente}
          </TabsContent>
          <TabsContent value="detalhes" forceMount className="relative mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
            {detalhes}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <h2 className="border-b border-border px-3 py-2.5 text-base font-semibold text-foreground">Detalhes</h2>
          {detalhes}
        </div>
      )}
    </aside>
  );
}
