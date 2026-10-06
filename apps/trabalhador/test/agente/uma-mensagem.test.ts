import { describe, expect, it } from 'vitest';
import type { Repos } from '@escritorio/db';
import { acessoTotal } from '../../src/agente/acesso';
import { CABECALHO_AGENTES_SETOR } from '../../src/agente/agentes-setor';
import type { ContextoAgente } from '../../src/agente/contexto';
import { TEXTO_MODO } from '../../src/agente/especialista';
import { executarAgente } from '../../src/agente/executar';
import type { ExecutorFerramentas } from '../../src/agente/ferramentas';
import { montarConteudoUsuario } from '../../src/agente/prompt';
import { AVISOS_AGENTE } from '../../src/agente/roteamento';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { FISCAL } from '../apoio/agente-setor';
import { CASOS_RETRATO } from '../apoio/retrato';

/** I3b (D1): "Oi, quem fala? Queria saber da nota do pedido 4512" — o cliente recebe uma mensagem só. */
function montar(roteiro: ConstructorParameters<typeof IaRoteirizada>[0], comAgente = true) {
  const base = CASOS_RETRATO['contato-uma-empresa']!();
  const ctx: ContextoAgente = comAgente ? { ...base, agentesSetor: [FISCAL], acessoFixo: acessoTotal(base.setores) } : base;
  const decisoes: { etapa: string; saida: Record<string, unknown> }[] = [];
  const repos = {
    registrarUsoIa: async () => {}, ultimasOrientacoesCortadas: async () => null, obterConversa: async () => ctx.conversa,
    registrarDecisao: async (x: { etapa: string; saida: Record<string, unknown> }) => { decisoes.push(x); },
    iniciarConducao: async () => true, encerrarConducao: async () => true,
  } as unknown as Repos;
  const chamadas: { nome: string; agente: string | null; texto: string | null }[] = [];
  const executor: ExecutorFerramentas = async (_d, estado, nome, entrada) => {
    chamadas.push({ nome, agente: estado.agenteSetor?.slug ?? null, texto: (entrada as { texto?: string }).texto ?? null });
    if (nome === 'responder') estado.respondeu = true;
    return { resultado: '{"enviado":true}', erro: false };
  };
  const ia = new IaRoteirizada(roteiro);
  const rodar = () => executarAgente({ repos, ia, envio: {} as never }, ctx, montarConteudoUsuario(ctx, [], [], []), executor);
  return { ia, decisoes, chamadas, rodar };
}
const chamar = { nome: 'chamar_agente', entrada: { agente: 'fiscal', assunto: 'Pedido de nota de venda', pedido: 'Cumprimentou, perguntou quem fala e quer saber da nota do pedido 4512' } };
const respThiago = { nome: 'responder', entrada: { texto: 'Oi, João! Aqui é o Thiago, do atendimento do escritório.' } };
const textoSistema = (p: { system?: unknown }) => (p.system as { text: string }[]).map((b) => b.text).join('\n');
const ultimoResultado = (p: { messages: { content: unknown }[] }, i = 0) =>
  (p.messages.at(-1)!.content as { content: string; is_error?: boolean; tool_use_id: string }[])[i]!;
const nomesFerramentas = (p: { tools?: unknown }) => (p.tools as { name: string }[]).map((x) => x.name);

describe('o cabeçalho e o modo Mesma voz (camada a)', () => {
  it('manda chamar o agente antes de mandar qualquer coisa quando há cumprimento ou "quem fala?" junto do assunto', () => {
    expect(CABECALHO_AGENTES_SETOR).toContain('"quem fala?"');
    expect(CABECALHO_AGENTES_SETOR).toContain('não mande nada antes');
    expect(CABECALHO_AGENTES_SETOR).toContain('Saudação ou agradecimento sem assunto de setor');
    expect(TEXTO_MODO.mesma_voz('Fiscal')).toContain('perguntou quem fala');
  });
});

describe('mesma rodada (camada b)', () => {
  it('responder + chamar_agente juntos: o agente fala primeiro e o responder do Thiago é recusado', async () => {
    const t = montar([
      usarFerramentas(respThiago, chamar),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi, João! Aqui é o Thiago, do atendimento do escritório. A nota do pedido 4512 está com o Fiscal.' } }),
      fim(),
      fim(),
    ]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(t.chamadas.map((c) => `${c.nome}:${c.agente ?? 'thiago'}`)).toEqual(['responder:fiscal']);
    // O resultado volta na ordem do modelo: o 1º é o responder do Thiago (recusado), o 2º o chamar_agente.
    const recusa = ultimoResultado(t.ia.recebidos[3]!, 0);
    expect(recusa.is_error).toBe(true);
    expect(recusa.content).toContain(AVISOS_AGENTE.mesmaRodada);
    expect(ultimoResultado(t.ia.recebidos[3]!, 1).is_error).toBeFalsy();
  });
  it('sem chamar_agente na rodada, a ordem e o envio do Thiago não mudam', async () => {
    const t = montar([usarFerramentas(respThiago), fim()]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(t.chamadas.map((c) => `${c.nome}:${c.agente ?? 'thiago'}`)).toEqual(['responder:thiago']);
  });
  it('Passa a conversa + responder na mesma rodada: vale a trava da condução (I2) e nada sai do Thiago', async () => {
    const duvida = { nome: 'chamar_agente', entrada: { agente: 'fiscal', assunto: 'Dúvida sobre <imposto>', pedido: 'Perguntou quem fala e tem dúvida sobre ICMS' } };
    const t = montar([
      usarFerramentas(respThiago, duvida),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi, João! Aqui é do Fiscal do escritório, sigo com você nesse assunto.' } }),
      fim(),
      fim(),
    ]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(t.chamadas.map((c) => `${c.nome}:${c.agente ?? 'thiago'}`)).toEqual(['responder:fiscal']);
    const recusa = ultimoResultado(t.ia.recebidos[3]!, 0);
    expect(recusa.is_error).toBe(true);
    expect(recusa.content).toContain(AVISOS_AGENTE.conduzindo);
  });
});

describe('rodadas seguidas (camada c)', () => {
  const roteiroRebaixado = () => [
    usarFerramentas(respThiago),
    usarFerramentas(chamar),
    usarFerramentas({ nome: 'devolver_resposta', entrada: { resposta_ao_cliente: 'A nota do pedido 4512 sai hoje.', para_a_equipe: null } }),
    usarFerramentas({ nome: 'responder', entrada: { texto: 'A nota do pedido 4512 sai hoje.' } }),
    fim(),
  ];
  it('o Thiago já falou nesta vez: Mesma voz vira por trás e o Thiago repassa', async () => {
    const t = montar(roteiroRebaixado());
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(textoSistema(t.ia.recebidos[2]!)).toContain('COMO VOCÊ FALA: por trás');
    expect(t.chamadas.map((c) => `${c.nome}:${c.agente ?? 'thiago'}`)).toEqual(['responder:thiago', 'responder:thiago']);
    const d = t.decisoes.find((x) => x.etapa === 'chamar_agente')!;
    expect(d.saida).toMatchObject({ modo: 'por_tras', modo_da_regra: 'mesma_voz', regra_id: 'r1', rebaixado: AVISOS_AGENTE.rebaixado });
  });
  it('F10: r1 rebaixado — o agente fica sem as que enviam, a devolução chega ao Thiago e o pedido de nota continua com ele', async () => {
    const t = montar(roteiroRebaixado());
    await t.rodar();
    const doAgente = nomesFerramentas(t.ia.recebidos[2]!);
    expect(doAgente).toContain('devolver_resposta');
    expect(doAgente).not.toContain('responder');
    expect(doAgente).not.toContain('resumir_pedido_nota');
    const devolucao = JSON.parse(ultimoResultado(t.ia.recebidos[3]!, 0).content) as Record<string, unknown>;
    expect(devolucao).toMatchObject({ modo: 'por_tras', resposta_do_agente: 'A nota do pedido 4512 sai hoje.', instrucao: AVISOS_AGENTE.porTras });
    expect(nomesFerramentas(t.ia.recebidos[3]!)).toEqual(expect.arrayContaining(['responder', 'resumir_pedido_nota', 'abrir_pedido_nota', 'chamar_agente']));
  });
  it('o Thiago chamou primeiro: Mesma voz continua Mesma voz', async () => {
    const t = montar([usarFerramentas(chamar), usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi, João! Aqui é o Thiago. A nota sai hoje.' } }), fim(), fim()]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(textoSistema(t.ia.recebidos[1]!)).toContain('COMO VOCÊ FALA: mesma voz');
    expect(t.decisoes.find((x) => x.etapa === 'chamar_agente')!.saida).toMatchObject({ modo: 'mesma_voz' });
    expect(t.decisoes.find((x) => x.etapa === 'chamar_agente')!.saida).not.toHaveProperty('modo_da_regra');
  });
});

describe('sem agente ativo nada muda', () => {
  it('as ferramentas e o sistema do Thiago não trazem chamar_agente nem o cabeçalho', async () => {
    const t = montar([usarFerramentas(respThiago), fim()], false);
    await t.rodar();
    expect((t.ia.recebidos[0]!.tools as { name: string }[]).map((x) => x.name)).not.toContain('chamar_agente');
    expect(textoSistema(t.ia.recebidos[0]!)).not.toContain('AGENTES DOS SETORES');
  });
  it('F15: um chamar_agente que não foi oferecido não muda a ordem da rodada', async () => {
    const t = montar([usarFerramentas(respThiago, chamar), fim()], false);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(t.chamadas.map((c) => `${c.nome}:${c.agente ?? 'thiago'}`)).toEqual(['responder:thiago', 'chamar_agente:thiago']);
  });
});
