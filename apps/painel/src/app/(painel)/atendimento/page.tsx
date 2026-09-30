import { MessagesSquare } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { lerFiltroCaixa } from '@/lib/caixa';
import { obterUsuario } from '@/lib/sessao';
import { AtualizarAoVivo } from './atualizar-ao-vivo';
import { ListaConversas } from './lista-conversas';

export default async function Atendimento({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string }> }) {
  const u = await obterUsuario();
  const sp = await searchParams;
  const filtro = lerFiltroCaixa(sp.filtro, u);
  const q = sp.q ?? '';

  return (
    <div className="-m-6 flex lg:altura-trabalho">
      <AtualizarAoVivo />
      <ListaConversas
        u={u}
        filtro={filtro}
        filtroNaUrl={sp.filtro ?? null}
        q={q}
        caminho="/atendimento"
        titulo="h1"
        className="w-full border-r border-border lg:w-lista-conversas lg:shrink-0"
      />
      <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
        <EmptyState
          icone={MessagesSquare}
          titulo="Selecione uma conversa"
          descricao="Escolha uma conversa na lista para ver o histórico, responder ao cliente ou falar com o assistente."
        />
      </div>
    </div>
  );
}
