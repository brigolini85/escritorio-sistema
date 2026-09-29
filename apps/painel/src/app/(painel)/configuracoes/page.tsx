import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import {
  adicionarFeriado, removerFeriado, removerResposta, salvarGerais, salvarMensagens,
  salvarResposta, salvarServico, salvarSetor,
} from './acoes';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const caixa = 'rounded-lg border bg-white p-4 space-y-3';
const input = 'rounded border p-2';

export default async function Configuracoes() {
  await exigirAdmin();
  const sb = await supabaseServidor();
  const [{ data: cfg }, { data: setores }, { data: servicos }, { data: respostas }, { data: feriados }, { data: sinais }] = await Promise.all([
    sb.from('configuracoes').select('*').eq('id', 1).single(),
    sb.from('setores').select('*').order('nome'),
    sb.from('servicos').select('*').order('nome'),
    sb.from('respostas_prontas').select('*').order('pergunta'),
    sb.from('feriados').select('*').order('data'),
    sb.from('sinais_vida').select('*'),
  ]);
  const mensagens = (cfg?.mensagens ?? {}) as Record<string, string>;
  const sinal = (c: string) => sinais?.find((s) => s.componente === c)?.visto_em;

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <p className="text-sm text-slate-500">Usuários e permissões ficam na aba Usuários.</p>

      <section className={caixa}>
        <h2 className="font-semibold">Integrações</h2>
        <p className="text-sm">WhatsApp: {sinal('whatsapp') ? `conectado (último sinal ${new Date(sinal('whatsapp')!).toLocaleString('pt-BR')})` : 'sem sinal — verifique a Z-API'}</p>
        <p className="text-sm">Trabalhador/fila: {sinal('fila') ? `ativo (último sinal ${new Date(sinal('fila')!).toLocaleString('pt-BR')})` : 'sem sinal'}</p>
      </section>

      <section className={caixa}>
        <h2 className="font-semibold">Setores</h2>
        <p className="text-sm text-slate-500">O agente usa a descrição dos assuntos para decidir para qual setor mandar cada demanda.</p>
        {(setores ?? []).map((s) => (
          <form key={s.id} action={salvarSetor.bind(null, s.id)} className="grid grid-cols-[10rem_1fr_auto_auto] items-center gap-2">
            <input name="nome" defaultValue={s.nome} className={input} />
            <input name="descricao_assuntos" defaultValue={s.descricao_assuntos} className={input} />
            <label className="text-sm"><input type="checkbox" name="ativo" defaultChecked={s.ativo} /> ativo</label>
            <button className="rounded border px-3 py-1">Salvar</button>
          </form>
        ))}
        <form action={salvarSetor.bind(null, null)} className="grid grid-cols-[10rem_1fr_auto] gap-2 border-t pt-3">
          <input name="nome" placeholder="Novo setor" required className={input} />
          <input name="descricao_assuntos" placeholder="Assuntos deste setor" className={input} />
          <button className="rounded bg-slate-900 px-3 py-1 text-white">Criar setor</button>
        </form>
      </section>

      <section className={caixa}>
        <h2 className="font-semibold">Serviços do escritório</h2>
        {(servicos ?? []).map((s) => (
          <form key={s.id} action={salvarServico.bind(null, s.id)} className="grid grid-cols-[1fr_12rem_auto_auto] items-center gap-2">
            <input name="nome" defaultValue={s.nome} className={input} />
            <select name="setor_id" defaultValue={s.setor_id ?? ''} className={input}><option value="">Sem setor</option>{(setores ?? []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
            <label className="text-sm"><input type="checkbox" name="ativo" defaultChecked={s.ativo} /> ativo</label>
            <button className="rounded border px-3 py-1">Salvar</button>
          </form>
        ))}
        <form action={salvarServico.bind(null, null)} className="grid grid-cols-[1fr_12rem_auto] gap-2 border-t pt-3">
          <input name="nome" placeholder="Novo serviço (ex.: Folha de pagamento)" required className={input} />
          <select name="setor_id" className={input}><option value="">Sem setor</option>{(setores ?? []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
          <button className="rounded bg-slate-900 px-3 py-1 text-white">Criar serviço</button>
        </form>
      </section>

      <section className={caixa}>
        <h2 className="font-semibold">Respostas prontas</h2>
        <p className="text-sm text-slate-500">O agente só responde sozinho o que estiver aqui (além de saudações e andamento de chamados).</p>
        {(respostas ?? []).map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-2 rounded border p-2 text-sm">
            <p><b>{r.pergunta}</b><br />{r.resposta}</p>
            <form action={removerResposta.bind(null, r.id)}><button className="text-red-700 underline">Remover</button></form>
          </div>
        ))}
        <form action={salvarResposta} className="grid gap-2 border-t pt-3">
          <input name="pergunta" placeholder="Pergunta (ex.: Qual o horário de atendimento?)" required className={input} />
          <textarea name="resposta" placeholder="Resposta" required className={input} />
          <button className="w-fit rounded bg-slate-900 px-3 py-1 text-white">Adicionar resposta</button>
        </form>
      </section>

      <form action={salvarGerais} className={caixa}>
        <h2 className="font-semibold">Expediente, IA e alertas</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Das <input type="time" name="horario_inicio" defaultValue={cfg?.horario_inicio.slice(0, 5)} className={input} />
          às <input type="time" name="horario_fim" defaultValue={cfg?.horario_fim.slice(0, 5)} className={input} />
          {DIAS.map((d, i) => <label key={d} className="flex items-center gap-1"><input type="checkbox" name="dia" value={i} defaultChecked={cfg?.dias_uteis.includes(i)} />{d}</label>)}
        </div>
        <label className="block text-sm">Teto mensal de gasto com IA (US$)<input name="teto_ia_usd" type="number" step="1" defaultValue={Number(cfg?.teto_ia_usd)} className={`${input} ml-2 w-28`} /></label>
        <label className="block text-sm">Avisar chamado sem responsável após (minutos)<input name="minutos_alerta_fila" type="number" defaultValue={cfg?.minutos_alerta_fila} className={`${input} ml-2 w-24`} /></label>
        <label className="block text-sm">E-mail para alertas<input name="email_alertas" type="email" defaultValue={cfg?.email_alertas ?? ''} className={`${input} ml-2 w-72`} /></label>
        <label className="block text-sm">Seu WhatsApp (recebe avisos e o resumo diário)<input name="telefone_dono" defaultValue={cfg?.telefone_dono ?? ''} className={`${input} ml-2 w-56`} /></label>
        <button className="rounded bg-slate-900 px-3 py-1 text-white">Salvar</button>
      </form>

      <section className={caixa}>
        <h2 className="font-semibold">Feriados</h2>
        <ul className="text-sm">{(feriados ?? []).map((f) => (
          <li key={f.data} className="flex gap-2">{new Date(`${f.data}T12:00:00`).toLocaleDateString('pt-BR')} · {f.descricao}
            <form action={removerFeriado.bind(null, f.data)}><button className="text-red-700 underline">remover</button></form></li>
        ))}</ul>
        <form action={adicionarFeriado} className="flex gap-2">
          <input type="date" name="data" required className={input} />
          <input name="descricao" placeholder="Descrição" required className={input} />
          <button className="rounded border px-3 py-1">Adicionar</button>
        </form>
      </section>

      <form action={salvarMensagens} className={caixa}>
        <h2 className="font-semibold">Mensagens automáticas</h2>
        {[['aviso_lgpd', 'Aviso de privacidade (primeiro contato)'], ['fora_do_horario', 'Fora do horário ({inicio} e {fim} viram os horários)'],
          ['ia_indisponivel', 'IA indisponível']].map(([k, rotulo]) => (
          <label key={k} className="block text-sm">{rotulo}<textarea name={k} defaultValue={mensagens[k!] ?? ''} rows={2} className={`${input} mt-1 w-full`} /></label>
        ))}
        <button className="rounded bg-slate-900 px-3 py-1 text-white">Salvar mensagens</button>
      </form>
    </div>
  );
}
