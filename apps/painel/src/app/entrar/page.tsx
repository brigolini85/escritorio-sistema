import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { entrar } from './acoes';

const ERROS: Record<string, string> = {
  credenciais: 'E-mail ou senha incorretos.',
  inativo: 'Seu acesso está desativado. Fale com o administrador.',
};

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 pt-24">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-xl font-semibold">Entrar no painel</h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {erro && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {ERROS[erro] ?? 'Não foi possível entrar.'}
            </p>
          )}
          <form action={entrar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entrar-email">E-mail</Label>
              <Input id="entrar-email" name="email" type="email" autoComplete="username" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entrar-senha">Senha</Label>
              <Input id="entrar-senha" name="senha" type="password" autoComplete="current-password" required />
            </div>
            <Button type="submit" className="w-full">Entrar</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
