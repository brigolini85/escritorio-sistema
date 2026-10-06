import { notFound } from 'next/navigation';
import { lerAgente, souDono } from '@/lib/agentes';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { FERRAMENTAS_DAS_TAREFAS } from '../textos';
import { EscolherFerramentas } from './escolher-ferramentas';

export default async function Ferramentas({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono] = await Promise.all([lerAgente(sb, slug), souDono(sb)]);
  if (!agente) notFound();
  const escolher = <EscolherFerramentas slug={agente.slug} porta={agente.portaDeEntrada} escolhidas={agente.ferramentas} editavel={dono && !semMigracao} />;
  if (!agente.tipos.includes('trabalho')) return escolher;
  return (
    <div className="flex flex-col gap-4">
      {escolher}
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Ferramentas das tarefas</h2>
        <p className="text-sm text-muted">Entram sozinhas no tipo Trabalho; nenhuma envia ao cliente.</p>
        <ul className="flex flex-col gap-2">
          {FERRAMENTAS_DAS_TAREFAS.map((f, i) => (
            <li key={f.rotulo} className="flex flex-wrap items-baseline gap-2 text-sm">
              <b>{f.rotulo}</b>
              {i < 2 && <Badge variant="success">só leitura</Badge>}
              {i === FERRAMENTAS_DAS_TAREFAS.length - 1 && <Badge variant="warning">só vale com a aprovação</Badge>}
              <span className="text-muted">{f.descricao}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
