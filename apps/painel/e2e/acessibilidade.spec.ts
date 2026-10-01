import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Auditoria automática de acessibilidade (axe, WCAG 2.0/2.1 A e AA) em todas as telas, no tema claro e no escuro.
// Falha só com violações sérias ou críticas; as moderadas/menores aparecem no log para a próxima revisão.

const EMAIL = 'a11y@teste.com';
const SENHA = 'senha-forte-123';
const TELEFONE = '5531999990901';
const CNPJ = '11444777000161';
// Textos próprios deste spec: não podem conter trechos que outros specs procuram com getByText.
const TITULO = 'Comprovante de acessibilidade (a11y)';
const TITULO_ORIENTACAO = 'Orientação de acessibilidade (a11y)';

let usuarioSemeado: string | null = null;

type Ids = { conversa: string; demanda: string; cliente: string; contato: string; usuario: string; orientacao: string };

async function semear(): Promise<Ids> {
  await db.from('chamados').delete().eq('titulo', TITULO);
  await db.from('conversas').delete().eq('telefone', TELEFONE);
  await db.from('contatos').delete().eq('telefone', TELEFONE);
  await db.from('clientes').delete().eq('cnpj', CNPJ);
  await db.from('orientacoes_agente').delete().eq('titulo', TITULO_ORIENTACAO);
  const usuario = await criarUsuarioTeste({
    email: EMAIL, senha: SENHA, nome: 'Revisora Acessível', papel: 'admin',
    permissoes: ['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site'],
  });
  const { data: cliente } = await db.from('clientes').insert({ razao_social: 'Empresa Acessível Ltda', nome_fantasia: 'Acessível', cnpj: CNPJ }).select().single();
  const { data: contato } = await db.from('contatos').insert({ nome: 'Clara Acessível', telefone: TELEFONE }).select().single();
  await db.from('contato_clientes').insert({ contato_id: contato!.id, cliente_id: cliente!.id, pode_pedir_nota: true });
  const { data: conversa } = await db.from('conversas').insert({ telefone: TELEFONE, contato_id: contato!.id, cliente_em_foco: cliente!.id }).select().single();
  await db.from('mensagens').insert([
    { conversa_id: conversa!.id, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'Bom dia, preciso do comprovante de acessibilidade.' },
    { conversa_id: conversa!.id, direcao: 'saida', autor: 'agente', tipo: 'texto', conteudo: 'Bom dia! Já encaminhei para o Fiscal.' },
  ]);
  const { data: setor } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: demanda } = await db.from('chamados')
    .insert({ conversa_id: conversa!.id, cliente_id: cliente!.id, setor_id: setor!.id, titulo: TITULO, resumo: 'Cliente pediu o comprovante de acessibilidade.' })
    .select('id, numero').single();
  const { error } = await db.from('assistente_mensagens').insert([
    { usuario_id: usuario, canal: 'site', papel: 'usuario', conteudo: 'quais demandas do Fiscal estão abertas?', processada_em: new Date().toISOString() },
    { usuario_id: usuario, canal: 'site', papel: 'assistente', conteudo: 'Há 1 demanda aberta no Fiscal: comprovante de acessibilidade.', processada_em: new Date().toISOString() },
  ]);
  if (error) throw error;
  // Orientação do agente com uma versão no histórico (tela Treinar o agente).
  const { data: orientacao, error: erroOrientacao } = await db.from('orientacoes_agente')
    .insert({ titulo: TITULO_ORIENTACAO, texto: 'Responda com frases curtas.', tipo: 'jeito', cliente_id: cliente!.id, ativo: true })
    .select('id').single();
  if (erroOrientacao) throw erroOrientacao;
  await db.from('orientacoes_agente_versoes').insert({ orientacao_id: orientacao.id, acao: 'criar', titulo: TITULO_ORIENTACAO, texto: 'Responda com frases longas.', tipo: 'jeito', ativo: false });
  usuarioSemeado = usuario;
  return { conversa: conversa!.id, demanda: demanda!.id, cliente: cliente!.id, contato: contato!.id, usuario, orientacao: orientacao.id };
}

// Sem sobras para os outros specs (listas e contagens do Atendimento e de Demandas).
test.afterAll(async () => {
  await db.from('chamados').delete().eq('titulo', TITULO);
  await db.from('conversas').delete().eq('telefone', TELEFONE);
  await db.from('contatos').delete().eq('telefone', TELEFONE);
  await db.from('clientes').delete().eq('cnpj', CNPJ);   // apaga também a orientação dela (cascata)
  await db.from('orientacoes_agente').delete().eq('titulo', TITULO_ORIENTACAO);
  // Apagar o login apaga também a pessoa em usuarios e as mensagens do assistente dela (cascata).
  if (usuarioSemeado) await db.auth.admin.deleteUser(usuarioSemeado);
  await db.from('usuarios').delete().eq('email', EMAIL);
});

async function auditar(page: Page, rotulo: string, tema?: 'claro' | 'escuro'): Promise<string[]> {
  await page.waitForLoadState('load');
  // A rodada escura precisa estar mesmo no escuro (se o cookie mudar de nome, o teste não pode passar auditando o claro).
  if (tema) await expect(page.locator('html')).toHaveAttribute('data-theme', tema === 'escuro' ? 'dark' : 'light');
  // Espera o conteúdo real (sem esqueleto de carregamento) antes de auditar; o catálogo mostra esqueletos de exemplo.
  if (!rotulo.startsWith('/_design')) await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 });
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('nextjs-portal') // sobreposição de desenvolvimento do Next, não é do painel
    .analyze();
  const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const leves = resultado.violations.filter((v) => !graves.includes(v));
  if (leves.length) console.log(`[a11y] ${rotulo}: moderadas/menores: ${leves.map((v) => `${v.id} (${v.nodes.length})`).join(', ')}`);
  return graves.map((v) => `${rotulo}: [${v.impact}] ${v.id} — ${v.help}\n${v.nodes.slice(0, 5).map((n) => `    ${n.target.join(' ')} :: ${n.failureSummary?.split('\n').slice(1, 3).join(' ')}`).join('\n')}`);
}

for (const tema of ['claro', 'escuro'] as const) {
  test.describe(`acessibilidade (tema ${tema})`, () => {
    test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    test.setTimeout(240_000);

    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: 'tema', value: tema, url: baseURL! }]);
    });

    test(`telas públicas sem violações graves (${tema})`, async ({ page }) => {
      const erros: string[] = [];
      await page.goto('/entrar');
      erros.push(...(await auditar(page, '/entrar', tema)));
      await page.goto('/entrar?erro=credenciais');
      erros.push(...(await auditar(page, '/entrar?erro=credenciais', tema)));
      await page.goto('/definir-senha?erro=curta');
      erros.push(...(await auditar(page, '/definir-senha?erro=curta', tema)));
      expect(erros, erros.join('\n')).toEqual([]);
    });

    test(`telas do painel sem violações graves (${tema})`, async ({ page }) => {
      const ids = await semear();
      await entrar(page, EMAIL, SENHA);
      const rotas = [
        '/inicio',
        '/atendimento',
        `/atendimento/${ids.conversa}`,
        '/demandas',
        `/demandas?demanda=${ids.demanda}`,
        '/clientes',
        `/clientes/${ids.cliente}`,
        `/clientes/${ids.cliente}?aba=contatos`,
        `/clientes/${ids.cliente}?aba=precos`,
        '/contatos',
        `/contatos?contato=${ids.contato}`,
        '/assistente',
        '/treinar-agente',
        `/treinar-agente?orientacao=${ids.orientacao}`,
        `/treinar-agente?orientacao=${ids.orientacao}&aba=historico`,
        '/treinar-agente?orientacao=nova&modelo=cumprimento',
        '/usuarios',
        `/usuarios?usuario=${ids.usuario}`,
        '/configuracoes',
        '/_design',
      ];
      const erros: string[] = [];
      for (const rota of rotas) {
        await page.goto(rota);
        erros.push(...(await auditar(page, rota, tema)));
      }
      expect(erros, erros.join('\n')).toEqual([]);
    });

    test(`janelas e menus abertos sem violações graves (${tema})`, async ({ page }) => {
      const ids = await semear();
      await entrar(page, EMAIL, SENHA);
      const erros: string[] = [];
      await page.goto(`/atendimento/${ids.conversa}`);
      await expect(page.getByRole('log', { name: 'Histórico da conversa' })).toBeVisible();

      await page.keyboard.press('Control+k');
      await page.getByRole('dialog').getByRole('combobox').fill('Acess');
      await expect(page.getByRole('option').first()).toBeVisible();
      erros.push(...(await auditar(page, 'busca (Ctrl+K)', tema)));
      await page.keyboard.press('Escape');

      // Fora de qualquer campo (a conversa pode ter posto o foco no compositor).
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await abrirAtalhos(page);
      erros.push(...(await auditar(page, 'atalhos (?)', tema)));
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Menu do usuário' }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      erros.push(...(await auditar(page, 'menu do usuário', tema)));
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Concluir' }).first().click();
      await expect(page.getByRole('alertdialog').or(page.getByRole('dialog'))).toBeVisible();
      erros.push(...(await auditar(page, 'confirmação de concluir', tema)));
      await page.keyboard.press('Escape');

      // Treinar o agente: busca de empresa aberta no formulário e confirmação de restaurar uma versão.
      await page.goto(`/treinar-agente?orientacao=${ids.orientacao}`);
      await page.getByRole('dialog').getByRole('combobox', { name: 'Empresa' }).click();
      await expect(page.getByRole('option').first()).toBeVisible();
      erros.push(...(await auditar(page, 'busca de empresa (Treinar o agente)', tema)));
      await page.keyboard.press('Escape');
      await page.goto(`/treinar-agente?orientacao=${ids.orientacao}&aba=historico`);
      await page.getByRole('button', { name: 'Restaurar esta versão' }).click();
      await expect(page.getByRole('dialog', { name: 'Restaurar esta versão?' })).toBeVisible();
      erros.push(...(await auditar(page, 'confirmação de restaurar (Treinar o agente)', tema)));
      expect(erros, erros.join('\n')).toEqual([]);
    });

    test(`Testar o agente aberto (vazio, pensando, resultado e erro) sem violações graves (${tema})`, async ({ page }) => {
      const ids = await semear();
      await entrar(page, EMAIL, SENHA);
      const erros: string[] = [];
      await page.goto('/treinar-agente');
      await page.getByRole('button', { name: 'Testar o agente' }).click();
      const janela = page.getByRole('dialog', { name: 'Testar o agente' });
      await expect(janela.getByLabel('Mensagem do cliente')).toBeVisible();
      erros.push(...(await auditar(page, 'Testar o agente (vazio)', tema)));
      await janela.getByLabel('Mensagem do cliente').fill('Bom dia, preciso do comprovante.');
      await janela.getByRole('button', { name: 'Enviar teste' }).click();
      await expect(janela.getByText('Pensando…')).toBeVisible();
      erros.push(...(await auditar(page, 'Testar o agente (pensando)', tema)));
      // Sem trabalhador nos e2e: o resultado vai direto no banco, como o trabalhador gravaria.
      await expect.poll(async () => (await db.from('simulacoes_agente').select('id').eq('usuario_id', ids.usuario)).data?.length).toBe(1);
      await db.from('simulacoes_agente').update({
        status: 'pronta',
        respostas: { mensagens: ['Bom dia! Já peço ao Fiscal.'], acoes: [{ ferramenta: 'abrir_chamado', resumo: 'Abriria uma demanda no Fiscal: Comprovante' }], observacoes: ['Aviso do teste.'] },
      }).eq('usuario_id', ids.usuario);
      await expect(janela.getByText('Bom dia! Já peço ao Fiscal.')).toBeVisible({ timeout: 10_000 });
      await janela.getByRole('button', { name: /O que o agente faria/ }).click();
      erros.push(...(await auditar(page, 'Testar o agente (resultado)', tema)));
      await janela.getByRole('button', { name: 'Enviar teste' }).click();
      await expect.poll(async () => (await db.from('simulacoes_agente').select('id').eq('usuario_id', ids.usuario)).data?.length).toBe(2);
      await db.from('simulacoes_agente').update({ status: 'erro', erro: 'Não consegui fazer o teste agora. Tente de novo em alguns minutos.' }).eq('usuario_id', ids.usuario).eq('status', 'pendente');
      await expect(janela.getByRole('alert')).toBeVisible({ timeout: 10_000 });
      erros.push(...(await auditar(page, 'Testar o agente (erro)', tema)));
      expect(erros, erros.join('\n')).toEqual([]);
    });

    test(`Treinar o agente sem orientações (exemplos) sem violações graves (${tema})`, async ({ page }) => {
      await semear();
      await db.from('orientacoes_agente').delete().not('id', 'is', null);
      await entrar(page, EMAIL, SENHA);
      await page.goto('/treinar-agente');
      await expect(page.getByText('Nenhuma orientação ainda.')).toBeVisible();
      const erros = await auditar(page, '/treinar-agente (vazio)', tema);
      expect(erros, erros.join('\n')).toEqual([]);
    });
  });
}

/** ? fora de campos abre a lista; repete enquanto a página hidrata (o ouvinte nasce num useEffect). */
async function abrirAtalhos(page: Page) {
  const janela = page.getByRole('dialog', { name: 'Atalhos do teclado' });
  await expect(async () => {
    await page.keyboard.press('?');
    await expect(janela).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

test('teclado: ? lista os atalhos só fora de campos, Esc devolve o foco e o salto leva ao conteúdo', async ({ page }) => {
  await semear();
  await entrar(page, EMAIL, SENHA);
  await page.goto('/demandas');
  await expect(page.getByRole('heading', { name: 'Demandas' })).toBeVisible();
  const janela = page.getByRole('dialog', { name: 'Atalhos do teclado' });

  // Primeiro Tab: link para pular o menu; Enter leva o foco ao conteúdo.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#conteudo')).toBeFocused();

  // ? abre a lista (com os atalhos pedidos) e Esc fecha devolvendo o foco a quem tinha.
  const menuPessoa = page.getByRole('button', { name: 'Menu do usuário' });
  await menuPessoa.focus();
  await abrirAtalhos(page);
  for (const texto of ['Abrir a busca', 'Próxima / anterior conversa', 'Assumir a conversa aberta', 'Escrever nota interna', 'Fechar a janela ou o painel lateral', 'Mostrar esta lista']) {
    await expect(janela.getByText(texto)).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(janela).toBeHidden();
  await expect(menuPessoa).toBeFocused();

  // Digitando num campo, ? é só um caractere.
  // Antes, a página precisa estar hidratada (senão ? no campo nunca abriria a janela e o teste não provaria nada).
  await page.goto('/clientes');
  await abrirAtalhos(page);
  await page.keyboard.press('Escape');
  await expect(janela).toBeHidden();
  const campo = page.getByRole('main').getByRole('searchbox').first();
  await campo.fill('');
  await campo.press('?');
  await expect(janela).toBeHidden();
  await expect(campo).toHaveValue('?');

  // Também pelo menu da pessoa.
  await menuPessoa.click();
  await page.getByRole('menuitem', { name: /Atalhos do teclado/ }).click();
  await expect(janela).toBeVisible();
  await expect(janela.getByRole('button', { name: 'Fechar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menuPessoa).toBeFocused();

  // A busca aberta pelo atalho (sem clicar no botão) também devolve o foco a quem tinha.
  await page.keyboard.press('Control+k');
  const busca = page.getByRole('dialog', { name: 'Buscar' });
  await expect(busca).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(busca).toBeHidden();
  await expect(menuPessoa).toBeFocused();
});
