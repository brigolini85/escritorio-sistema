'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Imprime a lista como está na tela (o menu, a barra do topo e os filtros somem na impressão). */
export function BotaoImprimir() {
  return (
    <Button type="button" variant="link" onClick={() => window.print()}>
      <Printer aria-hidden size={16} strokeWidth={1.75} />
      Imprimir
    </Button>
  );
}
