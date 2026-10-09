import { describe, expect, it } from 'vitest';
import {
  diaCurto, horaResumo, hrefSecao, inicioExemplo, nomeModelo, resumosDasSecoes, rotuloDaSecao, secaoDaUrl, secaoDoHash, secoesDe,
  textoDias, textoDiasUteis, textoImpacto, vencimentoCurto, type ImpactoPrazo,
} from './configuracoes';

describe('seções (spec 7C.4, D8, D12)', () => {
  it('quatro grupos; quem não é administrador não vê Teto e modelos de IA nem Integrações', () => {
    // Auditoria 5.1 (D3): a seção Dados de pagamento entrou depois de Mensagens.
    expect(secoesDe(true).map((s) => s.id)).toEqual(['expediente', 'prazos', 'feriados', 'mensagens', 'pagamento', 'respostas', 'espera', 'ia', 'setores', 'servicos', 'cargos', 'integracoes']);
    expect(secoesDe(false).map((s) => s.id)).not.toContain('ia');
    expect(secoesDe(false).map((s) => s.id)).not.toContain('integracoes');
  });
  it('auditoria 6.7 e D3: Mensagens e Dados de pagamento são só do administrador', () => {
    expect(secoesDe(false).map((s) => s.id)).not.toContain('mensagens');
    expect(secoesDe(false).map((s) => s.id)).not.toContain('pagamento');
    expect(secaoDaUrl('pagamento', false).id).toBe('expediente');
    expect(secaoDaUrl('pagamento', true).id).toBe('pagamento');
    expect(secaoDaUrl('aviso-login', false).id).toBe('expediente');
    expect(rotuloDaSecao('pagamento')).toBe('Dados de pagamento');
  });
  it('?secao=: vazia, desconhecida ou proibida → Expediente; âncoras antigas valem', () => {
    expect(secaoDaUrl(undefined, true).id).toBe('expediente');
    expect(secaoDaUrl('xyz', true).id).toBe('expediente');
    expect(secaoDaUrl('ia', false).id).toBe('expediente');
    expect(secaoDaUrl('ia', true).id).toBe('ia');
    expect(secaoDaUrl('teto-ia', true).id).toBe('ia');
    expect(secaoDaUrl(['prazos', 'x'], false).id).toBe('prazos');
  });
  it('hash de link antigo', () => {
    expect(secaoDoHash('#teto-ia')).toBe('ia');
    expect(secaoDoHash('#atendimento')).toBe('espera');
    expect(secaoDoHash('#aviso-login')).toBe('mensagens');
    expect(secaoDoHash('#integracoes')).toBe('integracoes');
    expect(secaoDoHash('#nada')).toBeNull();
    expect(secaoDoHash('')).toBeNull();
    // Hash malformado (link colado pela metade) não derruba a página.
    expect(secaoDoHash('#%E0%A4%A')).toBeNull();
  });
  it('rótulo e endereço', () => {
    expect(rotuloDaSecao('prazos')).toBe('Prazos');
    expect(rotuloDaSecao('teto-ia')).toBe('Teto e modelos de IA');
    expect(rotuloDaSecao('zzz')).toBeNull();
    expect(hrefSecao('feriados')).toBe('/configuracoes?secao=feriados');
  });
});

describe('textos', () => {
  it('dias úteis em faixas', () => {
    expect(textoDiasUteis([1, 2, 3, 4, 5])).toBe('seg–sex');
    expect(textoDiasUteis([5, 4, 3, 2, 1, 6])).toBe('seg–sáb');
    expect(textoDiasUteis([1, 3, 5])).toBe('seg, qua, sex');
    expect(textoDiasUteis([1, 2])).toBe('seg, ter');
    expect(textoDiasUteis([])).toBe('nenhum dia');
  });
  it('hora curta e dias', () => {
    expect(horaResumo('08:00:00')).toBe('08');
    expect(horaResumo('18:30')).toBe('18:30');
    expect(textoDias(0)).toBe('mesmo dia (fim do expediente)');
    expect(textoDias(1)).toBe('1 dia útil');
    expect(textoDias(5)).toBe('5 dias úteis');
  });
  it('vencimento e exemplo no horário de Brasília', () => {
    expect(vencimentoCurto('2026-10-02T21:00:00Z')).toBe('sex 02/10 às 18:00');
    expect(diaCurto('2026-10-06T21:00:00Z')).toBe('ter 06/10');
    expect(inicioExemplo(new Date('2026-10-03T02:30:00Z'))).toBe('2026-10-02T13:00:00.000Z');
  });
  it('nome do modelo', () => {
    expect(nomeModelo('claude-sonnet-5')).toBe('Claude Sonnet 5');
    expect(nomeModelo('claude-haiku-4-5')).toBe('Claude Haiku 4.5');
    expect(nomeModelo('outro')).toBe('outro');
  });
});

describe('resumosDasSecoes (menu, imagem A + resumos da B)', () => {
  const base = {
    cfg: {
      horario_inicio: '08:00:00', horario_fim: '18:00:00', dias_uteis: [1, 2, 3, 4, 5], prazo_urgente_dias: 0, prazo_alta_dias: 1,
      prazo_normal_dias: 2, prazo_baixa_dias: 5, espera_verde_min: 5, espera_ambar_min: 15, aviso_login: 'Fechamento até 05/10.',
      teto_ia_usd: 100, cargos: ['Auxiliar', 'Analista'],
    },
    feriados: [{ data: '2026-09-07', descricao: 'Independência' }, { data: '2026-10-12', descricao: 'N. Sra. Aparecida' }],
    respostas: [{ ativo: true }, { ativo: false }, { ativo: true }],
    setores: [{ ativo: true }, { ativo: true }, { ativo: false }],
    servicos: [{ setor_id: 's1' }, { setor_id: null }],
    fracaoTeto: 0.41, integracoesOk: true, hoje: '2026-10-02',
  };
  it('cada seção com contagem e resumo', () => {
    const r = resumosDasSecoes(base);
    expect(r.expediente).toEqual({ resumo: 'seg–sex 08–18' });
    expect(r.prazos.resumo).toBe('urgente mesmo dia · alta 1 · normal 2 · baixa 5');
    expect(r.feriados).toEqual({ contagem: 2, resumo: 'próximo: 12/10' });
    expect(r.mensagens).toEqual({ contagem: 4, resumo: 'aviso do login ligado' });
    expect(r.respostas).toEqual({ contagem: 3, resumo: '2 ativas' });
    expect(r.espera.resumo).toBe('verde até 5 · âmbar até 15 min');
    expect(r.ia).toEqual({ resumo: 'teto US$ 100 · 41%', atencao: false });
    expect(r.setores).toEqual({ contagem: 2, resumo: '2 ativos · 1 inativo' });
    expect(r.servicos).toEqual({ contagem: 2, resumo: '1 sem setor', atencao: true });
    expect(r.cargos).toEqual({ contagem: 2, resumo: 'Auxiliar, Analista' });
    expect(r.integracoes).toEqual({ resumo: 'ok', atencao: false });
  });
  it('sem feriado à frente, aviso vazio, teto perto, quem não é administrador', () => {
    const r = resumosDasSecoes({ ...base, cfg: { ...base.cfg, aviso_login: ' ' }, hoje: '2026-12-01', fracaoTeto: null, integracoesOk: null });
    expect(r.feriados.resumo).toBe('nenhum à frente');
    expect(r.mensagens.resumo).toBe('aviso do login desligado');
    expect(r.ia).toEqual({ resumo: 'teto US$ 100', atencao: false });
    expect(r.integracoes.resumo).toBe('');
    expect(resumosDasSecoes({ ...base, fracaoTeto: 0.85 }).ia.atencao).toBe(true);
  });
  it('dados de pagamento: quantos campos e se tem Pix (sem mostrar o valor)', () => {
    expect(resumosDasSecoes(base).pagamento).toEqual({ resumo: 'nenhum cadastrado' });
    const r = resumosDasSecoes({ ...base, cfg: { ...base.cfg, dados_pagamento: { pix: 'chave-secreta', banco: 'Banco X' } } });
    expect(r.pagamento).toEqual({ contagem: 2, resumo: 'Pix cadastrado' });
    expect(resumosDasSecoes({ ...base, cfg: { ...base.cfg, dados_pagamento: { banco: 'Banco X' } } }).pagamento)
      .toEqual({ contagem: 1, resumo: 'sem Pix' });
  });
});

describe('textoImpacto (janela de Prazos, D6)', () => {
  const i: ImpactoPrazo = {
    prioridade: 'normal', dias_atuais: 2, dias_novos: 3, abertas: 14, pela_regra: 11, a_mao: 3, sem_prazo: 0,
    ganham: 9, perdem: 0, pausadas: 2, passam_a_vencidas: 0, ja_vencidas: 1,
  };
  it('aumentar: quantas ganham, à mão e pausadas; nenhuma fica vencida', () => {
    expect(textoImpacto(i)).toEqual({
      titulo: 'Normal: de 2 dias úteis para 3 dias úteis',
      linhas: ['14 demandas Normais abertas', '9 ganham 1 dia útil', '3 com prazo escolhido à mão ficam como estão',
        '2 com o cliente continuam pausadas', 'Nenhuma fica vencida.'],
      alerta: null, recalcula: 9,
    });
  });
  it('diminuir com vencidas: aviso (vermelho na tela)', () => {
    const t = textoImpacto({ ...i, prioridade: 'urgente', dias_atuais: 2, dias_novos: 0, abertas: 1, a_mao: 0, pausadas: 0, ganham: 0, perdem: 1, passam_a_vencidas: 1 });
    expect(t.titulo).toBe('Urgente: de 2 dias úteis para mesmo dia (fim do expediente)');
    expect(t.linhas).toEqual(['1 demanda Urgente aberta', '1 perde 2 dias úteis']);
    expect(t.alerta).toBe('1 passaria a vencida na hora.');
    expect(t.recalcula).toBe(1);
  });
});

describe('resumo da IA com teto zerado', () => {
  it('teto 0 com gasto (fração infinita) mostra "teto atingido", nunca Infinity%', () => {
    const cfg = { dias_uteis: [1, 2, 3, 4, 5], horario_inicio: '08:00', horario_fim: '18:00', prazo_urgente_dias: 0, prazo_alta_dias: 1, prazo_normal_dias: 2, prazo_baixa_dias: 5, espera_verde_min: 5, espera_ambar_min: 15, aviso_login: '', teto_ia_usd: 0, cargos: [] };
    const r = resumosDasSecoes({ cfg, feriados: [], respostas: [], setores: [], servicos: [], fracaoTeto: Infinity, integracoesOk: null, hoje: '2026-10-02' } as never);
    expect(r.ia.resumo).toBe('teto US$ 0 · teto atingido');
    expect(r.ia.atencao).toBe(true);
  });
});
