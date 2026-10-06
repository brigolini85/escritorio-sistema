'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Bot, FlaskConical, LockKeyhole, Play, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { ESTADOS_AGENTE, ROTULO_ESTADO, ROTULO_TIPO_AGENTE, type EstadoAgente } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Button, variantesBotao } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Agente, ContatoTeste, Mudanca, NumerosAgente } from '@/lib/agentes';
import { buscarContatosParaTeste, definirContatosTeste, salvarAgente } from '@/lib/agentes-acoes';
import { cn } from '@/lib/cn';
import { formatarData, formatarUSD } from '@/lib/formatos';
import { ICONE_AGENTE } from '../cartao-agente';
import { HistoricoAgente } from './historico-agente';
import { comoTestar } from '@/lib/testar-setor';
import { TEXTO_TESTE_TRABALHO } from './textos';

const caixa = 'flex flex-col gap-0.5 rounded-md border border-border px-3 py-2';
const rotuloCaixa = 'text-xs font-bold uppercase tracking-wide text-muted';

/** Cabeçalho da ficha (spec 7E.3, imagem 00-agente-ficha): estado (só o dono), Teste com contatos, modelo, números do mês. */
export function CabecalhoAgente({ agente: a, dono, numeros, mostrarNumeros, contatosTeste, modelos, mudancas }: {
  agente: Agente; dono: boolean; numeros: NumerosAgente | null; mostrarNumeros: boolean; contatosTeste: ContatoTeste[];
  modelos: { padrao: string; comPreco: string[] }; mudancas: Mudanca[];
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [escolhendo, setEscolhendo] = useState(false);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<ContatoTeste[]>([]);
  const Icone = ICONE_AGENTE[a.slug] ?? Bot;
  const podeEstado = dono && !a.portaDeEntrada;
  const semPreco = a.modelo !== null && !modelos.comPreco.includes(a.modelo);
  const avisar = (r: { ok: true } | { ok: false; erro: string }, texto: string) => {
    if (r.ok) { toast(texto); router.refresh(); } else toast.error(r.erro);
    return r.ok;
  };

  useEffect(() => {
    if (busca.trim().length < 2) { setAchados([]); return; }
    const t = setTimeout(() => { buscarContatosParaTeste(busca).then(setAchados).catch(() => setAchados([])); }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  const mudarEstado = (estado: EstadoAgente) => {
    // Teste sem contato: primeiro escolher quem (o banco recusa Teste vazio).
    if (estado === 'teste' && contatosTeste.length === 0) { setEscolhendo(true); return; }
    iniciar(async () => { avisar(await salvarAgente(a.slug, { estado }), `Estado: ${ROTULO_ESTADO[estado]}.`); });
  };
  const adicionar = (c: ContatoTeste) => iniciar(async () => {
    const ok = avisar(await definirContatosTeste(a.slug, [...contatosTeste.map((x) => x.id), c.id]), `${c.nome} entrou no teste.`);
    if (ok && escolhendo && a.estado !== 'teste') avisar(await salvarAgente(a.slug, { estado: 'teste' }), 'Estado: Teste.');
    setBusca(''); setEscolhendo(false);
  });
  const remover = (c: ContatoTeste) => iniciar(async () => {
    avisar(await definirContatosTeste(a.slug, contatosTeste.filter((x) => x.id !== c.id).map((x) => x.id)), `${c.nome} saiu do teste.`);
  });
  const mudarModelo = (modelo: string) => iniciar(async () => {
    avisar(await salvarAgente(a.slug, { modelo: modelo || null }), 'Modelo salvo.');
  });

  return (
    <header className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-md bg-surface-muted text-brand"><Icone aria-hidden size={20} /></span>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold text-brand">{a.nome}</h1>
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
              <Badge variant="neutral">{a.setor ? `Setor ${a.setor}` : a.portaDeEntrada ? 'Atendimento' : 'Sem setor'}</Badge>
              <Badge variant="success">{a.tipos.map((t) => ROTULO_TIPO_AGENTE[t]).join(' + ')}</Badge>
              {a.criadoEm && <span>· criado em {formatarData(a.criadoEm)}</span>}
              {a.atualizadoEm && <span>· última mudança {formatarData(a.atualizadoEm)}{a.atualizadoPor ? ` por ${a.atualizadoPor}` : ''}</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className={caixa}>
            <span className={rotuloCaixa}>Modelo de IA</span>
            {dono ? (
              <select aria-label="Modelo de IA" value={a.modelo ?? ''} disabled={enviando} onChange={(e) => mudarModelo(e.target.value)}
                className="h-8 rounded-md border border-input bg-surface px-2 text-sm font-bold">
                <option value="">Padrão de Configurações ({modelos.padrao})</option>
                {/* Modelo cujo preço saiu de Configurações: continua aparecendo, marcado, em vez de virar "Padrão…". */}
                {semPreco && <option value={a.modelo!}>{a.modelo} (sem preço)</option>}
                {modelos.comPreco.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : <span className="font-bold">{a.modelo ?? modelos.padrao}{semPreco ? ' (sem preço)' : ''}</span>}
            <span className="text-xs text-muted">{a.modelo ? 'escolhido para este agente' : 'troca em Configurações'}</span>
          </div>
          {mostrarNumeros && (
            <>
              <div className={caixa}><span className={rotuloCaixa}>Custo do mês</span><span className="tabular text-xl font-extrabold">{formatarUSD((numeros?.custoUsd ?? 0) + (numeros?.custoTestesUsd ?? 0))}</span></div>
              <div className={caixa}><span className={rotuloCaixa}>Conversas no mês</span><span className="tabular text-xl font-extrabold">{numeros?.atendimentos ?? 0}</span></div>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Estado do agente" className="flex flex-wrap items-center gap-2">
          <span className={rotuloCaixa}>Estado</span>
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            {ESTADOS_AGENTE.map((e) => (
              <button key={e} type="button" aria-pressed={a.estado === e} disabled={!podeEstado || enviando} onClick={() => mudarEstado(e)}
                className={cn('h-8 px-3 text-sm font-bold uppercase disabled:cursor-not-allowed',
                  a.estado === e ? (e === 'teste' ? 'bg-warning-soft text-warning' : e === 'ligado' ? 'bg-success-soft text-success' : 'bg-grafite text-grafite-foreground') : 'bg-surface text-muted')}>
                {ROTULO_ESTADO[e]}
              </button>
            ))}
          </div>
          <Badge variant="brand"><LockKeyhole aria-hidden />só o dono</Badge>
          {a.portaDeEntrada && <span className="text-sm text-muted">O Thiago fica sempre ligado. Para parar o atendimento, use PAUSAR no Início.</span>}
        </div>
        <div className="flex gap-2">
          <HistoricoAgente nome={a.nome} mudancas={mudancas} />
          {a.portaDeEntrada || comoTestar(a, true) === 'setor'
            ? <Link href={`/agentes/${a.slug}/testar`} className={variantesBotao()}><Play aria-hidden size={16} />Testar agora</Link>
            : <Button disabled title={TEXTO_TESTE_TRABALHO}><Play aria-hidden size={16} />Testar agora</Button>}
        </div>
      </div>
      {!a.portaDeEntrada && (a.estado === 'teste' || escolhendo) && (
        <div className="flex flex-col gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <FlaskConical aria-hidden size={16} className="text-warning" />
            <b>Em teste:</b> só atende estes contatos; os outros seguem com o Thiago.
            <span className="font-bold">Testando com:</span>
            {contatosTeste.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5">
                {c.nome}
                {dono && <button type="button" aria-label={`Tirar ${c.nome} do teste`} onClick={() => remover(c)} disabled={enviando}><X aria-hidden size={12} /></button>}
              </span>
            ))}
          </div>
          {dono && (
            <div className="flex flex-col gap-1">
              <label className="inline-flex items-center gap-2 font-bold uppercase text-brand"><Plus aria-hidden size={14} />Adicionar contato
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou telefone" className="h-8 w-64 font-normal normal-case" />
              </label>
              {achados.length > 0 && (
                <ul aria-label="Contatos encontrados" className="flex flex-wrap gap-1">
                  {achados.map((c) => (
                    <li key={c.id}><Button size="sm" variant="outline" onClick={() => adicionar(c)} disabled={enviando}>{c.nome} · {c.telefone}</Button></li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {/* Clicou em TESTE sem contatos: o estado ainda não mudou; Cancelar fecha a faixa sem gravar nada. */}
          {escolhendo && a.estado !== 'teste' && (
            <div><Button size="sm" variant="outline" onClick={() => { setEscolhendo(false); setBusca(''); }} disabled={enviando}>Cancelar</Button></div>
          )}
        </div>
      )}
    </header>
  );
}
