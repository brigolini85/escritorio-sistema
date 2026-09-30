import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import type { ClienteIa } from '../../src/agente/cliente-ia';
import {
  MENSAGEM_EMPRESA_SIMULACAO, MENSAGEM_FALHA_SIMULACAO, MENSAGEM_PRAZO_SIMULACAO, MENSAGEM_TETO_SIMULACAO, processarSimulacao,
  reposDaSimulacao, type RespostasSimulacao,
} from '../../src/agente/simular';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, setorId } from '../apoio/cenario';
import { IaRoteirizada, fim, fimVazio, usarFerramentas } from '../apoio/ia-roteirizada';
import { criarUsuarioTeste } from '../apoio/usuario';

const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
const TABELAS_DE_NEGOCIO = [
  'chamados', 'chamado_eventos', 'mensagens', 'precos', 'produtos', 'decisoes_agente', 'conversas', 'contatos', 'contato_clientes',
  'parceiros_unidades', 'orientacoes_agente', 'orientacoes_agente_versoes', 'auditoria_acessos', 'alertas',
] as const;
let canal: CanalFalso;
let usuarioId: string;

function deps(ia: ClienteIa, extra: { prazoMs?: number } = {}) {
  return { repos, ia, envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) }, relogio: () => SEGUNDA_10H, ...extra };
}

async function novaSimulacao(p: { mensagem?: string; clienteId?: string | null; rascunho?: object | null } = {}): Promise<string> {
  const { data, error } = await db.from('simulacoes_agente').insert({
    usuario_id: usuarioId, mensagem: p.mensagem ?? 'Oi, preciso de uma nota', cliente_id: p.clienteId ?? null, rascunho: (p.rascunho ?? null) as never,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function simulacao(id: string) {
  const s = (await repos.simulacaoPorId(id))!;
  return { ...s, respostas: s.respostas as RespostasSimulacao | null };
}

async function contagens(): Promise<Record<string, number>> {
  const r: Record<string, number> = {};
  for (const t of TABELAS_DE_NEGOCIO) {
    const { count, error } = await db.from(t).select('*', { count: 'exact', head: true });
    if (error || count === null) throw new Error(`${t}: ${error?.message ?? 'sem contagem'}`);
    r[t] = count;
  }
  return r;
}

const textoSistema = (ia: IaRoteirizada, i = 0) => (ia.recebidos[i]!.system as { text: string }[]).map((b) => b.text).join('\n----\n');
const textoUsuario = (ia: IaRoteirizada) => JSON.stringify(ia.recebidos[0]!.messages[0]!.content);

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  usuarioId = await criarUsuarioTeste({ email: 'treino@teste.local', permissoes: ['treinar_agente'] });
});

describe('processarSimulacao', () => {
  it('ferramentas que gravam ou enviam não gravam nem enviam nada; respostas e custo registrados', async () => {
    const { empresas } = await contatoComEmpresas(['Indústria X']);
    const x = empresas[0]!;
    const c = await criarCadastrosExemplo(x.id);
    const fiscal = await setorId('Fiscal');
    const id = await novaSimulacao({ clienteId: x.id });
    const antes = await contagens();
    const pedido = {
      tipo: 'venda', unidade_id: c.brasilEfigenia, texto_destinatario: 'Brasil Santa Efigênia',
      itens: [{ produto_id: c.costela, texto: 'costela', quantidade: 10, unidade: 'PAC' }],
    };
    const ia = new IaRoteirizada([
      usarFerramentas(
        { nome: 'buscar_parceiros', entrada: { texto: 'Brasil Santa Efigênia', tipo: 'cliente' } },
        { nome: 'buscar_produtos', entrada: { textos: ['costela'] } },
      ),
      usarFerramentas({ nome: 'resumir_pedido_nota', entrada: pedido }),
      usarFerramentas(
        { nome: 'abrir_pedido_nota', entrada: { ...pedido, pedido_original: '10 costela pro Brasil', cliente_confirmou_resumo: true } },
        { nome: 'abrir_chamado', entrada: { setor_id: fiscal, titulo: 'Guia DAS de setembro', resumo: 'Cliente pediu a guia.', fora_do_contrato: false } },
        { nome: 'alterar_preco', entrada: { unidade_id: c.brasilEfigenia, produto_id: c.costela, novo_valor: 10, confirmado_pelo_cliente: true } },
        { nome: 'cadastrar_produto', entrada: { codigo: '30', descricao: 'Lasanha Bolonhesa', unidade: 'pac', apelidos: [], confirmado_pelo_cliente: true } },
        { nome: 'enviar_documento', entrada: { documento_id: c.contrato } },
        { nome: 'sinalizar_nao_entendido', entrada: {} },
        { nome: 'selecionar_empresa', entrada: { cliente_id: x.id } },
      ),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Pode deixar, já passei pro Fiscal.\n\nMais alguma coisa?' } }),
      fim(),
    ]);

    expect(await processarSimulacao(deps(ia), id, false)).toBe('pronta');

    expect(canal.enviados).toEqual([]);
    expect(await contagens()).toEqual(antes);
    expect((await db.from('precos').select('valor').eq('produto_id', c.costela)).data).toEqual([{ valor: 9.5 }]);
    const s = await simulacao(id);
    expect(s.status).toBe('pronta');
    expect(s.erro).toBeNull();
    const r = s.respostas!;
    // O resumo que o sistema mandaria vem inteiro, antes das mensagens do agente.
    expect(r.mensagens[0]).toContain('Costela com Requeijão');
    expect(r.mensagens.slice(1)).toEqual(['[documento] Contrato social', 'Pode deixar, já passei pro Fiscal.', 'Mais alguma coisa?']);
    expect(r.acoes.map((a) => a.ferramenta)).toEqual([
      'resumir_pedido_nota', 'abrir_pedido_nota', 'abrir_chamado', 'alterar_preco', 'cadastrar_produto', 'enviar_documento', 'sinalizar_nao_entendido', 'selecionar_empresa',
    ]);
    expect(r.acoes[1]!.resumo).toMatch(/^Passaria a nota para o Fiscal: NF de venda/);
    expect(r.acoes[2]!.resumo).toBe('Abriria uma demanda no Fiscal: Guia DAS de setembro');
    expect(r.acoes[3]!.resumo).toBe('Alteraria o preço de Costela com Requeijão para a rede Supermercado Brasil: de R$ 9,50 para R$ 10,00');
    expect(r.acoes[4]!.resumo).toBe('Cadastraria o produto 30 - Lasanha Bolonhesa (PAC)');
    // Leituras rodaram de verdade (o agente recebeu os candidatos).
    expect(ia.recebidos[1]!.messages.at(-1)!.content).toMatchObject([{ is_error: false }, { is_error: false }]);
    expect(JSON.stringify(ia.recebidos[1]!.messages.at(-1)!.content)).toContain(c.brasilEfigenia);
    expect(ia.recebidos[3]!.messages.at(-1)!.content).toMatchObject(Array(7).fill({ is_error: false }));
    // Custo gravado sem conversa: conta no teto.
    const uso = (await db.from('uso_ia').select('conversa_id')).data!;
    expect(uso).toHaveLength(5);
    expect(uso.every((u) => u.conversa_id === null)).toBe(true);
  });

  it('pedido de nota sem resumo neste teste é recusado, como no atendimento', async () => {
    const { empresas } = await contatoComEmpresas(['Indústria X']);
    const c = await criarCadastrosExemplo(empresas[0]!.id);
    const id = await novaSimulacao({ clienteId: empresas[0]!.id });
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'abrir_pedido_nota', entrada: {
        tipo: 'venda', unidade_id: c.brasilEfigenia, texto_destinatario: 'Brasil', pedido_original: 'x', cliente_confirmou_resumo: true,
        itens: [{ produto_id: c.costela, texto: 'costela', quantidade: 1, unidade: 'PAC' }],
      } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Vou conferir.' } }),
      fim(),
    ]);
    await processarSimulacao(deps(ia), id, false);
    expect(ia.recebidos[1]!.messages.at(-1)!.content).toMatchObject([{ is_error: true }]);
    expect((await simulacao(id)).respostas!.acoes).toEqual([]);
  });

  it('orientações ligadas + rascunho (no lugar da orientação que ele edita); desligada não entra', async () => {
    const { empresas } = await contatoComEmpresas(['Indústria X']);
    const x = empresas[0]!;
    const { data: editada } = await db.from('orientacoes_agente').insert({ titulo: 'Cumprimento', texto: 'Texto antigo do cumprimento.', tipo: 'jeito', ativo: true }).select().single();
    await db.from('orientacoes_agente').insert({ titulo: 'Prazo', texto: 'Notas saem em até 2 horas.', tipo: 'regra', ativo: true });
    await db.from('orientacoes_agente').insert({ titulo: 'Desligada', texto: 'Não deveria aparecer.', tipo: 'regra', ativo: false });
    const id = await novaSimulacao({ clienteId: x.id, rascunho: { id: editada!.id, titulo: 'Cumprimento', texto: 'Deseje ótima semana.', tipo: 'jeito', cliente_id: null, setor_id: null } });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá! Ótima semana.' } }), fim()]);
    await processarSimulacao(deps(ia), id, false);
    const sistema = textoSistema(ia);
    expect(sistema).toContain('[Jeito de atender] Cumprimento: Deseje ótima semana.');
    expect(sistema).toContain('Notas saem em até 2 horas.');
    expect(sistema).not.toContain('Texto antigo do cumprimento.');
    expect(sistema).not.toContain('Não deveria aparecer.');
    expect((await simulacao(id)).respostas!.mensagens).toEqual(['Olá! Ótima semana.']);
    // Nada muda nas orientações salvas.
    expect((await db.from('orientacoes_agente').select('texto').eq('id', editada!.id).single()).data!.texto).toBe('Texto antigo do cumprimento.');
  });

  it('rascunho de empresa: entra no bloco da empresa escolhida; testado com outra empresa, fica de fora e avisa', async () => {
    const { empresas } = await contatoComEmpresas(['Indústria X', 'Comércio Y']);
    const [x, y] = empresas as [typeof empresas[0], typeof empresas[0]];
    const rascunho = { titulo: 'Senha', texto: 'ZEBRA-42 é a palavra do cliente.', tipo: 'situacao', cliente_id: x.id, setor_id: null };

    const comX = await novaSimulacao({ clienteId: x.id, rascunho });
    const ia1 = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
    await processarSimulacao(deps(ia1), comX, false);
    const blocos = ia1.recebidos[0]!.system as { text: string }[];
    expect(blocos[0]!.text).not.toContain('ZEBRA-42');
    expect(blocos[1]!.text).toContain('ZEBRA-42');
    expect((await simulacao(comX)).respostas!.observacoes).toEqual([]);

    const comY = await novaSimulacao({ clienteId: y.id, rascunho });
    const ia2 = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
    await processarSimulacao(deps(ia2), comY, false);
    expect(textoSistema(ia2)).not.toContain('ZEBRA-42');
    expect((await simulacao(comY)).respostas!.observacoes).toEqual([expect.stringContaining('vale só para outra empresa')]);
  });

  it('empresa escolhida: só ela no contexto, cadastros e orientações de outra empresa não aparecem', async () => {
    const { empresas } = await contatoComEmpresas(['Indústria X', 'Comércio Y']);
    const [x, y] = empresas as [typeof empresas[0], typeof empresas[0]];
    const cy = await criarCadastrosExemplo(y.id);
    await db.from('orientacoes_agente').insert({ titulo: 'Da Y', texto: 'Segredo da Comércio Y.', tipo: 'regra', ativo: true, cliente_id: y.id });
    const id = await novaSimulacao({ clienteId: x.id });
    const ia = new IaRoteirizada([
      usarFerramentas(
        { nome: 'buscar_parceiros', entrada: { texto: 'Brasil', tipo: 'cliente' } },
        { nome: 'consultar_cadastro', entrada: { unidade_id: cy.brasilEfigenia } },
        { nome: 'selecionar_empresa', entrada: { cliente_id: y.id } },
      ),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Não encontrei.' } }),
      fim(),
    ]);
    await processarSimulacao(deps(ia), id, false);
    const usuario = textoUsuario(ia);
    expect(usuario).toContain(`Empresa em foco: [${x.id}] Indústria X`);
    expect(usuario).not.toContain('Comércio Y');
    expect(textoSistema(ia)).not.toContain('Segredo da Comércio Y.');
    const [parceiros, cadastro, selecao] = ia.recebidos[1]!.messages.at(-1)!.content as { content: string; is_error: boolean }[];
    expect(JSON.parse(parceiros!.content)).toEqual({ candidatos: [] });
    expect(cadastro!.is_error).toBe(true);
    expect(selecao!.is_error).toBe(true);
    expect(textoSistema(ia, 1)).not.toContain('Segredo da Comércio Y.');
  });

  it('sem empresa: número desconhecido, demanda na triagem e nada de cadastros', async () => {
    const { empresas } = await contatoComEmpresas(['Indústria X']);
    await criarCadastrosExemplo(empresas[0]!.id);
    const id = await novaSimulacao({ mensagem: 'Quero abrir uma empresa' });
    const antes = await contagens();
    const ia = new IaRoteirizada([
      usarFerramentas(
        { nome: 'buscar_parceiros', entrada: { texto: 'Brasil', tipo: 'cliente' } },
        { nome: 'abrir_chamado', entrada: { setor_id: 'triagem', titulo: 'Abertura de empresa', resumo: 'Quer abrir empresa.', fora_do_contrato: false } },
        { nome: 'abrir_chamado', entrada: { setor_id: 'triagem', titulo: 'Abertura de empresa', resumo: 'Nome: Ana.', fora_do_contrato: false } },
      ),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Já passei para a equipe. Qual o seu nome?' } }),
      fim(),
    ]);
    await processarSimulacao(deps(ia), id, false);
    expect(textoUsuario(ia)).toContain('Número desconhecido');
    expect(ia.recebidos[1]!.messages.at(-1)!.content).toMatchObject([{ is_error: true }, { is_error: false }, { is_error: false }]);
    const r = (await simulacao(id)).respostas!;
    expect(r.acoes.map((a) => a.resumo)).toEqual(['Abriria uma demanda na Triagem: Abertura de empresa', 'Acrescentaria as informações à demanda da Triagem: Nome: Ana.']);
    expect(await contagens()).toEqual(antes);
    expect(canal.enviados).toEqual([]);
  });

  it('agente que termina sem responder: mostra o encaminhamento e o aviso que o cliente receberia', async () => {
    const id = await novaSimulacao();
    const ia = new IaRoteirizada([fimVazio(), fimVazio()]);
    await processarSimulacao(deps(ia), id, false);
    const r = (await simulacao(id)).respostas!;
    const config = await repos.obterConfiguracoes();
    expect(r.acoes).toEqual([{ ferramenta: 'encaminhar', resumo: 'Passaria o atendimento para a equipe (o agente terminou sem responder)' }]);
    expect(r.mensagens).toEqual(config.mensagens.ia_indisponivel ? [config.mensagens.ia_indisponivel] : []);
    expect((await db.from('chamados').select('id')).data).toEqual([]);
  });

  it('teto de IA atingido: status erro com mensagem amigável, sem chamar a IA', async () => {
    await db.from('configuracoes').update({ teto_ia_usd: 0 }).eq('id', 1);
    const id = await novaSimulacao();
    const ia = new IaRoteirizada([]);
    expect(await processarSimulacao(deps(ia), id, false)).toBe('erro');
    expect(ia.recebidos).toHaveLength(0);
    const s = await simulacao(id);
    expect([s.status, s.erro, s.respostas]).toEqual(['erro', MENSAGEM_TETO_SIMULACAO, null]);
  });

  it('nova tentativa da fila depois de concluída não faz nada', async () => {
    const id = await novaSimulacao();
    await processarSimulacao(deps(new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()])), id, false);
    const ia = new IaRoteirizada([]);
    expect(await processarSimulacao(deps(ia), id, false)).toBe('ja-concluida');
    expect(ia.recebidos).toHaveLength(0);
    expect((await simulacao(id)).respostas!.mensagens).toEqual(['Oi']);
    expect(await processarSimulacao(deps(ia), '00000000-0000-0000-0000-000000000000', false)).toBe('inexistente');
  });

  it('erro temporário da IA relança (a fila tenta de novo); na última tentativa vira erro', async () => {
    const id = await novaSimulacao();
    const temporario = () => new Anthropic.APIConnectionError({ message: 'sem rede' });
    await expect(processarSimulacao(deps(new IaRoteirizada([temporario()])), id, false)).rejects.toThrow('sem rede');
    expect((await simulacao(id)).status).toBe('pendente');
    expect(await processarSimulacao(deps(new IaRoteirizada([temporario()])), id, true)).toBe('erro');
    expect((await simulacao(id)).erro).toBe(MENSAGEM_FALHA_SIMULACAO);
  });

  it('erro qualquer vira status erro com mensagem humana', async () => {
    const id = await novaSimulacao();
    expect(await processarSimulacao(deps(new IaRoteirizada([new Error('400: pedido inválido')])), id, false)).toBe('erro');
    const s = await simulacao(id);
    expect([s.status, s.erro]).toEqual(['erro', MENSAGEM_FALHA_SIMULACAO]);
  });

  it('empresa apagada depois de pedir o teste: erro com mensagem humana', async () => {
    const id = await novaSimulacao();
    // A linha não pode apontar para uma empresa que não existe (FK): a leitura devolve um id de empresa que sumiu.
    const sumiu = '00000000-0000-0000-0000-00000000dead';
    const r = { ...repos, simulacaoPorId: async (x: string) => ({ ...(await repos.simulacaoPorId(x))!, cliente_id: sumiu }) };
    expect(await processarSimulacao({ ...deps(new IaRoteirizada([])), repos: r }, id, false)).toBe('erro');
    expect((await simulacao(id)).erro).toBe(MENSAGEM_EMPRESA_SIMULACAO);
  });

  it('teste que passa do prazo é interrompido', async () => {
    const id = await novaSimulacao();
    const lenta: ClienteIa = { criar: () => new Promise(() => {}) };
    expect(await processarSimulacao(deps(lenta, { prazoMs: 50 }), id, false)).toBe('erro');
    expect((await simulacao(id)).erro).toBe(MENSAGEM_PRAZO_SIMULACAO);
  });
});

describe('reposDaSimulacao', () => {
  it('só leituras: gravações lançam erro, decisões não gravam e o uso da IA vai sem conversa', async () => {
    const conversa = { id: '00000000-0000-0000-0000-000000000001' } as never;
    const r = reposDaSimulacao(repos, conversa);
    expect(() => r.abrirChamado({} as never)).toThrow('A simulação não grava nem envia nada');
    expect(() => r.criarSaidaPendente({} as never)).toThrow();
    expect(() => r.atualizarConversa('x', {})).toThrow();
    await r.registrarDecisao({ conversaId: 'x', clienteId: null, etapa: 'responder', entrada: {}, saida: {} });
    await r.registrarUsoIa({ conversaId: 'x', modelo: 'm', tokensEntrada: 1, tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd: 0.01 });
    expect(await r.obterConversa('qualquer')).toBe(conversa);
    expect((await db.from('decisoes_agente').select('id')).data).toEqual([]);
    expect((await db.from('uso_ia').select('conversa_id')).data).toEqual([{ conversa_id: null }]);
    expect((await r.setoresAtivos()).length).toBeGreaterThan(0);
  });
});
