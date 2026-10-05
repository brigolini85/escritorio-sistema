import { beforeEach, describe, expect, it } from 'vitest';
import type { PerfilAgente, Repos, SkillCarregada } from '@escritorio/db';
import { criarSkillTeste, limparBanco } from '@escritorio/db/teste';
import type { ContextoAgente } from '../../src/agente/contexto';
import { executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { carregarPerfil, ferramentasDoPerfil, PERFIL_PADRAO_ATENDIMENTO } from '../../src/agente/perfil';
import { montarSistema } from '../../src/agente/prompt';
import { processarSimulacao } from '../../src/agente/simular';
import { AVISOS_SKILL, TAMANHO_PARTE_REFERENCIA } from '../../src/agente/skills';
import { db, repos } from '../apoio/cenario';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { CASOS_RETRATO } from '../apoio/retrato';
import { criarUsuarioTeste } from '../apoio/usuario';

const skill = (tipo: SkillCarregada['tipo'], nome: string, arquivos: string[] = []): SkillCarregada =>
  ({ id: `id-${nome}`, nome, tipo, ativa: true, titulo: `Título ${nome}`, descricao: `Quando ${nome}.`, corpo: `Texto de ${nome}.`, versao: 2, arquivos });
const perfil = (skills: SkillCarregada[]): PerfilAgente => ({ ...PERFIL_PADRAO_ATENDIMENTO, id: 'agente-x', skills });

function rodar(p: PerfilAgente, nome: string, entrada: object, texto: string | null = null) {
  const decisoes: { etapa: string; saida: unknown }[] = [];
  const pedidas: unknown[][] = [];
  const reposFalso = {
    registrarDecisao: async (d: { etapa: string; saida: unknown }) => { decisoes.push(d); },
    referenciaDaSkill: async (...a: unknown[]) => { pedidas.push(a); return texto; },
  } as unknown as Repos;
  const ctx = { ...CASOS_RETRATO['contato-uma-empresa']!(), agente: p } as ContextoAgente;
  const estado: EstadoExecucao = { ctx, respondeu: false };
  return { r: executarFerramenta({ repos: reposFalso, ia: {} as never, envio: {} as never }, estado, nome, entrada), decisoes, pedidas };
}

describe('índice e ferramentas de skill (D4, D5)', () => {
  it('só com skill sob demanda: índice com nome, tipo e descrição; ler_skill e ler_referencia no fim das ferramentas', () => {
    const p = perfil([skill('limites', 'limite-x'), skill('procedimento', 'certidao'), skill('exemplos', 'boas-respostas')]);
    const s = montarSistema([], [], { gerais: [], porSetor: [] }, p.skills);
    expect(s).toContain('SKILLS PARA LER QUANDO PRECISAR');
    expect(s).toContain('- certidao [Procedimentos]: Quando certidao.\n- boas-respostas [Exemplos]: Quando boas-respostas.');
    expect(s).not.toContain('- limite-x [');
    expect(ferramentasDoPerfil(p).slice(-2).map((t) => t.name)).toEqual(['ler_skill', 'ler_referencia']);
    expect(ferramentasDoPerfil(perfil([skill('limites', 'limite-x')])).map((t) => t.name)).not.toContain('ler_skill');
  });
});

describe('ler_skill e ler_referencia (spec 7E.10: só skills ligadas do próprio agente)', () => {
  it('ler_skill devolve o texto da skill do perfil; a decisão guarda só o tamanho', async () => {
    const { r, decisoes } = rodar(perfil([skill('procedimento', 'certidao', ['passos.md'])]), 'ler_skill', { nome: 'certidao' });
    expect(JSON.parse((await r).resultado)).toEqual({ nome: 'certidao', tipo: 'Procedimentos', titulo: 'Título certidao', versao: 2,
      texto: 'Texto de certidao.', arquivos: ['passos.md'] });
    expect(decisoes[0]).toMatchObject({ etapa: 'ler_skill', saida: { texto: '(18 caracteres)' } });
  });
  it('skill que não está no perfil (de outro agente, desligada ou arquivada): não encontrada', async () => {
    const { r } = rodar(perfil([skill('procedimento', 'certidao')]), 'ler_skill', { nome: 'jeito-do-fiscal' });
    expect(await r).toEqual({ resultado: JSON.stringify({ erro: AVISOS_SKILL.naoEncontrada }), erro: true });
  });
  it('ler_referencia só de arquivo listado na skill; texto grande em partes', async () => {
    const p = perfil([skill('conhecimento', 'cfop', ['tabela.csv'])]);
    expect(await rodar(p, 'ler_referencia', { skill: 'cfop', arquivo: 'outro.csv' }).r)
      .toEqual({ resultado: JSON.stringify({ erro: AVISOS_SKILL.arquivoNaoEncontrado }), erro: true });
    const grande = 'a'.repeat(TAMANHO_PARTE_REFERENCIA * 2 + 10);
    const { r, pedidas } = rodar(p, 'ler_referencia', { skill: 'cfop', arquivo: 'tabela.csv', parte: 3 }, grande);
    expect(JSON.parse((await r).resultado)).toMatchObject({ parte: 3, partes: 3, texto: 'a'.repeat(10) });
    expect(pedidas).toEqual([['agente-x', 'cfop', 'tabela.csv', null]]);
    expect(await rodar(p, 'ler_referencia', { skill: 'cfop', arquivo: 'tabela.csv', parte: 4 }, grande).r)
      .toEqual({ resultado: JSON.stringify({ erro: AVISOS_SKILL.parteInvalida }), erro: true });
  });
});

describe('no banco', () => {
  beforeEach(limparBanco);
  it('o perfil do Thiago carrega só as ligadas dele; a em teste entra desligada', async () => {
    await criarSkillTeste('atendimento', 'certidao', 'procedimento');
    const off = await criarSkillTeste('atendimento', 'cfop', 'conhecimento', false);
    await criarSkillTeste('fiscal', 'jeito-do-fiscal', 'jeito');
    expect((await carregarPerfil(repos, 'atendimento')).skills.map((s) => s.nome)).toEqual(['certidao']);
    expect((await carregarPerfil(repos, 'atendimento', off)).skills.map((s) => [s.nome, s.ativa])).toEqual([['certidao', true], ['cfop', false]]);
  });

  it('teste de skill (Testar): a skill desligada entra, a leitura aparece e a observação avisa', async () => {
    const usuario = await criarUsuarioTeste({ email: 'dono@skill.local', papel: 'admin', permissoes: ['treinar_agente'] });
    const off = await criarSkillTeste('atendimento', 'cfop', 'conhecimento', false);
    const { data: sim } = await db.from('simulacoes_agente').insert({ usuario_id: usuario, mensagem: 'Qual o CFOP de venda?', skill_id: off }).select('id').single();
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'ler_skill', entrada: { nome: 'cfop' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'É o 5102.' } }), fim(),
    ]);
    expect(await processarSimulacao({ repos, ia, envio: {} as never }, sim!.id, true)).toBe('pronta');
    expect(ia.recebidos[0]!.tools!.map((t) => (t as { name: string }).name)).toContain('ler_skill');
    const { data } = await db.from('simulacoes_agente').select('respostas').eq('id', sim!.id).single();
    const respostas = data!.respostas as { mensagens: string[]; acoes: { ferramenta: string; resumo: string }[]; observacoes: string[] };
    expect(respostas.mensagens).toEqual(['É o 5102.']);
    expect(respostas.acoes).toContainEqual({ ferramenta: 'ler_skill', resumo: 'Leria a skill cfop' });
    expect(respostas.observacoes).toContain('A skill “Título cfop” entrou neste teste mesmo desligada.');
    const { data: uso } = await db.from('uso_ia').select('funcionalidade, agente_id, usuario_id');
    expect(uso).toHaveLength(3);
    expect(uso!.every((u) => u.funcionalidade === 'testar_agente' && u.agente_id === 'a0000000-0000-4000-8000-000000000001' && u.usuario_id === usuario)).toBe(true);
  });
});
