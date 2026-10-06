import Link from 'next/link';
import { notFound } from 'next/navigation';
import { INFO_MODO, INFO_TIPO_SKILL, TEXTO_FALA_THIAGO, TIPOS_SKILL } from '@escritorio/core';
import { Card } from '@/components/ui/card';
import { lerAgente, lerLimitesTarefa, lerMudancas, lerRegras, lerSkills, souDono } from '@/lib/agentes';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { LimitesTarefa } from './limites-tarefa';
import { OrdemPrioridade, ResumoFerramentas, UltimasMudancas } from './coluna-lateral';

/** Visão geral: skills por tipo, como fala com o cliente, ferramentas, prioridade e últimas mudanças. */
export default async function VisaoGeral({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServidor();
  const { agente, semMigracao } = await lerAgente(sb, slug);
  if (!agente) notFound();
  const [skills, regras, mudancas, limites, dono] = semMigracao ? ([[], [], [], null, false] as [never[], never[], never[], null, boolean]) : await Promise.all([
    lerSkills(sb, agente.id), lerRegras(sb, agente.id), lerMudancas(sb, agente.id, 5),
    agente.tipos.includes('trabalho') ? lerLimitesTarefa(sb, slug) : Promise.resolve(null), souDono(sb),
  ]);
  const fala = agente.portaDeEntrada ? TEXTO_FALA_THIAGO : agente.modoContato ? INFO_MODO[agente.modoContato].rotulo : 'a definir';
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card className="flex flex-col gap-2 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Skills por tipo</h2>
            <Link href={`/agentes/${slug}/skills`} className="text-sm font-bold text-brand">abrir aba</Link>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[...TIPOS_SKILL].sort((x, y) => INFO_TIPO_SKILL[x].ordem - INFO_TIPO_SKILL[y].ordem).map((t) => {
              const doTipo = skills.filter((s) => s.tipo === t);
              return (
                <li key={t} className="rounded-md border border-border px-3 py-2 text-sm">
                  <p className="font-bold">{INFO_TIPO_SKILL[t].ordem} · {INFO_TIPO_SKILL[t].rotulo}</p>
                  <p className="text-muted">{INFO_TIPO_SKILL[t].quando} · {doTipo.filter((s) => s.ativo).length} ligada(s) de {doTipo.length}</p>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Como fala com o cliente</h2>
            <Link href={`/agentes/${slug}/como-fala`} className="text-sm font-bold text-brand">abrir aba</Link>
          </div>
          <p className="text-sm">Modo padrão: <b>{fala}</b>{!agente.portaDeEntrada && <> · {regras.length} regra(s) por assunto</>}</p>
        </Card>
        <ResumoFerramentas agente={agente} />
      </div>
      <div className="flex flex-col gap-4">
        {agente.tipos.includes('trabalho') && limites && <LimitesTarefa slug={slug} limites={limites} dono={dono} />}
        <OrdemPrioridade />
        <UltimasMudancas mudancas={mudancas} />
      </div>
    </div>
  );
}
