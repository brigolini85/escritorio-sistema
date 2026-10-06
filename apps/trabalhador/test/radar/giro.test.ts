import type Anthropic from '@anthropic-ai/sdk';
import { LIMITES_RADAR, criteriosParaBanco, custoChamadaRadarUsd, lerCriterios } from '@escritorio/core';
import type { GiroParaRodar, PerfilAgente, Repos, ReposRadar, SkillCarregada } from '@escritorio/db';
import { describe, expect, it, vi } from 'vitest';
import { rodarGiro } from '../../src/radar/giro';
import { LEMBRETE_GIRO } from '../../src/radar/prompt';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

const resposta = (content: unknown[], stop: string, buscas = 0): Anthropic.Message => ({
  id: 'msg_x', type: 'message', role: 'assistant', model: 'claude-sonnet-5', content, stop_reason: stop, stop_sequence: null,
  usage: { input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: buscas, web_fetch_requests: 0 } },
} as unknown as Anthropic.Message);
const busca = (id: string, urls: { url: string; title: string }[]) => [
  { type: 'server_tool_use', id, name: 'web_search', input: { query: 'eSocial leiaute' } },
  { type: 'web_search_tool_result', tool_use_id: id, content: urls.map((u) => ({ type: 'web_search_result', url: u.url, title: u.title, encrypted_content: 'x', page_age: null })) },
];
const leitura = (id: string, url: string, erro?: string) => [
  { type: 'server_tool_use', id, name: 'web_fetch', input: { url } },
  erro ? { type: 'web_fetch_tool_result', tool_use_id: id, content: { type: 'web_fetch_tool_result_error', error_code: erro } }
    : { type: 'web_fetch_tool_result', tool_use_id: id, content: { type: 'web_fetch_result', url, retrieved_at: '2026-10-26T10:00:00Z',
      content: { type: 'document', source: { type: 'text', media_type: 'text/plain', data: 'texto' }, title: 'Página' } } },
];
const usar = (nome: string, entrada: object) => ({ type: 'tool_use', id: `toolu_${nome}_${Math.random()}`, name: nome, input: entrada });

const PRECO = { entrada: 3, saida: 15, cacheLeitura: 0.3, cacheEscrita: 3.75 };
const custoDe = (buscas: number) => custoChamadaRadarUsd({ entrada: 1000, saida: 100, cacheLeitura: 0, cacheEscrita: 0 }, PRECO, buscas);

const FONTES: GiroParaRodar['fontes'] = [
  { id: 'f-esocial', nome: 'eSocial', dominio: 'gov.br', caminho: '/esocial', etiqueta: 'FED', oficial: true, ativa: true, paginas: [] },
  { id: 'f-pref', nome: 'Prefeitura de Conselheiro Lafaiete', dominio: 'conselheirolafaiete.mg.gov.br', caminho: null, etiqueta: 'MUN', oficial: true, ativa: true, paginas: [] },
];
const giroBase = (o: Partial<GiroParaRodar> = {}): GiroParaRodar => ({
  id: 'g1', origem: 'pedido', pedidoPor: 'u1', novidade: null,
  config: { hora: '07:00', dias: [0, 1, 2, 3, 4, 5, 6], assuntos: ['eSocial'], resumoWhatsapp: true, avisoAlto: true, avisarPainel: false, limiteUsdGiro: 0.5 },
  fontes: FONTES, setores: [{ id: 's-pessoal', nome: 'Pessoal' }, { id: 's-fiscal', nome: 'Fiscal' }], recentes: [], ...o,
});
const perfilRadar = (skills: SkillCarregada[] = []): PerfilAgente =>
  ({ id: 'agente-radar', slug: 'radar', nome: 'Radar de legislação', modelo: null, ferramentas: [], skills, skillEmTeste: null });

function montar(roteiro: (Anthropic.Message | Error)[], o: { giro?: GiroParaRodar; perfil?: PerfilAgente; custoMes?: number; teto?: number } = {}) {
  const repos = {
    obterConfiguracoes: vi.fn(async () => ({ tetoIaUsd: o.teto ?? 100, modeloConversa: 'claude-sonnet-5', precosModelos: { 'claude-sonnet-5': PRECO } })),
    custoIaDoMes: vi.fn(async () => o.custoMes ?? 0),
    perfilDoAgente: vi.fn(async () => o.perfil ?? perfilRadar()),
    orientacoesAtivas: vi.fn(async () => []),
    registrarUsoIa: vi.fn(async (_: unknown) => undefined),
    referenciaDaSkill: vi.fn(async () => null),
  };
  const radar = {
    registrarNovidadeRadar: vi.fn(async (_g: string, _n: unknown) => ({ situacao: 'nova', id: 'nov-1', selo: 'oficial', clientes: 4 })),
    somarCustoGiro: vi.fn(async (_g: string, _u: number) => undefined),
  };
  const ia = new IaRoteirizada(roteiro);
  const g = o.giro ?? giroBase();
  const run = () => rodarGiro({ repos: repos as unknown as Repos, radar: radar as unknown as ReposRadar, ia, relogio: () => new Date('2026-10-26T13:00:00Z') }, g);
  return { repos, radar, ia, g, run };
}
const termina = () => resposta([usar('terminar_giro', { resumo: 'Nada novo.' })], 'tool_use');
const nomes = (p: { tools?: unknown[] }) => ((p.tools ?? []) as { name: string }[]).map((t) => t.name);
const ultimoResultado = (ia: IaRoteirizada, n: number) => (ia.recebidos[n]!.messages.at(-1)!.content as { is_error?: boolean; content: string }[])[0]!;

describe('rodarGiro', () => {
  it('1. domínios: duas ferramentas de servidor com allowed_domains das fontes e só as do Radar', async () => {
    const { ia, run } = montar([termina()]);
    await run();
    const tools = ia.recebidos[0]!.tools as unknown as { type: string; name: string; allowed_domains?: string[] }[];
    expect(tools.find((t) => t.name === 'web_search')).toMatchObject({ type: 'web_search_20250305', allowed_domains: ['gov.br/esocial', 'conselheirolafaiete.mg.gov.br'] });
    expect(tools.find((t) => t.name === 'web_fetch')).toMatchObject({ type: 'web_fetch_20250910', allowed_domains: ['gov.br', 'conselheirolafaiete.mg.gov.br'] });
    expect(nomes(ia.recebidos[0]!)).toEqual(['web_search', 'web_fetch', 'registrar_novidade', 'fonte_fora_do_ar', 'terminar_giro']);
    for (const proibida of ['responder', 'abrir_chamado', 'entregar_resultado']) expect(nomes(ia.recebidos[0]!)).not.toContain(proibida);
  });
  it('1b. ler_skill e ler_referencia só com skill sob demanda', async () => {
    const proc: SkillCarregada = { id: 's', nome: 'proc', tipo: 'procedimento', ativa: true, titulo: 'T', descricao: 'D', corpo: 'C', versao: 1, arquivos: [] };
    const { ia, run } = montar([termina()], { perfil: perfilRadar([proc]) });
    await run();
    expect(nomes(ia.recebidos[0]!)).toEqual(['web_search', 'web_fetch', 'registrar_novidade', 'fonte_fora_do_ar', 'terminar_giro', 'ler_skill', 'ler_referencia']);
  });
  it('2. link que não apareceu: recusa e não grava', async () => {
    const { ia, radar, run } = montar([
      resposta([usar('registrar_novidade', { titulo: 'X', url: 'https://www.gov.br/esocial/x', resumo: 'r', impacto: 'alto', setores: ['Pessoal'], vigencia_texto: 'sem data ainda' })], 'tool_use'),
      termina(),
    ]);
    const fim = await run();
    expect(radar.registrarNovidadeRadar).not.toHaveBeenCalled();
    expect(ultimoResultado(ia, 1)).toMatchObject({ is_error: true, content: 'Cite um link que apareceu na busca ou na leitura deste giro.' });
    expect(fim.novas).toEqual([]);
  });
  it('3. link visto na busca: grava com url normalizada, setores em id e critérios em snake_case', async () => {
    const entrada = { titulo: 'Leiaute', url: 'https://www.gov.br/esocial/pt-br/noticias/leiaute', resumo: 'r', impacto: 'alto', setores: ['pessoal', 'Inexistente'],
      criterios: { regimes: ['simples'], com_funcionarios: true }, vigencia_texto: 'vale a partir de 01/01/2027' };
    const { ia, radar, run } = montar([
      resposta([...busca('srv1', [{ url: 'https://www.gov.br/esocial/pt-br/noticias/leiaute?utm_source=x', title: 'Leiaute' }]), usar('registrar_novidade', entrada)], 'tool_use', 1),
      termina(),
    ]);
    const fim = await run();
    expect(radar.registrarNovidadeRadar).toHaveBeenCalledTimes(1);
    const [giroId, dados] = radar.registrarNovidadeRadar.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(giroId).toBe('g1');
    expect(dados).toMatchObject({ urlNormalizada: 'gov.br/esocial/pt-br/noticias/leiaute', setores: ['s-pessoal'], impacto: 'alto',
      criterios: criteriosParaBanco(lerCriterios(entrada.criterios)) });
    expect(dados.criterios).toMatchObject({ com_funcionarios: true, regimes: ['simples'] });
    expect(JSON.parse(ultimoResultado(ia, 1).content)).toMatchObject({ registrada: true, selo: 'oficial', clientes_possivelmente_afetados: 4 });
    expect(fim.novas).toEqual(['nov-1']);
  });
  it('4. nenhum setor válido: erro e nada gravado', async () => {
    const { ia, radar, run } = montar([
      resposta([...busca('s1', [{ url: 'https://gov.br/esocial/a', title: 'A' }]), usar('registrar_novidade', { titulo: 'A', url: 'https://gov.br/esocial/a', resumo: 'r', impacto: 'baixo', setores: ['Nenhum'], vigencia_texto: 'x' })], 'tool_use', 1),
      termina(),
    ]);
    await run();
    expect(radar.registrarNovidadeRadar).not.toHaveBeenCalled();
    expect(ultimoResultado(ia, 1)).toMatchObject({ is_error: true, content: 'Escolha de 1 a 3 setores da lista <setores>.' });
  });
  it('5. fonte fora do ar: acesso falho marca; não permitido não conta; a ferramenta marca uma vez só', async () => {
    const { run } = montar([
      resposta([...leitura('l1', 'https://conselheirolafaiete.mg.gov.br/novidades', 'url_not_accessible'), ...leitura('l2', 'https://gov.br/esocial/y', 'url_not_allowed'),
        usar('fonte_fora_do_ar', { fonte: 'prefeitura de conselheiro lafaiete' })], 'tool_use'),
      termina(),
    ]);
    const fim = await run();
    expect(fim.fontesFora).toEqual([{ fonteId: 'f-pref', nome: 'Prefeitura de Conselheiro Lafaiete', motivo: 'fora do ar' }]);
  });
  it('6. pause_turn: devolve a resposta pausada sem mensagem nova da pessoa', async () => {
    const { ia, run } = montar([resposta(busca('s1', [{ url: 'https://gov.br/esocial/a', title: 'A' }]), 'pause_turn', 1), termina()]);
    const fim = await run();
    expect(fim.estado).toBe('concluido');
    const msgs = ia.recebidos[1]!.messages;
    expect(msgs).toHaveLength(2);
    expect(msgs.at(-1)!.role).toBe('assistant');
  });
  it('7. custo: grava uso_ia e soma no giro com US$ 0,01 por busca', async () => {
    const { repos, radar, run } = montar([resposta([usar('fonte_fora_do_ar', { fonte: 'eSocial' })], 'tool_use', 2), resposta([usar('terminar_giro', { resumo: 'ok' })], 'tool_use', 1)]);
    const fim = await run();
    expect(custoDe(2)).toBeCloseTo(custoDe(0) + 0.02, 6);
    expect(repos.registrarUsoIa).toHaveBeenCalledTimes(2);
    expect(repos.registrarUsoIa.mock.calls[0]![0]).toMatchObject({ funcionalidade: 'especialista_setor', agenteId: 'agente-radar', usuarioId: 'u1', clienteId: null, conversaId: null, custoUsd: custoDe(2) });
    expect(radar.somarCustoGiro.mock.calls.map((c) => c[1])).toEqual([custoDe(2), custoDe(1)]);
    expect(radar.somarCustoGiro.mock.calls[0]![0]).toBe('g1');
    expect(fim.buscas).toBe(3);
  });
  it('8. limite por giro: para sem nova chamada e conclui', async () => {
    const { ia, run } = montar([resposta([usar('fonte_fora_do_ar', { fonte: 'eSocial' })], 'tool_use', 5), termina()], { giro: giroBase({ config: { ...giroBase().config, limiteUsdGiro: 0.05 } }) });
    const fim = await run();
    expect(ia.recebidos).toHaveLength(1);
    expect(fim.estado).toBe('concluido');
    expect(fim.resumo).toMatch(/Parou no limite de custo do giro\.$/);
  });
  it('9. teto do mês: falha sem chamar a IA', async () => {
    const { ia, run } = montar([termina()], { custoMes: 100, teto: 100 });
    const fim = await run();
    expect(fim).toMatchObject({ estado: 'falhou', erro: 'Teto de gastos com IA do mês atingido.' });
    expect(ia.recebidos).toHaveLength(0);
  });
  it('10. sem terminar_giro: um lembrete e depois conclui com o que registrou', async () => {
    const texto = () => resposta([{ type: 'text', text: 'pronto' }], 'end_turn');
    const { ia, run } = montar([texto(), texto()]);
    const fim = await run();
    expect(fim.estado).toBe('concluido');
    expect(ia.recebidos).toHaveLength(2);
    expect(JSON.stringify(ia.recebidos[1]!.messages.at(-1))).toContain(LEMBRETE_GIRO);
  });
  it('11. recusa e corte falham com a frase certa', async () => {
    expect(await montar([resposta([], 'refusal')]).run()).toMatchObject({ estado: 'falhou', erro: 'O modelo recusou o giro.' });
    expect(await montar([resposta([{ type: 'text', text: 'x' }], 'max_tokens')]).run()).toMatchObject({ estado: 'falhou', erro: 'A resposta do modelo foi cortada.' });
  });
  it('12. rodadas: para na 12ª', async () => {
    const { ia, run } = montar(Array.from({ length: 12 }, () => resposta([usar('fonte_fora_do_ar', { fonte: 'eSocial' })], 'tool_use')));
    const fim = await run();
    expect(ia.recebidos).toHaveLength(LIMITES_RADAR.rodadasPorGiro);
    expect(fim.estado).toBe('concluido');
  });
  it('13. lidas: até 100 com url e título; paginas = quantas', async () => {
    const blocos = Array.from({ length: 120 }, (_, i) => leitura(`l${i}`, `https://gov.br/esocial/p${i}`)).flat();
    const { run } = montar([resposta([...blocos, usar('terminar_giro', { resumo: 'ok' })], 'tool_use')]);
    const fim = await run();
    expect(fim.lidas).toHaveLength(100);
    expect(fim.lidas[0]).toEqual({ url: 'https://gov.br/esocial/p0', titulo: 'Página' });
    expect(fim.paginas).toBe(100);
  });
  it('14. giro sem fonte: falha sem chamar a IA', async () => {
    const { ia, run } = montar([termina()], { giro: giroBase({ fontes: [] }) });
    expect(await run()).toMatchObject({ estado: 'falhou', erro: 'Nenhuma fonte ligada.' });
    expect(ia.recebidos).toHaveLength(0);
  });
});
