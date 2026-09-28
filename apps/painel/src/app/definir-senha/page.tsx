import { redirect } from 'next/navigation';
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

export default async function DefinirSenha({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="mx-auto mt-24 max-w-sm rounded-lg bg-white p-6 shadow">
      <h1 className="mb-4 text-xl font-semibold">Defina sua senha</h1>
      {erro === 'curta' && <p className="mb-3 text-sm text-red-700">A senha precisa ter pelo menos 10 caracteres.</p>}
      {erro === 'falha' && <p className="mb-3 text-sm text-red-700">Não foi possível salvar. Abra o link do e-mail de novo.</p>}
      <form action={definir} className="space-y-3">
        <input name="senha" type="password" minLength={10} required className="w-full rounded border p-2" placeholder="Nova senha" />
        <button className="w-full rounded bg-slate-900 p-2 text-white">Salvar</button>
      </form>
    </main>
  );
}
