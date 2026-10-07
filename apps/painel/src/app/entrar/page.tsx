import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MONOGRAMA, NOME_ESCRITORIO } from '@/lib/escritorio';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { entrar } from './acoes';
import { avisoParaMostrar } from './aviso-login';
import { mensagemDeErro } from './erros';
import { classeCampoSublinhado, classeRotuloLogin, FaixasLogin } from './faixas';

/** O recado do administrador nunca derruba a tela: qualquer falha vira "sem recado". */
async function lerAviso(): Promise<string | null> {
  try {
    const sb = await supabaseServidor();
    const { data, error } = await sb.rpc('aviso_login');
    return error ? null : avisoParaMostrar(data);
  } catch {
    return null;
  }
}

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const aviso = await lerAviso();
  return (
    <main className="relative min-h-dvh bg-surface">
      <FaixasLogin />
      <div className="grid min-h-dvh gap-12 px-6 py-12 login:grid-cols-2 login:items-center login:gap-16 login:pl-40 login:pr-24">
        <div>
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-11 place-items-center rounded-lg bg-sidebar-active font-extrabold text-sidebar-active-foreground">{MONOGRAMA}</span>
            <span className="font-bold">{NOME_ESCRITORIO}</span>
          </div>
          <p className="mt-12 text-sm font-bold uppercase tracking-widest text-brand">Acesso da equipe</p>
          <h1 className="mt-4 text-display font-light">
            Painel da <strong className="block font-extrabold">equipe</strong>
          </h1>
          {aviso && (
            <p data-testid="aviso-login" className="mt-10 max-w-md border-l-4 border-champagne pl-5 text-lg text-muted">
              {aviso}
            </p>
          )}
        </div>
        <div className="flex w-full max-w-md flex-col gap-6 login:justify-self-end">
          {erro && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {mensagemDeErro(erro)}
            </p>
          )}
          <form action={entrar} className="flex flex-col gap-8">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entrar-email" className={classeRotuloLogin}>E-mail</Label>
              <Input id="entrar-email" name="email" type="email" autoComplete="username" required className={classeCampoSublinhado} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entrar-senha" className={classeRotuloLogin}>Senha</Label>
              <Input id="entrar-senha" name="senha" type="password" autoComplete="current-password" required className={classeCampoSublinhado} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Link href="/esqueci-senha" className="text-sm text-muted underline">Esqueci a senha</Link>
              <Button type="submit" variant="grafite" className="h-12 rounded-md px-10 normal-case text-base">Entrar</Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
