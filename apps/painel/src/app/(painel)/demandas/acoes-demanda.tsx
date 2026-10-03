'use client';

import { ArrowRightLeft, CircleCheck, NotebookPen, Pencil, RotateCcw, UserRoundCheck } from 'lucide-react';
import { useEffect, useId, useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import type { StatusDemanda } from '@/components/patterns/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { PrazoTexto } from '@/components/patterns/prioridade-prazo';
import { OPCOES_PRIORIDADE, ROTULO_STATUS, type Prioridade } from '@/lib/demandas';
import { paraCampoDataHora } from '@/lib/prazo';
import { classeSelect } from '../clientes/estilos';
import {
  alterarStatusDemanda, assumirDemanda, concluirDemanda, definirPrazo, definirPrioridade, definirResponsavel, editarDemanda,
  notaInternaDemanda, reabrirDemanda, transferirDemanda, type Resultado,
} from './acoes';

export type PessoaSetor = { id: string; nome: string; setores: string[] };
type DemandaControles = {
  id: string; numero: number; titulo: string; descricao: string; status: StatusDemanda; prioridade: Prioridade; prazo: string | null; pausadoDesde: string | null; concluidaEm: string | null;
  setorId: string | null; responsavelId: string | null; contatoId: string | null;
};

const rotulo = 'text-xs font-bold uppercase tracking-wide text-brand';

/** Aviso rápido do resultado (spec 4.5). Devolve se deu certo. */
export function avisar(r: Resultado): boolean {
  if (r.ok) toast.success(r.mensagem); else toast.error(r.erro);
  return r.ok;
}

/** Pessoas ativas do setor da demanda (Triagem: todas), decisão 18. */
const doSetor = (pessoas: PessoaSetor[], setorId: string | null) => pessoas.filter((p) => !setorId || p.setores.includes(setorId));

/** ASSUMIR: no painel ocupa a largura toda (imagem 05); na linha da tabela é um link de texto (imagem 03). */
export function BotaoAssumir({ id, cheio = false }: { id: string; cheio?: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant={cheio ? 'primary' : 'link'}
      className={cn(cheio && 'w-full', !cheio && 'h-auto font-bold')}
      disabled={pendente}
      onClick={() => iniciar(async () => { avisar(await assumirDemanda(id)); })}
    >
      {cheio && <UserRoundCheck aria-hidden size={16} strokeWidth={1.75} />}
      {pendente ? 'Assumindo…' : 'Assumir'}
    </Button>
  );
}

/** Responsável, Status, Prioridade e Prazo: gravam ao mudar; erro volta o campo ao valor de antes (decisão 17). */
export function CamposDemanda({ d, pessoas, agora }: { d: DemandaControles; pessoas: PessoaSetor[]; agora: Date }) {
  const id = useId();
  const [pendente, iniciar] = useTransition();
  const [valores, setValores] = useState({ responsavel: d.responsavelId ?? '', status: d.status, prioridade: d.prioridade, prazo: paraCampoDataHora(d.prazo) });
  // A página volta do servidor com os valores novos (revalidatePath): o campo acompanha.
  useEffect(() => {
    setValores({ responsavel: d.responsavelId ?? '', status: d.status, prioridade: d.prioridade, prazo: paraCampoDataHora(d.prazo) });
  }, [d.responsavelId, d.status, d.prioridade, d.prazo]);
  const concluida = d.status === 'concluido';
  const opcoesPessoas = doSetor(pessoas, d.setorId);

  const gravar = (campo: keyof typeof valores, valor: string, chamar: () => Promise<Resultado>) => {
    const antes = valores[campo];
    setValores((v) => ({ ...v, [campo]: valor }));
    iniciar(async () => { if (!avisar(await chamar())) setValores((v) => ({ ...v, [campo]: antes })); });
  };

  return (
    <div className="grid grid-cols-2 gap-3" aria-busy={pendente}>
      <div className="grid gap-1">
        <label htmlFor={`${id}-resp`} className={rotulo}>Responsável</label>
        <select id={`${id}-resp`} className={classeSelect} value={valores.responsavel} disabled={concluida}
          onChange={(e) => gravar('responsavel', e.target.value, () => definirResponsavel(d.id, e.target.value || null))}>
          <option value="">Ninguém</option>
          {opcoesPessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-status`} className={rotulo}>Status</label>
        <select id={`${id}-status`} className={classeSelect} value={valores.status} disabled={concluida}
          onChange={(e) => gravar('status', e.target.value, () => alterarStatusDemanda(d.id, e.target.value as 'aberto' | 'em_andamento' | 'aguardando_cliente'))}>
          {(['aberto', 'em_andamento', 'aguardando_cliente'] as const).map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
          {concluida && <option value="concluido">{ROTULO_STATUS.concluido}</option>}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-prio`} className={rotulo}>Prioridade</label>
        <select id={`${id}-prio`} className={cn(classeSelect, valores.prioridade === 'urgente' && 'font-bold text-danger', valores.prioridade === 'alta' && 'font-bold text-warning')}
          value={valores.prioridade} disabled={concluida}
          onChange={(e) => gravar('prioridade', e.target.value, () => definirPrioridade(d.id, e.target.value as Prioridade))}>
          {OPCOES_PRIORIDADE.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-prazo`} className={rotulo}>Prazo</label>
        <Input id={`${id}-prazo`} type="datetime-local" className="tabular" value={valores.prazo} disabled={concluida}
          onChange={(e) => setValores((v) => ({ ...v, prazo: e.target.value }))}
          onBlur={(e) => { if (e.target.value && e.target.value !== paraCampoDataHora(d.prazo)) gravar('prazo', e.target.value, () => definirPrazo(d.id, e.target.value)); }} />
        {/* O campo guarda a data; o texto diz o que ela significa agora (pausado, hoje, venceu), spec 8. */}
        <p className="text-xs"><PrazoTexto prazo={d.prazo} pausadoDesde={d.pausadoDesde} concluidaEm={d.concluidaEm} agora={agora} /></p>
      </div>
    </div>
  );
}

/** Nota, Transferir e Concluir (Reabrir quando concluída), imagem 05. */
export function BotoesDemanda({ d, setores, pessoas }: { d: DemandaControles; setores: { id: string; nome: string }[]; pessoas: PessoaSetor[] }) {
  const [pendente, iniciar] = useTransition();
  if (d.status === 'concluido') {
    return (
      <Button type="button" variant="outline" disabled={pendente} onClick={() => iniciar(async () => { avisar(await reabrirDemanda(d.id)); })}>
        <RotateCcw aria-hidden size={16} strokeWidth={1.75} />{pendente ? 'Reabrindo…' : 'Reabrir'}
      </Button>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      <NotaInterna d={d} />
      <Transferir d={d} setores={setores} pessoas={pessoas} />
      <ConfirmDialog
        gatilho={<Button type="button" variant="outline" className="text-success"><CircleCheck aria-hidden size={16} strokeWidth={1.75} />Concluir</Button>}
        titulo={<>Concluir a demanda <strong>#{d.numero}</strong>?</>}
        descricao={`"${d.titulo}" sai das demandas abertas. Dá para reabrir depois.`}
        confirmar="Concluir"
        enviando="Concluindo…"
        variante="primary"
        tipo="concluir"
        acao={async () => { avisar(await concluirDemanda(d.id)); }}
      />
    </div>
  );
}

function NotaInterna({ d }: { d: DemandaControles }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [pendente, iniciar] = useTransition();
  const id = useId();
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild><Button type="button" variant="outline"><NotebookPen aria-hidden size={16} strokeWidth={1.75} />Nota</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nota interna na demanda #{d.numero}</DialogTitle>
          <DialogDescription>Só a equipe vê. O cliente não recebe.</DialogDescription>
        </DialogHeader>
        <label htmlFor={id} className="sr-only">Nota interna</label>
        <Textarea id={id} rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
          <Button type="button" disabled={pendente} onClick={() => iniciar(async () => {
            if (avisar(await notaInternaDemanda(d.id, texto))) { setTexto(''); setAberto(false); }
          })}>{pendente ? 'Salvando…' : 'Salvar nota'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Transferir({ d, setores, pessoas }: { d: DemandaControles; setores: { id: string; nome: string }[]; pessoas: PessoaSetor[] }) {
  const [aberto, setAberto] = useState(false);
  const [setor, setSetor] = useState(d.setorId ?? '');
  const [responsavel, setResponsavel] = useState('');
  const [pendente, iniciar] = useTransition();
  const id = useId();
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild><Button type="button" variant="outline"><ArrowRightLeft aria-hidden size={16} strokeWidth={1.75} />Transferir</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir a demanda #{d.numero}</DialogTitle>
          <DialogDescription>{d.titulo}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <label htmlFor={`${id}-setor`} className={rotulo}>Setor</label>
            <select id={`${id}-setor`} className={classeSelect} value={setor} onChange={(e) => { setSetor(e.target.value); setResponsavel(''); }}>
              <option value="" disabled>Escolha o setor</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${id}-resp`} className={rotulo}>Responsável</label>
            <select id={`${id}-resp`} className={classeSelect} value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Fila do setor</option>
              {doSetor(pessoas, setor || null).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
          <Button type="button" disabled={pendente} onClick={() => iniciar(async () => {
            if (avisar(await transferirDemanda(d.id, setor, responsavel || null))) setAberto(false);
          })}>{pendente ? 'Transferindo…' : 'Transferir'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Título com lápis (imagem 05): abre o campo no lugar; Salvar grava pelo editar_demanda. */
export function EditarTitulo({ d }: { d: DemandaControles }) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(d.titulo);
  const [pendente, iniciar] = useTransition();
  const id = useId();
  useEffect(() => setTitulo(d.titulo), [d.titulo]);
  if (!editando) {
    return (
      <div className="flex items-start gap-2">
        <p className="text-2xl font-extrabold text-foreground">{d.titulo}</p>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-muted" aria-label="Editar título" onClick={() => setEditando(true)}>
          <Pencil aria-hidden size={16} strokeWidth={1.75} />
        </Button>
      </div>
    );
  }
  return (
    <form className="flex items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      iniciar(async () => { if (avisar(await editarDemanda(d.id, { titulo }))) setEditando(false); });
    }}>
      <div className="grid flex-1 gap-1">
        <label htmlFor={id} className={rotulo}>Título</label>
        <Input id={id} value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} autoFocus />
      </div>
      <Button type="submit" size="sm" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar título'}</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => { setTitulo(d.titulo); setEditando(false); }}>Cancelar</Button>
    </form>
  );
}

/** Descrição e contato na empresa, com Salvar próprio (decisão 17). */
export function EditarDescricao({ d, contatos }: { d: DemandaControles; contatos: { id: string; nome: string }[] }) {
  const [descricao, setDescricao] = useState(d.descricao);
  const [contato, setContato] = useState(d.contatoId ?? '');
  const [pendente, iniciar] = useTransition();
  const id = useId();
  useEffect(() => { setDescricao(d.descricao); setContato(d.contatoId ?? ''); }, [d.descricao, d.contatoId]);
  const mudou = descricao !== d.descricao || contato !== (d.contatoId ?? '');
  // O contato atual pode ter sido arquivado depois: continua na lista para não sumir da tela (Foco da revisão, item 4).
  const atualForaDaLista = d.contatoId && !contatos.some((c) => c.id === d.contatoId);
  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault();
      iniciar(async () => { avisar(await editarDemanda(d.id, { descricao, contato: contato || null })); });
    }}>
      <div className="grid gap-1">
        <label htmlFor={`${id}-contato`} className={rotulo}>Contato na empresa</label>
        <select id={`${id}-contato`} className={classeSelect} value={contato} onChange={(e) => setContato(e.target.value)}>
          <option value="">Nenhum</option>
          {atualForaDaLista && <option value={d.contatoId!}>Contato arquivado</option>}
          {contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-desc`} className={rotulo}>Descrição</label>
        <Textarea id={`${id}-desc`} rows={4} maxLength={4000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline" disabled={!mudou || pendente}>{pendente ? 'Salvando…' : 'Salvar descrição'}</Button>
      </div>
    </form>
  );
}
