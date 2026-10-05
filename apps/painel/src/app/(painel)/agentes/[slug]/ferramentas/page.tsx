import { notFound } from 'next/navigation';
import { lerAgente, souDono } from '@/lib/agentes';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { EscolherFerramentas } from './escolher-ferramentas';

export default async function Ferramentas({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono] = await Promise.all([lerAgente(sb, slug), souDono(sb)]);
  if (!agente) notFound();
  return <EscolherFerramentas slug={agente.slug} porta={agente.portaDeEntrada} escolhidas={agente.ferramentas} editavel={dono && !semMigracao} />;
}
