import { notFound } from 'next/navigation';
import { LockKeyhole, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { lerAgente, lerMudancas, lerSkills, lerUsoSkills, parteI3bAplicada, souDono } from '@/lib/agentes';
import { lerPeriodo } from '@/lib/gastos';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { comoTestar } from '@/lib/testar-setor';
import { OrdemPrioridade, ResumoFerramentas, UltimasMudancas } from '../coluna-lateral';
import { ListaSkills } from './lista-skills';
import { SubirSkill } from './subir-skill';

/** Aba Skills (spec 7E.3): os 5 tipos, subir, versões e liga/desliga (só o dono); à direita, prioridade, ferramentas e mudanças. */
export default async function Skills({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono] = await Promise.all([lerAgente(sb, slug), souDono(sb)]);
  if (!agente) notFound();
  if (semMigracao) return null;
  const mes = lerPeriodo({}, new Date());
  const [skills, uso, mudancas, i3b] = await Promise.all([lerSkills(sb, agente.id), lerUsoSkills(sb, slug, mes.de, mes.ate), lerMudancas(sb, agente.id, 5), parteI3bAplicada(sb)]);
  const como = comoTestar(agente, i3b);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="flex flex-col gap-4 p-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand">Skills do {agente.nome}
            <Badge variant="brand" className="normal-case"><LockKeyhole aria-hidden />só o dono</Badge></h2>
          {dono && <a href="#subir" className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-bold uppercase text-brand-foreground"><Upload aria-hidden size={14} />Subir skill</a>}
        </div>
        <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-muted">Organizadas por <b>tipo</b>. O tipo diz <b>quando</b> o agente lê: umas sempre, outras só quando a tarefa ou o assunto aparece.</p>
        <ListaSkills slug={agente.slug} testavel={como === 'thiago' || como === 'setor'} skills={skills} uso={Object.fromEntries(uso)} dono={dono} />
        {dono && <SubirSkill slug={agente.slug} />}
      </Card>
      <div className="flex flex-col gap-4">
        <OrdemPrioridade />
        <ResumoFerramentas agente={agente} />
        <UltimasMudancas mudancas={mudancas} />
      </div>
    </div>
  );
}
