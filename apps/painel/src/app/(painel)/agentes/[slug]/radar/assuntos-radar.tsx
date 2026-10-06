'use client';
import { useEffect, useId, useState, useTransition } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { salvarConfigRadar } from '@/lib/radar-acoes';
import { SoDono } from './cabecalho-radar';
import { limparAssuntos, validarAssuntos } from './janelas';

function JanelaAssuntos({ aberta, aoMudar, assuntos }: { aberta: boolean; aoMudar: (a: boolean) => void; assuntos: string[] }) {
  const base = useId();
  const [ocupado, iniciar] = useTransition();
  const [lista, setLista] = useState<string[]>(assuntos);
  const [erro, setErro] = useState<string | null>(null);

  // A janela abre pelo botão (aberta muda sem onOpenChange): cada abertura volta ao que está salvo, sem o erro da vez anterior.
  useEffect(() => { if (aberta) { setLista(assuntos); setErro(null); } }, [aberta, assuntos]);
  const salvar = () => {
    const limpa = limparAssuntos(lista);
    const e = validarAssuntos(limpa);
    setErro(e);
    if (e) return;
    iniciar(async () => {
      const r = await salvarConfigRadar({ assuntos: limpa });
      if (r.ok) { toast('Assuntos salvos.'); aoMudar(false); } else setErro(r.erro);
    });
  };

  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assuntos vigiados</DialogTitle>
          <DialogDescription>Até 20 assuntos, de 2 a 60 letras cada. O Radar procura novidades sobre eles.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(ev) => { ev.preventDefault(); salvar(); }} className="flex flex-col gap-3">
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {lista.map((a, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input value={a} maxLength={60} aria-label={`Assunto ${i + 1}`} onChange={(x) => setLista(lista.map((v, j) => (j === i ? x.target.value : v)))} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Tirar o assunto ${a || i + 1}`} onClick={() => setLista(lista.filter((_, j) => j !== i))}>
                  <Trash2 aria-hidden size={16} />
                </Button>
              </li>
            ))}
          </ul>
          <div>
            <Button type="button" variant="outline" size="sm" disabled={lista.length >= 20} onClick={() => setLista([...lista, ''])}><Plus aria-hidden size={14} />Adicionar assunto</Button>
          </div>
          {erro && <p id={`${base}-erro`} role="alert" className="text-sm font-bold text-danger">{erro}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancelar</Button></DialogClose>
            <Button type="submit" size="sm" disabled={ocupado}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Assuntos vigiados em duas colunas, com ✓. Só o dono edita. */
export function AssuntosRadar({ assuntos, dono }: { assuntos: string[]; dono: boolean }) {
  const [editando, setEditando] = useState(false);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Assuntos vigiados</h2>
        {dono ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(true)}><Pencil aria-hidden size={14} />Editar</Button>
        ) : <SoDono />}
      </div>
      {assuntos.length === 0 ? <p className="text-sm text-muted">Nenhum assunto vigiado ainda.</p> : (
        <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {assuntos.map((a) => (
            <li key={a} className="flex items-start gap-2"><Check aria-hidden size={14} className="mt-1 shrink-0 text-brand" />{a}</li>
          ))}
        </ul>
      )}
      {dono && <JanelaAssuntos aberta={editando} aoMudar={setEditando} assuntos={assuntos} />}
    </Card>
  );
}
