import { ShieldCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { NOME_ESCRITORIO } from '@/lib/escritorio';
import { destinoDepoisDoFator } from '@/lib/segundo-fator';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { sair } from '../entrar/acoes';
import { conferirCodigo } from './acoes';
import { CadastroAplicativo } from './cadastro-aplicativo';
import { FormularioCodigo } from './formulario-codigo';

export const metadata = { title: 'Segundo fator' };

function Moldura({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <section aria-labelledby="fator-titulo" className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <ShieldCheck aria-hidden size={24} strokeWidth={1.75} className="text-brand" />
        <h1 id="fator-titulo" className="text-xl font-semibold text-foreground">{titulo}</h1>
        {children}
        <form action={sair}>
          <Button type="submit" variant="outline">Sair</Button>
        </form>
      </section>
    </main>
  );
}

/**
 * Segurança do login (item 8): administrador e quem vê acessos de portais confirmam o código do aplicativo autenticador.
 * Primeiro login: cadastra o aplicativo (QR code + código). Depois: só o código.
 */
export default async function SegundoFator({ searchParams }: { searchParams: Promise<{ depois?: string }> }) {
  const { depois } = await searchParams;
  const depoisSeguro = depois === 'senha' ? 'senha' : undefined;
  const sb = await supabaseServidor();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/entrar');
  const { data: nivel } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nivel?.currentLevel === 'aal2') redirect(destinoDepoisDoFator(depoisSeguro));
  const { data: exige, error: erroExige } = await sb.rpc('exige_segundo_fator');
  if (erroExige) {
    console.error('[segundo-fator] exige_segundo_fator', erroExige.message);
    return (
      <Moldura titulo="Não consegui conferir seu acesso">
        <p className="text-muted">Tente de novo em instantes.</p>
        <a href="/segundo-fator" className="text-sm underline">Tentar de novo</a>
      </Moldura>
    );
  }
  if (!exige) redirect(destinoDepoisDoFator(depoisSeguro));

  const { data: fatores } = await sb.auth.mfa.listFactors();
  if (fatores?.totp?.some((f) => f.status === 'verified')) {
    return (
      <Moldura titulo="Confirme que é você">
        <p className="text-muted">Abra o aplicativo autenticador no celular e digite o código de 6 números do {NOME_ESCRITORIO}.</p>
        <FormularioCodigo acao={conferirCodigo} depois={depoisSeguro} rotulo="Confirmar" />
        <p className="text-sm text-muted">Perdeu o celular? Fale com o administrador para cadastrar o aplicativo de novo.</p>
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Proteja seu acesso com o celular">
      <CadastroAplicativo depois={depoisSeguro} />
    </Moldura>
  );
}
