'use client';
import { Bot } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { criarTarefa } from '@/lib/tarefas-acoes';
import type { AgenteDeTrabalho } from '@/lib/tarefas-tela';

/** D3: só os agentes de Trabalho do setor da demanda; em Teste, só o dono e o administrador pedem (o banco confere). I4 troca pela janela PEDIR AO AGENTE. */
export function NovaTarefa({ chamadoId, agentes }: { chamadoId: string; agentes: AgenteDeTrabalho[] }) {
  const router = useRouter();
  const liberados = agentes.filter((a) => a.podePedir);
  const [agenteId, setAgenteId] = useState(liberados[0]?.id ?? '');
  const [skill, setSkill] = useState('');
  const [pedido, setPedido] = useState('');
  const [enviando, iniciar] = useTransition();
  const agente = agentes.find((a) => a.id === agenteId);
  const pedir = () => iniciar(async () => {
    const r = await criarTarefa(chamadoId, agenteId, pedido, skill || null);
    if (r.ok) { toast('Tarefa pedida: o agente começa em instantes.'); router.push(`/tarefas/${r.id}`); } else toast.error(r.erro);
  });
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Bot aria-hidden size={16} /> Tarefa para o agente</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tarefa para o agente</DialogTitle>
          <DialogDescription>O agente trabalha em segundo plano e para nas pendências. Nada vale antes da aprovação de uma pessoa do setor.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Label htmlFor="nt-agente">Agente</Label>
          <select id="nt-agente" className="h-9 rounded-md border border-input bg-surface px-2 text-sm" value={agenteId} onChange={(e) => { setAgenteId(e.target.value); setSkill(''); }}>
            {agentes.map((a) => <option key={a.id} value={a.id} disabled={!a.podePedir}>{a.nome}{a.podePedir ? '' : ' (em teste: só o dono e o administrador pedem)'}</option>)}
          </select>
          <Label htmlFor="nt-proc">Procedimento</Label>
          <select id="nt-proc" className="h-9 rounded-md border border-input bg-surface px-2 text-sm" value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">Sem procedimento</option>
            {(agente?.procedimentos ?? []).map((p) => <option key={p.nome} value={p.nome}>{p.titulo}</option>)}
          </select>
          <Label htmlFor="nt-pedido">O que o agente deve fazer?</Label>
          <Textarea id="nt-pedido" value={pedido} onChange={(e) => setPedido(e.target.value)} maxLength={2000} rows={4}
            placeholder="Ex.: Fazer o fechamento de outubro e gerar os lançamentos." />
          <p className="text-xs text-muted">Depois de pedir, envie os arquivos na tela da tarefa.</p>
        </div>
        <DialogFooter>
          <Button disabled={enviando || !agenteId || pedido.trim().length < 3} onClick={pedir}>Pedir ao agente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
