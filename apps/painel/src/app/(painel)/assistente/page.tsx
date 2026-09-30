import { ExternalLink, MessagesSquare, SearchX, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { EmptyState } from '@/components/patterns/empty-state';
import { RelativeTime } from '@/components/patterns/relative-time';
import { variantesBotao } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { agruparConversasAssistente, lerConversaAssistente, LIMITE_CONVERSAS_HISTORICO, LIMITE_MENSAGENS_HISTORICO } from '@/lib/conversas-assistente';
import { mascararTelefone } from '@/lib/formatos';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { AvisoErro } from './aviso-erro';
import { ConversaAssistente } from './conversa-assistente';

type ConversaVisivel = { id: string; telefone: string; contato: string | null; empresa: string | null };

function EsqueletoConversa() {
  return (
    <div aria-hidden className="flex flex-1 flex-col gap-3 py-2">
      <Skeleton className="ml-auto h-10 w-1/2 rounded-lg" />
      <Skeleton className="h-24 w-3/4 rounded-lg" />
      <Skeleton className="ml-auto h-10 w-2/5 rounded-lg" />
      <Skeleton className="h-16 w-2/3 rounded-lg" />
      <Skeleton className="mt-auto h-24 w-full rounded-lg" />
    </div>
  );
}

function ItemHistorico({ href, ativo, icone: Icone, titulo, detalhe, texto, quando }: {
  href: string;
  ativo: boolean;
  icone: typeof Sparkles;
  titulo: string;
  detalhe?: string | null;
  texto: string;
  quando: string | null;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={ativo ? 'page' : undefined}
        scroll={false}
        className={cn(
          'flex gap-2.5 border-l-2 px-3 py-2.5 transition-colors duration-150 ease-out focus-visible:-outline-offset-2',
          ativo ? 'border-l-assistant bg-assistant-soft' : 'border-l-transparent hover:bg-surface-muted',
        )}
      >
        <Icone aria-hidden size={16} strokeWidth={1.75} className={cn('mt-0.5 shrink-0', ativo ? 'text-assistant' : 'text-muted')} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium text-foreground">{titulo}</span>
            {quando && <RelativeTime data={quando} className="shrink-0 text-xs text-subtle" />}
          </span>
          {detalhe && <span className="truncate text-sm text-muted">{detalhe}</span>}
          <span className="line-clamp-1 text-sm text-subtle">{texto}</span>
        </span>
      </Link>
    </li>
  );
}

export default async function Assistente({ searchParams }: { searchParams: Promise<{ erro?: string; conversa?: string | string[] }> }) {
  const u = await obterUsuario();
  if (!u.permissoes.includes('assistente_site')) redirect('/inicio');
  const sp = await searchParams;
  const conversaId = lerConversaAssistente(sp.conversa);
  const sb = await supabaseServidor();

  // Histórico (só leitura, RLS: só as mensagens da própria pessoa): a "Geral" e as conversas feitas dentro de atendimentos.
  const [{ data: ultimaGeral }, { data: doHistorico }] = await Promise.all([
    sb.from('assistente_mensagens').select('criado_em').eq('usuario_id', u.id).eq('canal', 'site').is('conversa_id', null)
      .order('criado_em', { ascending: false }).limit(1).maybeSingle(),
    sb.from('assistente_mensagens').select('conversa_id, criado_em').eq('usuario_id', u.id).eq('canal', 'site').not('conversa_id', 'is', null)
      .order('criado_em', { ascending: false }).limit(LIMITE_MENSAGENS_HISTORICO),
  ]);
  // Lê o dobro das conversas mostradas: as que o RLS esconde saem antes do limite da coluna.
  const lidas = agruparConversasAssistente(doHistorico ?? [], LIMITE_CONVERSAS_HISTORICO * 2);
  const ids = [...new Set([...lidas.map((g) => g.conversaId), ...(conversaId ? [conversaId] : [])])];
  // Só as conversas que a pessoa ainda pode ver (RLS de conversas).
  const { data: conversas } = ids.length
    ? await sb.from('conversas').select('id, telefone, contatos(nome), clientes:cliente_em_foco(razao_social, nome_fantasia)').in('id', ids)
    : { data: [] };
  const visiveis = new Map<string, ConversaVisivel>((conversas ?? []).map((c) => [c.id, {
    id: c.id, telefone: c.telefone, contato: c.contatos?.nome ?? null,
    empresa: c.clientes ? c.clientes.nome_fantasia ?? c.clientes.razao_social : null,
  }]));
  const nomeDe = (c: ConversaVisivel) => c.contato ?? mascararTelefone(c.telefone);
  const aberta = conversaId ? visiveis.get(conversaId) ?? null : null;
  const grupos = lidas.filter((g) => visiveis.has(g.conversaId)).slice(0, LIMITE_CONVERSAS_HISTORICO);

  return (
    <div className="-m-6 flex flex-col lg:altura-trabalho lg:flex-row">
      <AtualizarAoVivo assistenteDe={u.id} />
      <section aria-labelledby="titulo-assistente" className="relative flex min-w-0 flex-col max-lg:altura-trabalho lg:flex-1">
        <div className="mx-auto flex min-h-0 w-full max-w-leitura flex-1 flex-col gap-3 px-4 py-4">
          <header className="flex flex-col gap-1">
            <h1 id="titulo-assistente" className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Sparkles aria-hidden size={20} strokeWidth={1.75} className="text-assistant" />
              Assistente
            </h1>
            {aberta ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 text-sm text-muted">
                  Sobre a conversa com <span className="font-medium text-foreground">{nomeDe(aberta)}</span>
                  {aberta.empresa && <> · {aberta.empresa}</>}. O assistente conhece este cliente e as demandas desta conversa.
                </p>
                <Link href={`/atendimento/${aberta.id}`} className={variantesBotao({ variant: 'outline', size: 'sm' })}>
                  <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
                  Abrir no Atendimento
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Consulte demandas, pedidos e vendas, corrija pedidos de nota e gere o CSV do Bling. Antes de gravar qualquer alteração, o assistente mostra o antes e o depois e pede sua confirmação.
              </p>
            )}
          </header>
          <AvisoErro erro={sp.erro} />
          {conversaId && !aberta ? (
            <EmptyState
              icone={SearchX}
              titulo="Conversa não encontrada"
              descricao="Ela pode ter sido apagada ou não estar mais nos seus setores."
              acao={<Link href="/assistente" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Voltar para a Geral</Link>}
              className="my-auto"
            />
          ) : (
            <Suspense key={conversaId ?? 'geral'} fallback={<EsqueletoConversa />}>
              <ConversaAssistente usuarioId={u.id} conversaId={conversaId} podeCsv={temPermissao(u, 'emitir_notas')} />
            </Suspense>
          )}
        </div>
      </section>
      <aside aria-label="Histórico do assistente" className="relative flex max-h-64 flex-col border-t border-border bg-surface lg:order-first lg:max-h-none lg:w-72 lg:shrink-0 lg:border-t-0 lg:border-r">
        <h2 id="titulo-historico" className="border-b border-border px-3 py-2.5 text-sm font-semibold text-foreground">Conversas</h2>
        <nav aria-labelledby="titulo-historico" className="relative min-h-0 flex-1 overflow-y-auto">
          <ul className="divide-y divide-border">
            <ItemHistorico
              href="/assistente"
              ativo={!conversaId}
              icone={Sparkles}
              titulo="Geral"
              texto="Suas perguntas pela tela Assistente"
              quando={ultimaGeral?.criado_em ?? null}
            />
            {grupos.flatMap((g) => {
              const c = visiveis.get(g.conversaId);
              if (!c) return [];
              return [(
                <ItemHistorico
                  key={g.conversaId}
                  href={`/assistente?conversa=${g.conversaId}`}
                  ativo={g.conversaId === conversaId}
                  icone={MessagesSquare}
                  titulo={nomeDe(c)}
                  detalhe={c.empresa ?? 'Empresa não definida'}
                  texto={g.mensagens === 1 ? '1 mensagem recente' : `${g.mensagens} mensagens recentes`}
                  quando={g.ultimaEm}
                />
              )];
            })}
          </ul>
          {grupos.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted">As conversas com o assistente dentro de um atendimento também aparecem aqui.</p>
          )}
        </nav>
      </aside>
    </div>
  );
}
