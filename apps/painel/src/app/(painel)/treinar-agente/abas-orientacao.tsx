'use client';

import { useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Abas do painel da orientação: o formulário e o histórico. O formulário fica montado na aba escondida
 * (forceMount): ver o histórico no meio da edição não perde o que foi digitado.
 */
export function AbasOrientacao({ abaInicial, formulario, historico, versoes }: {
  abaInicial: 'orientacao' | 'historico';
  formulario: ReactNode;
  historico: ReactNode;
  versoes: number;
}) {
  const [aba, setAba] = useState(abaInicial);
  return (
    <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)} className="flex min-h-0 flex-1 flex-col">
      <TabsList aria-label="Partes da orientação" className="mx-4 mt-3 self-start">
        <TabsTrigger value="orientacao">Orientação</TabsTrigger>
        <TabsTrigger value="historico">Histórico ({versoes})</TabsTrigger>
      </TabsList>
      <TabsContent value="orientacao" forceMount className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
        {formulario}
      </TabsContent>
      <TabsContent value="historico" className="mt-0 min-h-0 flex-1 overflow-y-auto">
        {historico}
      </TabsContent>
    </Tabs>
  );
}
