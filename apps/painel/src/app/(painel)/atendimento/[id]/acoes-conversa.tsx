'use client';

import { ArrowRightLeft, Bot, CircleCheck, Clock, PanelRightClose, PanelRightOpen, UserRoundCheck } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import type { StatusDemanda } from '@/components/patterns/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { demandaEmFoco, useEstadoConversa } from './estado-conversa';

type Acao = (dados: FormData) => void | Promise<void>;

/** Demanda aberta da conversa com as server actions já ligadas a ela (mesmas de antes: transferir, status, concluir, nota). */
export type DemandaDaConversa = {
  id: string;
  numero: number;
  titulo: string;
  setorId: string | null;
  status: StatusDemanda;
  transferir: Acao;
  aguardandoCliente: Acao;
  concluir: Acao;
  nota: Acao;
};

export const rotuloDemanda = (d: { numero: number; titulo: string }) => `#${d.numero} · ${d.titulo}`;

const campo = 'h-8 w-full rounded-md border border-input bg-surface px-2 text-sm text-foreground shadow-sm';

/** Escolha da demanda quando há mais de uma aberta (sem name: não vai no formulário; a demanda vai ligada à ação). */
export function EscolherDemanda({ demandas, className }: { demandas: DemandaDaConversa[]; className?: string }) {
  const { demandaId, setDemandaId } = useEstadoConversa();
  const id = useId();
  if (demandas.length < 2) return null;
  const atual = demandaEmFoco(demandas, demandaId);
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">Demanda</label>
      <select id={id} value={atual?.id} onChange={(e) => setDemandaId(e.target.value)} className={`${campo} max-w-48 truncate`}>
        {demandas.map((d) => <option key={d.id} value={d.id}>{rotuloDemanda(d)}</option>)}
      </select>
    </div>
  );
}

/**
 * Ações do cabeçalho da conversa: Assumir (primária) ou Devolver ao agente, e, para a demanda em foco,
 * Transferir, Com o cliente e Concluir (com confirmação). Mesmas server actions e campos de antes.
 */
export function AcoesConversa({
  minha,
  assumir,
  devolver,
  demandas,
  setores,
  pessoas,
  children,
}: {
  minha: boolean;
  assumir: Acao;
  devolver: Acao;
  demandas: DemandaDaConversa[];
  setores: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  /** Ações extras no fim da linha (ex.: "Ensinar o agente", só com a permissão). */
  children?: ReactNode;
}) {
  const { demandaId } = useEstadoConversa();
  const d = demandaEmFoco(demandas, demandaId);

  return (
    // Container query: com pouco espaço (a 1280px, por exemplo) Transferir, Com o cliente e Concluir ficam só com o
    // ícone; o texto continua como nome acessível (sr-only) e aparece no title.
    <div className="@container">
    <div className="flex flex-wrap items-center gap-2">
      {!minha ? (
        <form action={assumir}>
          <Button size="sm" data-atalho="assumir" aria-keyshortcuts="A" title="Assumir (atalho A)">
            <UserRoundCheck aria-hidden size={16} strokeWidth={1.75} />
            Assumir
          </Button>
        </form>
      ) : (
        <form action={devolver}>
          <Button size="sm" variant="outline">
            <Bot aria-hidden size={16} strokeWidth={1.75} />
            Devolver ao agente
          </Button>
        </form>
      )}

      {d && (
        <>
          <EscolherDemanda demandas={demandas} />
          <Transferir key={`t-${d.id}`} demanda={d} setores={setores} pessoas={pessoas} />
          {d.status !== 'aguardando_cliente' && (
            <form action={d.aguardandoCliente}>
              <Button size="sm" variant="outline" title="Com o cliente">
                <Clock aria-hidden size={16} strokeWidth={1.75} />
                <span className="@max-3xl:sr-only">Com o cliente</span>
              </Button>
            </form>
          )}
          <ConfirmDialog
            key={`c-${d.id}`}
            gatilho={(
              <Button size="sm" variant="outline" title="Concluir">
                <CircleCheck aria-hidden size={16} strokeWidth={1.75} />
                <span className="@max-3xl:sr-only">Concluir</span>
              </Button>
            )}
            titulo={`Concluir a demanda #${d.numero}?`}
            descricao={`“${d.titulo}” sai das demandas abertas desta conversa.`}
            confirmar="Concluir"
            enviando="Concluindo…"
            variante="primary"
            tipo="concluir"
            acao={d.concluir}
          />
        </>
      )}
      {children}
    </div>
    </div>
  );
}

function Transferir({ demanda, setores, pessoas }: { demanda: DemandaDaConversa; setores: { id: string; nome: string }[]; pessoas: { id: string; nome: string }[] }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="Transferir">
          <ArrowRightLeft aria-hidden size={16} strokeWidth={1.75} />
          <span className="@max-3xl:sr-only">Transferir</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir a demanda #{demanda.numero}</DialogTitle>
          <DialogDescription>{demanda.titulo}</DialogDescription>
        </DialogHeader>
        <form action={demanda.transferir} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-setor`} className="text-sm font-medium text-foreground">Setor</label>
            <select id={`${id}-setor`} name="setor_id" defaultValue={demanda.setorId ?? ''} className={campo}>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-resp`} className="text-sm font-medium text-foreground">Responsável</label>
            <select id={`${id}-resp`} name="responsavel_id" defaultValue="" className={campo}>
              <option value="">Fila do setor</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <BotaoEnviar rotulo="Transferir" enviando="Transferindo…" aoTerminar={() => setAberto(false)} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Submit que mostra "enviando" e fecha a janela quando a ação termina. */
function BotaoEnviar({ rotulo, enviando, aoTerminar }: { rotulo: string; enviando: string; aoTerminar: () => void }) {
  const { pending } = useFormStatus();
  const antes = useRef(false);
  useEffect(() => {
    if (antes.current && !pending) aoTerminar();
    antes.current = pending;
  }, [pending, aoTerminar]);
  return <Button type="submit" disabled={pending}>{pending ? enviando : rotulo}</Button>;
}

/** Mostra ou esconde o painel Assistente/Detalhes (a partir de lg; abaixo disso ele fica embaixo da conversa). */
export function BotaoPainel() {
  const { painelAberto, alternarPainel } = useEstadoConversa();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          id="botao-painel-conversa"
          className="hidden size-8 lg:inline-flex"
          aria-label={painelAberto ? 'Esconder painel lateral' : 'Mostrar painel lateral'}
          aria-expanded={painelAberto}
          aria-controls="painel-conversa"
          onClick={() => alternarPainel()}
        >
          {painelAberto ? <PanelRightClose aria-hidden size={16} strokeWidth={1.75} /> : <PanelRightOpen aria-hidden size={16} strokeWidth={1.75} />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{painelAberto ? 'Esconder Assistente e Detalhes (Esc)' : 'Mostrar Assistente e Detalhes'}</TooltipContent>
    </Tooltip>
  );
}
