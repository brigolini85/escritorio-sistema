import { Inbox, SearchX } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BotaoTentarDeNovo } from '@/components/patterns/data-table-cliente';
import { EmptyState } from '@/components/patterns/empty-state';
import { agruparConversas, juntarSemRepetir, lerLimites, type LinhaAtendimento } from '@/lib/atendimento';
import { interpretarBusca } from '@/lib/busca';
import { lerAgentePausado } from '@/lib/leituras-admin';
import { COLUNAS_CAIXA, consultaCaixa, filtroPadrao, LINHAS_POR_PAGINA_CAIXA, MAX_PAGINAS_CAIXA, passaNoFiltro, rotuloFiltroCaixa, type FiltroCaixa } from '@/lib/caixa';
import { cn } from '@/lib/cn';
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { FiltrosCaixa } from './filtros-caixa';
import { ItemConversa } from './item-conversa';
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
  paginas = 1,
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
  /** Revisão geral (painel I5): quantas páginas de 200 mostrar ("Carregar mais", ?mais=N). */
  paginas?: number;
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
  const busca = interpretarBusca(q);
  const limite = LINHAS_POR_PAGINA_CAIXA * paginas;
  // A mesma consulta (filtro e busca) para a lista e para quem está esperando.
  const montar = () => {
    let consulta = sb.from('caixa_entrada').select(COLUNAS_CAIXA);
    if (filtro === 'minhas') consulta = consulta.eq('atendente_id', u.id);
    else if (filtro === 'setor') consulta = consulta.overlaps('setores_abertos', u.setores.length ? u.setores : ['00000000-0000-0000-0000-000000000000']);
    else if (filtro === 'sem_responsavel') consulta = consulta.eq('sem_responsavel', true);
    else if (filtro === 'aguardando') consulta = consulta.eq('aguardando_cliente', true);
    else if (filtro === 'agente') consulta = consulta.eq('estado', 'agente').eq('sem_responsavel', false);
    else if (filtro === 'concluidas') consulta = consulta.eq('estado', 'agente').eq('chamados_abertos', 0);
    if (busca) {
      consulta = consulta.or(`nome_contato.ilike.%${busca.termo}%,empresa.ilike.%${busca.termo}%,telefone.ilike.%${busca.digitos || busca.termo}%`);
    }
    return consulta;
  };
  const [{ data: recentes, error }, { data: esperandoAgora, error: erroEspera }, { data: pessoas }, pausaGeral, { data: limitesBrutos }] = await Promise.all([
    montar().order('ultima_em', { ascending: false, nullsFirst: false }).limit(limite),
    // Quem espera há mais tempo costuma ter a última mensagem antiga: lido à parte, nunca fica fora do limite da lista.
    montar().not('espera_desde', 'is', null).order('espera_desde', { ascending: true }).limit(limite),
    nomesProntos ? Promise.resolve({ data: null }) : sb.from('usuarios').select('id, nome'),
    pausaPronta !== undefined ? Promise.resolve(pausaPronta) : lerAgentePausado(sb),
    sb.rpc('limites_espera'),
  ]);
  const nomes = nomesProntos ?? new Map((pessoas ?? []).map((p) => [p.id, p.nome]));
  const data = error || erroEspera ? null : juntarSemRepetir(esperandoAgora ?? [], recentes ?? []);
  const linhas = (data ?? []).filter((l) => passaNoFiltro({
    id: l.id!, atendente_id: l.atendente_id, setores_abertos: l.setores_abertos ?? [],
    sem_responsavel: Boolean(l.sem_responsavel), aguardando_cliente: Boolean(l.aguardando_cliente),
    estado: l.estado, chamados_abertos: l.chamados_abertos,
  }, filtro, u));
  const sufixo = consultaCaixa({ filtro: filtroNaUrl, q, mais: paginas });
  // Revisão geral (painel I5): a lista chegou ao limite; há mais conversas antigas para carregar.
  const temMais = !error && (recentes?.length ?? 0) >= limite;
  const limites = lerLimites(limitesBrutos);
  const grupos = agruparConversas(linhas as unknown as LinhaAtendimento[], new Date());
  const esperandoVoce = linhas.filter((l) => l.esperando_voce).length;
  const estadoCtx = { usuarioId: u.id, nomes, pausaGeral };
  const item = (l: LinhaAtendimento) => (
    <li key={l.id}>
      <ItemConversa l={l} href={`/atendimento/${l.id}${sufixo}`} ativa={l.id === selecionada} limites={limites} estadoCtx={estadoCtx} />
    </li>
  );
  const Titulo = titulo;

  return (
    <section aria-labelledby="titulo-lista-conversas" className={cn('flex min-h-0 flex-col bg-surface', className)}>
      <div className="flex flex-col gap-3 border-b border-border p-3">
        <div className="flex items-baseline justify-between gap-2">
          <Titulo id="titulo-lista-conversas" className={cn('font-light text-foreground', titulo === 'h1' ? 'text-xl' : 'text-lg')}>
            Atendimento <span className="tabular font-extrabold text-brand">{esperandoVoce}</span>{' '}
            <span className="text-sm font-normal text-muted">esperando você</span>
          </Titulo>
        </div>
        <FiltrosCaixa caminho={caminho} filtro={filtro} q={q} padrao={filtroPadrao(u)} />
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {error || erroEspera ? (
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
            <GrupoConversas id="grupo-esperando" titulo="Esperando pessoa" total={grupos.esperando.length}>
              {grupos.esperando.map(item)}
            </GrupoConversas>
            <GrupoConversas id="grupo-agente" titulo="Com o agente" total={grupos.comAgente.length}>
              {grupos.comAgente.map(item)}
            </GrupoConversas>
            {grupos.concluidasHoje.length > 0 && (
              <details className="group border-t border-border">
                <summary className="flex cursor-pointer items-center justify-between bg-surface-muted px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted">
                  Concluídas hoje <span className="tabular">{grupos.concluidasHoje.length}</span>
                </summary>
                <ul className="divide-y divide-border">{grupos.concluidasHoje.map(item)}</ul>
              </details>
            )}
            {temMais && (
              <p className="border-t border-border px-3 py-3 text-center text-sm text-muted">
                {paginas < MAX_PAGINAS_CAIXA ? (
                  <Link href={`${caminho}${consultaCaixa({ filtro: filtroNaUrl, q, mais: paginas + 1 })}`} scroll={false}
                    className="font-medium text-brand underline-offset-4 hover:underline">
                    Carregar mais conversas
                  </Link>
                ) : (
                  <>Mostrando as {limite.toLocaleString('pt-BR')} conversas mais recentes. Use a busca para achar as mais antigas.</>
                )}
              </p>
            )}
          </Realce>
        )}
      </div>
    </section>
  );
}

/** Grupo da lista com cabeçalho em caixa alta e a contagem; região nomeada para o leitor de tela e para os testes. */
function GrupoConversas({ id, titulo, total, children }: { id: string; titulo: string; total: number; children: ReactNode }) {
  if (total === 0) return null;
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="flex items-center justify-between border-b border-border bg-surface-muted px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted">
        {titulo} <span className="tabular">{total}</span>
      </h3>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}
