import { describe, expect, it } from 'vitest';
import type { AgenteSetor, PerfilAgente, Repos } from '@escritorio/db';
import { ACESSO_BASICO, acessoTotal } from '../../src/agente/acesso';
import type { ContextoAgente } from '../../src/agente/contexto';
import { executarAgente } from '../../src/agente/executar';
import { executarFerramenta, falha, type EstadoExecucao, type ExecutorFerramentas } from '../../src/agente/ferramentas';
import { PERFIL_PADRAO_ATENDIMENTO } from '../../src/agente/perfil';
import { montarConteudoUsuario } from '../../src/agente/prompt';
import { AVISOS_AGENTE, acessoAoSetor, conferirAcessoDoSetor } from '../../src/agente/roteamento';
import { AVISOS_SKILL } from '../../src/agente/skills';
import { IaRoteirizada, fim, recusa, usarFerramentas } from '../apoio/ia-roteirizada';
import { FISCAL, skillTeste } from '../apoio/agente-setor';
import { CASOS_RETRATO } from '../apoio/retrato';

type Chamada = { nome: string; agente: string | null };
function montar(modoPadrao: 'por_tras' | 'mesma_voz' | 'passa_conversa', roteiro: ConstructorParameters<typeof IaRoteirizada>[0], reposExtra: Record<string, unknown> = {}) {
  const base = CASOS_RETRATO['contato-uma-empresa']!();
  // O contato fictício pode tudo (acessoFixo): aqui se testa o roteamento; o acesso de verdade é a Task 7.
  const ctx: ContextoAgente = { ...base, agentesSetor: [{ ...FISCAL, modo: modoPadrao }], acessoFixo: acessoTotal(base.setores) };
  const usos: { funcionalidade: string; agenteId: string | null }[] = [];
  const decisoes: { etapa: string; saida: Record<string, unknown>; agenteId?: string | null }[] = [];
  const conducao: string[] = [];
  const repos = {
    registrarUsoIa: async (u: { funcionalidade: string; agenteId: string | null }) => { usos.push({ funcionalidade: u.funcionalidade, agenteId: u.agenteId }); },
    registrarDecisao: async (x: { etapa: string; saida: Record<string, unknown>; agenteId?: string | null }) => { decisoes.push(x); },
    ultimasOrientacoesCortadas: async () => null, obterConversa: async () => ctx.conversa,
    iniciarConducao: async (_c: string, a: string) => { conducao.push(`inicia:${a}`); return true; },
    encerrarConducao: async (_c: string, m: string) => { conducao.push(`encerra:${m}`); return true; },
    ...reposExtra,
  } as unknown as Repos;
  const chamadas: Chamada[] = [];
  const executor: ExecutorFerramentas = async (_d, estado, nome) => {
    chamadas.push({ nome, agente: estado.agenteSetor?.slug ?? null });
    if (nome === 'responder') estado.respondeu = true;
    return { resultado: '{"enviado":true}', erro: false };
  };
  const ia = new IaRoteirizada(roteiro);
  const rodar = () => executarAgente({ repos, ia, envio: {} as never }, ctx, montarConteudoUsuario(ctx, [], [], []), executor);
  return { ctx, ia, usos, decisoes, conducao, chamadas, rodar };
}
const chamar = (assunto: string, agente = 'fiscal') => ({ nome: 'chamar_agente', entrada: { agente, assunto, pedido: 'nota do pedido 4512' } });
const nomes = (t: unknown) => (t as { name: string }[]).map((x) => x.name);
const textoSistema = (p: { system?: unknown }) => (p.system as { text: string }[]).map((b) => b.text).join('\n');

describe('Mesma voz (D5)', () => {
  it('o Thiago chama, o agente responde com o prompt e as ferramentas dele; custo por agente; o Thiago não repete', async () => {
    const t = montar('por_tras', [usarFerramentas(chamar('Pedido de nota de venda')), usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim(), fim()]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(t.ia.recebidos).toHaveLength(4);
    expect(nomes(t.ia.recebidos[0]!.tools).at(-1)).toBe('chamar_agente');
    expect(textoSistema(t.ia.recebidos[1]!)).toContain('COMO VOCÊ FALA: mesma voz');
    expect(nomes(t.ia.recebidos[1]!.tools)).not.toContain('chamar_agente');
    expect(JSON.stringify(t.ia.recebidos[1]!.messages[0])).toContain('<pedido_do_thiago>');
    expect(t.chamadas).toEqual([{ nome: 'responder', agente: 'fiscal' }]);
    expect(t.usos.map((u) => u.funcionalidade)).toEqual(['agente_clientes', 'especialista_setor', 'especialista_setor', 'agente_clientes']);
    expect(t.usos.filter((u) => u.funcionalidade === 'especialista_setor').every((u) => u.agenteId === FISCAL.id)).toBe(true);
    const d = t.decisoes.find((x) => x.etapa === 'chamar_agente')!;
    expect(d.saida).toMatchObject({ agente_id: FISCAL.id, regra_id: 'r1', modo: 'mesma_voz', instrucao: AVISOS_AGENTE.mesmaVoz });
    expect(d.agenteId ?? null).toBeNull();   // a decisão é do Thiago (D11)
  });
});

describe('Por trás (D4)', () => {
  it('o agente nunca envia (responder recusado), devolve a resposta e o Thiago repassa', async () => {
    const t = montar('por_tras', [usarFerramentas(chamar('outro')), usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }),
      usarFerramentas({ nome: 'devolver_resposta', entrada: { resposta_ao_cliente: 'A guia vence dia 20.', para_a_equipe: null } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'A guia vence dia 20.' } }), fim()]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(nomes(t.ia.recebidos[1]!.tools)).toEqual(['consultar_chamados', 'conferir_pedido_nota', 'nota_interna', 'devolver_resposta']);
    expect(t.chamadas).toEqual([{ nome: 'responder', agente: null }]);
    const recusa = (t.ia.recebidos[2]!.messages.at(-1)!.content as { content: string; is_error: boolean }[])[0]!;
    expect(recusa.is_error).toBe(true);
    expect(recusa.content).toContain(AVISOS_AGENTE.porTrasNaoEnvia);
    const paraThiago = JSON.parse((t.ia.recebidos[3]!.messages.at(-1)!.content as { content: string }[])[0]!.content);
    expect(paraThiago).toMatchObject({ modo: 'por_tras', resposta_do_agente: 'A guia vence dia 20.', instrucao: AVISOS_AGENTE.porTras });
    expect(t.decisoes.find((x) => x.etapa === 'devolver_resposta')!.agenteId).toBe(FISCAL.id);
  });
  it('terminou sem devolver: um lembrete; de novo, o Thiago segue sozinho', async () => {
    const t = montar('por_tras', [usarFerramentas(chamar('outro')), fim(), fim(), usarFerramentas({ nome: 'responder', entrada: { texto: 'Vou confirmar.' } }), fim()]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(JSON.stringify(t.ia.recebidos[2]!.messages.at(-1))).toContain('devolver_resposta');
    const paraThiago = JSON.parse((t.ia.recebidos[3]!.messages.at(-1)!.content as { content: string }[])[0]!.content);
    expect(paraThiago.instrucao).toBe(AVISOS_AGENTE.naoConseguiu);
  });
});

describe('Passa a conversa (D6)', () => {
  it('marca a condução e o agente se apresenta pelo setor', async () => {
    const t = montar('mesma_voz', [usarFerramentas(chamar('Dúvida sobre <imposto>')), usarFerramentas({ nome: 'responder', entrada: { texto: 'Aqui é do Fiscal do escritório.' } }), fim(), fim()]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(t.conducao).toEqual([`inicia:${FISCAL.id}`]);
    expect(textoSistema(t.ia.recebidos[1]!)).toContain('"Aqui é do Fiscal do escritório"');
    expect(t.decisoes.find((x) => x.etapa === 'chamar_agente')!.saida).toMatchObject({ modo: 'passa_conversa', regra_id: 'r2', instrucao: AVISOS_AGENTE.passa });
  });
  it('devolvido no meio: a condução acaba e o Thiago segue', async () => {
    const t = montar('mesma_voz', [usarFerramentas(chamar('Dúvida sobre <imposto>')), usarFerramentas({ nome: 'devolver_ao_thiago', entrada: { motivo: 'pediu boleto' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Já passo pro Financeiro.' } }), fim()]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(t.conducao).toEqual([`inicia:${FISCAL.id}`, 'encerra:pediu boleto']);
    const paraThiago = JSON.parse((t.ia.recebidos[2]!.messages.at(-1)!.content as { content: string }[])[0]!.content);
    expect(paraThiago).toMatchObject({ devolvido: true, motivo: 'pediu boleto', instrucao: AVISOS_AGENTE.devolvido });
  });
  it('devolvido e a condução não encerra (banco fora): a vez do Thiago segue, com log (revisão final, como a D24a)', async () => {
    const t = montar('mesma_voz', [usarFerramentas(chamar('Dúvida sobre <imposto>')), usarFerramentas({ nome: 'devolver_ao_thiago', entrada: { motivo: 'pediu boleto' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Já passo pro Financeiro.' } }), fim()],
      { encerrarConducao: async () => { throw new Error('banco fora'); } });
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(t.chamadas).toEqual([{ nome: 'responder', agente: null }]);
  });
});

describe('o agente já respondeu ao cliente e devolveu (revisão da Task 9, Important 1)', () => {
  const resultadoDoChamar = (t: ReturnType<typeof montar>, i: number) => JSON.parse((t.ia.recebidos[i]!.messages.at(-1)!.content as { content: string }[])[0]!.content);
  it('mesma voz: aviso próprio; o Thiago não manda nada ao cliente, mas abre a demanda', async () => {
    const t = montar('mesma_voz', [usarFerramentas(chamar('outro')), usarFerramentas({ nome: 'responder', entrada: { texto: 'Vou confirmar com a equipe.' } }),
      usarFerramentas({ nome: 'devolver_ao_thiago', entrada: { motivo: 'equipe confirma o prazo' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi, aqui é o Thiago!' } }, { nome: 'enviar_documento', entrada: {} }),
      usarFerramentas({ nome: 'abrir_chamado', entrada: {} }), fim()]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(resultadoDoChamar(t, 3)).toMatchObject({ devolvido: true, ja_respondeu_ao_cliente: true, instrucao: AVISOS_AGENTE.jaRespondeuDevolveu });
    const [r1, r2] = t.ia.recebidos[4]!.messages.at(-1)!.content as { content: string; is_error: boolean }[];
    for (const r of [r1!, r2!]) expect(r).toMatchObject({ is_error: true, content: expect.stringContaining(AVISOS_AGENTE.jaRespondeuDevolveu) });
    expect(t.chamadas).toEqual([{ nome: 'responder', agente: 'fiscal' }, { nome: 'abrir_chamado', agente: null }]);
  });
  it('não conseguiu depois de responder: o mesmo aviso e a mesma trava', async () => {
    const t = montar('mesma_voz', [usarFerramentas(chamar('outro')), usarFerramentas({ nome: 'responder', entrada: { texto: 'Vou ver.' } }), recusa(),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi!' } }), fim()]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(resultadoDoChamar(t, 3)).toMatchObject({ ja_respondeu_ao_cliente: true, instrucao: AVISOS_AGENTE.jaRespondeuDevolveu });
    expect(t.ia.recebidos[4]!.messages.at(-1)).toMatchObject({ content: [{ is_error: true, content: expect.stringContaining(AVISOS_AGENTE.jaRespondeuDevolveu) }] });
    expect(t.chamadas).toEqual([{ nome: 'responder', agente: 'fiscal' }]);
  });
  it('devolvido sem ter respondido: o Thiago segue e responde (como antes)', async () => {
    const t = montar('mesma_voz', [usarFerramentas(chamar('outro')), usarFerramentas({ nome: 'devolver_ao_thiago', entrada: { motivo: 'pediu boleto' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Já passo pro Financeiro.' } }), fim()]);
    await t.rodar();
    expect(resultadoDoChamar(t, 2)).toMatchObject({ instrucao: AVISOS_AGENTE.devolvido });
    expect(t.chamadas).toEqual([{ nome: 'responder', agente: null }]);
  });
  it('mesma voz ok (o agente respondeu e terminou): sem trava, o Thiago ainda pode tratar outro assunto da mensagem', async () => {
    const t = montar('mesma_voz', [usarFerramentas(chamar('outro')), usarFerramentas({ nome: 'responder', entrada: { texto: 'A nota saiu.' } }), fim(),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'E o boleto já vai.' } }), fim()]);
    await t.rodar();
    expect(t.chamadas).toEqual([{ nome: 'responder', agente: 'fiscal' }, { nome: 'responder', agente: null }]);
  });
});

describe('o Thiago que erra a chamada (D16)', () => {
  it('agente fora da lista: recusa, sem custo do agente', async () => {
    const t = montar('mesma_voz', [usarFerramentas(chamar('outro', 'pessoal')), usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
    await t.rodar();
    expect(t.ia.recebidos[1]!.messages.at(-1)).toMatchObject({ content: [{ is_error: true, content: expect.stringContaining(AVISOS_AGENTE.naoEncontrado) }] });
    expect(t.usos.every((u) => u.funcionalidade === 'agente_clientes')).toBe(true);
  });
  it('duas chamadas na mesma vez: a segunda é recusada', async () => {
    const t = montar('mesma_voz', [usarFerramentas(chamar('outro'), chamar('outro')), usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim(), fim()]);
    await t.rodar();
    const [primeira, segunda] = t.ia.recebidos[3]!.messages.at(-1)!.content as { content: string; is_error: boolean }[];
    expect(primeira!.is_error).toBe(false);
    expect(segunda).toMatchObject({ is_error: true, content: expect.stringContaining(AVISOS_AGENTE.jaChamou) });
  });
});

describe('acesso do contato ao setor do agente (D7; F4, F14)', () => {
  const base = () => CASOS_RETRATO['contato-uma-empresa']!();
  const semSetor = (b: ContextoAgente) => ({ ...acessoTotal(b.setores), setores: [] });
  // Qualquer uso do repositório ou do envio quebra o teste e fica anotado.
  const vigiado = (tocados: string[], prefixo = '') =>
    new Proxy({}, { get: (_t, p) => { tocados.push(`${prefixo}${String(p)}`); throw new Error(`tocado: ${prefixo}${String(p)}`); } });

  it('um ajudante só: ok, básico ou sem acesso', async () => {
    const b = base();
    const d = { repos: {} as Repos, ia: {} as never, envio: {} as never };
    const com = (acessoFixo: ContextoAgente['acessoFixo']): EstadoExecucao => ({ ctx: { ...b, acessoFixo }, respondeu: false });
    expect((await acessoAoSetor(d, com(acessoTotal(b.setores)), b.empresaEmFoco!.id, FISCAL.setorId)).situacao).toBe('ok');
    expect((await acessoAoSetor(d, com(ACESSO_BASICO), b.empresaEmFoco!.id, FISCAL.setorId)).situacao).toBe('basico');
    expect((await acessoAoSetor(d, com(semSetor(b)), b.empresaEmFoco!.id, FISCAL.setorId)).situacao).toBe('sem');
  });

  it('o agente começa com o acesso já conferido por chamar_agente: as ferramentas dele não releem o acesso', async () => {
    const b = base();
    const ctx: ContextoAgente = { ...b, agentesSetor: [FISCAL] };
    let leituras = 0;
    const repos = {
      registrarUsoIa: async () => {}, registrarDecisao: async () => {}, ultimasOrientacoesCortadas: async () => null, obterConversa: async () => ctx.conversa,
      acessoDoContato: async () => { leituras++; return acessoTotal(b.setores); },
    } as unknown as Repos;
    const chamadas: string[] = [];
    const executor: ExecutorFerramentas = async (_d, estado, nome) => {
      chamadas.push(nome);
      if (nome === 'responder') estado.respondeu = true;
      return { resultado: '{}', erro: false };
    };
    const ia = new IaRoteirizada([usarFerramentas(chamar('Pedido de nota de venda')), usarFerramentas({ nome: 'consultar_chamados', entrada: {} }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim(), fim()]);
    expect(await executarAgente({ repos, ia, envio: {} as never }, ctx, montarConteudoUsuario(ctx, [], [], []), executor)).toEqual({ status: 'ok' });
    expect(chamadas).toEqual(['consultar_chamados', 'responder']);
    expect(leituras).toBe(1);
  });

  it('por trás: sem o setor, a conferência falha e nada vai ao cliente (nem a recusa neutra)', async () => {
    const b = base();
    const tocados: string[] = [];
    const estado: EstadoExecucao = { ctx: { ...b, acessoFixo: semSetor(b) }, respondeu: false, agenteSetor: FISCAL, modo: 'por_tras' };
    const d = { repos: vigiado(tocados) as Repos, ia: {} as never, envio: vigiado(tocados, 'envio.') as never };
    expect(await conferirAcessoDoSetor(d, estado)).toEqual(falha(AVISOS_AGENTE.semAcesso));
    expect(estado.respondeu).toBe(false);
    expect(estado.recusou).toBeUndefined();
    expect(estado.acessoSetorConferido).toBeUndefined();
    expect(tocados).toEqual([]);
  });

  it('mesma voz: sem o setor, segue para a recusa neutra da Parte H2 (é o caminho que o por trás não pode tomar)', async () => {
    const b = base();
    const tocados: string[] = [];
    const estado: EstadoExecucao = { ctx: { ...b, acessoFixo: semSetor(b) }, respondeu: false, agenteSetor: FISCAL, modo: 'mesma_voz' };
    await expect(conferirAcessoDoSetor({ repos: vigiado(tocados) as Repos, ia: {} as never, envio: {} as never }, estado)).rejects.toThrow('tocado');
    expect(tocados).toEqual(['registrarPedidoForaDoAcesso']);
  });

  it('com o setor: passa e fica conferido nesta execução', async () => {
    const b = base();
    const estado: EstadoExecucao = { ctx: { ...b, acessoFixo: acessoTotal(b.setores) }, respondeu: false, agenteSetor: FISCAL, modo: 'mesma_voz' };
    expect(await conferirAcessoDoSetor({ repos: {} as Repos, ia: {} as never, envio: {} as never }, estado)).toBeNull();
    expect(estado.acessoSetorConferido).toBe(true);
  });
});

describe('Passa a conversa com erro da IA (F10)', () => {
  it('a condução acaba e o erro segue', async () => {
    const t = montar('mesma_voz', [usarFerramentas(chamar('Dúvida sobre <imposto>')), new Error('IA fora do ar')]);
    await expect(t.rodar()).rejects.toThrow('IA fora do ar');
    expect(t.conducao).toEqual([`inicia:${FISCAL.id}`, 'encerra:não conseguiu seguir']);
  });
});

describe('ler_skill e ler_referencia pelo agente da execução (spec 7E.10; F11)', () => {
  function rodarSkill(agenteSetor: AgenteSetor | undefined, nome: string, entrada: object) {
    const decisoes: { etapa: string; agenteId?: string | null }[] = [];
    const pedidas: unknown[][] = [];
    const repos = {
      registrarDecisao: async (x: { etapa: string; agenteId?: string | null }) => { decisoes.push(x); },
      referenciaDaSkill: async (...a: unknown[]) => { pedidas.push(a); return 'texto da referência'; },
    } as unknown as Repos;
    const thiago: PerfilAgente = { ...PERFIL_PADRAO_ATENDIMENTO, id: 'thiago-id', skills: [skillTeste('procedimento', 'certidao', 'Texto da certidão.')] };
    const ctx = { ...CASOS_RETRATO['contato-uma-empresa']!(), agente: thiago } as ContextoAgente;
    const estado: EstadoExecucao = { ctx, respondeu: false, ...(agenteSetor ? { agenteSetor, modo: 'mesma_voz' as const } : {}) };
    return { r: executarFerramenta({ repos, ia: {} as never, envio: {} as never }, estado, nome, entrada), decisoes, pedidas };
  }
  const fiscal: AgenteSetor = { ...FISCAL, skills: [{ ...skillTeste('procedimento', 'nota-de-venda', 'Como conferir a nota.'), arquivos: ['cfop.md'] }] };

  it('o Fiscal lê a skill dele; a decisão leva o agente', async () => {
    const { r, decisoes } = rodarSkill(fiscal, 'ler_skill', { nome: 'nota-de-venda' });
    expect(JSON.parse((await r).resultado)).toMatchObject({ nome: 'nota-de-venda', texto: 'Como conferir a nota.' });
    expect(decisoes).toEqual([expect.objectContaining({ etapa: 'ler_skill', agenteId: FISCAL.id })]);
  });
  it('skill só do Thiago: o Fiscal não encontra', async () => {
    expect(await rodarSkill(fiscal, 'ler_skill', { nome: 'certidao' }).r).toEqual(falha(AVISOS_SKILL.naoEncontrada));
  });
  it('ler_referencia do Fiscal pede o arquivo com o id dele', async () => {
    const { r, pedidas } = rodarSkill(fiscal, 'ler_referencia', { skill: 'nota-de-venda', arquivo: 'cfop.md', parte: 1 });
    expect(JSON.parse((await r).resultado)).toMatchObject({ skill: 'nota-de-venda', texto: 'texto da referência' });
    expect(pedidas).toEqual([[FISCAL.id, 'nota-de-venda', 'cfop.md', null]]);
  });
  it('o Thiago: o caminho de antes (só as dele, nunca as do Fiscal), decisão sem agente', async () => {
    const { r, decisoes } = rodarSkill(undefined, 'ler_skill', { nome: 'certidao' });
    expect(JSON.parse((await r).resultado)).toMatchObject({ nome: 'certidao', texto: 'Texto da certidão.' });
    expect(decisoes[0]!.agenteId ?? null).toBeNull();
    expect(await rodarSkill(undefined, 'ler_skill', { nome: 'nota-de-venda' }).r).toEqual(falha(AVISOS_SKILL.naoEncontrada));
  });
});
