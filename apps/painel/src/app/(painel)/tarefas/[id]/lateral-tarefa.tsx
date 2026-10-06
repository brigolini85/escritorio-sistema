import { RelativeTime } from '@/components/patterns/relative-time';
import { Card } from '@/components/ui/card';
import { formatarUSD } from '@/lib/formatos';
import { custoPorEtapa, rotuloQuem, type TarefaTela } from '@/lib/tarefas-tela';

export function CustoTarefa({ t }: { t: TarefaTela }) {
  const usados = Math.round(t.segundosTrabalhando / 60);
  return (
    <Card className="flex flex-col gap-2 p-4" role="region" aria-label="Custo desta tarefa">
      <h2 className="text-xs font-bold uppercase tracking-wide text-brand">Custo desta tarefa</h2>
      <p className="text-3xl font-bold tabular">{formatarUSD(t.custoUsd)}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {custoPorEtapa(t).map((e) => <li key={e.nome} className="flex justify-between"><span>{e.nome}</span><b className="tabular">{formatarUSD(e.custo)}</b></li>)}
      </ul>
      <p className="text-xs text-muted">Limite: {formatarUSD(t.limiteUsd)} e {t.limiteMinutos} min · usado {usados} min. Entra em Gastos com IA no agente.</p>
    </Card>
  );
}

export function LinhaDoTempoTarefa({ t }: { t: TarefaTela }) {
  return (
    <Card className="flex flex-col gap-2 p-4" role="region" aria-label="Linha do tempo da tarefa">
      <h2 className="text-xs font-bold uppercase tracking-wide text-brand">Linha do tempo</h2>
      <ol className="flex flex-col gap-2 text-sm">
        {t.eventos.map((e, i) => (
          <li key={i} className="border-l-2 border-border pl-3"><b>{rotuloQuem(e, t.agente)}</b> {e.texto} · <RelativeTime data={e.criadoEm} className="text-muted" /></li>
        ))}
      </ol>
    </Card>
  );
}
