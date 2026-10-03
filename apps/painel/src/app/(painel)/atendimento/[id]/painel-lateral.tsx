'use client';

import { Bot, Building2, Sparkles, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { useEstadoConversa, type AbaPainel } from './estado-conversa';
import { rotuloDasAbas } from './preferencias-conversa';

/**
 * Coluna da direita (spec 7A.1): CLIENTE · ASSISTENTE · AGENTE. Recolhível pelo botão do cabeçalho ou Esc.
 * De lg até xl fica por cima do histórico; de xl (1280 px) em diante é coluna própria (P17). Sem o assistente, sem a aba.
 * As abas ficam montadas (a conversa com o assistente não perde o que foi digitado ao trocar de aba).
 */
export function PainelLateral({ cliente, assistente, agente }: { cliente: ReactNode; assistente?: ReactNode; agente: ReactNode }) {
  const { painelAberto, aba, setAba } = useEstadoConversa();
  const abas: { valor: AbaPainel; rotulo: string; Icone: LucideIcon; conteudo: ReactNode }[] = [
    { valor: 'cliente', rotulo: 'Cliente', Icone: Building2, conteudo: cliente },
    ...(assistente ? [{ valor: 'assistente' as const, rotulo: 'Assistente', Icone: Sparkles, conteudo: assistente }] : []),
    { valor: 'agente', rotulo: 'Agente', Icone: Bot, conteudo: agente },
  ];
  return (
    <aside
      id="painel-conversa"
      aria-label={rotuloDasAbas(Boolean(assistente))}
      className={cn(
        'flex min-h-0 flex-col border-t border-border bg-surface lg:border-l lg:border-t-0',
        'lg:max-xl:z-30 lg:max-xl:col-start-1 lg:max-xl:row-start-2 lg:max-xl:w-painel-conversa lg:max-xl:justify-self-end lg:max-xl:shadow-md',
        'xl:col-start-2 xl:row-span-3 xl:row-start-1',
        !painelAberto && 'lg:hidden',
      )}
    >
      <Tabs value={aba} onValueChange={(v) => setAba(v as AbaPainel)} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border">
          <TabsList className={cn('grid w-full rounded-none bg-transparent', abas.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
            {abas.map(({ valor, rotulo, Icone }) => (
              <TabsTrigger key={valor} value={valor} className="uppercase tracking-wide data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-brand">
                <Icone aria-hidden size={14} strokeWidth={1.75} />
                {rotulo}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {abas.map(({ valor, conteudo }) => (
          <TabsContent key={valor} value={valor} forceMount
            className={cn('relative mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden', valor === 'assistente' && 'flex flex-col p-3')}>
            {conteudo}
          </TabsContent>
        ))}
      </Tabs>
    </aside>
  );
}

/** Seção da conversa: cabeçalho, histórico e compositor em grade; com o painel aberto em xl, uma coluna a mais. */
export function GradeConversa({ children, painel }: { children: ReactNode; painel: ReactNode }) {
  const { painelAberto } = useEstadoConversa();
  return (
    <section
      aria-labelledby="titulo-conversa"
      className={cn('relative flex min-w-0 flex-1 flex-col bg-background lg:grid lg:grade-conversa', painelAberto && 'xl:grade-conversa-com-painel')}
    >
      {/* Abaixo de lg: cabeçalho, histórico e compositor ocupam a tela (o compositor sempre à vista) e o painel vem depois.
          A partir de lg este invólucro some (display: contents) e os três viram linhas da grade. */}
      <div className="flex min-h-0 flex-col max-lg:altura-trabalho lg:contents">{children}</div>
      {painel}
    </section>
  );
}
