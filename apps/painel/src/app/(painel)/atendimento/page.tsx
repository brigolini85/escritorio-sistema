import { MessagesSquare } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { EmptyState } from '@/components/patterns/empty-state';
import { lerFiltroCaixa, lerPaginasCaixa } from '@/lib/caixa';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { AtalhosLista } from './atalhos-lista';
import { AtualizarAoVivo } from './atualizar-ao-vivo';
import { EsqueletoLista } from './esqueletos';
import { ListaConversas } from './lista-conversas';

const COLUNA_LISTA = 'w-full border-r border-border lg:w-lista-conversas lg:shrink-0';

export default async function Atendimento({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string; mais?: string }> }) {
  const u = await obterUsuario();
  // "Atendimento: Sem acesso" (Parte D): o banco já não mostra conversa nenhuma; a tela nem abre.
  if (!temNivel(u, 'atendimento', 'meus_setores')) redirect('/inicio');
  const sp = await searchParams;
  const filtro = lerFiltroCaixa(sp.filtro, u);
  const q = sp.q ?? '';

  return (
    <div className="-m-6 flex lg:altura-trabalho">
      <AtualizarAoVivo />
      <AtalhosLista />
      {/* Trocar filtro ou busca não remonta a página: a lista antiga fica na tela até a nova chegar (sem piscar). */}
      <Suspense fallback={<EsqueletoLista className={COLUNA_LISTA} />}>
        <ListaConversas
          u={u}
          filtro={filtro}
          filtroNaUrl={sp.filtro ?? null}
          q={q}
          paginas={lerPaginasCaixa(sp.mais)}
          caminho="/atendimento"
          titulo="h1"
          className={COLUNA_LISTA}
        />
      </Suspense>
      <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
        <EmptyState
          icone={MessagesSquare}
          titulo="Selecione uma conversa"
          descricao="Escolha uma conversa na lista (ou tecle J) para ver o histórico, responder ao cliente ou falar com o assistente."
        />
      </div>
    </div>
  );
}
