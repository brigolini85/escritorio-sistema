'use client';
import Link from 'next/link';
import { useState, useTransition, type ReactNode } from 'react';
import { Bell, ChevronDown, CircleAlert, ExternalLink, FilePlus2, Info, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { fraseCriterios, type Impacto } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import type { NovidadeTela } from '@/lib/radar';
import { avisarEquipeRadar, criarDemandaRadar, descartarNovidadeRadar, procurarFonteOficial } from '@/lib/radar-acoes';
import { linhaFonte, rotuloSelo, textoDescartada, textoEnvios, textoVigencia, textoVirouDemanda } from './textos';

const IMPACTO = {
  alto: { Icone: TriangleAlert, selo: 'danger', borda: 'border-l-danger', texto: 'Impacto alto' },
  medio: { Icone: CircleAlert, selo: 'warning', borda: 'border-l-warning-decor', texto: 'Impacto médio' },
  baixo: { Icone: Info, selo: 'info', borda: 'border-l-info', texto: 'Impacto baixo' },
} as const satisfies Record<Impacto, { Icone: typeof Info; selo: 'danger' | 'warning' | 'info'; borda: string; texto: string }>;

function LinkFonte({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-brand underline-offset-4 hover:underline">
      abrir na fonte<ExternalLink aria-hidden size={12} />
    </a>
  );
}

function Selo({ n }: { n: NovidadeTela }) {
  return n.selo === 'oficial'
    ? <Badge variant="success" className="uppercase"><ShieldCheck aria-hidden />{rotuloSelo(n.selo)}</Badge>
    : <Badge variant="warning" className="uppercase"><TriangleAlert aria-hidden />{rotuloSelo(n.selo)}</Badge>;
}

/** Cartão da novidade (spec 7E, imagem 00-agente-radar). VER LISTA e MANDAR PARA CLIENTES AFETADOS entram pelos slots (Task 10). */
export function CartaoNovidade({ n, quem, agoraIso, dono, admin, verLista, mandar }: {
  n: NovidadeTela; quem: string | null; agoraIso: string; dono: boolean; admin: boolean; verLista?: ReactNode; mandar?: ReactNode;
}) {
  const [ocupado, iniciar] = useTransition();
  const [setorId, setSetorId] = useState(n.setores[0]?.id ?? '');
  const [descartando, setDescartando] = useState(false);
  const agora = new Date(agoraIso);
  const setor = n.setores.find((s) => s.id === setorId) ?? n.setores[0];
  const envios = textoEnvios(n.envios);
  const impacto = IMPACTO[n.impacto];

  if (n.estado === 'demanda') {
    return (
      <Card data-testid="novidade" data-estado="demanda" className="flex flex-col gap-1 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{n.titulo}</h3>
          <Selo n={n} />
        </div>
        <p className="text-sm text-muted">{textoVirouDemanda({ numero: n.chamado?.numero ?? null, setor: n.setores.map((s) => s.nome).join(', '), pessoa: quem, em: n.decididaEm })}</p>
        {envios && <p className="text-sm text-muted">{envios}</p>}
        <div className="flex flex-wrap items-center gap-3">
          {n.chamado && <Link href={`/demandas?demanda=${n.chamado.id}`} className="text-sm font-bold text-brand underline-offset-4 hover:underline">abrir a demanda{n.chamado.numero ? ` #${n.chamado.numero}` : ''}</Link>}
          <LinkFonte url={n.url} />
        </div>
      </Card>
    );
  }
  if (n.estado === 'descartada') {
    return (
      <Card data-testid="novidade" data-estado="descartada" className="flex flex-col gap-1 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{n.titulo}</h3>
          <Selo n={n} />
        </div>
        <p className="text-sm text-muted">{textoDescartada({ pessoa: quem, em: n.decididaEm })}</p>
        {envios && <p className="text-sm text-muted">{envios}</p>}
        <LinkFonte url={n.url} />
      </Card>
    );
  }

  const criarDemanda = () => iniciar(async () => {
    const r = await criarDemandaRadar(n.id, setorId);
    if (r.ok) toast(`Demanda #${r.numero} criada.`); else toast.error(r.erro);
  });
  const avisar = () => iniciar(async () => {
    const r = await avisarEquipeRadar(n.id);
    if (r.ok) toast('Equipe avisada.'); else toast.error(r.erro);
  });
  const descartar = () => iniciar(async () => {
    const r = await descartarNovidadeRadar(n.id);
    if (r.ok) { setDescartando(false); toast('Novidade descartada.'); } else toast.error(r.erro);
  });
  const procurarOficial = () => iniciar(async () => {
    const r = await procurarFonteOficial(n.id);
    if (r.ok) toast('Giro pedido. Começa em até 1 minuto.'); else toast.error(r.erro);
  });

  return (
    <Card data-testid="novidade" data-estado="para_decidir" data-impacto={n.impacto} className={cn('flex flex-col gap-3 border-l-4 p-4', impacto.borda)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-base font-bold">{n.titulo}</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant={impacto.selo}><impacto.Icone aria-hidden />{impacto.texto}</Badge>
          <Selo n={n} />
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>{linhaFonte(n, agora)}</span>
        <LinkFonte url={n.url} />
      </p>
      <p className="text-sm">{n.resumo}</p>
      <dl className="grid gap-3 rounded-md bg-surface-muted p-3 text-sm sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Setores</dt>
          <dd className="flex flex-wrap gap-1">{n.setores.length ? n.setores.map((s) => <Badge key={s.id} variant="outline">{s.nome}</Badge>) : <span className="text-muted">nenhum</span>}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Clientes possivelmente afetados</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span>{n.clientesAfetados} ({fraseCriterios(n.criterios)})</span>
            {n.clientesAfetados > 0 && verLista}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Vigência</dt>
          <dd>{textoVigencia(n.vigenciaTexto)}</dd>
        </div>
      </dl>
      {envios && <p className="text-sm text-muted">{envios}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {setor ? (
          <div className="inline-flex">
            <Button type="button" size="sm" disabled={ocupado} onClick={criarDemanda} className={n.setores.length > 1 ? 'rounded-r-none' : undefined}>
              <FilePlus2 aria-hidden size={14} />Criar demanda · {setor.nome}
            </Button>
            {n.setores.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" disabled={ocupado} aria-label="Escolher o setor da demanda" className="rounded-l-none border-l border-brand-foreground/30 px-2">
                    <ChevronDown aria-hidden size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={setorId} onValueChange={setSetorId}>
                    {n.setores.map((s) => <DropdownMenuRadioItem key={s.id} value={s.id}>{s.nome}</DropdownMenuRadioItem>)}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : <span className="text-sm text-muted">Sem setor para criar a demanda.</span>}
        <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={avisar}><Bell aria-hidden size={14} />Avisar equipe</Button>
        {n.clientesAfetados > 0 && mandar}
        {n.selo === 'confirmar' && (dono || admin) && (
          <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={procurarOficial}><Search aria-hidden size={14} />Procurar na fonte oficial</Button>
        )}
        <Button type="button" variant="ghost" size="sm" disabled={ocupado} onClick={() => setDescartando(true)}>Descartar</Button>
      </div>
      <Dialog open={descartando} onOpenChange={setDescartando}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Descartar esta novidade?</DialogTitle>
            <DialogDescription>Ela vai para Descartadas.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancelar</Button></DialogClose>
            <Button type="button" variant="danger" size="sm" disabled={ocupado} onClick={descartar}>Descartar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
