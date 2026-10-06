'use client';

import { LockKeyhole } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import { OPCOES_GUARDA, textoGuarda } from '@/lib/drive-tela';
import { classeSelect } from '../../clientes/estilos';
import { salvarGuardaTarefas } from '../guarda-acoes';

const NUNCA = 'nunca';
const paraTexto = (d: number | null) => (d === null ? NUNCA : String(d));

/** D14: só o dono escolhe; para os demais o seletor fica travado. O padrão é "Nunca apagar". */
export function GuardaTarefas({ dias, dono }: { dias: number | null; dono: boolean }) {
  const [valor, setValor] = useState(paraTexto(dias));
  const [salvo, setSalvo] = useState(dias);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const escolhido = valor === NUNCA ? null : Number(valor);
  const salvar = () => iniciar(async () => {
    const r = await salvarGuardaTarefas(escolhido);
    if (!r.ok) { setErro(r.erro); return; }
    setErro(null);
    setSalvo(escolhido);
    toast.success('Guarda dos arquivos salva.');
  });
  return (
    <CardContent className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="guarda-dias">Apagar os arquivos depois de</Label>
          <select id="guarda-dias" value={valor} onChange={(e) => setValor(e.currentTarget.value)} disabled={!dono || enviando} className={classeSelect}>
            {OPCOES_GUARDA.map((o) => <option key={paraTexto(o.valor)} value={paraTexto(o.valor)}>{o.rotulo}</option>)}
          </select>
        </div>
        {dono ? <Button type="button" size="sm" onClick={salvar} disabled={enviando || escolhido === salvo}>Salvar</Button>
          : <Badge variant="neutral"><LockKeyhole aria-hidden size={12} />só o dono</Badge>}
      </div>
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      <p className="text-sm text-muted">{textoGuarda(salvo)}</p>
    </CardContent>
  );
}
