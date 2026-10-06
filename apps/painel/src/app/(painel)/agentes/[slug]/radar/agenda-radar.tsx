'use client';
import { useId, useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { textoAgenda } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { salvarConfigRadar } from '@/lib/radar-acoes';
import { DIAS, diasDosAtalhos, diasMarcados } from './janelas';

/** MUDAR a agenda: hora e dias do giro automático. Só o dono (o cabeçalho decide quem vê o botão). */
export function BotaoAgenda({ hora, dias }: { hora: string; dias: number[] }) {
  const id = useId();
  const [aberta, setAberta] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const [h, setH] = useState(hora);
  const [d, setD] = useState<number[]>(dias);
  const [erro, setErro] = useState<string | null>(null);
  const marcados = diasMarcados(d);

  const mudar = (a: boolean) => { if (a) { setH(hora); setD(dias); setErro(null); } setAberta(a); };
  const alternar = (n: number, v: boolean) => setD(v ? [...new Set([...d, n])].sort() : d.filter((x) => x !== n));
  const salvar = () => {
    if (!/^\d{2}:\d{2}$/.test(h)) { setErro('Escolha a hora do giro.'); return; }
    if (d.length === 0) { setErro('Marque ao menos um dia.'); return; }
    setErro(null);
    iniciar(async () => {
      const r = await salvarConfigRadar({ hora: h, dias: d });
      if (r.ok) { toast('Agenda salva.'); setAberta(false); } else setErro(r.erro);
    });
  };

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => mudar(true)}><Pencil aria-hidden size={14} />Mudar</Button>
      <Dialog open={aberta} onOpenChange={mudar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agenda do Radar</DialogTitle>
            <DialogDescription>O giro automático roda uma vez por dia, no horário de São Paulo.</DialogDescription>
          </DialogHeader>
          <form noValidate onSubmit={(ev) => { ev.preventDefault(); salvar(); }} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-hora`} className="text-xs font-bold uppercase tracking-wider text-brand">Hora</label>
              <Input id={`${id}-hora`} type="time" value={h} onChange={(x) => setH(x.target.value)} className="w-32" />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-brand">Dias</legend>
              <div className="flex flex-wrap gap-3">
                {DIAS.map((x) => (
                  <label key={x.chave} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={marcados[x.chave]} onCheckedChange={(v) => alternar(x.numero, v === true)} />{x.nome}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setD(diasDosAtalhos('todo'))}>Todo dia</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setD(diasDosAtalhos('uteis'))}>Dias úteis</Button>
              </div>
            </fieldset>
            <p className="text-sm text-muted" aria-live="polite">Fica assim: <b className="text-foreground">{d.length && /^\d{2}:\d{2}$/.test(h) ? textoAgenda({ hora: h, dias: d }) : 'incompleto'}</b></p>
            {erro && <p role="alert" className="text-sm font-bold text-danger">{erro}</p>}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancelar</Button></DialogClose>
              <Button type="submit" size="sm" disabled={ocupado}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
