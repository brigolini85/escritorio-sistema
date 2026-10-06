'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { responderPendencia } from '@/lib/tarefas-acoes';
import type { PendenciaTela } from '@/lib/tarefas-tela';

export function PendenciaAnalista({ tarefaId, p, podeMexer }: { tarefaId: string; p: PendenciaTela; podeMexer: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [enviando, iniciar] = useTransition();
  const responder = (resposta: string) => iniciar(async () => {
    const r = await responderPendencia(tarefaId, p.id, resposta);
    if (r.ok) { toast('Resposta enviada ao agente.'); setTexto(''); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <article className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0 text-sm" aria-label={`Pendência ${p.numero}`}>
      <p className="font-bold">{p.pergunta}</p>
      {p.detalhe && <p className="text-muted">{p.detalhe}</p>}
      {p.estado === 'respondida' ? (
        <p className="text-success">Respondida{p.respondidaPor ? ` por ${p.respondidaPor}` : ''}: {p.resposta}</p>
      ) : podeMexer ? (
        <>
          {p.opcoes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {p.opcoes.map((o) => <Button key={o} variant="outline" size="sm" disabled={enviando} onClick={() => responder(o)}>{o}</Button>)}
            </div>
          )}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (texto.trim()) responder(texto); }}>
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Outra resposta ou observação…" aria-label={`Resposta da pendência ${p.numero}`} maxLength={2000} />
            <Button type="submit" size="sm" disabled={enviando || !texto.trim()}>Responder</Button>
          </form>
        </>
      ) : <p className="text-xs text-muted">Quem responde é uma pessoa do setor da demanda.</p>}
    </article>
  );
}
