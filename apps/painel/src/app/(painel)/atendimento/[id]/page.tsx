import { notFound } from 'next/navigation';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { AtualizarAoVivo } from '../atualizar-ao-vivo';
import { ContatoDaConversa } from './contato-da-conversa';
import { alterarStatus, assumir, concluir, devolverAoAgente, notaInterna, responder, transferir } from '../acoes';

const hora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

export default async function Conversa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await obterUsuario();
  const sb = await supabaseServidor();
  const { data: conversa } = await sb.from('conversas').select('*, contatos(id, nome, agente_pausado), clientes:cliente_em_foco(razao_social, nome_fantasia)').eq('id', id).maybeSingle();
  if (!conversa) notFound();
  const [{ data: mensagens }, { data: chamados }, { data: decisoes }, { data: setores }, { data: usuarios }] = await Promise.all([
    sb.from('mensagens').select('*').eq('conversa_id', id).order('criado_em'),
    sb.from('chamados').select('*, setores(nome), chamado_eventos(tipo, texto, criado_em, usuarios(nome))').eq('conversa_id', id).neq('status', 'concluido'),
    sb.from('decisoes_agente').select('etapa, entrada, saida, criado_em').eq('conversa_id', id).order('criado_em', { ascending: false }).limit(30),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome').eq('ativo', true).order('nome'),
  ]);
  const minha = conversa.atendente_id === u.id;

  return (
    <div className="grid grid-cols-[1fr_22rem] gap-6">
      <AtualizarAoVivo conversaId={id} />
      <section className="flex flex-col rounded-lg border bg-white">
        <header className="flex items-center justify-between border-b p-3">
          <div>
            <p className="font-semibold">{conversa.contatos?.nome ?? conversa.telefone}</p>
            <p className="text-sm text-slate-500">{conversa.clientes?.nome_fantasia ?? conversa.clientes?.razao_social ?? 'Empresa não definida'} · {conversa.estado === 'humano' ? 'com atendente' : 'com o agente'}</p>
          </div>
          <div className="flex gap-2">
            {!minha && <form action={assumir.bind(null, id)}><button className="rounded bg-slate-900 px-3 py-1 text-white">Assumir</button></form>}
            {minha && <form action={devolverAoAgente.bind(null, id)}><button className="rounded border px-3 py-1">Devolver ao agente</button></form>}
          </div>
        </header>
        <ol className="flex-1 space-y-2 overflow-y-auto p-4">
          {(mensagens ?? []).map((m) => (
            <li key={m.id} className={`max-w-[75%] rounded-lg p-2 text-sm ${m.direcao === 'entrada' ? 'bg-slate-100' : 'ml-auto bg-emerald-50'}`}>
              <p className="text-xs text-slate-500">{m.autor === 'cliente' ? 'Cliente' : m.autor === 'agente' ? 'Agente' : m.autor === 'sistema' ? 'Sistema' : 'Equipe'} · {hora(m.criado_em)}{m.status_envio === 'falhou' ? ' · falhou ao enviar' : ''}</p>
              {m.transcricao && <p className="italic">🎤 {m.transcricao}</p>}
              {m.conteudo && <p className="whitespace-pre-wrap">{m.conteudo}</p>}
              {m.arquivo_path && <a className="text-blue-700 underline" href={`/api/arquivos?path=${encodeURIComponent(m.arquivo_path)}`} target="_blank">{m.arquivo_nome ?? 'Abrir anexo'}</a>}
            </li>
          ))}
        </ol>
        <form action={responder.bind(null, id)} className="flex gap-2 border-t p-3">
          <textarea name="texto" rows={2} className="flex-1 rounded border p-2" placeholder="Escreva a resposta para o cliente" />
          <input name="arquivo" type="file" className="w-40 text-xs" />
          <button className="rounded bg-emerald-700 px-4 text-white">Enviar</button>
        </form>
      </section>

      <aside className="space-y-4">
        <ContatoDaConversa conversaId={id} contato={conversa.contatos} pode={temPermissao(u, 'editar_clientes')} />
        {(chamados ?? []).map((c) => (
          <div key={c.id} className="rounded-lg border bg-white p-3 text-sm">
            <p className="font-semibold">#{c.numero} · {c.titulo}</p>
            <p className="text-slate-500">{c.setores?.nome ?? 'Triagem'} · {c.status.replace('_', ' ')}{c.fora_do_contrato ? ' · fora do contrato' : ''}</p>
            <p className="my-2 whitespace-pre-wrap">{c.resumo}</p>
            {c.pedido_venda && <a href={`/api/csv-bling?id=${c.id}`} className="mb-2 inline-block text-blue-700 underline">Baixar CSV Bling</a>}
            <ul className="mb-2 space-y-1 text-xs text-slate-500">
              {c.chamado_eventos.map((e, i) => <li key={i}>{hora(e.criado_em)} · {e.tipo.replace('_', ' ')}{e.usuarios?.nome ? ` (${e.usuarios.nome})` : ''}{e.texto ? `: ${e.texto}` : ''}</li>)}
            </ul>
            <form action={notaInterna.bind(null, c.id, id)} className="mb-2 flex gap-1">
              <input name="texto" className="flex-1 rounded border p-1" placeholder="Nota interna" />
              <button className="rounded border px-2">Salvar</button>
            </form>
            <form action={transferir.bind(null, c.id, id)} className="mb-2 flex gap-1">
              <select name="setor_id" className="flex-1 rounded border p-1" defaultValue={c.setor_id ?? ''}>
                {(setores ?? []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              <select name="responsavel_id" className="flex-1 rounded border p-1" defaultValue="">
                <option value="">Fila do setor</option>
                {(usuarios ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <button className="rounded border px-2">Transferir</button>
            </form>
            <div className="flex gap-2">
              <form action={alterarStatus.bind(null, c.id, id, 'aguardando_cliente')}><button className="rounded border px-2 py-1">Aguardando cliente</button></form>
              <form action={concluir.bind(null, c.id, id)}><button className="rounded bg-slate-900 px-2 py-1 text-white">Concluir</button></form>
            </div>
          </div>
        ))}
        <details className="rounded-lg border bg-white p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Por que o agente fez isso?</summary>
          <ul className="mt-2 space-y-2 text-xs">
            {(decisoes ?? []).map((d, i) => (
              <li key={i}><p className="font-medium">{hora(d.criado_em)} · {d.etapa}</p><pre className="whitespace-pre-wrap text-slate-600">{JSON.stringify({ entrada: d.entrada, saida: d.saida }, null, 1)}</pre></li>
            ))}
          </ul>
        </details>
      </aside>
    </div>
  );
}
