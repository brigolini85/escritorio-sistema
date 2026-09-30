import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Auditoria automática de acessibilidade (axe, WCAG 2.0/2.1 A e AA) em todas as telas, no tema claro e no escuro.
// Falha só com violações sérias ou críticas; as moderadas/menores aparecem no log para a próxima revisão.

const EMAIL = 'a11y@teste.com';
const SENHA = 'senha-forte-123';
const TELEFONE = '5531999990901';
const CNPJ = '11444777000161';
const TITULO = 'Guia do DAS de setembro (a11y)';

type Ids = { conversa: string; demanda: string; cliente: string; contato: string; usuario: string };

async function semear(): Promise<Ids> {
  await db.from('chamados').delete().eq('titulo', TITULO);
  await db.from('conversas').delete().eq('telefone', TELEFONE);
  await db.from('contatos').delete().eq('telefone', TELEFONE);
  await db.from('clientes').delete().eq('cnpj', CNPJ);
  const usuario = await criarUsuarioTeste({
    email: EMAIL, senha: SENHA, nome: 'Revisora Acessível', papel: 'admin',
    permissoes: ['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site'],
  });
  const { data: cliente } = await db.from('clientes').insert({ razao_social: 'Empresa Acessível Ltda', nome_fantasia: 'Acessível', cnpj: CNPJ }).select().single();
  const { data: contato } = await db.from('contatos').insert({ nome: 'Clara Acessível', telefone: TELEFONE }).select().single();
  await db.from('contato_clientes').insert({ contato_id: contato!.id, cliente_id: cliente!.id, pode_pedir_nota: true });
  const { data: conversa } = await db.from('conversas').insert({ telefone: TELEFONE, contato_id: contato!.id, cliente_em_foco: cliente!.id }).select().single();
  await db.from('mensagens').insert([
    { conversa_id: conversa!.id, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'Bom dia, preciso da guia do DAS.' },
    { conversa_id: conversa!.id, direcao: 'saida', autor: 'agente', tipo: 'texto', conteudo: 'Bom dia! Já encaminhei para o Fiscal.' },
  ]);
  const { data: setor } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: demanda } = await db.from('chamados')
    .insert({ conversa_id: conversa!.id, cliente_id: cliente!.id, setor_id: setor!.id, titulo: TITULO, resumo: 'Cliente pediu a guia do DAS de setembro.' })
    .select('id, numero').single();
  const { error } = await db.from('assistente_mensagens').insert([
    { usuario_id: usuario, canal: 'site', papel: 'usuario', conteudo: 'quais demandas do Fiscal estão abertas?', processada_em: new Date().toISOString() },
    { usuario_id: usuario, canal: 'site', papel: 'assistente', conteudo: 'Há 1 demanda aberta no Fiscal: guia do DAS de setembro.', processada_em: new Date().toISOString() },
  ]);
  if (error) throw error;
  return { conversa: conversa!.id, demanda: demanda!.id, cliente: cliente!.id, contato: contato!.id, usuario };
}

async function auditar(page: Page, rotulo: string): Promise<string[]> {
  await page.waitForLoadState('load');
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
      erros.push(...(await auditar(page, '/entrar')));
      await page.goto('/entrar?erro=credenciais');
      erros.push(...(await auditar(page, '/entrar?erro=credenciais')));
      await page.goto('/definir-senha?erro=curta');
      erros.push(...(await auditar(page, '/definir-senha?erro=curta')));
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
        '/usuarios',
        `/usuarios?usuario=${ids.usuario}`,
        '/configuracoes',
        '/_design',
      ];
      const erros: string[] = [];
      for (const rota of rotas) {
        await page.goto(rota);
        erros.push(...(await auditar(page, rota)));
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
      erros.push(...(await auditar(page, 'busca (Ctrl+K)')));
      await page.keyboard.press('Escape');

      // Fora de qualquer campo (a conversa pode ter posto o foco no compositor).
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('?');
      await expect(page.getByRole('dialog', { name: 'Atalhos do teclado' })).toBeVisible();
      erros.push(...(await auditar(page, 'atalhos (?)')));
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Menu do usuário' }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      erros.push(...(await auditar(page, 'menu do usuário')));
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Concluir' }).first().click();
      await expect(page.getByRole('alertdialog').or(page.getByRole('dialog'))).toBeVisible();
      erros.push(...(await auditar(page, 'confirmação de concluir')));
      expect(erros, erros.join('\n')).toEqual([]);
    });
  });
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
  await page.keyboard.press('?');
  await expect(janela).toBeVisible();
  for (const texto of ['Abrir a busca', 'Próxima / anterior conversa', 'Assumir a conversa aberta', 'Escrever nota interna', 'Fechar a janela ou o painel lateral', 'Mostrar esta lista']) {
    await expect(janela.getByText(texto)).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(janela).toBeHidden();
  await expect(menuPessoa).toBeFocused();

  // Digitando num campo, ? é só um caractere.
  await page.goto('/clientes');
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
});
