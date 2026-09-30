import { Sparkles } from 'lucide-react';
import { BlingExportButton } from '@/components/patterns/bling-export-button';
import { DiffPreview } from '@/components/patterns/diff-preview';
import { EmptyState } from '@/components/patterns/empty-state';
import { MessageBubble } from '@/components/patterns/message-bubble';
import { TextoFormatado } from '@/components/patterns/texto-formatado';
import { cn } from '@/lib/cn';
import { linhaDoTempo } from '@/lib/historico';
import { interpretarPrevias } from '@/lib/previa-pedido';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { blocosDoTexto } from '@/lib/texto-assistente';
import { Realce } from '../atendimento/realce';
import { perguntarAoAssistente } from './acoes';
import { CompositorAssistente, ProvedorAssistente, Sugestoes } from './compositor-assistente';
import { HistoricoRolante } from '@/components/patterns/historico-rolante';

type ArquivoCsv = { tipo: string; chamados: string[]; nome: string; partes?: number };

const VAZIO = 'Pergunte sobre demandas, pedidos, vendas ou peça para corrigir um pedido e gerar o CSV do Bling.';
const SUGESTOES_GERAL = ['Quais pedidos de nota estão em aberto?', 'Quanto vendemos neste mês?', 'Quais demandas estão aguardando o cliente?'];
const SUGESTOES_CONVERSA = ['Faça um resumo desta conversa', 'O que o cliente está pedindo?', 'Há pedido de nota nesta conversa?'];

const formatar = (t: string) => <TextoFormatado texto={t} />;

/** Resposta com tabela ou prévia antes/depois ocupa a largura toda; texto curto fica no balão. */
function respostaLarga(texto: string) {
  return Boolean(interpretarPrevias(texto)) || blocosDoTexto(texto).some((b) => b.tipo === 'tabela');
}

/**
 * Conversa com o assistente: na tela própria (conversaId null = "Geral", ou uma conversa de atendimento aberta pelo
 * histórico) ou compacta, na aba Assistente dentro do atendimento. O mesmo visual nos dois lugares.
 * `podeCsv`: o link do CSV do Bling só aparece para quem pode gerá-lo (emitir_notas; o administrador sempre pode).
 */
export async function ConversaAssistente({ usuarioId, conversaId, podeCsv, compacta = false }: { usuarioId: string; conversaId: string | null; podeCsv: boolean; compacta?: boolean }) {
  const sb = await supabaseServidor();
  let q = sb.from('assistente_mensagens').select('id, papel, conteudo, arquivo, processada_em, criado_em').eq('usuario_id', usuarioId).eq('canal', 'site');
  q = conversaId ? q.eq('conversa_id', conversaId) : q.is('conversa_id', null);
  const { data } = await q.order('criado_em', { ascending: false }).limit(compacta ? 20 : 60);
  const mensagens = (data ?? []).reverse();
  const pensando = mensagens.some((m) => m.papel === 'usuario' && !m.processada_em);
  const linhas = linhaDoTempo(mensagens);
  const texto = compacta ? 'text-sm' : 'text-base';

  return (
    <ProvedorAssistente>
      <div className={cn('flex min-h-0 flex-1 flex-col gap-3', compacta && 'min-h-80 max-lg:max-h-128')}>
        <Realce chave={`assistente-${conversaId ?? 'geral'}`} lembrar={false} className="flex min-h-0 flex-1 flex-col">
          <HistoricoRolante
            como="ul"
            compositor="[data-compositor-assistente]"
            testId="mensagens-assistente"
            className="flex min-h-0 flex-1 flex-col"
            rotulo="Conversa com o assistente"
            ultima={`${mensagens.at(-1)?.id ?? ''}-${pensando}`}
            classNameLista={cn('flex min-h-0 flex-1 flex-col gap-3 focus-visible:outline-2 focus-visible:outline-ring', compacta ? 'pr-1' : 'px-1 py-2')}
          >
            {linhas.map((l) => {
              if (l.tipo === 'dia') {
                return (
                  <li key={l.chave} className="flex items-center gap-3 text-xs font-medium text-subtle">
                    <span aria-hidden className="h-px flex-1 bg-border" />
                    {l.rotulo}
                    <span aria-hidden className="h-px flex-1 bg-border" />
                  </li>
                );
              }
              const m = l.item;
              if (m.papel === 'usuario') {
                return (
                  <li key={l.chave} data-realce={m.criado_em} data-realce-proprio="" className="flex flex-col rounded-lg">
                    <MessageBubble autor="pessoa" hora={m.criado_em} conteudo={m.conteudo} className={cn(texto, compacta && 'max-w-5/6')} />
                  </li>
                );
              }
              const arquivo = podeCsv ? (m.arquivo as ArquivoCsv | null) : null;
              const partes = arquivo?.tipo === 'csv_bling' ? Math.max(1, arquivo.partes ?? 1) : 0;
              return (
                <li key={l.chave} data-realce={m.criado_em} className="flex flex-col rounded-lg">
                  <MessageBubble
                    autor="assistente"
                    hora={m.criado_em}
                    className={cn(texto, (compacta || respostaLarga(m.conteudo)) && 'w-full max-w-full')}
                  >
                    <DiffPreview texto={m.conteudo} formatarTexto={formatar} />
                    {partes > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {Array.from({ length: partes }, (_, i) => (
                          <BlingExportButton
                            key={i}
                            href={`/api/csv-bling?assistente=${m.id}&parte=${i + 1}`}
                            rotulo={partes === 1 ? 'Baixar CSV Bling' : `Baixar CSV Bling (parte ${i + 1})`}
                          />
                        ))}
                      </div>
                    )}
                  </MessageBubble>
                </li>
              );
            })}
            {pensando && (
              <li role="status" className="mr-auto flex items-center gap-2 rounded-lg bg-assistant-soft px-3 py-2 text-sm font-medium text-assistant">
                <Sparkles aria-hidden size={16} strokeWidth={1.75} className="shrink-0 animate-pulse" />
                Pensando…
              </li>
            )}
            {mensagens.length === 0 && (
              <li className="my-auto">
                <EmptyState
                  icone={Sparkles}
                  titulo={conversaId ? 'Pergunte sobre esta conversa' : 'Como posso ajudar?'}
                  descricao={VAZIO}
                  acao={<Sugestoes itens={conversaId ? SUGESTOES_CONVERSA : SUGESTOES_GERAL} />}
                  className={compacta ? 'py-6' : undefined}
                />
              </li>
            )}
          </HistoricoRolante>
        </Realce>
        <CompositorAssistente acao={perguntarAoAssistente.bind(null, conversaId)} compacta={compacta} />
      </div>
    </ProvedorAssistente>
  );
}
