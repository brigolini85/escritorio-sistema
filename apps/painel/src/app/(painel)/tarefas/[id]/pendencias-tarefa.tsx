import { Play } from 'lucide-react';
import { tarefaAtiva } from '@escritorio/core';
import type { TarefaTela } from '@/lib/tarefas-tela';
import { PendenciaAnalista } from './pendencia-analista';
import { PendenciaCliente } from './pendencia-cliente';

export function PendenciasTarefa({ t, podeMexer }: { t: TarefaTela; podeMexer: boolean }) {
  if (!t.pendencias.length) return null;
  const doCliente = t.pendencias.filter((p) => p.tipo === 'cliente');
  const doAnalista = t.pendencias.filter((p) => p.tipo === 'analista');
  const ativa = tarefaAtiva(t.estado);
  const abertas = (l: typeof doCliente) => l.filter((p) => p.estado === 'aberta').length;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="pendencias-titulo">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="pendencias-titulo" className="text-xs font-bold uppercase tracking-wide text-brand">Pendências</h3>
        <p className="text-xs text-muted">o agente para e pergunta em vez de chutar</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-md border border-border p-3" aria-label="Do cliente">
          <p className="flex items-center justify-between text-sm font-bold uppercase">Do cliente <span className="text-xs text-warning">{abertas(doCliente)} aguardando</span></p>
          {doCliente.map((p) => <PendenciaCliente key={p.id} tarefaId={t.id} p={p} setor={t.setor} podeMexer={podeMexer && ativa} />)}
        </section>
        <section className="flex flex-col gap-3 rounded-md border border-border p-3" aria-label="Para o analista">
          <p className="flex items-center justify-between text-sm font-bold uppercase">Para o analista <span className="text-xs text-warning">{abertas(doAnalista)} abertas</span></p>
          {doAnalista.map((p) => <PendenciaAnalista key={p.id} tarefaId={t.id} p={p} podeMexer={podeMexer && ativa} />)}
        </section>
      </div>
      {t.estado === 'aguardando_pendencias' && <p className="flex items-center gap-2 rounded-md bg-info-soft px-3 py-2 text-sm text-info"><Play aria-hidden size={14} /> O agente retoma sozinho assim que as pendências forem respondidas.</p>}
    </section>
  );
}
