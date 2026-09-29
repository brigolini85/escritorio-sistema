import { redirect } from 'next/navigation';
import { obterUsuario } from '@/lib/sessao';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { ConversaAssistente } from './conversa-assistente';

export default async function Assistente({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const u = await obterUsuario();
  if (!u.permissoes.includes('assistente_site')) redirect('/inicio');
  const { erro } = await searchParams;
  return (
    <section className="max-w-3xl space-y-4">
      <AtualizarAoVivo assistenteDe={u.id} />
      <h1 className="text-xl font-semibold">Assistente</h1>
      <p className="text-sm text-slate-500">Consulte demandas, pedidos e vendas, corrija pedidos de nota e gere o CSV do Bling. Antes de gravar qualquer alteração, o assistente mostra o antes e o depois e pede sua confirmação.</p>
      {erro && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
      <div className="rounded-lg border bg-white p-4"><ConversaAssistente usuarioId={u.id} conversaId={null} /></div>
    </section>
  );
}
