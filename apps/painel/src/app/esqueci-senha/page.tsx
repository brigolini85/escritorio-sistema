import Link from 'next/link';
import { classeCampoSublinhado, classeRotuloLogin, FaixasLogin } from '@/app/entrar/faixas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MUITAS_TENTATIVAS } from '@/lib/textos-login';
import { pedirNovaSenha } from './acoes';

export default async function EsqueciSenha({ searchParams }: { searchParams: Promise<{ enviado?: string; erro?: string }> }) {
  const { enviado, erro } = await searchParams;
  return (
    <main className="relative min-h-dvh bg-surface">
      <FaixasLogin />
      <div className="grid min-h-dvh items-center px-6 py-12 login:pl-40 login:pr-24">
        <div className="flex w-full max-w-md flex-col gap-6">
          <h1 className="text-3xl font-extrabold">Esqueci a senha</h1>
          {enviado ? (
            <>
              <p role="status" className="text-lg text-muted">Se o e-mail estiver cadastrado, o link chega em instantes.</p>
              <Link href="/entrar" className="text-sm text-muted underline">Voltar para a entrada</Link>
            </>
          ) : (
            <form action={pedirNovaSenha} className="flex flex-col gap-8">
              {erro === 'envio' && (
                <p role="alert" className="text-base font-medium text-danger">Não deu para enviar agora. Tente de novo em alguns minutos.</p>
              )}
              {erro === 'tentativas' && <p role="alert" className="text-base font-medium text-danger">{MUITAS_TENTATIVAS}</p>}
              <p className="text-muted">Informe o e-mail do seu acesso. Enviamos um link para definir uma nova senha.</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="esqueci-email" className={classeRotuloLogin}>E-mail</Label>
                <Input id="esqueci-email" name="email" type="email" autoComplete="username" required className={classeCampoSublinhado} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Link href="/entrar" className="text-sm text-muted underline">Voltar para a entrada</Link>
                <Button type="submit" variant="grafite" className="h-12 rounded-md px-10 normal-case text-base">Enviar link</Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
