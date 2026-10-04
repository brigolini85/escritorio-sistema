import { describe, expect, it } from 'vitest';
import {
  alertasDaFaixa, barraDoSetor, capitalizar, dataDoTitulo, detalheEsperando, detalheMaisAtrasada, detalheVencemHoje, diasDoMes, diaSP,
  hrefDoSetor, juntarNomes, lerEstadoSistema, lerLinhasSetor, linhasDoSistema, mesCorrenteSP, primeiroNome,
  saudacao, separarSetores, situacaoTeto, textoAtualizado, textoSemAbertas, totaisDosSetores,
} from './inicio';

describe('mesCorrenteSP', () => {
  it('usa o mês de Brasília (virada de mês e de ano)', () => {
    expect(mesCorrenteSP(new Date('2026-09-30T12:00:00Z'))).toEqual({ inicio: '2026-09-01T00:00:00-03:00', fim: '2026-10-01T00:00:00-03:00' });
    // 01/10 às 01:00 UTC ainda é 30/09 em Brasília
    expect(mesCorrenteSP(new Date('2026-10-01T01:00:00Z')).inicio).toBe('2026-09-01T00:00:00-03:00');
    expect(mesCorrenteSP(new Date('2026-12-15T12:00:00Z')).fim).toBe('2027-01-01T00:00:00-03:00');
  });
});

describe('situacaoTeto', () => {
  it('ok abaixo de 80%, perto a partir de 80%, atingido em 100%', () => {
    expect(situacaoTeto(10, 50).nivel).toBe('ok');
    expect(situacaoTeto(40, 50)).toMatchObject({ nivel: 'perto', fracao: 0.8 });
    expect(situacaoTeto(50, 50).nivel).toBe('atingido');
    expect(situacaoTeto(0, 0).nivel).toBe('atingido');
  });
});

describe('alertasDaFaixa', () => {
  const agora = new Date('2026-09-30T12:00:00Z');
  const ha = (s: number) => new Date(agora.getTime() - s * 1000).toISOString();
  const ok = { fila: ha(30), whatsapp: ha(30), ultimo: ha(30) };
  it('nada errado: faixa vazia', () => {
    expect(alertasDaFaixa({ teto: situacaoTeto(1, 50), sinais: ok, agora })).toEqual([]);
    expect(alertasDaFaixa({ teto: null, sinais: null, agora })).toEqual([]);
  });
  it('teto perto e atingido', () => {
    expect(alertasDaFaixa({ teto: situacaoTeto(45, 50), sinais: ok, agora })[0]).toMatchObject({ id: 'teto', nivel: 'atencao' });
    expect(alertasDaFaixa({ teto: situacaoTeto(50, 50), sinais: ok, agora })[0]).toMatchObject({ id: 'teto', nivel: 'perigo', titulo: 'Teto de gasto com IA atingido' });
  });
  it('WhatsApp sem sinal com a fila batendo: aviso neutro com o tempo', () => {
    expect(alertasDaFaixa({ teto: null, sinais: { ...ok, whatsapp: ha(400) }, agora })[0]!.titulo).toBe('Sem sinal do WhatsApp há 6 min');
    expect(alertasDaFaixa({ teto: null, sinais: { ...ok, whatsapp: ha(400) }, agora }).map((a) => a.id)).toEqual(['whatsapp']);
    expect(alertasDaFaixa({ teto: null, sinais: { ...ok, whatsapp: ha(200) }, agora })).toEqual([]); // só atrasado
  });
  it('fila parada esconde o aviso do WhatsApp (os dois vêm do batimento)', () => {
    expect(alertasDaFaixa({ teto: null, sinais: { fila: null, whatsapp: null, ultimo: null }, agora }).map((a) => a.id)).toEqual(['fila']);
  });
});

describe('textoFracaoTeto', () => {
  it('percentual normal e "teto atingido" para fração infinita, nunca Infinity%', async () => {
    const { textoFracaoTeto } = await import('./inicio');
    expect(textoFracaoTeto(0.41)).toBe('41%');
    expect(textoFracaoTeto(Infinity)).toBe('teto atingido');
    expect(textoFracaoTeto(situacaoTeto(5, 0).fracao)).toBe('teto atingido');
  });
});

describe('faixa: fila atrasada e links (D10)', () => {
  const agora = new Date('2026-09-30T12:00:00Z');
  const ha = (s: number) => new Date(agora.getTime() - s * 1000).toISOString();
  it('fila atrasada (3 a 5 min): aviso âmbar com o tempo e o link para os sinais', () => {
    const [a] = alertasDaFaixa({ teto: null, sinais: { fila: ha(200), whatsapp: ha(30), ultimo: ha(30) }, agora });
    expect(a).toMatchObject({ id: 'fila', nivel: 'atencao', titulo: 'Fila de tarefas sem batimento há 3 min', link: { href: '#sinais-de-vida', rotulo: 'Ver sinais de vida' } });
    expect(a!.texto).toContain('Se passar de 5 min, vira alerta crítico.');
  });
  it('fila atrasada e WhatsApp parado: os dois', () => {
    expect(alertasDaFaixa({ teto: null, sinais: { fila: ha(200), whatsapp: ha(400), ultimo: ha(200) }, agora }).map((a) => a.id)).toEqual(['fila', 'whatsapp']);
  });
  it('teto leva a Gastos com IA', () => {
    expect(alertasDaFaixa({ teto: situacaoTeto(50, 50), sinais: null, agora })[0]!.link).toEqual({ href: '/gastos-ia', rotulo: 'Ver Gastos com IA' });
  });
});

describe('cabeçalho (D23)', () => {
  it('dia da semana e data de Brasília, sem "-feira"', () => {
    expect(dataDoTitulo(new Date('2026-10-01T15:00:00Z'))).toBe('quinta, 01/10');
    expect(dataDoTitulo(new Date('2026-10-02T02:00:00Z'))).toBe('quinta, 01/10'); // 23:00 de 01/10 em Brasília
    expect(dataDoTitulo(new Date('2026-10-03T12:00:00Z'))).toBe('sábado, 03/10');
    expect(capitalizar('quinta, 01/10')).toBe('Quinta, 01/10');
  });
  it('saudação pela hora de Brasília', () => {
    expect(saudacao(new Date('2026-10-01T08:00:00Z'))).toBe('Bom dia');    // 05:00
    expect(saudacao(new Date('2026-10-01T14:59:00Z'))).toBe('Bom dia');    // 11:59
    expect(saudacao(new Date('2026-10-01T15:00:00Z'))).toBe('Boa tarde');  // 12:00
    expect(saudacao(new Date('2026-10-01T21:30:00Z'))).toBe('Boa noite');  // 18:30
    expect(saudacao(new Date('2026-10-01T06:00:00Z'))).toBe('Boa noite');  // 03:00
  });
  it('primeiro nome, nomes juntos e "atualizado há"', () => {
    expect(primeiroNome('  Ana Souza Lima ')).toBe('Ana');
    expect(juntarNomes([])).toBe('');
    expect(juntarNomes(['Fiscal'])).toBe('Fiscal');
    expect(juntarNomes(['Pessoal', 'Fiscal'])).toBe('Pessoal e Fiscal');
    expect(juntarNomes(['Comercial', 'Direção', 'IRPF'])).toBe('Comercial, Direção e IRPF');
    expect(textoAtualizado(2)).toBe('agora');
    expect(textoAtualizado(12.7)).toBe('há 12 s');
    expect(textoAtualizado(185)).toBe('há 3 min');
  });
  it('dia e mês de Brasília', () => {
    expect(diaSP(new Date('2026-10-01T02:00:00Z'))).toBe('2026-09-30');
    expect(diasDoMes(new Date('2026-10-15T12:00:00Z'))).toEqual({ primeiro: '01/10', ultimo: '31/10' });
    expect(diasDoMes(new Date('2027-02-10T12:00:00Z'))).toEqual({ primeiro: '01/02', ultimo: '28/02' });
  });
});

describe('demandas por setor (D5)', () => {
  const bruto = [
    { setor_id: 's1', setor: 'Fiscal', abertas: 9, no_prazo: 5, vencem_hoje: 3, vencidas: 1, sem_responsavel: 2, urgentes: 1 },
    { setor_id: 's2', setor: 'Comercial', abertas: 0, no_prazo: 0, vencem_hoje: 0, vencidas: 0, sem_responsavel: 0, urgentes: 0 },
    { setor_id: 's3', setor: 'Direção', abertas: '0', no_prazo: 0, vencem_hoje: 0, vencidas: 0, sem_responsavel: 0, urgentes: 0 },
    { setor_id: null, setor: 'Triagem', abertas: 2, no_prazo: 2, vencem_hoje: 0, vencidas: 0, sem_responsavel: 1, urgentes: 0 },
  ];
  it('lê, soma e separa os setores sem abertas', () => {
    const linhas = lerLinhasSetor(bruto);
    expect(linhas[0]).toEqual({ setorId: 's1', setor: 'Fiscal', abertas: 9, noPrazo: 5, vencemHoje: 3, vencidas: 1, semResponsavel: 2, urgentes: 1 });
    expect(totaisDosSetores(linhas)).toEqual({ abertas: 11, vencemHoje: 3, vencidas: 1, semResponsavel: 3, urgentes: 1 });
    const { visiveis, semAbertas } = separarSetores(linhas);
    expect(visiveis.map((l) => l.setor)).toEqual(['Fiscal', 'Triagem']);
    expect(semAbertas).toEqual(['Comercial', 'Direção']);
    expect(textoSemAbertas(semAbertas)).toBe('Comercial e Direção sem demandas abertas');
    expect(textoSemAbertas([])).toBeNull();
    expect(lerLinhasSetor(null)).toEqual([]);
  });
  it('barra proporcional ao maior setor, com o texto para o leitor de tela', () => {
    const [fiscal, , , triagem] = lerLinhasSetor(bruto);
    expect(barraDoSetor(fiscal!, 9)).toEqual({ noPrazo: 55.6, venceHoje: 33.3, vencida: 11.1, rotulo: '1 vencida, 3 vencem hoje, 5 no prazo' });
    expect(barraDoSetor(triagem!, 9)).toEqual({ noPrazo: 22.2, venceHoje: 0, vencida: 0, rotulo: '2 no prazo' });
    expect(hrefDoSetor('s1')).toBe('/demandas?setor=s1');
    expect(hrefDoSetor(null)).toBe('/demandas?setor=triagem');
  });
});

describe('detalhes dos números', () => {
  const agora = new Date('2026-10-01T15:00:00Z'); // 12:00 em Brasília
  it('esperando, vencem hoje e mais atrasada', () => {
    expect(detalheEsperando(new Date(agora.getTime() - 18 * 60_000).toISOString(), agora)).toBe('a mais antiga há 18 min');
    expect(detalheEsperando(new Date(agora.getTime() - 20_000).toISOString(), agora)).toBe('a mais antiga chegou agora');
    expect(detalheEsperando(null, agora)).toBe('ninguém esperando');
    expect(detalheVencemHoje([
      { prioridade: 'urgente', prazo_em: '2026-10-01T20:00:00Z' }, { prioridade: 'urgente', prazo_em: '2026-10-01T21:00:00Z' },
      { prioridade: 'normal', prazo_em: '2026-10-01T18:00:00Z' },
    ])).toBe('2 urgentes · até 18h');
    expect(detalheVencemHoje([{ prioridade: 'normal', prazo_em: '2026-10-01T18:30:00Z' }])).toBe('até 15h30');
    expect(detalheVencemHoje([])).toBeNull();
    expect(detalheMaisAtrasada('2026-09-29T21:00:00Z', agora)).toBe('mais atrasada: venceu 29/09');
    expect(detalheMaisAtrasada(null, agora)).toBeNull();
  });
});

describe('estado do sistema (D3, D18)', () => {
  const ok = { agente_pausado: false, teto_atingido: false, whatsapp_conectado: true, trabalhador_ok: true, verificado_em: '2026-10-01T15:00:00Z' };
  it('lê só booleanos; qualquer outra coisa é indisponível', () => {
    expect(lerEstadoSistema(ok)).toEqual({ agentePausado: false, tetoAtingido: false, whatsappConectado: true, trabalhadorOk: true });
    expect(lerEstadoSistema(null)).toBeNull();
    expect(lerEstadoSistema({ ...ok, teto_atingido: 'sim' })).toBeNull();
  });
  it('linhas do bloco Sistema, sem valores', () => {
    expect(linhasDoSistema(lerEstadoSistema(ok)!)).toEqual([
      { id: 'agente', rotulo: 'Agente', valor: 'atendendo', tom: 'ok' },
      { id: 'whatsapp', rotulo: 'WhatsApp', valor: 'conectado', tom: 'ok' },
    ]);
    expect(linhasDoSistema(lerEstadoSistema({ ...ok, agente_pausado: true })!)[0]).toMatchObject({ valor: 'pausado', tom: 'perigo' });
    expect(linhasDoSistema(lerEstadoSistema({ ...ok, teto_atingido: true })!)[0]).toMatchObject({ valor: 'pausado: limite de IA do mês', tom: 'perigo' });
    expect(linhasDoSistema(lerEstadoSistema({ ...ok, whatsapp_conectado: false })!)[1]).toMatchObject({ valor: 'sem sinal', tom: 'perigo' });
    expect(linhasDoSistema(lerEstadoSistema({ ...ok, trabalhador_ok: false, whatsapp_conectado: false })!)).toEqual([
      { id: 'agente', rotulo: 'Agente', valor: 'atendendo', tom: 'ok' },
      { id: 'whatsapp', rotulo: 'WhatsApp', valor: 'sem confirmação', tom: 'atencao' },
      { id: 'fila', rotulo: 'Mensagens', valor: 'paradas: avise o administrador', tom: 'perigo' },
    ]);
  });
});
