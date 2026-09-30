'use client';

import { ReceiptText } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

/** O pedido completo (OrderSummary, com a tabela de itens) numa janela larga: no painel de 360px ela não cabe. */
export function VerPedido({ numero, children }: { numero: number; children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ReceiptText aria-hidden size={16} strokeWidth={1.75} />
          Ver pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-11/12 max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pedido de nota da demanda #{numero}</DialogTitle>
          <DialogDescription>Itens, destinatário e o combinado com o cliente.</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
