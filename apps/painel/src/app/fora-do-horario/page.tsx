import { Clock } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { descreverHorario, lerHorarioDoBanco } from '@/lib/horario-acesso';
import { destinoSemAcesso, lerSituacao } from '@/lib/situacao-acesso';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { sair } from '../entrar/acoes';

export const metadata = { title: 'Fora do horário' };

/** Spec 7.2: fora do horário a sessão mostra o porquê e o horário da pessoa. Liberado de novo, volta ao painel. */
export default async function ForaDoHorario() {
  const sb = await supabaseServidor();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/entrar');
  const resposta = await sb.rpc('situacao_acesso');
  const situacao = lerSituacao(resposta, 'fora-do-horario');
  if (situacao === 'liberado') redirect('/inicio');
  // Erro do banco leva a "tente de novo", não a "acesso desativado".
  if (situacao !== 'fora_do_horario') redirect(destinoSemAcesso(situacao));
  const horario = lerHorarioDoBanco((resposta.data as { horario?: unknown }).horario ?? null);
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4">
      <section aria-labelledby="fora-titulo" className="flex max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <Clock aria-hidden size={24} strokeWidth={1.75} className="text-brand" />
        <h1 id="fora-titulo" className="text-xl font-semibold text-foreground">Fora do seu horário de acesso</h1>
        <p className="text-muted">Seu horário: {descreverHorario(horario)}.</p>
        <p className="text-muted">O painel abre de novo quando o seu horário começar. Precisa entrar agora? Fale com o administrador.</p>
        <form action={sair}>
          <Button type="submit" variant="outline">Sair</Button>
        </form>
      </section>
    </main>
  );
}
