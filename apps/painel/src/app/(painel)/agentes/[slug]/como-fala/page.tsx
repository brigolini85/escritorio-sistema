import { notFound } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { TEXTO_FALA_THIAGO } from '@escritorio/core';
import { Card } from '@/components/ui/card';
import { lerAgente, lerRegras, souDono } from '@/lib/agentes';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ModoContatoEscolha } from './modo-contato';
import { RegrasAssunto } from './regras-assunto';

/** Aba Como fala com o cliente (spec 7E.3). O Thiago é a voz (D13); os outros guardam modo e regras (D14). */
export default async function ComoFala({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono] = await Promise.all([lerAgente(sb, slug), souDono(sb)]);
  if (!agente) notFound();
  const editavel = dono && !semMigracao;
  if (agente.portaDeEntrada) {
    return (
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Como fala com o cliente</h2>
        <p className="text-lg font-bold">{TEXTO_FALA_THIAGO}</p>
        <p className="text-sm text-muted">O Thiago recebe toda mensagem. Os agentes dos setores falam pelo modo escolhido na ficha de cada um (próxima etapa).</p>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Como fala com o cliente</h2>
      <ModoContatoEscolha slug={agente.slug} atual={agente.modoContato} editavel={editavel} />
      <RegrasAssunto slug={agente.slug} regras={semMigracao ? [] : await lerRegras(sb, agente.id)} editavel={editavel} />
      <p className="flex items-start gap-2 rounded-md border border-success bg-success-soft px-3 py-2 text-sm text-success">
        <ShieldCheck aria-hidden size={16} className="mt-0.5 shrink-0" />
        O acesso por contato vale sempre: só trata de {agente.setor ?? 'assuntos do setor'} com quem pode tratar de {agente.setor ?? 'assuntos do setor'}. Quem não tem acesso continua com o Thiago, seja qual for o modo.
      </p>
    </Card>
  );
}
