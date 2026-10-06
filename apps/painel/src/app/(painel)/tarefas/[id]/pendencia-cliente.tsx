'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { opcoesDaPendenciaCliente, pedirAoCliente, receberPendencia } from '@/lib/tarefas-acoes';
import { podeCobrarDeNovo, situacaoPedidoNaTela, type PendenciaTela } from '@/lib/tarefas-tela';
import { EnviarArquivo } from './enviar-arquivo';

const SITUACAO = { a_pedir: 'ainda não pedido', enviando: 'enviando pelo WhatsApp', nao_enviado: 'não enviado: o pedido não saiu em 24 h', aguardando: 'aguardando resposta', recebida: 'recebida' } as const;

/** D7: a pessoa escolhe o contato (só quem pode ser procurado no setor) e confere a mensagem; o Thiago manda. */
export function PendenciaCliente({ tarefaId, p, setor, podeMexer }: { tarefaId: string; p: PendenciaTela; setor: string | null; podeMexer: boolean }) {
  const router = useRouter();
  const [janela, setJanela] = useState<'pedir' | 'recebi' | null>(null);
  const [opcoes, setOpcoes] = useState<Awaited<ReturnType<typeof opcoesDaPendenciaCliente>>>({ contatos: [], arquivos: [] });
  const [contato, setContato] = useState('');
  const [texto, setTexto] = useState(p.pedidoTexto ?? p.mensagem ?? '');
  const [obs, setObs] = useState('');
  const [arquivo, setArquivo] = useState<{ arquivoId?: string; mensagemId?: string }>({});
  const [enviando, iniciar] = useTransition();
  const agora = new Date();
  const situacao = situacaoPedidoNaTela(p, agora);
  const abrir = (qual: 'pedir' | 'recebi') => iniciar(async () => {
    const o = await opcoesDaPendenciaCliente(p.id);
    setOpcoes(o);
    setContato(o.contatos[0]?.id ?? '');
    setJanela(qual);
  });
  const pedir = () => iniciar(async () => {
    const r = await pedirAoCliente(tarefaId, p.id, contato, texto);
    if (r.ok) { toast('O Thiago vai mandar o pedido pelo WhatsApp.'); setJanela(null); router.refresh(); } else toast.error(r.erro);
  });
  const recebi = () => iniciar(async () => {
    const r = await receberPendencia(tarefaId, p.id, { observacao: obs, ...arquivo });
    if (r.ok) { toast('Pendência marcada como recebida.'); setJanela(null); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <article className="flex flex-col gap-2 text-sm" aria-label={`Pendência ${p.numero}`}>
      <p className="font-bold">{p.pergunta}</p>
      {p.contato && <p className="text-muted">Pedido pelo Thiago ao contato <b>{p.contato}</b> <Badge variant="success">{setor ?? 'setor'} permitido</Badge></p>}
      {(p.pedidoTexto ?? p.mensagem) && <blockquote className="rounded-md bg-surface-muted px-3 py-2 italic">“{p.pedidoTexto ?? p.mensagem}”</blockquote>}
      <p className="text-xs text-warning">{SITUACAO[situacao]}{p.estado === 'respondida' && p.resposta ? `: ${p.resposta}` : ''}</p>
      {podeMexer && p.estado === 'aberta' && (
        <div className="flex flex-wrap gap-2">
          {situacao === 'a_pedir' && <Button size="sm" disabled={enviando} onClick={() => abrir('pedir')}>Pedir ao cliente</Button>}
          {situacao !== 'a_pedir' && podeCobrarDeNovo(p, agora) && <Button size="sm" variant="outline" disabled={enviando} onClick={() => abrir('pedir')}>Cobrar de novo</Button>}
          <Button size="sm" variant="outline" disabled={enviando} onClick={() => abrir('recebi')}>Já recebi</Button>
        </div>
      )}
      <Dialog open={janela === 'pedir'} onOpenChange={(v) => !v && setJanela(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedir ao cliente</DialogTitle>
            <DialogDescription>O Thiago manda esta mensagem pelo WhatsApp ao contato escolhido. Só aparecem contatos com o setor permitido e "pode ser procurado".</DialogDescription>
          </DialogHeader>
          {opcoes.contatos.length === 0 ? <p className="text-sm text-warning">Nenhum contato desta empresa pode ser procurado por este setor. Marque um na ficha do cliente (aba Contatos).</p> : (
            <div className="flex flex-col gap-3">
              <Label htmlFor={`contato-${p.id}`}>Contato</Label>
              <select id={`contato-${p.id}`} className="h-9 rounded-md border border-input bg-surface px-2 text-sm" value={contato} onChange={(e) => setContato(e.target.value)}>
                {opcoes.contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <Label htmlFor={`msg-${p.id}`}>Mensagem</Label>
              <Textarea id={`msg-${p.id}`} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} rows={4} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setJanela(null)}>Cancelar</Button>
            <Button disabled={enviando || !contato || texto.trim().length < 3} onClick={pedir}>Mandar pelo Thiago</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={janela === 'recebi'} onOpenChange={(v) => !v && setJanela(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Já recebi</DialogTitle>
            <DialogDescription>O agente lê o arquivo quando retomar. Escolha um que o cliente mandou na conversa ou envie agora.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {opcoes.arquivos.length > 0 && (
              <fieldset className="flex flex-col gap-1 text-sm">
                <legend className="font-bold">Arquivos que o cliente mandou</legend>
                {opcoes.arquivos.map((a) => (
                  <label key={a.mensagemId} className="flex items-center gap-2">
                    <input type="radio" name={`arq-${p.id}`} checked={arquivo.mensagemId === a.mensagemId} onChange={() => setArquivo({ mensagemId: a.mensagemId })} /> {a.nome}
                  </label>
                ))}
              </fieldset>
            )}
            <EnviarArquivo tarefaId={tarefaId} rotulo="Enviar o arquivo agora" aoEnviar={(id) => setArquivo({ arquivoId: id })} />
            <Label htmlFor={`obs-${p.id}`}>Observação</Label>
            <Textarea id={`obs-${p.id}`} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={2000} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJanela(null)}>Cancelar</Button>
            <Button disabled={enviando} onClick={recebi}>Marcar como recebida</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
