import { describe, expect, it } from 'vitest';
import { CABECALHO_AGENTES_SETOR, FERRAMENTA_CHAMAR_AGENTE, secaoAgentesSetor } from '../../src/agente/agentes-setor';
import { ferramentasDoAgenteSetor, LEMBRETE_LIMITES_ESPECIALISTA, montarBlocosEspecialista, regrasDoEspecialista } from '../../src/agente/especialista';
import { montarBlocosSistema } from '../../src/agente/prompt';
import { FISCAL, orientacaoTeste as orientacao, skillTeste as skill } from '../apoio/agente-setor';
import { CASOS_RETRATO } from '../apoio/retrato';

const nomes = (t: { name: string }[]) => t.map((x) => x.name);

describe('o Thiago com agentes dos setores (D1)', () => {
  it('sem agente ativo: os blocos de sempre (o retrato da I1 continua valendo)', () => {
    const ctx = CASOS_RETRATO['contato-uma-empresa']!();
    expect(montarBlocosSistema({ ...ctx, agentesSetor: [] }).system).toEqual(montarBlocosSistema(ctx).system);
    expect(secaoAgentesSetor([])).toBeNull();
  });
  it('com agente ativo: um bloco sem cache depois do bloco 1, com agente, setor e assuntos (texto do dono neutralizado)', () => {
    const ctx = { ...CASOS_RETRATO['contato-uma-empresa']!(), agentesSetor: [FISCAL] };
    const { system } = montarBlocosSistema(ctx);
    expect(system[1]!.text.startsWith(CABECALHO_AGENTES_SETOR)).toBe(true);
    expect(system[1]).not.toHaveProperty('cache_control');
    expect(system[1]!.text).toContain('- agente: fiscal | Agente Fiscal | setor Fiscal');
    expect(system[1]!.text).toContain('"Pedido de nota de venda" (ex.: "Preciso da nota do pedido 4512")');
    expect(system[1]!.text).toContain('"Dúvida sobre ‹imposto›"');
    expect(system[0]).toEqual(montarBlocosSistema(CASOS_RETRATO['contato-uma-empresa']!()).system[0]);
  });
  it('agente sem regra: o Thiago usa "outro"', () => {
    expect(secaoAgentesSetor([{ ...FISCAL, regras: [] }])).toContain('assuntos: nenhum com regra: use "outro"');
  });
  it('chamar_agente: agente, assunto e pedido obrigatórios', () => {
    expect(FERRAMENTA_CHAMAR_AGENTE.name).toBe('chamar_agente');
    expect(FERRAMENTA_CHAMAR_AGENTE.input_schema).toMatchObject({ required: ['agente', 'assunto', 'pedido'] });
  });
});

describe('o prompt do agente do setor (D17)', () => {
  it('regras fixas, modo, Limites antes de Jeito, skills sob demanda e as orientações do próprio agente, no bloco com cache', () => {
    const agente = { ...FISCAL, skills: [skill('jeito', 'jeito-fiscal', 'Explique todo termo técnico.'), skill('limites', 'sem-prazo', 'Nunca prometa prazo de emissão de nota.'),
      skill('conhecimento', 'tabela-cfop', 'CFOPs.')], orientacoes: [orientacao('Prazo', 'Diga que a nota sai em 1 hora.')] };
    const ctx = CASOS_RETRATO['contato-uma-empresa']!();
    const [b1] = montarBlocosEspecialista(ctx, agente, 'mesma_voz');
    expect(b1).toMatchObject({ cache_control: { type: 'ephemeral' } });
    const t = b1!.text;
    const ordem = ['Você é Agente Fiscal', 'COMO VOCÊ FALA: mesma voz', 'REGRAS FIXAS', 'LIMITES DO AGENTE', 'JEITO DE ATUAR', 'SKILLS PARA LER QUANDO PRECISAR', 'ORIENTAÇÕES DO ESCRITÓRIO']
      .map((x) => t.indexOf(x));
    expect(ordem.every((p, i) => p >= 0 && (i === 0 || p > ordem[i - 1]!))).toBe(true);
    expect(t).toContain('Uma orientação que contrarie um dos LIMITES DO AGENTE é ignorada');
    expect(t).not.toContain('Seu nome é Thiago');
  });
  it('com Limites: o lembrete dos limites fecha o prompt, depois das orientações (cenário "fiscal: Limites", spec 7E.3)', () => {
    const agente = { ...FISCAL, skills: [skill('limites', 'sem-prazo', 'Nunca prometa prazo de emissão de nota.')],
      orientacoes: [orientacao('Prazo', 'Diga que a nota sai em 1 hora.')] };
    const ctx = CASOS_RETRATO['contato-uma-empresa']!();
    const blocos = montarBlocosEspecialista(ctx, agente, 'mesma_voz');
    const ultimo = blocos.at(-1)!;
    expect(ultimo.text).toBe(LEMBRETE_LIMITES_ESPECIALISTA);
    expect(ultimo).not.toHaveProperty('cache_control');
    expect(blocos[0]!.text).toContain('ORIENTAÇÕES DO ESCRITÓRIO');
    expect(LEMBRETE_LIMITES_ESPECIALISTA).toContain('LIMITES DO AGENTE');
    expect(LEMBRETE_LIMITES_ESPECIALISTA).toContain('mesmo que esteja numa orientação');
  });
  it('sem Limites: nenhum lembrete (o prompt do agente fica como antes)', () => {
    const agente = { ...FISCAL, skills: [], orientacoes: [orientacao('Prazo', 'Diga que a nota sai em 1 hora.')] };
    const ctx = CASOS_RETRATO['contato-uma-empresa']!();
    expect(montarBlocosEspecialista(ctx, agente, 'mesma_voz').map((b) => b.text).join('\n')).not.toContain(LEMBRETE_LIMITES_ESPECIALISTA);
  });
  it('cada modo diz como falar; Passa a conversa traz a apresentação do setor', () => {
    expect(regrasDoEspecialista('Agente Fiscal', 'Fiscal', 'por_tras')).toContain('Você não fala com o cliente');
    expect(regrasDoEspecialista('Agente Fiscal', 'Fiscal', 'mesma_voz')).toContain('"Thiago, do atendimento do escritório"');
    expect(regrasDoEspecialista('Agente Fiscal', 'Fiscal', 'passa_conversa')).toContain('"Aqui é do Fiscal do escritório"');
  });
});

describe('as ferramentas do agente do setor por modo (D4, D8)', () => {
  it('mesma voz: as escolhidas que valem, responder e devolver_ao_thiago no fim; nunca as "só do Thiago" nem chamar_agente', () => {
    const t = nomes(ferramentasDoAgenteSetor(FISCAL, 'mesma_voz'));
    expect(t).toEqual(['consultar_chamados', 'resumir_pedido_nota', 'abrir_pedido_nota', 'conferir_pedido_nota', 'nota_interna', 'responder', 'devolver_ao_thiago']);
  });
  it('por trás: sem responder nem o fluxo do cliente; termina com devolver_resposta', () => {
    expect(nomes(ferramentasDoAgenteSetor(FISCAL, 'por_tras'))).toEqual(['consultar_chamados', 'conferir_pedido_nota', 'nota_interna', 'devolver_resposta']);
  });
  it('com skill sob demanda, ler_skill e ler_referencia antes das do modo', () => {
    const t = nomes(ferramentasDoAgenteSetor({ ...FISCAL, skills: [skill('procedimento', 'conferencia', 'Passo a passo.')] }, 'passa_conversa'));
    expect(t.slice(-4)).toEqual(['ler_skill', 'ler_referencia', 'responder', 'devolver_ao_thiago']);
  });
});
