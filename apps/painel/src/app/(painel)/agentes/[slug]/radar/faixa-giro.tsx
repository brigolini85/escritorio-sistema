'use client';
import { CircleCheck, Eye, Info, Loader, TriangleAlert } from 'lucide-react';
import { textoFaixaGiro } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { GiroTela } from '@/lib/radar';

const ESTADOS = ['pendente', 'rodando', 'concluido', 'falhou'] as const;
type EstadoGiro = (typeof ESTADOS)[number];

/** A faixa do giro mais novo: o ícone e a frase dizem o estado (nunca só a cor). */
export function FaixaGiro({ giro, agoraIso }: { giro: GiroTela | null; agoraIso: string }) {
  if (!giro || !(ESTADOS as readonly string[]).includes(giro.estado)) {
    return (
      <p data-testid="radar-faixa-giro" className="flex items-start gap-2 rounded-md border border-info bg-info-soft px-4 py-3 text-sm text-info">
        <Info aria-hidden size={16} className="mt-0.5 shrink-0" />Nenhum giro ainda. Ligue o Radar ou use PROCURAR AGORA.
      </p>
    );
  }
  const falhou = giro.estado === 'falhou';
  const andando = giro.estado === 'pendente' || giro.estado === 'rodando';
  const Icone = falhou ? TriangleAlert : andando ? Loader : CircleCheck;
  const cor = falhou ? 'border-danger bg-danger-soft text-danger' : andando ? 'border-info bg-info-soft text-info' : 'border-success bg-success-soft text-success';
  const texto = textoFaixaGiro({ ...giro, estado: giro.estado as EstadoGiro }, new Date(agoraIso));
  return (
    <div data-testid="radar-faixa-giro" role="status" className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-3 text-sm ${cor}`}>
      <p className="flex items-start gap-2">
        <Icone aria-hidden size={16} className="mt-0.5 shrink-0" />
        <span>{falhou && <b>Falhou. </b>}{texto}</span>
      </p>
      {giro.lidas.length > 0 && (
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm"><Eye aria-hidden size={14} />Ver o que leu</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>O que o Radar leu neste giro</DialogTitle>
              <DialogDescription>{giro.lidas.length} {giro.lidas.length === 1 ? 'página' : 'páginas'}. Os links abrem em outra aba.</DialogDescription>
            </DialogHeader>
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto text-sm">
              {giro.lidas.map((l) => (
                <li key={l.url} className="flex flex-col">
                  <a href={l.url} target="_blank" rel="noreferrer" className="font-bold text-brand underline-offset-4 hover:underline">{l.titulo || l.url}</a>
                  <span className="truncate text-xs text-muted">{l.url}</span>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
