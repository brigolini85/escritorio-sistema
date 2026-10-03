import { chromium, type FullConfig } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Aquece o servidor de desenvolvimento: a primeira visita a cada rota compila a tela (muitos segundos) e
// estourava a espera dos testes na primeira rodada a frio. Aqui as telas compilam uma vez, antes dos specs.
const EMAIL = 'aquecer@teste.com';
const SENHA = 'senha-forte-123';
const ROTAS = [
  '/inicio', '/atendimento', '/demandas', '/demandas?nova=1', '/demandas?vencidas=1', '/demandas?prazo=hoje',
  '/clientes', '/contatos', '/usuarios', '/configuracoes', '/treinar-agente', '/assistente',
];

export default async function aquecer(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!;
  const usuario = await criarUsuarioTeste({ email: EMAIL, senha: SENHA, nome: 'Aquecimento', papel: 'admin' });
  const navegador = await chromium.launch();
  try {
    const page = await (await navegador.newContext({ baseURL, locale: 'pt-BR' })).newPage();
    page.setDefaultTimeout(120_000);
    await page.goto('/entrar');
    await entrar(page, EMAIL, SENHA);
    for (const rota of ROTAS) await page.goto(rota, { waitUntil: 'load' });
    // Quadro: é preferência da pessoa; liga, visita e desfaz (a pessoa some no fim).
    await db.from('usuarios').update({ visao_demandas: 'quadro' }).eq('id', usuario);
    await page.goto('/demandas', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Quadro' }).waitFor();
  } finally {
    await navegador.close();
    // Apagar o login apaga também a pessoa em usuarios (cascata).
    await db.auth.admin.deleteUser(usuario);
    await db.from('usuarios').delete().eq('email', EMAIL);
  }
}
