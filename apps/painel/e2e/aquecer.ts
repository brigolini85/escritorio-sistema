import { chromium, type Browser, type FullConfig } from '@playwright/test';
// apoio.ts cria o cliente pela trava-local: com SUPABASE_URL fora do banco local, importar já recusa a rodada.
import { criarUsuarioTeste, db, entrar } from './apoio';

// Aquece o servidor de desenvolvimento: a primeira visita a cada rota compila a tela (muitos segundos) e
// estourava a espera dos testes na primeira rodada a frio. Aqui as telas compilam uma vez, antes dos specs.
// É só ajuda: uma falha aqui vira aviso e os testes seguem; a pessoa de aquecimento sempre é apagada no fim.
const EMAIL = 'aquecer@teste.com';
const SENHA = 'senha-forte-123';
const ROTAS = [
  '/inicio', '/atendimento', '/demandas', '/demandas?nova=1', '/demandas?vencidas=1', '/demandas?prazo=hoje',
  '/clientes', '/contatos', '/usuarios', '/usuarios/novo', '/configuracoes', '/treinar-agente', '/assistente',
];

const texto = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default async function aquecer(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!;
  let navegador: Browser | null = null;
  try {
    const usuario = await criarUsuarioTeste({ email: EMAIL, senha: SENHA, nome: 'Aquecimento', papel: 'admin' });
    navegador = await chromium.launch();
    const page = await (await navegador.newContext({ baseURL, locale: 'pt-BR' })).newPage();
    page.setDefaultTimeout(120_000);
    await entrar(page, EMAIL, SENHA);
    for (const rota of ROTAS) {
      try {
        await page.goto(rota, { waitUntil: 'load' });
      } catch (e) {
        console.warn(`[aquecer] ${rota} não abriu (os testes seguem): ${texto(e)}`);
      }
    }
    // Quadro: é preferência da pessoa; liga e visita (a pessoa some no fim).
    try {
      await db.from('usuarios').update({ visao_demandas: 'quadro' }).eq('id', usuario);
      await page.goto('/demandas', { waitUntil: 'load' });
      await page.getByRole('button', { name: 'Quadro' }).waitFor();
    } catch (e) {
      console.warn(`[aquecer] quadro não abriu (os testes seguem): ${texto(e)}`);
    }
  } catch (e) {
    console.warn(`[aquecer] aquecimento interrompido (os testes seguem): ${texto(e)}`);
  } finally {
    await navegador?.close().catch((e) => console.warn(`[aquecer] navegador não fechou: ${texto(e)}`));
    await apagarPessoaDeAquecimento();
  }
}

/** Pelo e-mail, não pelo id: apaga também o login que ficou se a criação parou no meio. */
async function apagarPessoaDeAquecimento() {
  try {
    const { data, error } = await db.auth.admin.listUsers();
    if (error) throw error;
    for (const u of data.users.filter((x) => x.email === EMAIL)) {
      // Apagar o login apaga também a pessoa em usuarios (cascata).
      const { error: erro } = await db.auth.admin.deleteUser(u.id);
      if (erro) console.error(`[aquecer] não apagou o login ${EMAIL}: ${erro.message}`);
    }
    const { error: erroPessoa } = await db.from('usuarios').delete().eq('email', EMAIL);
    if (erroPessoa) console.error(`[aquecer] não apagou a pessoa ${EMAIL}: ${erroPessoa.message}`);
  } catch (e) {
    console.error(`[aquecer] limpeza falhou; apague ${EMAIL} à mão no banco local: ${texto(e)}`);
  }
}
