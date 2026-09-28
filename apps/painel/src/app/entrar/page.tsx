import { entrar } from './acoes';

const ERROS: Record<string, string> = {
  credenciais: 'E-mail ou senha incorretos.',
  inativo: 'Seu acesso está desativado. Fale com o administrador.',
};

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="mx-auto mt-24 max-w-sm rounded-lg bg-white p-6 shadow">
      <h1 className="mb-4 text-xl font-semibold">Entrar no painel</h1>
      {erro && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{ERROS[erro] ?? 'Não foi possível entrar.'}</p>}
      <form action={entrar} className="space-y-3">
        <label className="block text-sm">E-mail<input name="email" type="email" required className="mt-1 w-full rounded border p-2" /></label>
        <label className="block text-sm">Senha<input name="senha" type="password" required className="mt-1 w-full rounded border p-2" /></label>
        <button className="w-full rounded bg-slate-900 p-2 text-white">Entrar</button>
      </form>
    </main>
  );
}
