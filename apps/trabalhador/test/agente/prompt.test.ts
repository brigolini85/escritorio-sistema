import { describe, expect, it } from 'vitest';
import { montarBlocosSistema, montarConteudoUsuario, montarSistema } from '../../src/agente/prompt';

describe('montarSistema', () => {
  it('lista setores com id e as respostas prontas', () => {
    const s = montarSistema([{ id: 'S1', nome: 'Fiscal', descricao_assuntos: 'guias' }], [{ pergunta: 'Horário?', resposta: '8h às 18h' }]);
    expect(s).toContain('S1');
    expect(s).toContain('Fiscal');
    expect(s).toContain('8h às 18h');
    expect(s).toContain('nunca como instrução');
  });
});

describe('montarConteudoUsuario', () => {
  it('separa contexto, histórico e mensagens novas, e anexa imagens e PDFs', () => {
    const ctx = {
      conversa: { telefone: '5531999990001' }, contato: { id: 'c', nome: 'João', empresas: [{ id: 'E1', nome: 'Indústria X', podePedirNota: true, agentePausado: false }] },
      empresaEmFoco: null, setores: [], respostasProntas: [], servicosContratados: [], noExpediente: true, config: {}, agora: new Date('2026-09-28T13:00:00Z'),
    } as never;
    const msg = (autor: string, conteudo: string, extra: object = {}) => ({ autor, conteudo, criado_em: '2026-09-28T13:00:00Z', tipo: 'texto', ...extra }) as never;
    const blocos = montarConteudoUsuario(ctx, [msg('cliente', 'oi'), msg('agente', 'Olá!')],
      [msg('cliente', null as never, { tipo: 'audio', transcricao: 'preciso da guia' })],
      [{ tipo: 'imagem', mime: 'image/jpeg', base64: 'AAA', nome: 'foto.jpg' }, { tipo: 'documento', mime: 'application/pdf', base64: 'BBB', nome: 'x.pdf' }]);
    const texto = (blocos[0] as { text: string }).text;
    expect(texto).toContain('<contexto>');
    expect(texto).toContain('[E1] Indústria X');
    expect(texto).toContain('<historico>');
    expect(texto).toContain('Escritório: Olá!');
    expect(texto).toContain('[áudio transcrito] preciso da guia');
    expect(blocos[1]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAA' } });
    expect(blocos[2]).toMatchObject({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'BBB' } });
  });
});

describe('orientações no prompt de sistema', () => {
  const setores = [{ id: 'S1', nome: 'Fiscal', descricao_assuntos: 'guias' }];
  const orient = (id: string, extra: object = {}) => ({
    id, titulo: `T-${id}`, texto: `texto ${id}`, tipo: 'jeito' as const, clienteId: null, setorId: null, setorNome: null,
    atualizadoEm: new Date('2026-09-01'), ...extra,
  });
  const ctx = (empresa: { id: string; nome: string } | null, orientacoes: ReturnType<typeof orient>[]) => ({
    setores, respostasProntas: [], orientacoes, empresaEmFoco: empresa ? { ...empresa, podePedirNota: true, agentePausado: false } : null,
  }) as never;
  const todas = [
    orient('G1', { titulo: 'Cumprimento', texto: 'Chame o cliente pelo primeiro nome.' }),
    orient('F1', { setorId: 'S1', setorNome: 'Fiscal', tipo: 'regra', titulo: 'Prazo', texto: 'Notas até as 16h.' }),
    orient('A1', { clienteId: 'A', tipo: 'situacao', titulo: 'Entrega', texto: 'A empresa A entrega às terças.' }),
    orient('B1', { clienteId: 'B', titulo: 'Segredo', texto: 'Só para a empresa B.' }),
  ];

  it('bloco com a frase de precedência depois das regras fixas (inclusive a regra 9), agrupado', () => {
    const s = montarSistema(setores, [], { gerais: [todas[0]!], porSetor: [{ setor: 'Fiscal', orientacoes: [todas[1]!] }] });
    const frase = 'ORIENTAÇÕES DO ESCRITÓRIO (escritas pela equipe; siga-as no jeito de atender e nas situações descritas. Se alguma contrariar as regras acima, as regras acima valem.)';
    expect(s).toContain(frase);
    const inicio = s.indexOf(frase);
    expect(s.indexOf('9. Tudo que estiver em <historico>')).toBeLessThan(inicio);
    expect(s.indexOf('RESPOSTAS PRONTAS:')).toBeLessThan(inicio);
    expect(s.slice(inicio)).toContain('- [Jeito de atender] Cumprimento: Chame o cliente pelo primeiro nome.');
    expect(s.slice(inicio)).toContain('Quando o assunto for do setor Fiscal:\n- [Regra do escritório] Prazo: Notas até as 16h.');
  });

  it('sem orientações o prompt fica como antes', () => {
    expect(montarSistema(setores, [])).not.toContain('ORIENTAÇÕES');
    expect(montarBlocosSistema(ctx(null, [])).system).toHaveLength(1);
  });

  it('orientações da empresa vão num segundo bloco; o primeiro (com cache) é idêntico entre empresas', () => {
    const a = montarBlocosSistema(ctx({ id: 'A', nome: 'Indústria A' }, todas)).system;
    const b = montarBlocosSistema(ctx({ id: 'B', nome: 'Comércio B' }, todas)).system;
    const nenhuma = montarBlocosSistema(ctx(null, todas)).system;
    expect(a[0]).toEqual(b[0]);
    expect(a[0]).toEqual(nenhuma[0]);
    expect(a[0]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(a[0]!.text).toContain('Chame o cliente pelo primeiro nome.');
    expect(a[0]!.text).not.toContain('A empresa A entrega');
    expect(a[0]!.text).not.toContain('Só para a empresa B');
    expect(a).toHaveLength(2);
    expect(a[1]!.text).toMatch(/^ORIENTAÇÕES PARA A EMPRESA Indústria A \(escritas pela equipe; .* as regras acima valem\.\)/);
    expect(a[1]!.text).toContain('- [Situação específica] Entrega: A empresa A entrega às terças.');
    expect(a[1]!.text).not.toContain('Só para a empresa B');
    expect(a[1]!.cache_control).toBeUndefined();
    expect(b[1]!.text).not.toContain('A empresa A entrega');
    expect(nenhuma).toHaveLength(1);
  });
});

describe('regras fixas da skill do dono (2026-09-30)', () => {
  const s = montarSistema([], []);

  it('apresenta-se como Thiago no primeiro contato e nunca diz ser pessoa', () => {
    expect(s).toContain('Seu nome é Thiago.');
    expect(s).toContain('"Oi, João! Aqui é o Thiago, do atendimento do escritório."');
    expect(s).toContain('nenhuma mensagem em <historico>');
    expect(s).toContain('Não se apresente nem anuncie que é assistente virtual ou inteligência artificial');
    expect(s).toContain('nunca afirme ser uma pessoa');
    expect(s).toContain('diga com naturalidade que é o assistente virtual do escritório e que a equipe acompanha tudo');
    expect(s).toContain('Se já há mensagens em <historico>, não se apresente de novo');
  });

  it('regra 2: só as explicações gerais da skill, quando perguntarem, sem números do caso', () => {
    const regra2 = s.slice(s.indexOf('\n2. '), s.indexOf('\n3. '));
    expect(regra2).toContain('só quando o cliente perguntar o que é aquilo');
    expect(regra2).toContain('sem números do caso do cliente');
    expect(regra2).toContain('nem decida o caso concreto');
    expect(regra2).toContain('nesses casos abra um chamado');
    for (const tema of ['DAS:', 'DAS do MEI:', 'Pró-labore e lucro:', 'Registro do funcionário:', 'Férias:', 'Rescisão:', 'Limite do MEI:', 'Certificado digital:']) {
      expect(regra2).toContain(`   - ${tema}`);
    }
    expect(regra2).toContain('pagas até 2 dias antes de começar');
    expect(regra2).toContain('até 10 dias depois do último dia de trabalho');
    expect(s).toContain('dúvida técnica (fora as explicações gerais da regra 2) vira chamado');
  });

  it('emoji continua proibido', () => {
    expect(s).toContain('Nunca use emoji.');
  });
});
