import { ExternalLink, SearchX } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { EmptyState } from '@/components/patterns/empty-state';
import { variantesBotao } from '@/components/ui/button';
import { lerConversaAssistente } from '@/lib/conversas-assistente';
import { usaAssistente } from '@/lib/permissoes';
import { lerChaveResultado } from '@/lib/resultados-assistente';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { ProvedorAssistente } from './compositor-assistente';
import { COLUNA_CHAT, ConversaComResultado, EsqueletoTela } from './conversa-com-resultado';
import { lerHistoricoAssistente } from './dados-assistente';
import { HistoricoEmBotoes } from './historico-em-botoes';
import { Hidratado } from './hidratado';

/**
 * Assistente, Opção B "Conversa + resultado" (spec 7C.3): conversa enxuta à esquerda, resultado com abas à direita.
 * As regras do assistente não mudam: a tela só lê as mensagens e a pergunta continua indo por perguntarAoAssistente.
 */
export default async function Assistente({ searchParams }: { searchParams: Promise<{ erro?: string; conversa?: string | string[]; resultado?: string | string[] }> }) {
  const u = await obterUsuario();
  if (!usaAssistente(u)) redirect('/inicio');
  const sp = await searchParams;
  const conversaId = lerConversaAssistente(sp.conversa);
  const chave = lerChaveResultado(sp.resultado);
  const sb = await supabaseServidor();
  const historico = await lerHistoricoAssistente(sb, u.id, conversaId);
  const aberta = historico.aberta;

  const cabecalho = (
    <header className="flex flex-col gap-3 border-b border-border px-4 pb-3 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 id="titulo-assistente" className="min-w-0 truncate text-2xl font-light text-foreground">
          Assistente · <span className="font-extrabold text-brand">{aberta ? aberta.nome : 'Geral'}</span>
        </h1>
        {aberta && (
          <Link href={`/atendimento/${aberta.id}`} className={variantesBotao({ variant: 'outline', size: 'sm' })}>
            <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
            Abrir no Atendimento
          </Link>
        )}
      </div>
      {aberta && (
        <p className="text-sm text-muted">{aberta.empresa ? `${aberta.empresa} · ` : ''}O assistente conhece este cliente e as demandas desta conversa.</p>
      )}
      <HistoricoEmBotoes conversaId={conversaId} ultimaGeral={historico.ultimaGeral} conversas={historico.conversas} aberta={aberta} />
    </header>
  );

  return (
    <ProvedorAssistente>
      <div className="-m-6 flex flex-col lg:altura-trabalho lg:flex-row">
        <AtualizarAoVivo assistenteDe={u.id} />
        <Hidratado />
        {conversaId && !aberta ? (
          <section aria-labelledby="titulo-assistente" className={COLUNA_CHAT}>
            {cabecalho}
            <div className="px-4"><AvisoErro erro={sp.erro} limparDaUrl /></div>
            <EmptyState
              icone={SearchX}
              titulo="Conversa não encontrada"
              descricao="Ela pode ter sido apagada ou não estar mais nos seus setores."
              acao={<Link href="/assistente" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Voltar para a Geral</Link>}
              className="my-auto"
            />
          </section>
        ) : (
          <Suspense key={conversaId ?? 'geral'} fallback={<EsqueletoTela cabecalho={cabecalho} />}>
            <ConversaComResultado usuario={u} conversaId={conversaId} chave={chave} cabecalho={cabecalho} erro={sp.erro} />
          </Suspense>
        )}
      </div>
    </ProvedorAssistente>
  );
}
