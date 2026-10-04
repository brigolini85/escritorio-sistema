'use client';

import {
  Building2, CircleDot, CircleHelp, ClipboardList, FilePlus2, FileText, Info, LoaderCircle, MessageCircle, PackagePlus, Paperclip,
  Pencil, RotateCcw, Send, ShieldCheck, Tag, UserRound, type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { EscolherEmpresa, type EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { FormField } from '@/components/patterns/form-field';
import { formularioAlterado } from '@/components/patterns/formulario-alteravel';
import { MessageBubble } from '@/components/patterns/message-bubble';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatarHora } from '@/lib/formatos';
import { testarAgente, type RespostaTeste } from './acoes';
import { EVENTO_RASCUNHO, ID_FORM_ORIENTACAO } from './rascunho-ao-vivo';
import {
  LIMITE_MENSAGEM_TESTE, MENSAGEM_FALHA_TESTE, MENSAGEM_SEM_RESPOSTA, resultadoDaLinha, type PedidoTeste, type RespostasSimulacao,
} from './simulacao';
import {
  empresaDoFormulario, empresaDoTeste, lerRascunho, podeCompararSemRascunho, rotuloSimulador,
  type CampoRascunho, type ConteudoSalvo, type EscolhaEmpresa,
} from './tela';
import { useSimulacao } from './use-simulacao';

type Fase = 'pensando' | 'pronta' | 'erro' | 'atrasou';

/** Ícone de cada ação que o trabalhador registra (simularGravacao e o encaminhamento). D6 */
const ICONE: Record<string, LucideIcon> = {
  abrir_chamado: FilePlus2,
  abrir_pedido_nota: FileText,
  resumir_pedido_nota: ClipboardList,
  enviar_documento: Paperclip,
  alterar_preco: Tag,
  cadastrar_produto: PackagePlus,
  selecionar_empresa: Building2,
  passar_para_pessoa: UserRound,
  encaminhar: UserRound,
  sinalizar_nao_entendido: CircleHelp,
};

async function pedirTeste(p: PedidoTeste): Promise<RespostaTeste> {
  try {
    return await testarAgente(p);
  } catch (e) {
    console.error('[treinar-agente] falha ao enviar o teste', e);
    return { erro: MENSAGEM_FALHA_TESTE };
  }
}

/** Fase de um teste pela linha do banco; "não respondeu a tempo" pelo relógio de quem espera. */
function useFase(id: string, aoMudarFase: (f: Fase | null) => void) {
  const { linha, atrasou } = useSimulacao(id);
  const resultado = linha ? resultadoDaLinha(linha) : { fase: 'pensando' as const };
  const fase: Fase = resultado.fase === 'pensando' && atrasou ? 'atrasou' : resultado.fase;
  useEffect(() => {
    aoMudarFase(fase);
    // Ao sair da tela (troca de teste ou quadro escondido), a fase volta a neutra: "pensando" não prende o Testar.
    return () => aoMudarFase(null);
  }, [fase, aoMudarFase]);
  return { linha, resultado, fase };
}

/** Rascunho incompleto: o foco vai para o campo que falta (D9). */
function focarCampo(f: HTMLFormElement, campo: CampoRascunho | null) {
  if (!campo) return;
  const alvo = campo === 'titulo' || campo === 'texto'
    ? f.querySelector<HTMLElement>(`[name="${campo}"]`)
    : f.querySelector<HTMLElement>(`[data-campo="${campo}"] button, [data-campo="${campo}"] select`);
  alvo?.focus();
}

function OQueFaria({ respostas }: { respostas: RespostasSimulacao }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-agent-active bg-surface p-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-agent-active">O que o agente faria</h3>
      {respostas.acoes.length === 0 ? (
        <p className="text-sm text-muted">O agente não usaria nenhuma ferramenta (não abriria demanda nem pedido de nota).</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
          {respostas.acoes.map((a, i) => {
            const Icone = ICONE[a.ferramenta] ?? CircleDot;
            return (
              <li key={i} className="flex items-start gap-2">
                <Icone aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-agent-active" />
                {a.resumo}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted">O que grava ou envia foi só simulado.</p>
    </div>
  );
}

/** Resultado do teste: a mensagem do cliente, "Pensando…" e depois o que o agente mandaria e faria. */
function ResultadoTeste({ id, aviso, rascunho, aoMudarFase, tentarDeNovo, rodape }: {
  id: string;
  aviso: string | null;
  rascunho: PedidoTeste['rascunho'];
  aoMudarFase: (f: Fase | null) => void;
  tentarDeNovo: () => void;
  rodape: ReactNode;
}) {
  const { linha, resultado, fase } = useFase(id, aoMudarFase);
  return (
    <section aria-label="Resultado do teste" className="flex flex-col gap-3">
      {aviso && (
        <p className="flex items-start gap-2 rounded-md bg-info-soft p-3 text-sm text-info">
          <Info aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          {aviso}
        </p>
      )}
      {linha && <p className="self-center rounded-full border border-border bg-surface px-3 py-0.5 text-xs text-muted">Teste · {formatarHora(linha.criado_em)}</p>}
      {linha && <MessageBubble autor="cliente" nome="Cliente (teste)" hora={linha.criado_em} conteudo={linha.mensagem} />}
      {rascunho && (
        <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
          <Pencil aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          Teste com o rascunho “{rascunho.titulo}” (ligado, sem salvar).
        </p>
      )}
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
            ? resultado.respostas.mensagens.map((m, i) => <MessageBubble key={i} autor="agente" nome="Agente responderia" hora={linha.criado_em} conteudo={m} />)
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
          {rodape}
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

/** A segunda simulação (sem rascunho): o texto que o cliente receberia e as ações, em poucas linhas. */
function ResultadoComparacao({ id, aoMudarFase, comparar }: { id: string; aoMudarFase: (f: Fase | null) => void; comparar: () => void }) {
  const { resultado, fase } = useFase(id, aoMudarFase);
  if (fase === 'pensando') {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-agent-active">
        <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" />
        Pensando…
      </p>
    );
  }
  if (resultado.fase === 'pronta') {
    const { mensagens, acoes } = resultado.respostas;
    return (
      <div className="flex flex-col gap-1.5 text-sm text-foreground">
        {mensagens.length > 0
          ? mensagens.map((m, i) => <p key={i} className="whitespace-pre-wrap break-words">{m}</p>)
          : <p className="text-muted">Não mandaria nenhuma mensagem.</p>}
        <p className="text-muted">{acoes.length > 0 ? `Faria: ${acoes.map((a) => a.resumo).join('; ')}.` : 'Nenhuma ação.'}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <AvisoErro erro={resultado.fase === 'erro' ? resultado.erro : MENSAGEM_SEM_RESPOSTA} />
      <Button type="button" variant="outline" size="sm" onClick={comparar}>
        <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
        Comparar de novo
      </Button>
    </div>
  );
}

/** Quadro "Sem o rascunho" (spec 7C.5, D2–D4): uma segunda simulação, sob pedido, com a mesma mensagem e empresa. */
function SemORascunho({ comparacao, ocupado, erro, comparar, aoMudarFase }: {
  comparacao: { id: string; vez: number } | null;
  ocupado: boolean;
  erro: string | null;
  comparar: () => void;
  aoMudarFase: (f: Fase | null) => void;
}) {
  return (
    <section aria-label="Sem o rascunho" className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Sem o rascunho</h3>
      {comparacao ? (
        <ResultadoComparacao key={`${comparacao.id}-${comparacao.vez}`} id={comparacao.id} aoMudarFase={aoMudarFase} comparar={comparar} />
      ) : (
        <>
          <p className="text-sm text-muted">
            Veja o que o agente responde hoje, com as orientações ligadas e salvas. É mais um teste, com a mesma mensagem e empresa, e conta em Gastos com IA.
          </p>
          <Button type="button" variant="outline" size="sm" className="self-start" disabled={ocupado} onClick={comparar}>Comparar sem o rascunho</Button>
        </>
      )}
      {erro && <AvisoErro erro={erro} />}
    </section>
  );
}

/**
 * Simulador de WhatsApp sempre visível (spec 7C.5): empresa, mensagem do cliente, a resposta e "O que o agente faria".
 * Com uma orientação aberta, o teste leva o formulário do meio como está (rascunho, sem salvar); sem orientação, só as
 * ligadas (D10). Nada é enviado nem gravado além do próprio teste (criar_simulacao + trabalhador, regras de hoje).
 */
export function Simulador({ aberta, idOrientacao, salva, empresas, avisoEmpresas }: {
  aberta: 'nova' | 'salva' | null;
  idOrientacao: string | null;
  salva: ConteudoSalvo | null;
  /** Só empresas ativas. */
  empresas: EmpresaOpcao[];
  avisoEmpresas: string | null;
}) {
  const id = useId();
  const ativas = useMemo(() => new Set(empresas.map((e) => e.id)), [empresas]);
  const [doRascunho, setDoRascunho] = useState<{ alterado: boolean; clienteId: string | null }>({ alterado: false, clienteId: salva?.clienteId ?? null });
  const [escolha, setEscolha] = useState<EscolhaEmpresa>({ manual: false });
  const [versaoEmpresa, setVersaoEmpresa] = useState(0);
  const empresa = empresaDoTeste(escolha, aberta ? doRascunho.clienteId : null, ativas);

  // O editor avisa a cada mudança (EVENTO_RASCUNHO): o selo e a empresa do teste acompanham o formulário (D11).
  useEffect(() => {
    if (aberta === null) return;
    const ler = () => {
      const f = document.getElementById(ID_FORM_ORIENTACAO);
      if (!(f instanceof HTMLFormElement)) return;
      setDoRascunho({ alterado: formularioAlterado(f), clienteId: empresaDoFormulario(new FormData(f)) });
    };
    ler();
    window.addEventListener(EVENTO_RASCUNHO, ler);
    return () => window.removeEventListener(EVENTO_RASCUNHO, ler);
  }, [aberta]);

  const [mensagem, setMensagem] = useState('');
  const [teste, setTeste] = useState<{ id: string; aviso: string | null; vez: number; pedido: PedidoTeste; podeComparar: boolean } | null>(null);
  const [fase, setFase] = useState<Fase | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroRascunho, setErroRascunho] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<PedidoTeste | null>(null);
  const [comparacao, setComparacao] = useState<{ id: string; vez: number } | null>(null);
  const [faseComparacao, setFaseComparacao] = useState<Fase | null>(null);
  const [erroComparacao, setErroComparacao] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  // Um teste por pessoa (criar_simulacao): enquanto um roda, nada mais sai.
  const ocupado = enviando || fase === 'pensando' || faseComparacao === 'pensando';

  const enviar = (pedido: PedidoTeste) => {
    setUltimo(pedido);
    setErro(null);
    setComparacao(null);
    setFaseComparacao(null);
    setErroComparacao(null);
    iniciar(async () => {
      const r = await pedirTeste(pedido);
      if ('erro' in r) {
        setErro(r.erro);
        setTeste(null);
        setFase(null);
      } else {
        setFase('pensando');
        // Decidido na criação (D4): salvar ou ligar depois não esconde o quadro com uma comparação em andamento.
        const podeComparar = !r.aviso && podeCompararSemRascunho(pedido.rascunho, salva);
        setTeste((t) => ({ id: r.id, aviso: r.aviso, vez: (t?.vez ?? 0) + 1, pedido, podeComparar }));
      }
    });
  };

  // "Sem o rascunho": a mesma mensagem e empresa, sem rascunho. Um teste pendente de outra aba não é adotado aqui.
  const comparar = () => {
    if (!teste || ocupado) return;
    setErroComparacao(null);
    iniciar(async () => {
      const r = await pedirTeste({ ...teste.pedido, rascunho: null });
      if ('erro' in r) setErroComparacao(r.erro);
      else if (r.aviso) setErroComparacao(r.aviso);
      else {
        setFaseComparacao('pensando');
        setComparacao((c) => ({ id: r.id, vez: (c?.vez ?? 0) + 1 }));
      }
    });
  };

  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (ocupado) return;
    setErroRascunho(null);
    let rascunho: PedidoTeste['rascunho'] = null;
    if (aberta !== null) {
      const f = document.getElementById(ID_FORM_ORIENTACAO);
      if (!(f instanceof HTMLFormElement)) {
        setErroRascunho('O formulário da orientação não carregou. Recarregue a página.');
        return;
      }
      const r = lerRascunho(new FormData(f), idOrientacao);
      if (!r.ok) {
        setErroRascunho(`Complete o rascunho para testar: ${r.erro}`);
        focarCampo(f, r.campo);
        return;
      }
      rascunho = r.rascunho;
    }
    enviar({ mensagem, clienteId: empresa, rascunho });
  };

  // Um teste por pessoa: repetir também espera o que está em andamento.
  const repetir = () => {
    if (ultimo && !ocupado) enviar(ultimo);
  };

  return (
    <section aria-label="Simulador" className="flex min-h-0 flex-col bg-background max-lg:border-t max-lg:border-border lg:w-simulador-treinar lg:shrink-0 lg:border-l lg:border-border">
      <div className="flex flex-col gap-2 border-b border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-brand">
            <MessageCircle aria-hidden size={16} strokeWidth={1.75} />
            Simulador
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
            <Pencil aria-hidden size={14} strokeWidth={1.75} />
            {rotuloSimulador({ aberta, alterado: doRascunho.alterado })}
          </span>
        </div>
        <FormField id={`${id}-empresa`} rotulo="Como cliente de" ajuda={avisoEmpresas ? <span className="text-warning">{avisoEmpresas}</span> : undefined}>
          <EscolherEmpresa
            // Acompanhando o rascunho, a busca recomeça quando a empresa dele muda; escolhida à mão, fica.
            key={escolha.manual ? `m-${versaoEmpresa}` : `r-${empresa ?? ''}`}
            name="empresa_teste"
            empresas={empresas}
            inicial={empresa}
            placeholder="Sem empresa (número desconhecido)"
            aoMudar={(v) => setEscolha({ manual: true, id: v || null })}
          />
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck aria-hidden size={14} strokeWidth={1.75} className="shrink-0" />
            Nada é enviado ao cliente nem gravado em demanda.
          </p>
          {empresa && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setEscolha({ manual: true, id: null }); setVersaoEmpresa((v) => v + 1); }}>
              Testar sem empresa
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {!teste && !erro && (
          <p className="m-auto max-w-xs text-center text-sm text-muted">
            Escreva uma mensagem como o cliente escreveria e toque em Testar. A resposta aparece aqui, sem enviar nada.
          </p>
        )}
        {erro && (
          <div className="flex flex-col items-start gap-2">
            <AvisoErro erro={erro} />
            {ultimo && (
              <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={repetir}>
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
            // Teste retomado (aviso): a linha mostrada é a do teste antigo, não a deste rascunho (D7).
            rascunho={teste.aviso ? null : teste.pedido.rascunho}
            aoMudarFase={setFase}
            tentarDeNovo={repetir}
            rodape={teste.podeComparar
              ? <SemORascunho comparacao={comparacao} ocupado={ocupado} erro={erroComparacao} comparar={comparar} aoMudarFase={setFaseComparacao} />
              : null}
          />
        )}
      </div>

      <form onSubmit={aoEnviar} className="flex flex-col gap-2 border-t border-border bg-surface p-4">
        {erroRascunho && <p role="alert" className="text-sm text-danger">{erroRascunho}</p>}
        <label htmlFor={`${id}-mensagem`} className="sr-only">Mensagem do cliente</label>
        <div className="relative">
          <Textarea
            id={`${id}-mensagem`}
            name="mensagem"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            maxLength={LIMITE_MENSAGEM_TESTE}
            rows={2}
            required
            placeholder="Escreva como o cliente escreveria…"
            className="pr-20"
          />
          <span aria-hidden className="pointer-events-none absolute top-2 right-3 tabular text-xs text-muted">
            {mensagem.length.toLocaleString('pt-BR')} / {LIMITE_MENSAGEM_TESTE.toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">Um teste por vez · conta em Gastos com IA</p>
          <Button type="submit" disabled={ocupado} aria-busy={enviando || undefined}>
            {enviando ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" /> : <Send aria-hidden size={16} strokeWidth={1.75} />}
            Testar
          </Button>
        </div>
      </form>
    </section>
  );
}
