import { supabaseServidor } from '@/lib/supabase/servidor';
import { perguntarAoAssistente } from './acoes';
import { ListaRolante } from './lista-rolante';

const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'short' }).format(new Date(iso));

type ArquivoCsv = { tipo: string; chamados: string[]; nome: string; partes?: number };

/**
 * Conversa com o assistente: na tela própria (conversaId null) ou dentro de um atendimento.
 * `podeCsv`: o link do CSV do Bling só aparece para quem pode gerá-lo (emitir_notas; o administrador sempre pode).
 */
export async function ConversaAssistente({ usuarioId, conversaId, podeCsv, compacta = false }: { usuarioId: string; conversaId: string | null; podeCsv: boolean; compacta?: boolean }) {
  const sb = await supabaseServidor();
  let q = sb.from('assistente_mensagens').select('id, papel, conteudo, arquivo, processada_em, criado_em').eq('usuario_id', usuarioId).eq('canal', 'site');
  q = conversaId ? q.eq('conversa_id', conversaId) : q.is('conversa_id', null);
  const { data } = await q.order('criado_em', { ascending: false }).limit(compacta ? 20 : 60);
  const mensagens = (data ?? []).reverse();
  const pensando = mensagens.some((m) => m.papel === 'usuario' && !m.processada_em);
  return (
    <div className="flex flex-col gap-2">
      <ListaRolante className={`space-y-2 overflow-y-auto text-sm ${compacta ? 'max-h-80' : 'max-h-[60vh]'}`}>
        {mensagens.map((m) => {
          const arquivo = m.papel === 'assistente' && podeCsv ? (m.arquivo as ArquivoCsv | null) : null;
          const partes = arquivo?.tipo === 'csv_bling' ? Math.max(1, arquivo.partes ?? 1) : 0;
          return (
            <li key={m.id} className={`rounded p-2 ${m.papel === 'usuario' ? 'ml-8 bg-slate-100' : 'mr-8 border bg-white'}`}>
              <p className="whitespace-pre-wrap">{m.conteudo}</p>
              {Array.from({ length: partes }, (_, i) => (
                <a key={i} href={`/api/csv-bling?assistente=${m.id}&parte=${i + 1}`} className="mt-1 block text-blue-700 underline">
                  {partes === 1 ? 'Baixar CSV Bling' : `Baixar CSV Bling (parte ${i + 1})`}
                </a>
              ))}
              <p className="mt-1 text-xs text-slate-400">{hora(m.criado_em)}</p>
            </li>
          );
        })}
        {pensando && <li className="mr-8 rounded border bg-white p-2 text-sm text-slate-500">Pensando…</li>}
        {mensagens.length === 0 && <li className="text-slate-500">Pergunte sobre demandas, pedidos, vendas ou peça para corrigir um pedido e gerar o CSV do Bling.</li>}
      </ListaRolante>
      <form action={perguntarAoAssistente.bind(null, conversaId)} className="flex gap-2">
        <input name="pergunta" placeholder="Pergunte ao assistente" required maxLength={4000} className="flex-1 rounded border p-2 text-sm" autoComplete="off" />
        <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white">Enviar</button>
      </form>
    </div>
  );
}
