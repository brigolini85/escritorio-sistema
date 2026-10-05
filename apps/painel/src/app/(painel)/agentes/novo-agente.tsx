'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ROTULO_TIPO_AGENTE, TIPOS_AGENTE, type TipoAgente } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { criarAgente } from '@/lib/agentes-acoes';

/** + NOVO AGENTE (D25), só para o dono: nasce Desligado, sem skills nem ferramentas. */
export function NovoAgente({ setores }: { setores: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [setorId, setSetorId] = useState('');
  const [tipos, setTipos] = useState<TipoAgente[]>(['conversa']);
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const alternar = (t: TipoAgente, sim: boolean) => setTipos((atual) => (sim ? [...new Set([...atual, t])] : atual.filter((x) => x !== t)));
  const salvar = () => iniciar(async () => {
    const r = await criarAgente({ nome, setorId: setorId || null, tipos, descricao });
    if (!r.ok) { setErro(r.erro); return; }
    toast(`Agente ${nome.trim()} criado.`);
    setAberto(false);
    router.push(`/agentes/${r.slug}`);
  });
  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); setErro(null); }}>
      <DialogTrigger asChild><Button><Plus aria-hidden size={16} />Novo agente</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo agente</DialogTitle>
          <DialogDescription>Nasce desligado. Depois você sobe as skills e escolhe as ferramentas.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Label className="flex flex-col gap-1">Nome<Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} /></Label>
          <Label className="flex flex-col gap-1">Setor
            <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className="h-9 rounded-md border border-input bg-surface px-2 text-sm">
              <option value="">Sem setor</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Label>
          <fieldset className="flex gap-4"><legend className="mb-1 text-sm font-medium">Tipo</legend>
            {TIPOS_AGENTE.map((t) => (
              <Label key={t} className="flex items-center gap-2 font-normal">
                <Checkbox checked={tipos.includes(t)} onCheckedChange={(v) => alternar(t, v === true)} />{ROTULO_TIPO_AGENTE[t]}
              </Label>
            ))}
          </fieldset>
          <Label className="flex flex-col gap-1">Descrição curta<Input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={120} /></Label>
          {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={enviando}>Criar agente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
