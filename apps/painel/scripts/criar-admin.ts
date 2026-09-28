import { criarClienteServico } from '@escritorio/db';

// Uso: pnpm --filter @escritorio/painel exec tsx --env-file=../../.env scripts/criar-admin.ts "Nome" email@dominio.com
const [nome, email] = process.argv.slice(2);
if (!nome || !email) {
  console.error('Uso: criar-admin.ts "Nome" email@dominio.com');
  process.exit(1);
}
const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${process.env.PAINEL_URL}/auth/confirm` });
if (error) throw error;
const { error: e2 } = await db.from('usuarios').insert({ id: data.user.id, nome, email, papel: 'admin' });
if (e2) throw e2;
console.log(`Convite enviado para ${email}. Abra o e-mail e defina a senha.`);
