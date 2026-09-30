'use client';

import { Info, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { useEstadoConversa, type AbaPainel } from './estado-conversa';

/**
 * Painel da direita (360px, recolhível pelo botão do cabeçalho ou Esc): abas Assistente e Detalhes.
 * De lg até 2xl fica por cima do histórico (sobreposição, com sombra); de 2xl em diante é uma coluna própria.
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
        'flex min-h-0 flex-col border-t border-border bg-surface lg:border-l lg:border-t-0',
        // lg até 2xl: por cima do histórico (a linha do meio da grade), encostado à direita.
        'lg:max-2xl:z-30 lg:max-2xl:col-start-1 lg:max-2xl:row-start-2 lg:max-2xl:w-painel-conversa lg:max-2xl:justify-self-end lg:max-2xl:shadow-md',
        // 2xl em diante: coluna própria, da altura toda.
        '2xl:col-start-2 2xl:row-span-3 2xl:row-start-1',
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
          <TabsContent value="assistente" forceMount className="relative mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto p-3 data-[state=inactive]:hidden">
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

/** Seção da conversa: cabeçalho, histórico e compositor em grade; com o painel aberto em 2xl, uma coluna a mais. */
export function GradeConversa({ children, painel }: { children: ReactNode; painel: ReactNode }) {
  const { painelAberto } = useEstadoConversa();
  return (
    <section
      aria-labelledby="titulo-conversa"
      className={cn('relative flex min-w-0 flex-1 flex-col bg-background lg:grid lg:grade-conversa', painelAberto && '2xl:grade-conversa-com-painel')}
    >
      {/* Abaixo de lg: cabeçalho, histórico e compositor ocupam a tela (o compositor sempre à vista) e o painel vem depois.
          A partir de lg este invólucro some (display: contents) e os três viram linhas da grade. */}
      <div className="flex min-h-0 flex-col max-lg:altura-trabalho lg:contents">{children}</div>
      {painel}
    </section>
  );
}
