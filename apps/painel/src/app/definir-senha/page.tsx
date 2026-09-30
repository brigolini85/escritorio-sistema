import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabaseServidor } from '@/lib/supabase/servidor';

async function definir(formData: FormData) {
  'use server';
  const senha = String(formData.get('senha') ?? '');
  if (senha.length < 10) redirect('/definir-senha?erro=curta');
  const sb = await supabaseServidor();
  const { error } = await sb.auth.updateUser({ password: senha });
  if (error) redirect('/definir-senha?erro=falha');
  redirect('/inicio');
}

const ERROS: Record<string, string> = {
  curta: 'A senha precisa ter pelo menos 10 caracteres.',
  falha: 'Não foi possível salvar. Abra o link do e-mail de novo.',
};

export default async function DefinirSenha({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const aviso = erro ? ERROS[erro] : undefined;
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 pt-24">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-xl font-semibold">Defina sua senha</h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {aviso && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {aviso}
            </p>
          )}
          <form action={definir} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <Input
                id="nova-senha"
                name="senha"
                type="password"
                minLength={10}
                required
                autoComplete="new-password"
                placeholder="Nova senha"
                aria-describedby="nova-senha-ajuda"
              />
              <p id="nova-senha-ajuda" className="text-sm text-muted">Pelo menos 10 caracteres.</p>
            </div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
