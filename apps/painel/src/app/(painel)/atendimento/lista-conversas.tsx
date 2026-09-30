import { Inbox, SearchX } from 'lucide-react';
import Link from 'next/link';
import { AgentStateIndicator, type EstadoAgente } from '@/components/patterns/agent-state-indicator';
import { estadoDaConversa } from '@/components/patterns/estado-agente';
import { BotaoTentarDeNovo } from '@/components/patterns/data-table-cliente';
import { EmptyState } from '@/components/patterns/empty-state';
import { RelativeTime } from '@/components/patterns/relative-time';
import { StatusBadge } from '@/components/patterns/status-badge';
import { interpretarBusca } from '@/lib/busca';
import { lerAgentePausado } from '@/lib/contadores';
import { consultaCaixa, ordenarCaixa, passaNoFiltro, rotuloFiltroCaixa, type FiltroCaixa } from '@/lib/caixa';
import { cn } from '@/lib/cn';
import { mascararTelefone } from '@/lib/formatos';
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { FiltrosCaixa } from './filtros-caixa';
import { Realce } from './realce';

/**
 * Coluna da esquerda do Atendimento (320px), usada na lista (/atendimento) e ao lado da conversa aberta
 * (/atendimento/[id]). Lê a view caixa_entrada pelo cliente do usuário (RLS): filtro e busca vão na consulta,
 * antes do limite, senão conversas antigas somem de "Comigo" e "Do meu setor".
 * `filtroNaUrl`/`q`: o que veio na URL, repassado aos links para a lista não mudar ao abrir outra conversa.
 */
export async function ListaConversas({
  u,
  filtro,
  filtroNaUrl,
  q,
  caminho,
  selecionada,
  titulo,
  pausaGeral: pausaPronta,
  nomes: nomesProntos,
  className,
}: {
  u: UsuarioPainel;
  filtro: FiltroCaixa;
  filtroNaUrl: string | null;
  q: string;
  caminho: string;
  selecionada?: string;
  /** Na lista, o título da página (h1); ao lado da conversa, um título de seção (h2). */
  titulo: 'h1' | 'h2';
  /** configuracoes.agente_pausado (null quando o RLS não deixa ler): vale para toda conversa não assumida. Sem valor, a lista lê. */
  pausaGeral?: boolean | null;
  /** Nomes da equipe já lidos pela página (evita ler usuarios duas vezes). */
  nomes?: Map<string, string>;
  className?: string;
}) {
  const sb = await supabaseServidor();
  let consulta = sb.from('caixa_entrada').select('*');
  if (filtro === 'minhas') consulta = consulta.eq('atendente_id', u.id);
  else if (filtro === 'setor') consulta = consulta.overlaps('setores_abertos', u.setores.length ? u.setores : ['00000000-0000-0000-0000-000000000000']);
  else if (filtro === 'sem_responsavel') consulta = consulta.eq('sem_responsavel', true);
  else if (filtro === 'aguardando') consulta = consulta.eq('aguardando_cliente', true);
  else if (filtro === 'agente') consulta = consulta.eq('estado', 'agente').eq('sem_responsavel', false);
  else if (filtro === 'concluidas') consulta = consulta.eq('estado', 'agente').eq('chamados_abertos', 0);
  const busca = interpretarBusca(q);
  if (busca) {
    consulta = consulta.or(`nome_contato.ilike.%${busca.termo}%,empresa.ilike.%${busca.termo}%,telefone.ilike.%${busca.digitos || busca.termo}%`);
  }
  const [{ data, error }, { data: pessoas }, pausaGeral] = await Promise.all([
    consulta.order('ultima_em', { ascending: false, nullsFirst: false }).limit(200),
    nomesProntos ? Promise.resolve({ data: null }) : sb.from('usuarios').select('id, nome'),
    pausaPronta !== undefined ? Promise.resolve(pausaPronta) : lerAgentePausado(sb),
  ]);
  const nomes = nomesProntos ?? new Map((pessoas ?? []).map((p) => [p.id, p.nome]));
  const linhas = ordenarCaixa((data ?? []).filter((l) => passaNoFiltro({
    id: l.id!, atendente_id: l.atendente_id, setores_abertos: l.setores_abertos ?? [],
    sem_responsavel: Boolean(l.sem_responsavel), aguardando_cliente: Boolean(l.aguardando_cliente),
    estado: l.estado, chamados_abertos: l.chamados_abertos,
  }, filtro, u)));
  const sufixo = consultaCaixa({ filtro: filtroNaUrl, q });
  const Titulo = titulo;

  return (
    <section aria-labelledby="titulo-lista-conversas" className={cn('flex min-h-0 flex-col bg-surface', className)}>
      <div className="flex flex-col gap-3 border-b border-border p-3">
        <div className="flex items-baseline justify-between gap-2">
          <Titulo id="titulo-lista-conversas" className={cn('font-semibold text-foreground', titulo === 'h1' ? 'text-xl' : 'text-lg')}>
            {titulo === 'h1' ? 'Atendimento' : 'Conversas'}
          </Titulo>
          {!error && (
            <p aria-live="polite" className="tabular text-xs text-subtle">
              {linhas.length === 1 ? '1 conversa' : `${linhas.length} conversas`}
            </p>
          )}
        </div>
        <FiltrosCaixa caminho={caminho} filtro={filtro} q={q} />
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <EmptyState
            titulo="Não consegui carregar as conversas."
            descricao="Verifique a conexão e tente de novo."
            acao={<BotaoTentarDeNovo />}
          />
        ) : linhas.length === 0 ? (
          busca ? (
            <EmptyState icone={SearchX} titulo="Nenhuma conversa encontrada." descricao={`Nada para “${q.trim()}” em “${rotuloFiltroCaixa(filtro)}”.`}
              acao={<Link href={`${caminho}${consultaCaixa({ filtro: filtroNaUrl })}`} className="text-sm font-medium text-brand underline-offset-4 hover:underline">Limpar busca</Link>} />
          ) : (
            <EmptyState icone={Inbox} titulo="Nenhuma conversa neste filtro." descricao={`Filtro atual: ${rotuloFiltroCaixa(filtro)}.`}
              acao={filtro !== 'todas' ? <Link href={`${caminho}${consultaCaixa({ filtro: 'todas', q })}`} className="text-sm font-medium text-brand underline-offset-4 hover:underline">Ver todas</Link> : undefined} />
          )
        ) : (
          <Realce chave="lista-conversas">
          <ul className="divide-y divide-border">
            {linhas.map((l) => {
              const ativa = l.id === selecionada;
              const aguardando = Boolean(l.sem_responsavel);
              // A view não traz a pausa do contato nem da empresa: aqui só assumida, pausa geral ou ativo.
              const estado: EstadoAgente = estadoDaConversa({
                assumidaPor: l.estado === 'humano' ? (l.atendente_id && nomes.get(l.atendente_id)) || 'equipe' : null,
                pausaGeral,
              });
              const nome = l.nome_contato && l.nome_contato !== l.telefone ? l.nome_contato : mascararTelefone(l.telefone ?? '');
              return (
                <li key={l.id}>
                  <Link
                    href={`/atendimento/${l.id}${sufixo}`}
                    data-conversa-item=""
                    data-realce={l.ultima_em ?? undefined}
                    aria-current={ativa ? 'page' : undefined}
                    scroll={false}
                    className={cn(
                      'relative flex flex-col gap-1 border-l-2 px-3 py-2.5 transition-colors duration-150 ease-out',
                      ativa ? 'border-l-brand bg-brand-soft' : aguardando ? 'border-l-warning bg-warning-soft/40 hover:bg-warning-soft' : 'border-l-transparent hover:bg-surface-muted',
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-foreground">{nome}</span>
                      {l.ultima_em && <RelativeTime data={l.ultima_em} className="shrink-0 text-xs text-subtle" />}
                    </span>
                    <span className="truncate text-sm text-muted">{l.empresa ?? 'Empresa não definida'}</span>
                    <span className="line-clamp-1 text-sm text-subtle">{l.ultima_mensagem ?? (l.ultima_em ? 'Anexo ou áudio' : 'Sem mensagens')}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                      {aguardando && <StatusBadge tipo="conversa" status="aguardando_atendente" />}
                      <AgentStateIndicator estado={estado} className="h-5 px-1.5" />
                      {l.aguardando_cliente && <StatusBadge tipo="demanda" status="aguardando_cliente" />}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          </Realce>
        )}
      </div>
    </section>
  );
}
