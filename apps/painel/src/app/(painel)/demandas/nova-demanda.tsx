'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { EscolherEmpresa, type EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { OPCOES_PRIORIDADE, type Prioridade } from '@/lib/demandas';
import type { CampoNova } from '@/lib/nova-demanda';
import { paraCampoDataHora } from '@/lib/prazo';
import { classeSelect } from '../clientes/estilos';
import { contatosDaEmpresa, criarDemanda } from './acoes';
import { avisar, type PessoaSetor } from './acoes-demanda';

const rotulo = 'text-xs font-bold uppercase tracking-wide text-brand';

/**
 * Nova demanda (spec 6.4, imagem 04): ligação, e-mail ou balcão. Prioridade Normal por padrão; o prazo vem preenchido com o
 * sugerido e muda junto com a prioridade até a pessoa mexer nele. Responsável só do setor escolhido. Origem = equipe.
 */
export function NovaDemanda({ empresas, setores, pessoas, sugeridos, podePrazo, inicial, conversa, aoConcluir, aoCancelar }: {
  empresas: EmpresaOpcao[]; setores: { id: string; nome: string }[]; pessoas: PessoaSetor[]; sugeridos: Record<Prioridade, string | null>; podePrazo: boolean;
  /** Abrir demanda do Atendimento: empresa e contato da conversa já escolhidos. */
  inicial?: { cliente?: string; contato?: string };
  /** A demanda nasce ligada a esta conversa (spec 7A.1). */
  conversa?: string;
  /** Fora da tela Demandas: quem abriu decide o que fazer depois (fechar o painel, avisar). */
  aoConcluir?: (r: { id: string; mensagem: string }) => void;
  aoCancelar?: () => void;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = useId();
  const [pendente, iniciar] = useTransition();
  const [cliente, setCliente] = useState(inicial?.cliente ?? '');
  const [setor, setSetor] = useState(setores.length === 1 ? setores[0]!.id : '');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('normal');
  const [prazo, setPrazo] = useState(paraCampoDataHora(sugeridos.normal));
  const [prazoTocado, setPrazoTocado] = useState(false);
  const [responsavel, setResponsavel] = useState('');
  const [contato, setContato] = useState(inicial?.contato ?? '');
  const [contatos, setContatos] = useState<{ id: string; nome: string }[]>([]);
  const [erro, setErro] = useState<{ campo?: CampoNova; texto: string } | null>(null);
  // Empresa trocada antes da lista de contatos chegar: a resposta atrasada é descartada.
  const empresaAtual = useRef(inicial?.cliente ?? '');
  const erroDe = (c: CampoNova) => (erro?.campo === c ? erro.texto : null);

  // Empresa já escolhida (Abrir demanda do Atendimento): carrega os contatos dela uma vez.
  useEffect(() => {
    if (inicial?.cliente) void contatosDaEmpresa(inicial.cliente).then((l) => { if (empresaAtual.current === inicial.cliente) setContatos(l); }).catch(() => undefined);
  }, [inicial?.cliente]);

  const escolherPrioridade = (p: Prioridade) => {
    setPrioridade(p);
    if (!prazoTocado) setPrazo(paraCampoDataHora(sugeridos[p]));
  };

  const escolherEmpresa = (novo: string) => {
    empresaAtual.current = novo;
    setCliente(novo);
    setContato('');
    setContatos([]);
    if (novo) void contatosDaEmpresa(novo).then((lista) => { if (empresaAtual.current === novo) setContatos(lista); }).catch(() => undefined);
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    iniciar(async () => {
      const r = await criarDemanda({ cliente, setor, titulo, descricao, prioridade, prazo: prazoTocado ? prazo : '', responsavel, contato, conversa: conversa ?? '' });
      if (!r.ok) {
        setErro({ campo: r.campo, texto: r.erro });
        if (!r.campo) avisar(r);
        return;
      }
      if (aoConcluir) { aoConcluir(r); return; }
      avisar(r);
      const p = new URLSearchParams(sp.toString());
      p.delete('nova');
      p.set('demanda', r.id);
      router.replace(`/demandas?${p.toString()}`, { scroll: false });
    });
  };

  // Tira só o ?nova=1 (link direto não pode "voltar" para fora do painel).
  const cancelar = () => {
    if (aoCancelar) { aoCancelar(); return; }
    const p = new URLSearchParams(sp.toString());
    p.delete('nova');
    router.replace(`/demandas${p.size ? `?${p.toString()}` : ''}`, { scroll: false });
  };

  const aviso = (c: CampoNova) => erroDe(c) && <p id={`${id}-${c}-erro`} className="text-sm text-danger">{erroDe(c)}</p>;
  const descrito = (c: CampoNova) => (erroDe(c) ? `${id}-${c}-erro` : undefined);

  return (
    <form onSubmit={enviar} className="flex h-full flex-col" noValidate>
      <SheetHeader>
        <SheetTitle>Nova demanda</SheetTitle>
        <SheetDescription>Para pedidos que chegaram por ligação, e-mail ou no balcão.</SheetDescription>
      </SheetHeader>
      <SheetBody className="grid content-start gap-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor={`${id}-empresa`} className={rotulo}>Empresa</label>
            <EscolherEmpresa id={`${id}-empresa`} name="cliente" empresas={empresas} inicial={inicial?.cliente ?? null} aoMudar={escolherEmpresa}
              aria-invalid={Boolean(erroDe('cliente'))} aria-describedby={descrito('cliente')} />
            {aviso('cliente')}
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${id}-setor`} className={rotulo}>Setor</label>
            <select id={`${id}-setor`} className={classeSelect} value={setor} aria-invalid={Boolean(erroDe('setor'))} aria-describedby={descrito('setor')}
              onChange={(e) => { setSetor(e.target.value); setResponsavel(''); }}>
              <option value="" disabled>Escolha o setor</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            {aviso('setor')}
          </div>
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-titulo`} className={rotulo}>Título</label>
          <Input id={`${id}-titulo`} value={titulo} maxLength={120} aria-invalid={Boolean(erroDe('titulo'))}
            aria-describedby={descrito('titulo')} onChange={(e) => setTitulo(e.target.value)} />
          {aviso('titulo')}
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-desc`} className={rotulo}>Descrição</label>
          <Textarea id={`${id}-desc`} rows={3} maxLength={4000} value={descricao} aria-invalid={Boolean(erroDe('descricao'))}
            aria-describedby={descrito('descricao')} onChange={(e) => setDescricao(e.target.value)} />
          {aviso('descricao')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="grid gap-1 sm:col-span-2">
            <legend className={cn(rotulo, 'mb-1')}>Prioridade</legend>
            <div className="grid grid-cols-4 overflow-hidden rounded-md border border-input">
              {OPCOES_PRIORIDADE.map((o) => (
                <label key={o.valor} className={cn('cursor-pointer px-2 py-2 text-center text-sm has-checked:bg-grafite has-checked:text-grafite-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring',
                  'border-l border-input first:border-l-0')}>
                  <input type="radio" name="prioridade" value={o.valor} checked={prioridade === o.valor} onChange={() => escolherPrioridade(o.valor)} className="sr-only" />
                  {o.rotulo}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-1">
            <label htmlFor={`${id}-prazo`} className={cn(rotulo, 'flex items-center gap-2')}>
              Prazo {!prazoTocado && <span className="normal-case tracking-normal text-champagne-text">sugerido</span>}
            </label>
            <Input id={`${id}-prazo`} type="datetime-local" className="tabular" value={prazo} aria-invalid={Boolean(erroDe('prazo'))}
              aria-describedby={descrito('prazo')} readOnly={!podePrazo}
              onChange={(e) => { if (!podePrazo) return; setPrazo(e.target.value); setPrazoTocado(true); }} />
            {aviso('prazo')}
            {!podePrazo && <p className="text-xs text-muted">O prazo sugerido vale. Só quem pode alterar prazos muda a data.</p>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor={`${id}-resp`} className={rotulo}>Responsável</label>
            <select id={`${id}-resp`} className={classeSelect} value={responsavel} disabled={!setor} aria-invalid={Boolean(erroDe('responsavel'))}
              aria-describedby={descrito('responsavel')} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Ninguém (fila do setor)</option>
              {pessoas.filter((p) => p.setores.includes(setor)).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            {aviso('responsavel')}
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${id}-contato`} className={rotulo}>Contato na empresa</label>
            <select id={`${id}-contato`} className={classeSelect} value={contato} disabled={!cliente} aria-invalid={Boolean(erroDe('contato'))}
              aria-describedby={descrito('contato')} onChange={(e) => setContato(e.target.value)}>
              <option value="">Nenhum</option>
              {contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            {aviso('contato')}
          </div>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={cancelar}>Cancelar</Button>
        <Button type="submit" disabled={pendente}>{pendente ? 'Abrindo…' : 'Abrir demanda'}</Button>
      </SheetFooter>
    </form>
  );
}
