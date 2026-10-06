'use client';
import { useState } from 'react';
import { History, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatarHoraOuDia, formatarUSD } from '@/lib/formatos';
import type { GiroTela } from '@/lib/radar';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const quando = (g: GiroTela, agora: Date) => formatarHoraOuDia(g.terminadoEm ?? g.iniciadoEm ?? g.criadoEm, agora);

/** Quem começou o giro, em palavras da tela (agendado, pedido por <pessoa>, nova tentativa, confirmar). */
export function origemDoGiro(g: Pick<GiroTela, 'origem' | 'pedidoPor'>, nomes: Record<string, string>): string {
  const pessoa = g.pedidoPor ? nomes[g.pedidoPor] ?? 'uma pessoa' : null;
  if (g.origem === 'pedido') return `pedido por ${pessoa ?? 'uma pessoa'}`;
  if (g.origem === 'confirmar') return pessoa ? `confirmar, pedido por ${pessoa}` : 'confirmar';
  if (g.origem === 'nova_tentativa') return 'nova tentativa';
  return 'agendado';
}

function resumoCurto(g: GiroTela, nomes: Record<string, string>): string {
  if (g.estado === 'falhou') return 'falhou';
  if (g.estado === 'pendente') return 'esperando';
  if (g.estado === 'rodando') return 'em andamento';
  const novas = g.novidades ? plural(g.novidades, 'novidade', 'novidades') : 'nada novo';
  if (g.origem === 'pedido') return `${nomes[g.pedidoPor ?? ''] ?? 'Alguém'} pediu · ${novas}`;
  return `${plural(g.fontes, 'fonte', 'fontes')} · ${novas}`;
}

/** Botão e janela com os 20 giros mais novos. `rotulo` muda o texto (GIROS ANTERIORES no cabeçalho, VER TODOS na coluna). */
export function JanelaGiros({ giros, nomes, agoraIso, rotulo, variante = 'outline' }: {
  giros: GiroTela[]; nomes: Record<string, string>; agoraIso: string; rotulo: string; variante?: 'outline' | 'ghost';
}) {
  const [aberta, setAberta] = useState(false);
  const agora = new Date(agoraIso);
  return (
    <>
      <Button type="button" variant={variante} size="sm" onClick={() => setAberta(true)}><History aria-hidden size={14} />{rotulo}</Button>
      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent className="max-h-screen max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Giros anteriores</DialogTitle>
            <DialogDescription>Os {Math.min(giros.length, 20)} giros mais novos.</DialogDescription>
          </DialogHeader>
          {giros.length === 0 ? <p className="text-sm text-muted">Nenhum giro ainda.</p> : (
            <ul className="flex flex-col gap-2">
              {giros.slice(0, 20).map((g) => (
                <li key={g.id} className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold">{quando(g, agora)} <span className="font-normal text-muted">· {origemDoGiro(g, nomes)}</span></p>
                    <p className="tabular text-muted">{formatarUSD(g.custoUsd)}</p>
                  </div>
                  {g.estado === 'falhou' && (
                    <p className="flex items-start gap-2 font-bold text-danger"><TriangleAlert aria-hidden size={14} className="mt-0.5 shrink-0" />Falhou{g.erro ? `: ${g.erro}` : '.'}</p>
                  )}
                  {(g.estado === 'pendente' || g.estado === 'rodando') && <p className="text-muted">{g.estado === 'pendente' ? 'Esperando para começar.' : 'Em andamento.'}</p>}
                  <p className="text-muted">
                    {[plural(g.fontes, 'fonte', 'fontes'), plural(g.buscas, 'busca', 'buscas'), plural(g.paginas, 'página lida', 'páginas lidas'),
                      plural(g.novidades, 'novidade', 'novidades'), plural(g.repetidas, 'repetida', 'repetidas')].join(' · ')}
                  </p>
                  {g.fontesFora.length > 0 && (
                    <p className="flex items-start gap-2 text-warning"><TriangleAlert aria-hidden size={14} className="mt-0.5 shrink-0" />Fora do ar: {g.fontesFora.map((f) => f.nome).join(', ')}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Últimos 4 giros na coluna da direita. */
export function GirosRadar({ giros, nomes, agoraIso }: { giros: GiroTela[]; nomes: Record<string, string>; agoraIso: string }) {
  const agora = new Date(agoraIso);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Últimos giros</h2>
        <JanelaGiros giros={giros} nomes={nomes} agoraIso={agoraIso} rotulo="Ver todos" variante="ghost" />
      </div>
      {giros.length === 0 ? <p className="text-sm text-muted">Nenhum giro ainda.</p> : (
        <ul className="flex flex-col gap-2 text-sm">
          {giros.slice(0, 4).map((g) => (
            <li key={g.id} className="grid grid-cols-3 gap-2">
              <span className="font-bold tabular">{quando(g, agora)}</span>
              <span className="text-muted">{g.estado === 'falhou' && <TriangleAlert aria-hidden size={12} className="mr-1 inline text-danger" />}{resumoCurto(g, nomes)}</span>
              <span className="text-right tabular text-muted">{formatarUSD(g.custoUsd)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
