import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SENHA_MINIMA } from '@/lib/senha';
import { lerClaims, origemDaSessao } from '@/lib/sessao-limites';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { MUITAS_TENTATIVAS } from '@/lib/textos-login';
import { definirSenha } from './acoes';

const ERROS: Record<string, string> = {
  curta: 'A senha precisa ter pelo menos 10 caracteres.',
  falha: 'Não foi possível salvar. Abra o link do e-mail de novo.',
  // Auditoria 2.6: fora do link recente, a troca pede a senha atual.
  atual: 'Digite sua senha atual para trocar a senha.',
  atual_errada: 'Senha atual incorreta.',
  tentativas: MUITAS_TENTATIVAS,
  // Revisão (auditoria 2.6): secure_password_change recusa troca de sessão com mais de 24 h.
  reautenticar: 'Por segurança, entre de novo no painel e troque a senha logo em seguida.',
};

export default async function DefinirSenha({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const aviso = erro && Object.hasOwn(ERROS, erro) ? ERROS[erro] : undefined;
  // Auditoria 2.6: sessão de login comum precisa da senha atual; a do link, só nos primeiros 15 min (revisão M1: link
  // vencido manda pedir outro, porque quem veio do convite não tem senha atual).
  const sb = await supabaseServidor();
  const { data: auth } = await sb.auth.getUser();
  let origem: ReturnType<typeof origemDaSessao> | null = null;
  if (auth.user) {
    const { data: sessao } = await sb.auth.getSession();
    origem = origemDaSessao(sessao.session ? lerClaims(sessao.session.access_token) : null, Date.now());
  }
  const pedirAtual = origem === 'outra';
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 pt-24">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-xl font-semibold">Defina sua senha</h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {origem === 'link_vencido' ? (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              O link venceu. Peça um novo em{' '}
              <Link href="/esqueci-senha" className="font-medium underline">Esqueci a senha</Link>.
            </p>
          ) : (
            <>
              {aviso && (
                <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                  {aviso}
                </p>
              )}
              <form action={definirSenha} className="flex flex-col gap-4">
                {pedirAtual && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="senha-atual">Senha atual</Label>
                    <Input id="senha-atual" name="senha_atual" type="password" required autoComplete="current-password" placeholder="Senha atual" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nova-senha">Nova senha</Label>
                  <Input
                    id="nova-senha"
                    name="senha"
                    type="password"
                    minLength={SENHA_MINIMA}
                    required
                    autoComplete="new-password"
                    placeholder="Nova senha"
                    aria-describedby="nova-senha-ajuda"
                  />
                  <p id="nova-senha-ajuda" className="text-sm text-muted">Pelo menos 10 caracteres.</p>
                </div>
                <Button type="submit" className="w-full">Salvar</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
