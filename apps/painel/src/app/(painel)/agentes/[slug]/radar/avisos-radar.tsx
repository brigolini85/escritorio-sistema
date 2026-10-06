'use client';
import Link from 'next/link';
import { useEffect, useId, useState, useTransition } from 'react';
import { Bell, MessageCircle, Pencil, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { textoHora } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { hrefSecao } from '@/lib/configuracoes';
import { formatarUSD } from '@/lib/formatos';
import type { ConfigTela } from '@/lib/radar';
import { salvarConfigRadar, type DadosConfigRadar } from '@/lib/radar-acoes';
import { SoDono } from './cabecalho-radar';
import { Campo, ligar } from './fontes-radar';
import { validarLimite } from './janelas';
import { CAMINHO_TELEFONE_DONO } from './textos';

type Chave = 'resumo_whatsapp' | 'aviso_alto' | 'avisar_painel';

function Aviso({ Icone, titulo, explicacao, ligado, desabilitado, aoMudar }: {
  Icone: typeof Bell; titulo: string; explicacao: string; ligado: boolean; desabilitado: boolean; aoMudar: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <li className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-2">
        <Icone aria-hidden size={16} className="mt-0.5 shrink-0 text-brand" />
        <div className="flex flex-col gap-0.5">
          <label htmlFor={id} className="text-sm font-bold">{titulo}</label>
          <p id={`${id}-dica`} className="text-xs text-muted">{explicacao}</p>
        </div>
      </div>
      <Switch id={id} checked={ligado} disabled={desabilitado} onCheckedChange={aoMudar} aria-describedby={`${id}-dica`} />
    </li>
  );
}

function JanelaLimite({ aberta, aoMudar, atual }: { aberta: boolean; aoMudar: (a: boolean) => void; atual: number }) {
  const id = useId();
  const [ocupado, iniciar] = useTransition();
  const [texto, setTexto] = useState(String(atual).replace('.', ','));
  const [erro, setErro] = useState<string | undefined>();
  // Cada abertura volta ao valor salvo, sem o erro da vez anterior.
  useEffect(() => { if (aberta) { setTexto(atual.toFixed(2).replace('.', ',')); setErro(undefined); } }, [aberta, atual]);
  const salvar = () => {
    const v = validarLimite(texto);
    if (!v.ok) { setErro(v.erro); return; }
    iniciar(async () => {
      const r = await salvarConfigRadar({ limite_usd_giro: v.valor });
      if (r.ok) { toast('Limite por giro salvo.'); aoMudar(false); } else setErro(r.erro);
    });
  };
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Limite por giro</DialogTitle>
          <DialogDescription>Se o giro chegar a esse valor, ele para com o que já achou.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(ev) => { ev.preventDefault(); salvar(); }} className="flex flex-col gap-3">
          <Campo id={id} rotulo="Limite em US$" dica="De 0,05 a 5,00." erro={erro}>
            <Input id={id} value={texto} onChange={(x) => setTexto(x.target.value)} inputMode="decimal" className="w-32" aria-invalid={!!erro} aria-describedby={ligar(id, true, erro)} />
          </Campo>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancelar</Button></DialogClose>
            <Button type="submit" size="sm" disabled={ocupado}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Avisos do Radar: três chaves (só o dono muda) e o limite de custo por giro. */
export function AvisosRadar({ config, dono, admin, telefoneDono }: { config: ConfigTela; dono: boolean; admin: boolean; telefoneDono: boolean }) {
  const [ocupado, iniciar] = useTransition();
  const [valores, setValores] = useState<Record<Chave, boolean>>({ resumo_whatsapp: config.resumoWhatsapp, aviso_alto: config.avisoAlto, avisar_painel: config.avisarPainel });
  const [limite, setLimite] = useState(false);

  const mudar = (chave: Chave) => (v: boolean) => {
    const antes = valores[chave];
    setValores({ ...valores, [chave]: v });
    iniciar(async () => {
      const r = await salvarConfigRadar({ [chave]: v } as DadosConfigRadar);
      if (!r.ok) { setValores((x) => ({ ...x, [chave]: antes })); toast.error(r.erro); }
    });
  };
  const trava = !dono || ocupado;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Avisos</h2>
        {!dono && <SoDono />}
      </div>
      <ul className="flex flex-col gap-3">
        <Aviso Icone={MessageCircle} titulo="Resumo diário no WhatsApp do dono" explicacao={`depois do giro das ${textoHora(config.hora)} · só se houver novidade`}
          ligado={valores.resumo_whatsapp} desabilitado={trava} aoMudar={mudar('resumo_whatsapp')} />
        <Aviso Icone={TriangleAlert} titulo="Impacto alto avisa na hora" explicacao="para o dono, no WhatsApp, e para os setores, no painel"
          ligado={valores.aviso_alto} desabilitado={trava} aoMudar={mudar('aviso_alto')} />
        <Aviso Icone={Bell} titulo="Avisar equipe pelo painel" explicacao="aparece no Início de cada setor"
          ligado={valores.avisar_painel} desabilitado={trava} aoMudar={mudar('avisar_painel')} />
      </ul>
      {!telefoneDono && (
        // Configurações é só do administrador: para os outros, o caminho em texto.
        <p className="text-xs text-muted">Sem telefone do dono em {admin
          ? <Link href={hrefSecao('ia')} className="font-bold text-brand underline-offset-4 hover:underline">{CAMINHO_TELEFONE_DONO}</Link>
          : <b>{CAMINHO_TELEFONE_DONO}</b>}.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        <span>Limite por giro: <b className="tabular">{formatarUSD(config.limiteUsdGiro)}</b></span>
        {dono ? <Button type="button" variant="ghost" size="sm" onClick={() => setLimite(true)}><Pencil aria-hidden size={14} />Mudar</Button> : <SoDono />}
      </div>
      {dono && <JanelaLimite aberta={limite} aoMudar={setLimite} atual={config.limiteUsdGiro} />}
    </Card>
  );
}
