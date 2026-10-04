import { expect, type Page } from '@playwright/test';
import { db } from './apoio';

export const PREFIXO = 'G3E2E';
export const minAtras = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

/**
 * Abre Contatos e espera o navegador assumir a página (data-contatos-hidratado, marcado num useEffect). Digitar ou clicar
 * antes disso perde a ação (mesmo cuidado do abrirInicio da G2).
 */
export async function abrirContatos(page: Page, consulta = ''): Promise<void> {
  await page.goto(`/contatos${consulta}`);
  await expect(page.locator('[data-contatos-hidratado]')).toHaveCount(1, { timeout: 30_000 });
}

/** Número de um filtro rápido (contrato data-filtro/data-contagem). */
export async function contagemFiltro(page: Page, filtro: string): Promise<number> {
  return Number((await page.locator(`[data-filtro="${filtro}"] [data-contagem]`).innerText()).trim());
}

/** Linha da tabela pelo texto. Por CSS: com o painel aberto, a tabela fica aria-hidden e getByRole não a acha. */
export const linhaContato = (page: Page, texto: string) => page.locator('tbody tr').filter({ hasText: texto });

/** Apaga o que os testes da G3 criaram (demandas, conversas, contatos e empresas com o prefixo). */
export async function limparG3(): Promise<void> {
  await db.from('chamados').delete().like('titulo', `${PREFIXO}%`);
  const { data: cs } = await db.from('contatos').select('telefone').like('nome', `${PREFIXO}%`);
  const telefones = (cs ?? []).map((c) => c.telefone);
  if (telefones.length) await db.from('conversas').delete().in('telefone', telefones);
  await db.from('contatos').delete().like('nome', `${PREFIXO}%`);
  await db.from('clientes').delete().like('razao_social', `${PREFIXO}%`);
}

/** Conversa com mensagens em horários dados (a mais nova é o "último contato"). */
export async function conversaCom(
  telefone: string, contatoId: string | null, mensagens: { autor: 'cliente' | 'agente' | 'atendente'; em: string }[], extra: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await db.from('conversas').insert({ telefone, contato_id: contatoId, ...extra }).select('id').single();
  if (error) throw error;
  for (const m of mensagens) {
    const entrada = m.autor === 'cliente';
    await db.from('mensagens').insert({
      conversa_id: data.id, direcao: entrada ? 'entrada' : 'saida', autor: m.autor, tipo: 'texto', conteudo: 'oi',
      criado_em: m.em, processada_em: entrada ? m.em : null,
    });
  }
  return data.id;
}

/**
 * Rede e Mercado (ativas), Zeta (arquivada) e Padaria (ativa, sem ninguém). Carla: Rede (pede nota), Mercado (nada) e Zeta (muda
 * preço, arquivada), esperando pessoa há 9 min; Roberto: Rede (pede nota e muda preço), com o agente; Sandra: sem empresa,
 * agente desligado, sem conversa.
 */
export async function semearContatos() {
  const empresa = async (razao: string, cnpj: string, ativo = true) =>
    (await db.from('clientes').insert({ razao_social: `${PREFIXO} ${razao}`, cnpj, ativo }).select('id').single()).data!.id;
  const rede = await empresa('Rede Bom Preço Ltda', '31000000000101');
  const mercado = await empresa('Mercado Central', '31000000000202');
  const zeta = await empresa('Zeta Arquivada', '31000000000303', false);
  const padaria = await empresa('Padaria Sol', '31000000000404');
  const contato = async (nome: string, telefone: string, agente_pausado = false) =>
    (await db.from('contatos').insert({ nome: `${PREFIXO} ${nome}`, telefone, agente_pausado }).select('id').single()).data!.id;
  const carla = await contato('Carla Mendes', '5531980020001');
  const roberto = await contato('Roberto Nunes', '5531980020002');
  const sandra = await contato('Sandra Costa', '5531980020003', true);
  // defaultToNull false: no insert de várias linhas, a marcação que falta numa linha fica com o padrão do banco (false), não null.
  const vinculos = await db.from('contato_clientes').insert([
    { contato_id: carla, cliente_id: rede, pode_pedir_nota: true },
    { contato_id: carla, cliente_id: mercado },
    { contato_id: carla, cliente_id: zeta, pode_atualizar_preco: true },
    { contato_id: roberto, cliente_id: rede, pode_pedir_nota: true, pode_atualizar_preco: true },
  ], { defaultToNull: false });
  if (vinculos.error) throw vinculos.error;
  const conversaCarla = await conversaCom('5531980020001', carla, [{ autor: 'cliente', em: minAtras(10) }], { aguardando_pessoa_desde: minAtras(9) });
  await db.from('conversa_eventos').insert({ conversa_id: conversaCarla, tipo: 'passou_para_pessoa', criado_em: minAtras(9) });
  await conversaCom('5531980020002', roberto, [{ autor: 'cliente', em: minAtras(121) }, { autor: 'agente', em: minAtras(120) }]);
  return { rede, mercado, zeta, padaria, carla, roberto, sandra, conversaCarla };
}

/**
 * Histórico da Carla para o bloco WhatsApp e as demandas: há 2 dias a equipe respondeu; ontem só o agente; hoje passou para
 * pessoa (semearContatos) → 3 atendimentos, 1 resolvido pelo agente (33%). Demandas: uma urgente e uma normal abertas no
 * Fiscal e uma concluída (não aparece).
 */
export async function semearHistorico(s: Awaited<ReturnType<typeof semearContatos>>) {
  await db.from('mensagens').insert([
    { conversa_id: s.conversaCarla, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'oi', criado_em: minAtras(48 * 60), processada_em: minAtras(48 * 60) },
    { conversa_id: s.conversaCarla, direcao: 'saida', autor: 'atendente', tipo: 'texto', conteudo: 'pois não', criado_em: minAtras(48 * 60 - 5) },
    { conversa_id: s.conversaCarla, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'oi', criado_em: minAtras(24 * 60), processada_em: minAtras(24 * 60) },
    { conversa_id: s.conversaCarla, direcao: 'saida', autor: 'agente', tipo: 'texto', conteudo: 'olá', criado_em: minAtras(24 * 60 - 1) },
  ]);
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const demanda = async (titulo: string, prioridade: 'urgente' | 'normal', concluida = false) => (await db.from('chamados').insert({
    conversa_id: s.conversaCarla, setor_id: fiscal!.id, titulo: `${PREFIXO} ${titulo}`, prioridade,
    ...(concluida ? { status: 'concluido', concluido_em: new Date().toISOString() } : {}),
  }).select('id, numero').single()).data!;
  const urgente = await demanda('Nota de venda', 'urgente');
  await demanda('Alteração de sócio', 'normal');
  await demanda('Antiga', 'normal', true);
  return { urgente };
}
