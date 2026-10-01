'use client';

import { ChevronDown, FlaskConical, Info, LoaderCircle, RotateCcw, Send } from 'lucide-react';
import { useEffect, useId, useState, useTransition, type FormEvent } from 'react';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { EscolherEmpresa } from '@/components/patterns/escolher-empresa';
import { FormField } from '@/components/patterns/form-field';
import { MessageBubble } from '@/components/patterns/message-bubble';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { autenticarTempoReal, supabaseNavegador } from '@/lib/supabase/navegador';
import { empresasParaTeste, testarAgente, type EmpresasTeste } from './acoes';
import { AVISO_EMPRESAS_INCOMPLETAS } from './esquemas';
import {
  INTERVALO_CONSULTA_MS, LIMITE_MENSAGEM_TESTE, MENSAGEM_FALHA_TESTE, MENSAGEM_SEM_RESPOSTA, PRAZO_ESPERA_MS, prazoDoTeste,
  resultadoDaLinha, type LinhaSimulacao, type PedidoTeste, type RascunhoTeste, type RespostasSimulacao,
} from './simulacao';

type Fase = 'pensando' | 'pronta' | 'erro' | 'atrasou';

/**
 * Acompanha um teste: tempo real na linha da simulação (com a sessão da pessoa; o RLS só entrega as dela) e, de
 * reserva, uma consulta a cada 3 s enquanto pendente. Para em pronta/erro ou no prazo ("não respondeu a tempo").
 */
/** Contador das montagens de useSimulacao (sufixo do tópico do canal). */
let montagens = 0;

function useSimulacao(id: string): { linha: LinhaSimulacao | null; atrasou: boolean } {
  const [linha, setLinha] = useState<LinhaSimulacao | null>(null);
  const [atrasou, setAtrasou] = useState(false);

  useEffect(() => {
    const sb = supabaseNavegador();
    let ativo = true;
    let canal: ReturnType<typeof sb.channel> | undefined;
    let prazoAjustado = false;
    let prazo: ReturnType<typeof setTimeout> | undefined;
    let consulta: ReturnType<typeof setInterval> | undefined;

    const parar = () => {
      ativo = false;
      clearInterval(consulta);
      clearTimeout(prazo);
      if (canal) void sb.removeChannel(canal);
      canal = undefined;
    };
    const ler = async (): Promise<LinhaSimulacao | null> => {
      const { data, error } = await sb.from('simulacoes_agente').select('id, status, mensagem, criado_em, respostas, erro').eq('id', id).maybeSingle();
      if (!ativo) return null;
      if (error) {
        console.error('[treinar-agente] falha ao ler o teste', error);
        return null;
      }
      if (!data) return null;
      setLinha(data);
      if (data.status !== 'pendente') parar();
      else if (!prazoAjustado) {
        // Teste retomado (já estava pendente): o prazo conta de quando ele foi criado.
        prazoAjustado = true;
        agendarPrazo(prazoDoTeste(data.criado_em, Date.now()) - Date.now());
      }
      return data;
    };
    const agendarPrazo = (ms: number) => {
      clearTimeout(prazo);
      prazo = setTimeout(() => {
        void ler().then((l) => {
          if (!ativo || (l && l.status !== 'pendente')) return;
          parar();
          setAtrasou(true);
        });
      }, ms);
    };

    agendarPrazo(PRAZO_ESPERA_MS);
    consulta = setInterval(() => void ler(), INTERVALO_CONSULTA_MS);
    void ler();
    void autenticarTempoReal(sb).then((ok) => {
      if (!ativo || !ok) return;
      // Tópico único por montagem: o canal anterior do mesmo teste pode ainda estar saindo (removeChannel é assíncrono).
      canal = sb.channel(`simulacao-${id}-${++montagens}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'simulacoes_agente', filter: `id=eq.${id}` }, () => void ler())
        .subscribe();
    });
    return parar;
  }, [id]);

  return { linha, atrasou };
}

function OQueFaria({ respostas }: { respostas: RespostasSimulacao }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  if (respostas.acoes.length === 0) return <p className="text-sm text-muted">O agente não usaria nenhuma ferramenta (não abriria demanda nem pedido de nota).</p>;
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-surface-muted"
      >
        O que o agente faria ({respostas.acoes.length})
        <ChevronDown aria-hidden size={16} strokeWidth={1.75} className={cn('transition-transform duration-150 ease-out', aberto && 'rotate-180')} />
      </button>
      <ul id={id} hidden={!aberto} className="flex list-disc flex-col gap-1 border-t border-border py-2 pr-3 pl-8 text-sm text-foreground">
        {respostas.acoes.map((a, i) => <li key={i}>{a.resumo}</li>)}
      </ul>
    </div>
  );
}

/** Resultado de um teste: a mensagem do cliente, "Pensando…" e depois o que o agente mandaria e faria. */
function ResultadoTeste({ id, aviso, aoMudarFase, tentarDeNovo }: {
  id: string;
  aviso: string | null;
  aoMudarFase: (f: Fase) => void;
  tentarDeNovo: () => void;
}) {
  const { linha, atrasou } = useSimulacao(id);
  const resultado = linha ? resultadoDaLinha(linha) : { fase: 'pensando' as const };
  const fase: Fase = resultado.fase === 'pensando' && atrasou ? 'atrasou' : resultado.fase;
  useEffect(() => aoMudarFase(fase), [fase, aoMudarFase]);

  return (
    <section aria-label="Resultado do teste" className="flex flex-col gap-3 border-t border-border pt-4">
      {aviso && (
        <p className="flex items-start gap-2 rounded-md bg-info-soft p-3 text-sm text-info">
          <Info aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          {aviso}
        </p>
      )}
      {linha && <MessageBubble autor="cliente" nome="Cliente (teste)" hora={linha.criado_em} conteudo={linha.mensagem} />}
      {fase === 'pensando' && (
        <p role="status" className="ml-auto flex items-center gap-2 rounded-lg bg-agent-active-soft px-3 py-2 text-sm text-agent-active">
          <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" />
          Pensando…
        </p>
      )}
      {resultado.fase === 'pronta' && linha && (
        <>
          <p role="status" className="sr-only">O agente respondeu.</p>
          {resultado.respostas.mensagens.length > 0
            ? resultado.respostas.mensagens.map((m, i) => <MessageBubble key={i} autor="agente" hora={linha.criado_em} conteudo={m} />)
            : <p className="text-sm text-muted">O agente não mandaria nenhuma mensagem para o cliente.</p>}
          <OQueFaria respostas={resultado.respostas} />
          {resultado.respostas.observacoes.length > 0 && (
            <ul aria-label="Observações do teste" className="flex flex-col gap-2">
              {resultado.respostas.observacoes.map((o, i) => (
                <li key={i} className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
                  <Info aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  {o}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {(fase === 'erro' || fase === 'atrasou') && (
        <div className="flex flex-col items-start gap-2">
          <AvisoErro erro={resultado.fase === 'erro' ? resultado.erro : MENSAGEM_SEM_RESPOSTA} />
          <Button type="button" variant="outline" size="sm" onClick={tentarDeNovo}>
            <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
            Tentar de novo
          </Button>
        </div>
      )}
    </section>
  );
}

/** Conteúdo do Dialog (montado só aberto: fechar e abrir começa um teste novo e relê as empresas). */
function ConteudoTeste({ rascunho }: { rascunho: RascunhoTeste | null }) {
  const id = useId();
  const [mensagem, setMensagem] = useState('');
  // A empresa da orientação em teste vem escolhida; se ela não estiver entre as ativas, sai quando a lista chegar.
  const [empresa, setEmpresa] = useState<string | null>(rascunho?.cliente_id ?? null);
  const [versaoEmpresa, setVersaoEmpresa] = useState(0);
  const [lista, setLista] = useState<EmpresasTeste | null>(null);

  useEffect(() => {
    let ativo = true;
    void empresasParaTeste()
      .catch((e: unknown) => {
        console.error('[treinar-agente] falha ao carregar as empresas do teste', e);
        return { empresas: [], aviso: AVISO_EMPRESAS_INCOMPLETAS } satisfies EmpresasTeste;
      })
      .then((l) => {
        if (!ativo) return;
        const ativas = { ...l, empresas: l.empresas.filter((e) => !e.inativa) };
        setLista(ativas);
        setEmpresa((atual) => (atual && ativas.empresas.some((e) => e.id === atual) ? atual : null));
        setVersaoEmpresa((v) => v + 1);
      });
    return () => { ativo = false; };
  }, []);

  const [teste, setTeste] = useState<{ id: string; aviso: string | null; vez: number } | null>(null);
  const [fase, setFase] = useState<Fase | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<PedidoTeste | null>(null);
  const [enviando, iniciar] = useTransition();
  const ocupado = enviando || fase === 'pensando';

  const enviar = (pedido: PedidoTeste) => {
    setUltimo(pedido);
    setErro(null);
    iniciar(async () => {
      let r: Awaited<ReturnType<typeof testarAgente>>;
      try {
        r = await testarAgente(pedido);
      } catch (e) {
        console.error('[treinar-agente] falha ao enviar o teste', e);
        r = { erro: MENSAGEM_FALHA_TESTE };
      }
      if ('erro' in r) {
        setErro(r.erro);
        setTeste(null);
        setFase(null);
      } else {
        setFase('pensando');
        setTeste((t) => ({ id: r.id, aviso: r.aviso, vez: (t?.vez ?? 0) + 1 }));
      }
    });
  };
  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ocupado) enviar({ mensagem, clienteId: empresa, rascunho });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-md bg-info-soft p-3 text-sm text-info">
        <Info aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
        <span>
          É só um teste: nada é enviado ao cliente nem gravado.
          {rascunho && ' A orientação entra no teste como está no formulário, ligada, mesmo sem salvar.'}
        </span>
      </p>
      {rascunho && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          Orientação em teste:
          <StatusBadge tipo="orientacao" status={rascunho.tipo} />
          <span className="font-medium text-foreground">{rascunho.titulo}</span>
        </p>
      )}
      <form onSubmit={aoEnviar} className="flex flex-col gap-4">
        <FormField
          id={`${id}-mensagem`}
          rotulo="Mensagem do cliente"
          ajuda={(
            <span className="flex flex-wrap justify-between gap-2">
              <span>Escreva como o cliente escreveria no WhatsApp.</span>
              <span className="tabular">{mensagem.length.toLocaleString('pt-BR')} / {LIMITE_MENSAGEM_TESTE.toLocaleString('pt-BR')}</span>
            </span>
          )}
          obrigatorio
        >
          <Textarea
            name="mensagem"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            maxLength={LIMITE_MENSAGEM_TESTE}
            rows={3}
            placeholder="Ex.: Bom dia, preciso da guia do DAS deste mês."
          />
        </FormField>
        <FormField
          id={`${id}-empresa`}
          rotulo="Empresa (opcional)"
          ajuda={(
            <>
              Sem empresa, o agente atende como um número desconhecido. Com empresa, como um contato dela.
              {lista?.aviso && <span className="block text-warning">{lista.aviso}</span>}
            </>
          )}
        >
          <EscolherEmpresa
            key={versaoEmpresa}
            name="cliente_id"
            empresas={lista?.empresas ?? []}
            inicial={empresa}
            placeholder={lista ? 'Nenhuma empresa' : 'Carregando empresas…'}
            disabled={!lista}
            aoMudar={setEmpresa}
          />
        </FormField>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {empresa && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setEmpresa(null); setVersaoEmpresa((v) => v + 1); }}>
              Testar sem empresa
            </Button>
          )}
          <Button type="submit" disabled={ocupado} aria-busy={enviando || undefined}>
            {enviando ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" /> : <Send aria-hidden size={16} strokeWidth={1.75} />}
            Enviar teste
          </Button>
        </div>
      </form>
      {erro && (
        <div className="flex flex-col items-start gap-2">
          <AvisoErro erro={erro} />
          {ultimo && (
            <Button type="button" variant="outline" size="sm" disabled={enviando} onClick={() => enviar(ultimo)}>
              <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
              Tentar de novo
            </Button>
          )}
        </div>
      )}
      {teste && (
        <ResultadoTeste
          key={`${teste.id}-${teste.vez}`}
          id={teste.id}
          aviso={teste.aviso}
          aoMudarFase={setFase}
          tentarDeNovo={() => ultimo && enviar(ultimo)}
        />
      )}
    </div>
  );
}

/**
 * Dialog "Testar o agente": mensagem do cliente, empresa (opcional, só ativas, lidas ao abrir) e, quando vem do formulário, a orientação
 * ainda não salva (rascunho). O teste roda no trabalhador (fila simular_agente) sem enviar nem gravar nada.
 */
export function DialogTestarAgente({ aberto, aoMudarAberto, rascunho = null }: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  rascunho?: RascunhoTeste | null;
}) {
  return (
    <Dialog open={aberto} onOpenChange={aoMudarAberto}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rascunho ? 'Testar esta orientação' : 'Testar o agente'}</DialogTitle>
          <DialogDescription>Escreva uma mensagem como se fosse o cliente e veja o que o agente responderia.</DialogDescription>
        </DialogHeader>
        <ConteudoTeste rascunho={rascunho} />
      </DialogContent>
    </Dialog>
  );
}

/** Botão do cabeçalho da tela: testa o agente com as orientações ligadas, sem rascunho. */
export function BotaoTestarAgente() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
        <FlaskConical aria-hidden size={16} strokeWidth={1.75} />
        Testar o agente
      </Button>
      <DialogTestarAgente aberto={aberto} aoMudarAberto={setAberto} />
    </>
  );
}
