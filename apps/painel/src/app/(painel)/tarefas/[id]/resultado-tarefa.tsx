import { Download, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { formatarBRL } from '@/lib/formatos';
import type { TarefaTela } from '@/lib/tarefas-tela';

const MOSTRAR = 50;
export function ResultadoTarefa({ t }: { t: TarefaTela }) {
  const r = t.resultado;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="resultado-titulo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="resultado-titulo" className="text-xs font-bold uppercase tracking-wide text-brand">Resultado</h3>
        <Badge variant={t.estado === 'aprovada' ? 'success' : 'warning'}>{t.estado === 'aprovada' ? 'aprovado' : 'rascunho · ainda não vale'}</Badge>
      </div>
      {!r ? <p className="text-sm text-muted">O agente ainda não entregou o resultado.</p> : (
        <>
          <p className="text-sm">{r.resumo}</p>
          {r.destaques.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {r.destaques.map((d, i) => (
                <li key={i} className="rounded-md border border-border p-3">
                  <p className="text-xs font-bold uppercase text-muted">{d.rotulo}</p>
                  <p className="text-2xl font-bold tabular">{d.valor}</p>
                  {d.detalhe && <p className="text-xs text-muted">{d.detalhe}</p>}
                </li>
              ))}
            </ul>
          )}
          {r.linhas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Linhas do resultado">
                <thead><tr className="text-left text-xs uppercase text-muted"><th className="py-1">Descrição</th><th className="py-1 pl-4 text-right">Valor</th><th className="py-1 pl-4">Fonte</th></tr></thead>
                <tbody>
                  {r.linhas.slice(0, MOSTRAR).map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1">{l.descricao}{l.provisoria && <Badge variant="warning" className="ml-2">provisória</Badge>}</td>
                      <td className="whitespace-nowrap py-1 pl-4 text-right tabular">{l.valor !== null ? formatarBRL(l.valor) : l.texto}</td>
                      <td className="py-1 pl-4 text-muted">{l.fonte}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.linhas.length > MOSTRAR && <p className="text-xs text-muted">e mais {r.linhas.length - MOSTRAR} linhas no CSV.</p>}
            </div>
          )}
          {r.observacoes && <p className="text-sm text-muted">{r.observacoes}</p>}
          <a href={`/api/tarefas/csv?id=${t.id}`} className={variantesBotao({ variant: 'outline', size: 'sm' })}><Download aria-hidden size={16} /> Baixar CSV</a>
        </>
      )}
      <p className="flex items-center gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm">
        <ShieldCheck aria-hidden size={16} className="text-warning" /> <span><b>Nunca inventa valores:</b> o que não tem documento vira pendência — nada vale sem a aprovação.</span>
      </p>
    </section>
  );
}
