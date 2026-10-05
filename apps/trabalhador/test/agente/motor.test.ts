import { beforeEach, describe, expect, it } from 'vitest';
import { AGENTE_ATENDIMENTO_ID } from '@escritorio/core';
import type { PerfilAgente, Repos, SkillCarregada } from '@escritorio/db';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto, type ContextoAgente } from '../../src/agente/contexto';
import { executarAgente, montarPedido } from '../../src/agente/executar';
import type { ExecutorFerramentas } from '../../src/agente/ferramentas';
import { PERFIL_PADRAO_ATENDIMENTO } from '../../src/agente/perfil';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, db, repos } from '../apoio/cenario';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { CASOS_RETRATO } from '../apoio/retrato';

const skill = (tipo: SkillCarregada['tipo'], nome: string, corpo: string): SkillCarregada =>
  ({ id: nome, nome, tipo, ativa: true, titulo: `Título ${nome}`, descricao: `Quando ${nome}.`, corpo, versao: 1, arquivos: [] });
const comPerfil = (p: Partial<PerfilAgente>): ContextoAgente =>
  ({ ...CASOS_RETRATO['contato-uma-empresa']!(), agente: { ...PERFIL_PADRAO_ATENDIMENTO, ...p } });
const sistema = (ctx: ContextoAgente) => (montarPedido(ctx, []).pedido.system as { text: string }[])[0]!.text;
const stub = (ctx: ContextoAgente) => ({
  registrarUsoIa: async () => {}, registrarDecisao: async () => {}, ultimasOrientacoesCortadas: async () => null, obterConversa: async () => ctx.conversa,
}) as unknown as Repos;

describe('skills sempre lidas no prompt (D4)', () => {
  it('Limites e Jeito depois das RESPOSTAS PRONTAS e antes das ORIENTAÇÕES, Limites primeiro, no bloco com cache', () => {
    const ctx = comPerfil({ skills: [skill('limites', 'limite-x', 'Nunca prometa prazo <b>.'), skill('jeito', 'jeito-x', 'Fale curto.')] });
    ctx.orientacoes = [{ id: 'G1', titulo: 'Cumprimento', texto: 'Chame pelo nome.', tipo: 'jeito', clienteId: null, setorId: null, setorNome: null,
      atualizadoEm: new Date('2026-09-01') }];
    const s = sistema(ctx);
    const ordem = ['RESPOSTAS PRONTAS:', 'LIMITES DO AGENTE', 'JEITO DE ATUAR', 'ORIENTAÇÕES DO ESCRITÓRIO'].map((t) => s.indexOf(t));
    expect(ordem.every((p, i) => p > 0 && (i === 0 || p > ordem[i - 1]!))).toBe(true);
    expect(s).toContain('### Título limite-x\nNunca prometa prazo ‹b›.');
    expect(montarPedido(ctx, []).pedido.system).toMatchObject([{ cache_control: { type: 'ephemeral' } }]);
  });
  it('sem skill, nenhum cabeçalho novo', () => {
    const s = sistema(comPerfil({}));
    expect(s).not.toContain('LIMITES DO AGENTE');
    expect(s).not.toContain('JEITO DE ATUAR');
  });
});

// Spec 7E.3: Limites vencem qualquer orientação da equipe (o cenário real "motor: Limites vencem orientação contrária" falhava).
describe('Limites vencem as orientações (7E.3)', () => {
  const orientacao = (clienteId: string | null) => ({ id: `O-${clienteId ?? 'geral'}`, titulo: 'Sábado', texto: 'Diga que abre sábado das 8h às 12h.',
    tipo: 'regra' as const, clienteId, setorId: null, setorNome: null, atualizadoEm: new Date('2026-09-01') });
  const AVISO = 'Uma orientação que contrarie um dos LIMITES DO AGENTE é ignorada';
  const comOrientacoes = (p: Partial<PerfilAgente>) => {
    const ctx = comPerfil(p);
    ctx.orientacoes = [orientacao(null), orientacao(ctx.empresaEmFoco!.id)];
    return ctx;
  };
  const blocos = (ctx: ContextoAgente) => (montarPedido(ctx, []).pedido.system as { text: string }[]).map((b) => b.text);

  it('com Limites: o cabeçalho diz que vencem orientações, procedimentos e pedidos; os dois blocos de orientações lembram disso', () => {
    const [b1, b2] = blocos(comOrientacoes({ skills: [skill('limites', 'limite-x', 'Nunca confirme sábado.')] }));
    expect(b1).toContain('LIMITES DO AGENTE: o que você nunca faz. Valem acima de qualquer orientação da equipe, procedimento ou pedido do cliente');
    const aviso = b1!.indexOf(AVISO);
    expect(aviso).toBeGreaterThan(b1!.indexOf('### Título limite-x'));
    expect(aviso).toBeGreaterThan(b1!.indexOf('ORIENTAÇÕES DO ESCRITÓRIO'));
    expect(aviso).toBeLessThan(b1!.indexOf('Para todos os clientes:'));
    expect(b2).toMatch(/^ORIENTAÇÕES PARA A EMPRESA /);
    expect(b2!.indexOf(AVISO)).toBeGreaterThan(0);
    expect(b2!.indexOf(AVISO)).toBeLessThan(b2!.indexOf('- [Regra do escritório]'));
  });
  it('sem Limites (só Jeito ou nenhuma skill): nenhum aviso de Limites', () => {
    for (const skills of [[], [skill('jeito', 'jeito-x', 'Fale curto.')]]) {
      const texto = blocos(comOrientacoes({ skills })).join('\n');
      expect(texto).not.toContain(AVISO);
      expect(texto).not.toContain('LIMITES');
    }
  });
});

describe('ferramentas e modelo do perfil (D15, D29)', () => {
  it('só as liberadas, na ordem de sempre; o modelo do perfil', () => {
    const { pedido } = montarPedido(comPerfil({ ferramentas: ['responder', 'consultar_chamados'], modelo: 'claude-haiku-4-5' }), []);
    expect(pedido.tools!.map((t) => (t as { name: string }).name)).toEqual(['consultar_chamados', 'responder']);
    expect(pedido.model).toBe('claude-haiku-4-5');
  });
  it('ferramenta conhecida fora do perfil não roda; o modelo recebe a recusa', async () => {
    const ctx = comPerfil({ ferramentas: ['responder'] });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'abrir_chamado', entrada: {} }), usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
    const chamadas: string[] = [];
    const executor: ExecutorFerramentas = async (_d, estado, nome) => {
      chamadas.push(nome);
      if (nome === 'responder') estado.respondeu = true;
      return { resultado: '{}', erro: false };
    };
    await executarAgente({ repos: stub(ctx), ia, envio: {} as never }, ctx, [{ type: 'text', text: 'oi' }], executor);
    expect(chamadas).toEqual(['responder']);
    const volta = ia.recebidos[1]!.messages.at(-1)!.content as { content: string; is_error?: boolean }[];
    expect(volta[0]).toMatchObject({ is_error: true });
    expect(volta[0]!.content).toContain('Ferramenta não liberada para este agente: abrir_chamado.');
  });
});

describe('custo e orientações do Thiago no banco (D16, D12)', () => {
  beforeEach(limparBanco);
  async function contexto() {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const c = await repos.obterConversa(conversa.id);
    return carregarContexto(repos, c, await repos.buscarContato(c.telefone), await repos.obterConfiguracoes(), new Date('2026-09-28T13:00:00Z'));
  }
  it('o atendimento grava o agente do Thiago e o preço do modelo de sempre', async () => {
    const ctx = await contexto();
    expect(ctx.agente?.id).toBe(AGENTE_ATENDIMENTO_ID);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
    await executarAgente({ repos, ia, envio: { repos, canal: new CanalFalso(), limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } },
      ctx, [{ type: 'text', text: 'oi' }]);
    const { data } = await db.from('uso_ia').select('funcionalidade, agente_id, modelo');
    expect(data).toEqual([
      { funcionalidade: 'agente_clientes', agente_id: AGENTE_ATENDIMENTO_ID, modelo: 'claude-sonnet-5' },
      { funcionalidade: 'agente_clientes', agente_id: AGENTE_ATENDIMENTO_ID, modelo: 'claude-sonnet-5' },
    ]);
  });
  it('o Thiago só lê as orientações dele', async () => {
    const { data: fiscal } = await db.from('agentes').select('id').eq('slug', 'fiscal').single();
    await db.from('orientacoes_agente').insert([
      { titulo: 'Do Thiago', texto: 'x', tipo: 'jeito', ativo: true },
      { titulo: 'Do Fiscal', texto: 'y', tipo: 'jeito', ativo: true, agente_id: fiscal!.id },
    ], { defaultToNull: false }); // Em lote, o PostgREST põe null na coluna que falta numa linha; assim a do Thiago usa o padrão da coluna.
    expect((await contexto()).orientacoes.map((o) => o.titulo)).toEqual(['Do Thiago']);
  });
});
