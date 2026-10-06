'use client';
import { Bot, Building2, CircleDollarSign, FolderOpen, Paperclip, Send, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { EscolherEmpresa, type EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { iniciarTarefaPedida, pedirAoAgente } from '@/lib/pedir-acoes';
import { TEXTO_SEM_I4, arquivosRecusados, podeEnviar, textoCusto, textoDestino, type DadosPedir } from '@/lib/pedir-agente-tela';
import { enviarArquivoTarefa } from '@/lib/tarefas-acoes';

const rotulo = 'text-xs font-bold uppercase tracking-wide text-brand';
const ACEITA = '.pdf,.xml,.csv,.txt,.ofx,.jpg,.jpeg,.png';

/** Spec 7E.5: a mesma tarefa do WhatsApp. Cartões só dos agentes que a pessoa pode pedir (D5; o dono vê todos, D15); o destino aparece antes de enviar (D6). */
export function PedirAoAgente({ chamado, dados, empresas = [], drive }: {
  chamado: { id: string; numero: number; empresa: { id: string; nome: string } | null } | null;
  dados: DadosPedir; empresas?: EmpresaOpcao[]; drive?: { pasta: boolean; configurado: boolean; erro?: boolean };
}) {
  const router = useRouter();
  const id = useId();
  const [aberta, setAberta] = useState(false);
  const [agenteId, setAgenteId] = useState(dados.agentes[0]?.id ?? '');
  const [skill, setSkill] = useState('');
  const [pedido, setPedido] = useState('');
  const [prazo, setPrazo] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [usarDrive, setUsarDrive] = useState(true);
  const [mostrarSub, setMostrarSub] = useState(false);
  const [subpasta, setSubpasta] = useState('');
  const [painel, setPainel] = useState(true);
  const [whatsapp, setWhatsapp] = useState(dados.whatsapp === null);
  const [enviando, iniciar] = useTransition();
  const agente = dados.agentes.find((a) => a.id === agenteId) ?? null;
  const empresaFixa = chamado?.empresa ?? null;
  const [empresaEscolhida, setEmpresaEscolhida] = useState('');
  const precisaEmpresa = agente?.destino === 'nova' && !empresaFixa;
  const escolheEmpresa = !empresaFixa && (precisaEmpresa || !chamado);
  const recusas = arquivosRecusados(arquivos);
  const comDrive = dados.i4 && drive?.configurado && drive.pasta;

  const enviar = () => iniciar(async () => {
    if (recusas.length) { toast.error(recusas[0]!); return; }
    const r = await pedirAoAgente({ agenteId, pedido, chamadoId: chamado?.id ?? null, clienteId: empresaFixa?.id ?? (empresaEscolhida || null),
      skill: skill || null, prazo, avisarPainel: painel, avisarWhatsapp: whatsapp, lerDrive: usarDrive, subpasta: mostrarSub ? subpasta : '', i4: dados.i4 });
    if (!r.ok) { toast.error(r.erro); return; }
    // D8: os arquivos sobem antes de o agente começar; o que falhar a pessoa manda na tela da tarefa.
    // Com a tarefa já criada, uma exceção aqui não pode deixar a janela aberta (outro Enviar criaria outra tarefa).
    for (const f of arquivos) {
      const fd = new FormData();
      fd.set('arquivo', f);
      const up = await enviarArquivoTarefa(r.tarefaId, fd).catch(() => ({ ok: false as const, erro: 'falha na conexão.' }));
      if (!up.ok) toast.error(`Não enviei ${f.name}: ${up.erro} Envie na tela da tarefa.`);
    }
    if (dados.i4) await iniciarTarefaPedida(r.tarefaId).catch(() => toast.error('O agente começa pelo batimento em alguns minutos.'));
    toast(r.rotulo ? `Tarefa ${r.rotulo} pedida${r.demanda ? ` na demanda #${r.demanda}${r.demandaNova ? ' (nova)' : ''}` : ''}.` : 'Tarefa pedida: o agente começa em instantes.');
    setAberta(false);
    router.push(`/tarefas/${r.tarefaId}`);
  });

  return (
    <Dialog open={aberta} onOpenChange={setAberta}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full border-brand text-brand"><Bot aria-hidden size={16} /> Pedir ao agente</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot aria-hidden size={20} className="text-success" /> Pedir ao agente
            {chamado && <span className="ml-auto text-sm font-normal text-muted">demanda #{chamado.numero}</span>}</DialogTitle>
          <DialogDescription>O agente trabalha em segundo plano e para nas pendências. Nada vale antes da aprovação de uma pessoa do setor.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-128 flex-col gap-4 overflow-y-auto">
          {!dados.i4 && <p className="rounded-md bg-surface-muted p-2 text-xs text-muted">{TEXTO_SEM_I4}</p>}
          <section>
            <p className="mb-2"><span id={`${id}-agente`} className={rotulo}>Agente</span>
              <span className="text-xs text-muted"> · {dados.donoVeTodos ? 'todos os setores' : 'só os dos seus setores'}</span></p>
            <div role="radiogroup" aria-labelledby={`${id}-agente`} className="grid gap-2 sm:grid-cols-3">
              {dados.agentes.map((a) => (
                <button key={a.id} type="button" role="radio" aria-checked={a.id === agenteId} onClick={() => { setAgenteId(a.id); setSkill(''); }}
                  className={cn('flex flex-col gap-1 rounded-md border p-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring',
                    a.id === agenteId ? 'border-brand bg-brand-soft' : 'border-border hover:bg-surface-muted')}>
                  <span className="flex items-center gap-1 font-bold"><Bot aria-hidden size={14} /> {a.nome}{a.estado === 'teste' && <span className="text-xs font-normal text-warning"> · em teste</span>}</span>
                  {a.descricao && <span className="text-xs text-muted">{a.descricao}</span>}
                </button>
              ))}
            </div>
            {agente && dados.i4 && <p className="mt-2 text-xs text-muted">{textoDestino(agente, chamado?.numero ?? null)}</p>}
          </section>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              {/* Combobox não tira o nome do conteúdo: com a escolha, o rótulo é um <label> ligado ao botão (axe aria-input-field-name). */}
              {escolheEmpresa ? <Label htmlFor={`${id}-empresa-escolha`} className={rotulo}>Empresa</Label>
                : <span id={`${id}-empresa`} className={rotulo}>Empresa</span>}
              {empresaFixa ? (
                <p className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm" aria-labelledby={`${id}-empresa`}>
                  <span className="flex items-center gap-2 font-bold"><Building2 aria-hidden size={16} /> {empresaFixa.nome}</span><span className="text-xs text-muted">da demanda</span>
                </p>
              ) : escolheEmpresa ? (
                <EscolherEmpresa id={`${id}-empresa-escolha`} name="empresa" empresas={empresas} aoMudar={setEmpresaEscolhida} />
              ) : <p className="text-sm text-muted">Sem empresa nesta demanda.</p>}
            </div>
            {dados.i4 && (
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${id}-prazo`} className={rotulo}>Prazo desejado</Label>
                <Input id={`${id}-prazo`} type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
            )}
          </div>
          {(agente?.procedimentos.length ?? 0) > 0 && (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-proc`}>Procedimento</Label>
              <select id={`${id}-proc`} className="h-9 rounded-md border border-input bg-surface px-2 text-sm" value={skill} onChange={(e) => setSkill(e.target.value)}>
                <option value="">Sem procedimento</option>
                {agente!.procedimentos.map((p) => <option key={p.nome} value={p.nome}>{p.titulo}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-pedido`} className={rotulo}>O que você quer?</Label>
            <Textarea id={`${id}-pedido`} value={pedido} onChange={(e) => setPedido(e.target.value)} maxLength={2000} rows={3}
              placeholder="Ex.: Confere as notas de setembro contra os pedidos e me diz o que não bate." />
          </div>
          <section className="flex flex-col gap-2" aria-labelledby={`${id}-arquivos`}>
            <span id={`${id}-arquivos`} className={rotulo}>Arquivos</span>
            <ul className="flex flex-wrap gap-2 text-sm">
              {comDrive && usarDrive && (
                <li className="flex items-center gap-1 rounded-full border border-border px-3 py-1"><FolderOpen aria-hidden size={14} />
                  Drive · {empresaFixa?.nome ?? 'pasta do cliente'}{mostrarSub && subpasta.trim() ? ` / ${subpasta.trim()}` : ''}
                  <button type="button" aria-label="Não ler a pasta do Drive" onClick={() => setUsarDrive(false)}><X aria-hidden size={14} /></button></li>
              )}
              {arquivos.map((f) => (
                <li key={f.name} className="flex items-center gap-1 rounded-full border border-border px-3 py-1"><Paperclip aria-hidden size={14} /> {f.name}
                  <button type="button" aria-label={`Tirar ${f.name}`} onClick={() => setArquivos(arquivos.filter((x) => x !== f))}><X aria-hidden size={14} /></button></li>
              ))}
            </ul>
            {recusas.map((r) => <p key={r} className="text-xs text-danger" role="alert">{r}</p>)}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline"><label><Paperclip aria-hidden size={16} /> Anexar
                <input type="file" multiple accept={ACEITA} className="sr-only" onChange={(e) => setArquivos([...arquivos, ...Array.from(e.target.files ?? [])])} /></label></Button>
              {comDrive && <Button size="sm" variant="outline" type="button" onClick={() => { setUsarDrive(true); setMostrarSub(!mostrarSub); }}>
                <FolderOpen aria-hidden size={16} /> Pasta do Drive</Button>}
            </div>
            {dados.i4 && drive?.configurado && drive.erro && <p className="text-xs text-warning" role="status">Não consegui conferir a situação do Drive agora; a leitura pode falhar.</p>}
            {comDrive && mostrarSub && (
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${id}-sub`}>Subpasta (opcional)</Label>
                <Input id={`${id}-sub`} value={subpasta} onChange={(e) => setSubpasta(e.target.value)} placeholder="Ex.: Fiscal/2026-09" maxLength={300} />
                <p className="text-xs text-muted">Só leitura. Vazio = a pasta inteira do cliente.</p>
              </div>
            )}
          </section>
          {dados.i4 && (
            <fieldset className="flex flex-col gap-1">
              <legend className={rotulo}>Avisar quando terminar</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={painel} onChange={(e) => setPainel(e.target.checked)} /> Painel</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={whatsapp} disabled={dados.whatsapp !== null}
                  onChange={(e) => setWhatsapp(e.target.checked)} /> Meu WhatsApp</label>
              </div>
              {dados.whatsapp && <p className="text-xs text-muted">{dados.whatsapp}</p>}
            </fieldset>
          )}
          {agente && textoCusto(agente) && (
            <p className="flex items-center gap-2 rounded-md bg-surface-muted p-2 text-sm text-muted"><CircleDollarSign aria-hidden size={16} /> {textoCusto(agente)}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setAberta(false)}>Cancelar</Button>
          <Button type="button" disabled={enviando || recusas.length > 0 || !podeEnviar({ agenteId, pedido, temEmpresa: !!empresaFixa || empresaEscolhida !== '', destino: agente?.destino ?? null })}
            onClick={enviar}><Send aria-hidden size={16} /> Enviar para o agente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
