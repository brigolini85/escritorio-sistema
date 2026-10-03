'use client';

import { ClipboardPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { NovaDemanda } from '../../demandas/nova-demanda';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toaster';
import { dadosAbrirDemanda } from '../acoes';

type Dados = Exclude<Awaited<ReturnType<typeof dadosAbrirDemanda>>, { erro: string }>;

/** Abrir demanda (spec 7A.1): o painel "Nova demanda" da Parte C, já com empresa, contato e esta conversa. */
export function AbrirDemanda({ conversaId, desligado }: { conversaId: string; desligado: string | null }) {
  const router = useRouter();
  const idAviso = useId();
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, iniciar] = useTransition();
  const abrir = () => iniciar(async () => {
    const r = await dadosAbrirDemanda(conversaId);
    if ('erro' in r) toast.error(r.erro); else setDados(r);
  });
  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={Boolean(desligado) || carregando} aria-describedby={desligado ? idAviso : undefined} onClick={abrir}>
        <ClipboardPlus aria-hidden size={16} strokeWidth={1.75} />
        Abrir demanda
      </Button>
      {desligado && <span id={idAviso} className="text-xs text-muted">{desligado}</span>}
      <Sheet open={Boolean(dados)} onOpenChange={(v) => { if (!v) setDados(null); }}>
        <SheetContent aria-describedby={undefined}>
          {dados && (
            <NovaDemanda
              empresas={dados.empresas} setores={dados.setores} pessoas={dados.pessoas} sugeridos={dados.sugeridos} podePrazo={dados.podePrazo}
              inicial={dados.inicial} conversa={conversaId}
              aoConcluir={(r) => { toast.success(r.mensagem); setDados(null); router.refresh(); }}
              aoCancelar={() => setDados(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
