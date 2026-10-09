import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { lerFiltroCaixa, lerPaginasCaixa } from '@/lib/caixa';
import { lerAgentePausado } from '@/lib/leituras-admin';
import { lerDataAlvo } from '@/lib/historico';
import { lerCursorAnteriores } from '@/lib/mensagens-conversa';
import { temNivel, usaAssistente } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { AtalhosLista } from '../atalhos-lista';
import { AtualizarAoVivo } from '../atualizar-ao-vivo';
import { EsqueletoConversa } from '../esqueletos';
import { ListaConversas } from '../lista-conversas';
import { ConversaAberta } from './conversa-aberta';

/**
 * Conversa aberta com a lista ao lado. A lista vem junto com a página (sem Suspense), então ao trocar de
 * conversa (J/K ou clique) ela não pisca; só o centro e o painel mostram o esqueleto enquanto a conversa nova carrega.
 */
export default async function Conversa({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; filtro?: string; q?: string; data?: string; mais?: string; anteriores?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await obterUsuario();
  // "Atendimento: Sem acesso" (Parte D): o banco já não mostra conversa nenhuma; a tela nem abre.
  if (!temNivel(u, 'atendimento', 'meus_setores')) redirect('/inicio');
  const sb = await supabaseServidor();
  const [{ data: existe }, { data: usuarios }, pausaGeral] = await Promise.all([
    sb.from('conversas').select('id').eq('id', id).maybeSingle(),
    sb.from('usuarios').select('id, nome, ativo').order('nome'),
    lerAgentePausado(sb), // null para quem não é administrador (RLS)
  ]);
  if (!existe) notFound();
  const pessoas = usuarios ?? [];
  const q = sp.q ?? '';

  return (
    <div className="-m-6 flex flex-col lg:altura-trabalho lg:flex-row">
      <AtualizarAoVivo conversaAberta={id} assistenteDe={usaAssistente(u) ? u.id : undefined} />
      <AtalhosLista />
      <ListaConversas
        u={u}
        filtro={lerFiltroCaixa(sp.filtro, u)}
        filtroNaUrl={sp.filtro ?? null}
        q={q}
        paginas={lerPaginasCaixa(sp.mais)}
        caminho={`/atendimento/${id}`}
        selecionada={id}
        titulo="h2"
        pausaGeral={pausaGeral}
        nomes={new Map(pessoas.map((p) => [p.id, p.nome]))}
        className="hidden w-lista-conversas shrink-0 border-r border-border xl:flex"
      />
      <Suspense fallback={<EsqueletoConversa />}>
        <ConversaAberta id={id} u={u} filtroNaUrl={sp.filtro ?? null} q={q} erro={sp.erro} pessoas={pessoas} pausaGeral={pausaGeral} dataAlvo={lerDataAlvo(sp.data)} anteriores={lerCursorAnteriores(sp.anteriores)} />
      </Suspense>
    </div>
  );
}
