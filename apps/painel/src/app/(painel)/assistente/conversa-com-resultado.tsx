import type { ReactNode } from 'react';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { Skeleton } from '@/components/ui/skeleton';
import { temNivel } from '@/lib/permissoes';
import { escolherResultado, lerConversa } from '@/lib/resultados-assistente';
import type { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { perguntarAoAssistente } from './acoes';
import { ChatAssistente } from './chat-assistente';
import { CompositorAssistente, Sugestoes } from './compositor-assistente';
import { lerMensagensAssistente } from './dados-assistente';
import { PainelResultado } from './painel-resultado';

type Usuario = Awaited<ReturnType<typeof obterUsuario>>;

export const COLUNA_CHAT = 'flex min-w-0 flex-col bg-surface max-lg:altura-trabalho lg:w-chat-assistente lg:shrink-0 lg:border-r lg:border-border';
const SUGESTOES_GERAL = ['Quais pedidos de nota estão em aberto?', 'Quanto vendemos neste mês?', 'Quais demandas estão aguardando o cliente?'];
const SUGESTOES_CONVERSA = ['Faça um resumo desta conversa', 'O que o cliente está pedindo?', 'Há pedido de nota nesta conversa?'];

/** As duas colunas da tela: a conversa enxuta e o painel de resultado, das mesmas mensagens (uma leitura só). */
export async function ConversaComResultado({ usuario, conversaId, chave, cabecalho, erro }: {
  usuario: Usuario; conversaId: string | null; chave: string | null; cabecalho: ReactNode; erro?: string;
}) {
  const sb = await supabaseServidor();
  // O CSV só para quem pode gerá-lo (emitir_notas; o administrador sempre pode), como antes.
  const podeCsv = temNivel(usuario, 'notas', 'corrigir');
  const mensagens = await lerMensagensAssistente(sb, usuario.id, conversaId);
  const leitura = lerConversa(mensagens, podeCsv);
  const selecionado = escolherResultado(leitura, chave);
  return (
    <>
      <section aria-labelledby="titulo-assistente" className={COLUNA_CHAT}>
        {cabecalho}
        <div className="px-4 empty:hidden"><AvisoErro erro={erro} limparDaUrl /></div>
        <ChatAssistente mensagens={mensagens} respostas={leitura.respostas} conversaId={conversaId} selecionada={selecionado?.chave ?? null} />
        <div className="flex flex-col gap-2 border-t border-border p-4">
          <Sugestoes itens={conversaId ? SUGESTOES_CONVERSA : SUGESTOES_GERAL} className="justify-start" />
          <CompositorAssistente acao={perguntarAoAssistente.bind(null, conversaId)} />
        </div>
      </section>
      <PainelResultado leitura={leitura} selecionado={selecionado} conversaId={conversaId} />
    </>
  );
}

export function EsqueletoTela({ cabecalho }: { cabecalho: ReactNode }) {
  return (
    <>
      <section aria-labelledby="titulo-assistente" className={COLUNA_CHAT}>
        {cabecalho}
        <div aria-hidden className="flex flex-1 flex-col gap-3 bg-background p-4">
          <Skeleton className="ml-auto h-10 w-1/2 rounded-lg" />
          <Skeleton className="h-20 w-3/4 rounded-lg" />
          <Skeleton className="ml-auto h-10 w-2/5 rounded-lg" />
          <Skeleton className="mt-auto h-24 w-full rounded-lg" />
        </div>
      </section>
      <div aria-hidden className="flex flex-1 flex-col gap-4 bg-background p-6">
        <Skeleton className="h-10 w-2/3 rounded-md" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </>
  );
}
