'use client';
import { CircleCheck, Lock, Trash2, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { formatarDataHora } from '@/lib/formatos';
import { aprovarTarefa, descartarTarefa, pedirAjuste } from '@/lib/tarefas-acoes';
import { TEXTO_SETOR_INATIVO, pendenciasAbertas, podeAprovar, type TarefaTela } from '@/lib/tarefas-tela';

/** D11: nada vale antes. Aprovar travado com pendência aberta (o banco recusa de novo). */
export function AprovacaoTarefa({ t, podeMexer, setorInativo = false }: { t: TarefaTela; podeMexer: boolean; setorInativo?: boolean }) {
  const router = useRouter();
  const [ajuste, setAjuste] = useState('');
  const [enviando, iniciar] = useTransition();
  const rodar = (acao: () => Promise<{ ok: true } | { ok: false; erro: string }>, aviso: string) => iniciar(async () => {
    const r = await acao();
    if (r.ok) { toast(aviso); setAjuste(''); router.refresh(); } else toast.error(r.erro);
  });
  const decidida = t.estado === 'aprovada' || t.estado === 'descartada';
  const abertas = pendenciasAbertas(t);
  return (
    <Card className="flex flex-col gap-3 border-t-4 border-t-brand p-4" role="region" aria-label="Aprovação">
      <h2 className="text-xs font-bold uppercase tracking-wide text-brand">Aprovação</h2>
      <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm">
        <Lock aria-hidden size={16} className="mt-0.5 shrink-0 text-warning" /> Só vale depois da aprovação de uma pessoa do {t.setor ?? 'setor'}. Antes disso é rascunho.
      </p>
      {decidida ? (
        <p className="text-sm">{t.estado === 'aprovada' ? 'Aprovada' : 'Descartada'}{t.decididaPor ? ` por ${t.decididaPor}` : ''}{t.decididaEm ? ` em ${formatarDataHora(t.decididaEm)}` : ''}.</p>
      ) : !podeMexer ? (
        <p className="text-xs text-muted">{setorInativo ? TEXTO_SETOR_INATIVO : 'Quem aprova é uma pessoa do setor da demanda.'}</p>
      ) : (
        <>
          <Button disabled={enviando || !podeAprovar(t)} onClick={() => rodar(() => aprovarTarefa(t.id), 'Aprovada: a nota entrou na demanda e ela foi concluída.')}>
            <CircleCheck aria-hidden size={16} /> Aprovar e concluir
          </Button>
          {!podeAprovar(t) && <p className="text-center text-xs text-muted">{abertas ? 'liberado quando não houver pendências' : 'liberado quando o agente terminar'}</p>}
          <form className="flex flex-col gap-2 border-t border-border pt-3" onSubmit={(e) => { e.preventDefault(); rodar(() => pedirAjuste(t.id, ajuste), 'Ajuste pedido: o agente voltou a trabalhar.'); }}>
            <label htmlFor="ajuste" className="text-xs font-bold uppercase">Pedir ajuste ao agente</label>
            <Textarea id="ajuste" value={ajuste} onChange={(e) => setAjuste(e.target.value)} maxLength={1000} rows={3}
              placeholder='Ex.: "Lance a conta de energia em despesas administrativas, não em custo."' />
            <Button type="submit" variant="outline" disabled={enviando || ajuste.trim().length < 3 || t.estado === 'trabalhando'}><Undo2 aria-hidden size={16} /> Pedir ajuste</Button>
          </form>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
            <span>Descarta o rascunho; a demanda continua aberta.</span>
            <ConfirmDialog tipo="excluir" titulo="Descartar o rascunho?" descricao="A demanda continua aberta." confirmar="Descartar" enviando="Descartando…"
              gatilho={<Button type="button" variant="outline" size="sm" disabled={enviando}><Trash2 aria-hidden size={16} /> Descartar</Button>}
              acao={async () => { const r = await descartarTarefa(t.id); if (r.ok) { toast('Rascunho descartado.'); router.refresh(); } else toast.error(r.erro); }} />
          </div>
        </>
      )}
    </Card>
  );
}
