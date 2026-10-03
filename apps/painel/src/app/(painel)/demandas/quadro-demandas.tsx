'use client';

import Link from 'next/link';
import { useState, useTransition, type KeyboardEvent } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { PrazoTexto, PrioridadeTexto } from '@/components/patterns/prioridade-prazo';
import type { StatusDemanda } from '@/components/patterns/status-badge';
import { cn } from '@/lib/cn';
import { iniciais } from '@/lib/demandas';
import { alterarStatusDemanda, concluirDemanda } from './acoes';
import { avisar } from './acoes-demanda';
import type { LinhaDemanda } from './colunas-demandas';

export type ColunaQuadro = { status: StatusDemanda; titulo: string; total: number; cartoes: LinhaDemanda[] };
const ORDEM: StatusDemanda[] = ['aberto', 'em_andamento', 'aguardando_cliente', 'concluido'];

/**
 * Quadro (spec 6.2, imagem 04): arrastar o cartão muda o status; soltar em Concluída pede confirmação.
 * Sem mouse: com o cartão em foco, Shift + → / Shift + ← move para a coluna vizinha (spec 8). Cartão concluído não se move:
 * reabrir é no painel lateral. Clique (ou Enter) no cartão abre o painel lateral.
 */
export function QuadroDemandas({ colunas, hrefs, agora }: { colunas: ColunaQuadro[]; hrefs: Record<string, string>; agora: string }) {
  const [arrastando, setArrastando] = useState<LinhaDemanda | null>(null);
  const [sobre, setSobre] = useState<StatusDemanda | null>(null);
  const [concluir, setConcluir] = useState<LinhaDemanda | null>(null);
  const [anuncio, setAnuncio] = useState({ texto: '', n: 0 });
  const [movendo, setMovendo] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  // O contador alterna um espaço invisível no fim: o texto muda e o leitor de tela lê de novo mesmo um aviso igual ao anterior.
  const anunciar = (texto: string) => setAnuncio((a) => ({ texto, n: a.n + 1 }));
  const data = new Date(agora);
  const nomeDa = (s: StatusDemanda) => colunas.find((c) => c.status === s)?.titulo ?? s;

  const mover = (d: LinhaDemanda, para: StatusDemanda) => {
    if (d.status === para || d.status === 'concluido') return;
    if (para === 'concluido') { setConcluir(d); return; }
    setMovendo(d.id);
    iniciar(async () => {
      if (avisar(await alterarStatusDemanda(d.id, para))) anunciar(`Demanda #${d.numero} foi para ${nomeDa(para)}.`);
      setMovendo(null);
    });
  };

  const teclado = (e: KeyboardEvent, d: LinhaDemanda) => {
    if (!e.shiftKey || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    e.preventDefault();
    const i = ORDEM.indexOf(d.status) + (e.key === 'ArrowRight' ? 1 : -1);
    if (d.status === 'concluido' || i < 0 || i >= ORDEM.length) { anunciar('Não dá para mover para lá.'); return; }
    mover(d, ORDEM[i]!);
  };

  return (
    <>
      <p id="dica-quadro" className="sr-only">Para mover sem o mouse: com o cartão em foco, Shift e seta para a direita ou para a esquerda.</p>
      <p aria-live="polite" className="sr-only">{anuncio.texto}{anuncio.n % 2 ? '\u200B' : ''}</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {colunas.map((c) => (
          <section
            key={c.status}
            aria-labelledby={`coluna-${c.status}`}
            onDragOver={(e) => { if (arrastando && arrastando.status !== c.status) { e.preventDefault(); setSobre(c.status); } }}
            onDragLeave={() => setSobre((s) => (s === c.status ? null : s))}
            onDrop={(e) => { e.preventDefault(); setSobre(null); if (arrastando) mover(arrastando, c.status); setArrastando(null); }}
            className={cn('flex min-h-40 flex-col gap-2 rounded-lg bg-surface-muted p-3', sobre === c.status && 'ring-2 ring-brand')}
          >
            <h2 id={`coluna-${c.status}`} className="flex items-center justify-between text-sm font-bold uppercase tracking-wide text-foreground">
              <span>{c.titulo}</span>
              <span className="tabular">{c.total}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {c.cartoes.map((d) => (
                <li key={d.id}>
                  <Link
                    href={hrefs[d.id]!}
                    scroll={false}
                    draggable={d.status !== 'concluido'}
                    onDragStart={(e) => { setArrastando(d); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d.id); }}
                    onDragEnd={() => { setArrastando(null); setSobre(null); }}
                    onKeyDown={(e) => teclado(e, d)}
                    aria-busy={movendo === d.id || undefined}
                    aria-describedby={d.status !== 'concluido' ? 'dica-quadro' : undefined}
                    className={cn(
                      'flex flex-col gap-1 rounded-md border border-border bg-surface p-3 text-sm hover:border-brand',
                      (d.prioridade === 'urgente' || d.vencida) && 'border-l-4 border-l-danger',
                      d.prioridade === 'alta' && !d.vencida && 'border-l-4 border-l-warning',
                      d.status === 'concluido' && 'bg-surface-muted',
                      movendo === d.id && 'opacity-60',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 text-muted">
                      <span className="tabular uppercase">{d.numero} · {d.setor ?? 'Triagem'}</span>
                      <PrazoTexto prazo={d.prazo} pausadoDesde={d.pausadoDesde} concluidaEm={d.concluidaEm} agora={data} />
                    </span>
                    <span className="font-bold text-foreground">{d.titulo}</span>
                    <span className="text-muted">{d.empresa ?? 'Empresa não identificada'}</span>
                    <span className="flex items-center justify-between">
                      <PrioridadeTexto prioridade={d.prioridade} caixaAlta />
                      {d.responsavel ? (
                        <span title={d.responsavel} className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                          <span aria-hidden>{iniciais(d.responsavel)}</span>
                          <span className="sr-only">Responsável: {d.responsavel}</span>
                        </span>
                      ) : (
                        <span title="Sem responsável" className="size-7 rounded-full border-2 border-dashed border-subtle">
                          <span className="sr-only">Sem responsável</span>
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {c.total > c.cartoes.length && <p className="text-sm text-muted">e mais {c.total - c.cartoes.length} na tabela</p>}
          </section>
        ))}
      </div>
      <ConfirmDialog
        aberto={concluir !== null}
        aoMudarAberto={(v) => { if (!v) setConcluir(null); }}
        titulo={concluir ? <>Concluir a demanda <strong>#{concluir.numero}</strong>?</> : 'Concluir a demanda?'}
        descricao={concluir ? `"${concluir.titulo}" sai das demandas abertas. Dá para reabrir depois.` : undefined}
        confirmar="Concluir"
        enviando="Concluindo…"
        variante="primary"
        tipo="concluir"
        acao={async () => {
          const d = concluir;
          if (!d) return;
          if (avisar(await concluirDemanda(d.id))) anunciar(`Demanda #${d.numero} concluída.`);
          setConcluir(null);
        }}
      />
    </>
  );
}
