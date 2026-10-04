import { Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { HistoricoRolante } from '@/components/patterns/historico-rolante';
import { MessageBubble } from '@/components/patterns/message-bubble';
import { TextoFormatado } from '@/components/patterns/texto-formatado';
import { linhaDoTempo } from '@/lib/historico';
import { hrefResultado, type MensagemTela, type Pedaco } from '@/lib/resultados-assistente';
import { Realce } from '../atendimento/realce';
import { CartaoResultado } from './cartao-resultado';

const VAZIO = 'Pergunte sobre demandas, pedidos, vendas ou peça para corrigir um pedido e gerar o CSV do Bling.';

/**
 * Conversa enxuta da tela do Assistente (spec 7C.3): a resposta mostra só o texto em volta; prévia, tabela e arquivo
 * viram cartões VER AO LADO (D8). Mesma rolagem, realce e "Pensando…" de antes.
 */
export function ChatAssistente({ mensagens, respostas, conversaId, selecionada }: {
  mensagens: MensagemTela[]; respostas: Map<string, Pedaco[]>; conversaId: string | null; selecionada: string | null;
}) {
  const pensando = mensagens.some((m) => m.papel === 'usuario' && !m.processada_em);
  const linhas = linhaDoTempo(mensagens);
  return (
    <Realce chave={`assistente-${conversaId ?? 'geral'}`} lembrar={false} className="flex min-h-0 flex-1 flex-col">
      <HistoricoRolante
        como="ul"
        compositor="[data-compositor-assistente]"
        testId="mensagens-assistente"
        className="flex min-h-0 flex-1 flex-col"
        rotulo="Conversa com o assistente"
        ultima={`${mensagens.at(-1)?.id ?? ''}-${pensando}`}
        classNameLista="flex min-h-0 flex-1 flex-col gap-3 bg-background px-4 py-4 focus-visible:outline-2 focus-visible:outline-ring"
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
                <MessageBubble autor="pessoa" hora={m.criado_em} conteudo={m.conteudo} />
              </li>
            );
          }
          const pedacos = respostas.get(m.id) ?? [{ tipo: 'texto' as const, texto: m.conteudo }];
          return (
            <li key={l.chave} data-realce={m.criado_em} className="flex flex-col rounded-lg">
              <MessageBubble autor="assistente" hora={m.criado_em}>
                <div className="flex flex-col gap-2">
                  {pedacos.map((p, i) => (p.tipo === 'texto'
                    ? <TextoFormatado key={i} texto={p.texto} />
                    : <CartaoResultado key={i} cartao={p.cartao} href={hrefResultado(conversaId, p.cartao.chave)} ativo={p.cartao.chave === selecionada} />))}
                </div>
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
            <EmptyState icone={Sparkles} titulo={conversaId ? 'Pergunte sobre esta conversa' : 'Como posso ajudar?'} descricao={VAZIO} />
          </li>
        )}
      </HistoricoRolante>
    </Realce>
  );
}
