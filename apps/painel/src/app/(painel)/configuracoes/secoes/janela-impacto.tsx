'use client';

import { TriangleAlert } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { textoImpacto, type ImpactoPrazo } from '@/lib/configuracoes';

export type Escolha = 'novas' | 'aplicar' | 'cancelar';

/**
 * Impacto de mudar o prazo (spec 7C.4, decisão do dono de 02/10): "SÓ PARA AS NOVAS" é o padrão (foco inicial);
 * "APLICAR TAMBÉM ÀS N ABERTAS" só quando alguma mudaria (D6). Ao diminuir, aviso vermelho com ícone e texto.
 */
export function JanelaImpacto({ impactos, escolher }: { impactos: ImpactoPrazo[] | null; escolher: (e: Escolha) => void }) {
  const novas = useRef<HTMLButtonElement>(null);
  // Diferença 0 não recalcula nada (D1 desloca pela diferença): essa prioridade não promete mudança.
  const textos = (impactos ?? []).filter((i) => i.dias_novos !== i.dias_atuais).map(textoImpacto);
  const recalcula = textos.reduce((n, t) => n + t.recalcula, 0);
  return (
    <Dialog open={impactos !== null} onOpenChange={(aberto) => { if (!aberto) escolher('cancelar'); }}>
      <DialogContent className="max-w-lg" onOpenAutoFocus={(e) => { e.preventDefault(); novas.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>Mudar o prazo das demandas abertas também?</DialogTitle>
          <DialogDescription>A regra nova sempre vale para as demandas novas. Escolha se as abertas mudam junto.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {textos.map((t) => (
            <section key={t.titulo} aria-label={t.titulo} className="rounded-md border border-border p-3">
              <h3 className="font-semibold text-foreground">{t.titulo}</h3>
              <ul className="mt-1 list-disc pl-5 text-base text-muted">
                {t.linhas.map((l) => <li key={l}>{l}</li>)}
              </ul>
              {t.alerta && (
                <p role="alert" className="mt-2 flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
                  <TriangleAlert aria-hidden size={16} strokeWidth={2} />
                  {t.alerta}
                </p>
              )}
            </section>
          ))}
          {recalcula === 0 && <p className="text-sm text-muted">Nenhuma aberta muda de prazo: as que existem ficam como estão.</p>}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button ref={novas} type="button" onClick={() => escolher('novas')}>Só para as novas</Button>
          {recalcula > 0 && (
            <Button type="button" variant="outline" onClick={() => escolher('aplicar')}>
              {recalcula === 1 ? 'Aplicar também à 1 aberta' : `Aplicar também às ${recalcula} abertas`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
