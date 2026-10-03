import type { ReactNode } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';

/** Cartão de Configurações: região com nome (leitor de tela e testes acham pelo título), descrição e conteúdo. */
export function Cartao({ id, titulo, descricao, className, children }: { id: string; titulo: string; descricao?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Card id={id} role="region" aria-labelledby={`${id}-titulo`} className={cn('ancora-abaixo-cabecalho', className)}>
      <CardHeader>
        <CardTitle id={`${id}-titulo`}>{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      {children}
    </Card>
  );
}
