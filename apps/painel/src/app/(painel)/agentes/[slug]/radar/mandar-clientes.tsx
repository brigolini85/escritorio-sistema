'use client';
import { useEffect, useId, useState, useTransition } from 'react';
import { ListChecks, Lock, MessageSquareText, Pencil, Send, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { NovidadeTela } from '@/lib/radar';
import { aprovarEnvioRadar, lerContatosParaEnvio, salvarMensagemRadar, type ClienteParaEnvio } from '@/lib/radar-acoes';
import { capacidadeEnvio, contatosDaEscolha, NOTA_LIMITE_ENVIO, podeAprovar, podeDecidir, resumoEscolha, textoAprovacao, textoContatosProcurados, tituloRascunho } from './janelas';

function JanelaAprovar({ novidadeId, setorId, setorNome, texto, aberta, aoMudar, comLista }: {
  novidadeId: string; setorId: string; setorNome: string; texto: string; aberta: boolean; aoMudar: (a: boolean) => void; comLista: boolean;
}) {
  const [ocupado, iniciar] = useTransition();
  const [linhas, setLinhas] = useState<ClienteParaEnvio[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [lista, setLista] = useState(comLista);

  // Cada vez que abre, lê de novo: contatos e permissões podem ter mudado desde a última vez.
  useEffect(() => {
    if (!aberta) return;
    let vivo = true;
    setLinhas(null); setErro(null); setLista(comLista);
    lerContatosParaEnvio(novidadeId, setorId).then((r) => {
      if (!vivo) return;
      if (r.ok) { setLinhas(r.clientes); setMarcados(new Set(r.clientes.filter((c) => c.contatos > 0).map((c) => c.id))); } else setErro(r.erro);
    });
    return () => { vivo = false; };
  }, [aberta, novidadeId, setorId, comLista]);

  const disponiveis = (linhas ?? []).filter((c) => c.contatos > 0);
  const contatos = contatosDaEscolha(linhas ?? [], marcados);
  const motivo = linhas ? podeAprovar({ texto, clientes: marcados.size, contatos }) : 'Lendo os clientes…';
  // Mudou a escolha: o erro da tentativa anterior já não vale.
  const escolher = (m: Set<string>) => { setMarcados(m); setErro(null); };
  const alternar = (id: string, v: boolean) => { setErro(null); setMarcados((m) => { const x = new Set(m); if (v) x.add(id); else x.delete(id); return x; }); };
  const capacidade = capacidadeEnvio(contatos);
  const todosMarcados = disponiveis.length > 0 && marcados.size === disponiveis.length;

  const aprovar = () => iniciar(async () => {
    const r = await aprovarEnvioRadar(novidadeId, setorId, [...marcados], texto);
    if (r.ok) { toast(textoAprovacao(r.contatos)); aoMudar(false); } else setErro(r.erro);
  });

  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="max-h-screen max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mandar para clientes afetados</DialogTitle>
          <DialogDescription>Sai pelo WhatsApp do escritório, na voz do Thiago, como o setor {setorNome}.</DialogDescription>
        </DialogHeader>
        <blockquote className="rounded-md bg-surface-muted p-3 text-sm">&ldquo;{texto.trim()}&rdquo;</blockquote>
        {erro && <p role="alert" className="text-sm font-bold text-danger">{erro}</p>}
        {linhas && (
          <div className="flex flex-col gap-3">
            <p className="text-sm"><b>{resumoEscolha(marcados.size, disponiveis.length)}</b> · {contatos} {contatos === 1 ? 'contato' : 'contatos'}</p>
            {disponiveis.length < linhas.length && <p className="text-xs text-muted">{linhas.length - disponiveis.length} sem contato que o setor {setorNome} possa procurar: ficam de fora.</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" aria-expanded={lista} onClick={() => setLista(!lista)}><ListChecks aria-hidden size={14} />Escolher clientes</Button>
              {lista && (
                <Button type="button" variant="ghost" size="sm" onClick={() => escolher(todosMarcados ? new Set() : new Set(disponiveis.map((c) => c.id)))}>
                  {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
                </Button>
              )}
            </div>
            {lista && (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
                {linhas.map((c) => {
                  const livre = c.contatos > 0;
                  return (
                    <li key={c.id}>
                      <label className={`flex items-start gap-2 text-sm ${livre ? 'cursor-pointer' : 'text-muted'}`}>
                        <Checkbox className="mt-0.5" disabled={!livre} checked={livre && marcados.has(c.id)} onCheckedChange={(v) => alternar(c.id, v === true)} />
                        <span className="flex flex-col">
                          <span className="font-medium">{c.nome}</span>
                          <span className="text-xs text-muted">{livre ? textoContatosProcurados(c.contatos) : `nenhum contato pode ser procurado pelo ${setorNome}`}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {capacidade.linha && <p className="text-sm tabular">{capacidade.linha}</p>}
        {capacidade.aviso && <p role="status" className="flex items-start gap-2 text-sm font-bold text-warning"><TriangleAlert aria-hidden size={14} className="mt-0.5 shrink-0" />{capacidade.aviso}</p>}
        <p className="text-xs text-muted">{NOTA_LIMITE_ENVIO}</p>
        <DialogFooter className="items-center">
          {motivo && <p className="text-xs text-muted sm:mr-auto" aria-live="polite">{motivo}</p>}
          <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancelar</Button></DialogClose>
          <Button type="button" size="sm" disabled={ocupado || !!motivo} onClick={aprovar}><Send aria-hidden size={14} />Aprovar e enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * O rascunho para os clientes (bloco tracejado da imagem). A tela só cria a lista aprovada:
 * quem manda a mensagem é o trabalhador, respeitando o limite do dia.
 */
export function MandarClientes({ n, dono, admin, meusSetores }: { n: NovidadeTela; dono: boolean; admin: boolean; meusSetores: string[] }) {
  const id = useId();
  const [ocupado, iniciar] = useTransition();
  const [aberto, setAberto] = useState(!!n.mensagemCliente);
  const [texto, setTexto] = useState(n.mensagemCliente ?? '');
  const [editando, setEditando] = useState(!n.mensagemCliente);
  const [erro, setErro] = useState<string | null>(null);
  const [setorId, setSetorId] = useState(n.setores[0]?.id ?? '');
  const [janela, setJanela] = useState<null | 'aprovar' | 'escolher'>(null);
  const setor = n.setores.find((s) => s.id === setorId) ?? n.setores[0];

  if (!aberto) {
    return <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}><MessageSquareText aria-hidden size={14} />Mandar para clientes afetados</Button>;
  }
  const autorizado = !!setor && podeDecidir({ dono, admin, meusSetores, setorId: setor.id });
  const salvar = () => {
    const t = texto.trim();
    if (t.length < 3 || t.length > 1000) { setErro('A mensagem tem de 3 a 1.000 letras.'); return; }
    setErro(null);
    iniciar(async () => {
      const r = await salvarMensagemRadar(n.id, t);
      if (r.ok) { setTexto(t); setEditando(false); toast('Mensagem salva.'); } else setErro(r.erro);
    });
  };

  return (
    <div data-testid="radar-mandar" className="order-first flex w-full flex-col gap-3 rounded-md border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand">
          <Pencil aria-hidden size={12} />{tituloRascunho(n)}
        </p>
        <span className="inline-flex items-center gap-1 rounded-sm bg-surface-muted px-1.5 py-0.5 text-xs text-muted"><Lock aria-hidden size={12} />só sai com aprovação</span>
      </div>
      {editando ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-msg`} className="sr-only">Mensagem para os clientes</label>
          <Textarea id={`${id}-msg`} value={texto} onChange={(x) => setTexto(x.target.value)} maxLength={1000} rows={4} placeholder="Escreva a mensagem para os clientes."
            aria-invalid={!!erro} aria-describedby={erro ? `${id}-erro` : undefined} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={ocupado} onClick={salvar}>Salvar</Button>
            {n.mensagemCliente && <Button type="button" variant="ghost" size="sm" onClick={() => { setTexto(n.mensagemCliente ?? ''); setEditando(false); setErro(null); }}>Cancelar</Button>}
            <span className="ml-auto text-xs text-muted tabular">{texto.length}/1000</span>
          </div>
          {erro && <p id={`${id}-erro`} role="alert" className="text-xs font-bold text-danger">{erro}</p>}
        </div>
      ) : (
        <p className="whitespace-pre-line text-sm">&ldquo;{texto}&rdquo;</p>
      )}
      {!setor ? <p className="text-sm text-muted">Sem setor para mandar a mensagem.</p> : (
        <div className="flex flex-wrap items-center gap-2">
          {n.setores.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor={`${id}-setor`} className="text-xs font-bold uppercase tracking-wide text-muted">Mandar como o setor</label>
              <Select value={setorId} onValueChange={setSetorId}>
                <SelectTrigger id={`${id}-setor`} size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>{n.setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {autorizado ? (
            <>
              <Button type="button" size="sm" disabled={editando || !texto.trim()} onClick={() => setJanela('aprovar')}><Send aria-hidden size={14} />Aprovar e enviar</Button>
              {!editando && <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)}><Pencil aria-hidden size={14} />Editar</Button>}
              <Button type="button" variant="outline" size="sm" disabled={editando || !texto.trim()} onClick={() => setJanela('escolher')}><ListChecks aria-hidden size={14} />Escolher clientes</Button>
            </>
          ) : <p className="text-sm text-muted">Quem aprova é uma pessoa do setor {setor.nome}.</p>}
        </div>
      )}
      {autorizado && setor && janela && (
        <JanelaAprovar novidadeId={n.id} setorId={setor.id} setorNome={setor.nome} texto={texto} aberta comLista={janela === 'escolher'} aoMudar={(a) => { if (!a) setJanela(null); }} />
      )}
    </div>
  );
}
