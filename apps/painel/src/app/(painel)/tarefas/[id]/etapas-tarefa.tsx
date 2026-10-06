import { Check, Hourglass } from 'lucide-react';
import type { TarefaTela } from '@/lib/tarefas-tela';

export function EtapasTarefa({ t }: { t: TarefaTela }) {
  if (!t.etapas.length) return <p className="text-sm text-muted">As etapas aparecem quando o agente começar.</p>;
  return (
    <ol className="grid gap-2 sm:grid-cols-5" aria-label="Etapas da tarefa">
      {t.etapas.map((e, i) => {
        const atual = !e.concluida && i + 1 === t.etapaAtual;
        const ultima = i === t.etapas.length - 1;
        return (
          <li key={i} className="flex flex-col items-center gap-1 text-center text-sm" aria-current={atual ? 'step' : undefined}>
            <span className={e.concluida ? 'flex size-8 items-center justify-center rounded-full bg-success text-success-foreground'
              : atual ? 'flex size-8 items-center justify-center rounded-full bg-warning text-warning-foreground'
              : 'flex size-8 items-center justify-center rounded-full border border-border text-muted'}>
              {e.concluida ? <Check aria-hidden size={16} /> : atual ? <Hourglass aria-hidden size={16} /> : i + 1}
            </span>
            <b>{e.nome}</b>
            <span className="text-xs text-muted">{e.concluida ? e.resumo ?? 'feita' : ultima ? `pessoa do ${t.setor ?? 'setor'}` : atual ? 'agora' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}
