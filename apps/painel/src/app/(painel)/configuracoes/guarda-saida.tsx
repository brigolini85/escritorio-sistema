'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { definirGuardaSaida, descartarAlterados, salvarAlteradosParaSair, totalDeAlteracoes } from '@/components/patterns/formulario-alteravel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Sair de Configurações com alteração (spec 7C.4, imagem A): SALVAR E SAIR · DESCARTAR · CONTINUAR AQUI. Vale para todo
 * link do painel (D14); fechar ou recarregar a aba continua com a pergunta do navegador. Foco inicial em CONTINUAR AQUI.
 */
export function GuardaSaida({ secao }: { secao: string }) {
  const router = useRouter();
  const [destino, setDestino] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const continuar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    definirGuardaSaida((d) => {
      setTotal(totalDeAlteracoes());
      setDestino(d);
    });
    return () => definirGuardaSaida(null);
  }, []);

  return (
    <Dialog open={destino !== null} onOpenChange={(aberto) => { if (!aberto) setDestino(null); }}>
      <DialogContent mostrarFechar={false} className="max-w-md" onOpenAutoFocus={(e) => { e.preventDefault(); continuar.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>Há alterações não salvas</DialogTitle>
          <DialogDescription>{secao} tem {total === 1 ? '1 alteração não salva' : `${total} alterações não salvas`}.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-wrap gap-2">
          <Button ref={continuar} type="button" variant="ghost" onClick={() => setDestino(null)}>Continuar aqui</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const d = destino;
              setDestino(null);
              descartarAlterados();
              if (d) router.push(d);
            }}
          >
            Descartar
          </Button>
          <Button
            type="button"
            onClick={async () => {
              const d = destino;
              // Fecha antes: o Salvar de Prazos pode abrir a janela de impacto (D15).
              setDestino(null);
              if ((await salvarAlteradosParaSair()) && d) router.push(d);
            }}
          >
            Salvar e sair
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
