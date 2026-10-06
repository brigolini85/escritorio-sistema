import { Bot } from 'lucide-react';
import { ROTULO_ESTADO_TAREFA } from '@escritorio/core';
import { RelativeTime } from '@/components/patterns/relative-time';
import { Badge } from '@/components/ui/badge';
import { textoDoEstado, type TarefaTela } from '@/lib/tarefas-tela';
import { BotoesTarefa } from './botoes-tarefa';

const CHIPS = ['trabalhando', 'aguardando_pendencias', 'pronta'] as const;
const CANAL = { painel: 'pelo painel', whatsapp: 'pelo WhatsApp', automatico: 'automático' } as const;

export function CabecalhoTarefa({ t, podeMexer }: { t: TarefaTela; podeMexer: boolean }) {
  const emChips = (CHIPS as readonly string[]).includes(t.estado);
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Bot aria-hidden size={20} className="mt-1 shrink-0 text-success" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-success">Tarefa do {t.agente}</p>
            <h2 className="text-lg font-bold">{t.pedido}</h2>
            <p className="text-sm text-muted">pedido por <b>{t.pedidaPor ?? 'alguém da equipe'}</b> {CANAL[t.canal]} · <RelativeTime data={t.criadoEm} /></p>
          </div>
        </div>
        {podeMexer && <BotoesTarefa id={t.id} estado={t.estado} motivoPausa={t.motivoPausa} />}
      </div>
      {emChips ? (
        <ul className="flex flex-wrap gap-2" aria-label="Estado da tarefa">
          {CHIPS.map((c) => (
            <li key={c}><Badge variant={c === t.estado ? 'warning' : 'outline'} aria-current={c === t.estado ? 'step' : undefined}>{ROTULO_ESTADO_TAREFA[c]}</Badge></li>
          ))}
        </ul>
      ) : (
        <p><Badge variant={t.estado === 'aprovada' ? 'success' : t.estado === 'pausada' ? 'warning' : 'neutral'}>{textoDoEstado(t)}</Badge></p>
      )}
    </header>
  );
}
