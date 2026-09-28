import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarAgenteContato, cadastrarContatoDaConversa } from '../acoes';

/**
 * Número não cadastrado: cadastra o contato (com ou sem empresa) e escolhe se o agente atende.
 * Contato cadastrado: liga ou desliga o agente só para ele (desligado = nada automático; vira triagem).
 */
export async function ContatoDaConversa({ conversaId, contato, pode }: {
  conversaId: string; contato: { id: string; nome: string; agente_pausado: boolean } | null; pode: boolean;
}) {
  if (contato) {
    return (
      <div className="rounded-lg border bg-white p-3 text-sm">
        <p className="font-semibold">{contato.nome}</p>
        <p className={contato.agente_pausado ? 'text-amber-700' : 'text-emerald-700'}>
          {contato.agente_pausado ? 'Agente desligado para este contato' : 'O agente atende este contato'}
        </p>
        {pode && (
          <form action={alternarAgenteContato.bind(null, contato.id, conversaId, contato.agente_pausado)} className="mt-2">
            <button className="rounded border px-2 py-1">
              {contato.agente_pausado ? 'Ligar o agente para este contato' : 'Desligar o agente para este contato'}
            </button>
          </form>
        )}
      </div>
    );
  }

  const sb = await supabaseServidor();
  const { data: empresas } = await sb.from('clientes').select('id, razao_social, nome_fantasia').eq('ativo', true).order('razao_social');
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="mb-2 font-semibold">Contato não cadastrado</p>
      {!pode && <p className="text-slate-600">Peça a alguém com a permissão "Editar clientes" para cadastrar este número.</p>}
      {pode && (
        <form action={cadastrarContatoDaConversa.bind(null, conversaId)} className="space-y-2">
          <label className="block">Nome do contato<input name="nome" required minLength={2} className="mt-1 w-full rounded border p-1" /></label>
          <label className="block">Empresa (opcional)
            <select name="cliente_id" defaultValue="" className="mt-1 w-full rounded border p-1">
              <option value="">Sem empresa</option>
              {(empresas ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome_fantasia ?? e.razao_social}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1"><input type="checkbox" name="pode_pedir_nota" /> Pode pedir nota</label>
          <label className="flex items-center gap-1"><input type="checkbox" name="agente_atende" defaultChecked /> O agente atende este contato</label>
          <button className="rounded bg-slate-900 px-3 py-1 text-white">Cadastrar contato</button>
        </form>
      )}
    </div>
  );
}
