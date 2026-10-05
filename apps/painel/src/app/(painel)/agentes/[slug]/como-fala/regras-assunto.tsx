'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { INFO_MODO, MODOS_CONTATO, type ModoContato } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RegraAssunto } from '@/lib/agentes';
import { excluirRegraAssunto, salvarRegraAssunto } from '@/lib/agentes-acoes';

type Edicao = { id: string | null; assunto: string; exemplo: string; modo: ModoContato };

/** Regras por assunto (spec 7E.3): valem antes do modo padrão. Uso no mês: conversas em que o Thiago chamou o agente por esta regra (I2). Sem a I2 no banco: —. */
export function RegrasAssunto({ slug, regras, uso, editavel }: { slug: string; regras: RegraAssunto[]; uso: Record<string, number> | null; editavel: boolean }) {
  const router = useRouter();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [enviando, iniciar] = useTransition();
  const salvar = () => edicao && iniciar(async () => {
    const r = await salvarRegraAssunto(slug, edicao.id, { assunto: edicao.assunto, exemplo: edicao.exemplo, modo: edicao.modo });
    if (r.ok) { toast('Regra salva.'); setEdicao(null); router.refresh(); } else toast.error(r.erro);
  });
  const excluir = (r: RegraAssunto) => iniciar(async () => {
    const x = await excluirRegraAssunto(r.id);
    if (x.ok) { toast('Regra removida.'); router.refresh(); } else toast.error(x.erro);
  });
  const formulario = edicao && (
    <tr>
      <td className="py-2 pr-2"><Input aria-label="Quando o assunto for" value={edicao.assunto} maxLength={80} onChange={(e) => setEdicao({ ...edicao, assunto: e.target.value })} /></td>
      <td className="py-2 pr-2"><Input aria-label="Exemplo do que o cliente diz" value={edicao.exemplo} maxLength={200} onChange={(e) => setEdicao({ ...edicao, exemplo: e.target.value })} /></td>
      <td className="py-2 pr-2">
        <select aria-label="Modo" value={edicao.modo} onChange={(e) => setEdicao({ ...edicao, modo: e.target.value as ModoContato })} className="h-9 rounded-md border border-input bg-surface px-2 text-sm">
          {MODOS_CONTATO.map((m) => <option key={m} value={m}>{INFO_MODO[m].rotulo}</option>)}
        </select>
      </td>
      <td colSpan={2} className="py-2 text-right">
        <Button size="sm" variant="outline" onClick={() => setEdicao(null)}>Cancelar</Button>{' '}
        <Button size="sm" onClick={salvar} disabled={enviando}>Salvar regra</Button>
      </td>
    </tr>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Regras por assunto <span className="font-normal normal-case">· valem antes do modo padrão</span></h2>
        {editavel && !edicao && <Button variant="outline" onClick={() => setEdicao({ id: null, assunto: '', exemplo: '', modo: 'mesma_voz' })}><Plus aria-hidden size={16} />Nova regra</Button>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-muted">
          <th className="py-2">Quando o assunto for</th><th>Exemplo do que o cliente diz</th><th>Modo</th><th>Usada no mês</th><th><span className="sr-only">Ações</span></th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {regras.map((r) => (edicao?.id === r.id ? null : (
            <tr key={r.id}>
              <td className="py-2 font-bold">{r.assunto}</td>
              <td className="text-muted">{r.exemplo ? `"${r.exemplo}"` : '—'}</td>
              <td><Badge variant="outline">{INFO_MODO[r.modo].rotulo}</Badge></td>
              <td className="text-muted tabular">{uso === null ? '—' : ((n) => (n === 1 ? '1 conversa' : `${n} conversas`))(uso[r.id] ?? 0)}</td>
              <td className="text-right">{editavel && (
                <>
                  <Button size="icon" variant="ghost" aria-label={`Editar a regra ${r.assunto}`} onClick={() => setEdicao({ id: r.id, assunto: r.assunto, exemplo: r.exemplo, modo: r.modo })}><Pencil aria-hidden size={16} /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Remover a regra ${r.assunto}`} onClick={() => excluir(r)} disabled={enviando}><Trash2 aria-hidden size={16} /></Button>
                </>
              )}</td>
            </tr>
          )))}
          {formulario}
          {!regras.length && !edicao && <tr><td colSpan={5} className="py-3 text-muted">Nenhuma regra: vale o modo padrão.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
