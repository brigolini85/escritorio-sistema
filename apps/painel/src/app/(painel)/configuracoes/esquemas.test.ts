import { describe, expect, it } from 'vitest';
import { CargosForm, CotacaoForm, EsperaForm, esquemaAvisoLogin, ExpedienteForm, FeriadoForm, modelosForm, PrazosForm, RespostaForm, ServicoForm, SetorForm, TetoAlertasForm } from './esquemas';

describe('ExpedienteForm e TetoAlertasForm (separados na Parte D: teto e alertas são só do administrador)', () => {
  it('expediente: horários e dias úteis', () => {
    const f = new FormData();
    f.set('horario_inicio', '08:00'); f.set('horario_fim', '18:00'); f.append('dia', '1'); f.append('dia', '5');
    expect(ExpedienteForm.parse(f)).toEqual({ horario_inicio: '08:00', horario_fim: '18:00', dias_uteis: [1, 5] });
  });
  it('fim antes do início é recusado', () => {
    const f = new FormData();
    f.set('horario_inicio', '18:00'); f.set('horario_fim', '08:00');
    expect(ExpedienteForm.safeParse(f).success).toBe(false);
  });
  it('teto e alertas', () => {
    const f = new FormData();
    f.set('teto_ia_usd', '80'); f.set('minutos_alerta_fila', '30'); f.set('email_alertas', 'dono@escritorio.com'); f.set('telefone_dono', '(31) 97777-0000');
    expect(TetoAlertasForm.parse(f)).toEqual({
      teto_ia_usd: 80, minutos_alerta_fila: 30, email_alertas: 'dono@escritorio.com', telefone_dono: '5531977770000',
    });
  });
});

describe('CotacaoForm: cotação do dólar e custo por minuto da transcrição (Parte F; cartão próprio na G1)', () => {
  const form = (extra: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  };
  const erros = (extra: Record<string, string>) => {
    const r = CotacaoForm.safeParse(form(extra));
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };
  it('cotação: vazio vira null; vírgula ou ponto viram número', () => {
    expect(CotacaoForm.parse(form({ cotacao_usd_brl: '' })).cotacao_usd_brl).toBeNull();
    expect(CotacaoForm.parse(form({ cotacao_usd_brl: '5,55' })).cotacao_usd_brl).toBe(5.55);
    expect(CotacaoForm.parse(form({ cotacao_usd_brl: '5.55' })).cotacao_usd_brl).toBe(5.55);
  });
  it('cotação zero, negativa ou texto é recusada', () => {
    expect(erros({ cotacao_usd_brl: '0' })).toEqual(['A cotação precisa ser maior que zero.']);
    expect(erros({ cotacao_usd_brl: '-1' })).toEqual(['A cotação precisa ser maior que zero.']);
    expect(erros({ cotacao_usd_brl: 'abc' })).toEqual(['A cotação precisa ser maior que zero.']);
  });
  it('custo por minuto: vazio vira null; "0,000667" vira 0.000667; zero vale; negativo recusado', () => {
    expect(CotacaoForm.parse(form({ custo_minuto_transcricao_usd: '' })).custo_minuto_transcricao_usd).toBeNull();
    expect(CotacaoForm.parse(form({ custo_minuto_transcricao_usd: '0,000667' })).custo_minuto_transcricao_usd).toBe(0.000667);
    expect(CotacaoForm.parse(form({ custo_minuto_transcricao_usd: '0' })).custo_minuto_transcricao_usd).toBe(0);
    expect(erros({ custo_minuto_transcricao_usd: '-0,01' })).toEqual(['O custo por minuto não pode ser negativo.']);
  });
});

describe('esquemaAvisoLogin', () => {
  it('apara, aceita vazio e até 200 caracteres', () => {
    expect(esquemaAvisoLogin.parse({ aviso_login: '  Oi  ' })).toEqual({ aviso_login: 'Oi' });
    expect(esquemaAvisoLogin.parse({ aviso_login: '' })).toEqual({ aviso_login: '' });
    expect(esquemaAvisoLogin.safeParse({ aviso_login: 'x'.repeat(201) }).success).toBe(false);
  });
  it('conta o CRLF do textarea como um caractere e grava só LF', () => {
    const visiveis200 = `${'x'.repeat(99)}\r\n${'y'.repeat(100)}`; // 200 caracteres na tela, 201 com o CRLF
    expect(esquemaAvisoLogin.parse({ aviso_login: visiveis200 })).toEqual({ aviso_login: `${'x'.repeat(99)}\n${'y'.repeat(100)}` });
  });
});

describe('PrazosForm (Configurações › Prazos)', () => {
  it('dias úteis inteiros de 0 a 30 para cada prioridade', () => {
    expect(PrazosForm.parse({ prazo_urgente_dias: '0', prazo_alta_dias: '1', prazo_normal_dias: '2', prazo_baixa_dias: '5' }))
      .toEqual({ prazo_urgente_dias: 0, prazo_alta_dias: 1, prazo_normal_dias: 2, prazo_baixa_dias: 5 });
    for (const ruim of ['-1', '31', '1.5', '']) {
      expect(PrazosForm.safeParse({ prazo_urgente_dias: '0', prazo_alta_dias: ruim, prazo_normal_dias: '2', prazo_baixa_dias: '5' }).success).toBe(false);
    }
  });
});

describe('EsperaForm', () => {
  it('aceita 5 e 15; recusa âmbar menor ou igual ao verde e verde fora da faixa', () => {
    expect(EsperaForm.safeParse({ espera_verde_min: '5', espera_ambar_min: '15' }).success).toBe(true);
    expect(EsperaForm.safeParse({ espera_verde_min: '10', espera_ambar_min: '10' }).success).toBe(false);
    expect(EsperaForm.safeParse({ espera_verde_min: '0', espera_ambar_min: '10' }).success).toBe(false);
  });
  it('só inteiros: recusa decimal, vazio, texto e âmbar acima de 480', () => {
    for (const [v, a] of [['5.5', '15'], ['', '15'], ['5', ''], ['x', '15'], ['5', '481'], ['241', '300']]) {
      expect(EsperaForm.safeParse({ espera_verde_min: v, espera_ambar_min: a }).success).toBe(false);
    }
  });
});

describe('FeriadoForm (Parte G1)', () => {
  it('data e descrição aparada', () => {
    expect(FeriadoForm.parse({ data: '2026-12-24', descricao: '  Véspera ' })).toEqual({ data: '2026-12-24', descricao: 'Véspera' });
  });
  it('sem data ou sem nome: recusa com a frase da tela', () => {
    expect(FeriadoForm.safeParse({ data: '', descricao: 'X' }).error?.issues[0]?.message).toBe('Escolha a data do feriado.');
    expect(FeriadoForm.safeParse({ data: '2026-12-24', descricao: ' ' }).error?.issues[0]?.message).toBe('Escreva o nome do feriado.');
  });
});
describe('ExpedienteForm (Parte G1): mensagens em português', () => {
  it('horário vazio', () => {
    const f = new FormData();
    f.set('horario_inicio', ''); f.set('horario_fim', '18:00');
    expect(ExpedienteForm.safeParse(f).error?.issues[0]?.message).toBe('Informe o horário (hh:mm).');
  });
});

describe('modelosForm (Parte G1, D11)', () => {
  const Modelos = modelosForm(['claude-sonnet-5', 'claude-haiku-4-5']);
  it('aceita só modelos com preço', () => {
    const f = new FormData();
    f.set('modelo_conversa', 'claude-sonnet-5'); f.set('modelo_rapido', 'claude-haiku-4-5');
    expect(Modelos.parse(f)).toEqual({ modelo_conversa: 'claude-sonnet-5', modelo_rapido: 'claude-haiku-4-5' });
    f.set('modelo_rapido', 'gpt-x');
    expect(Modelos.safeParse(f).error?.issues[0]?.message).toBe('Escolha um modelo da lista de preços.');
  });
});

describe('RespostaForm (Parte G1, D19)', () => {
  it('apara; ativa pela caixa', () => {
    expect(RespostaForm.parse({ pergunta: ' Horário? ', resposta: ' 8h às 18h ', ativo: true })).toEqual({ pergunta: 'Horário?', resposta: '8h às 18h', ativo: true });
  });
  it('pergunta curta ou resposta vazia: recusa', () => {
    expect(RespostaForm.safeParse({ pergunta: 'Oi', resposta: 'x', ativo: true }).error?.issues[0]?.message).toBe('A pergunta precisa de pelo menos 3 letras.');
    expect(RespostaForm.safeParse({ pergunta: 'Horário?', resposta: ' ', ativo: true }).error?.issues[0]?.message).toBe('Escreva a resposta.');
  });
});

describe('CargosForm (Parte G1, D10)', () => {
  it('um por linha; aparado; sem vazias', () => {
    expect(CargosForm.parse({ cargos: ' Auxiliar \r\nAnalista\n\nSócio ' })).toEqual(['Auxiliar', 'Analista', 'Sócio']);
  });
  it('repetido (ignora maiúsculas), longo demais, mais de 30: recusa', () => {
    expect(CargosForm.safeParse({ cargos: 'Analista\nanalista' }).error?.issues[0]?.message).toBe('Há cargo repetido na lista.');
    expect(CargosForm.safeParse({ cargos: 'a'.repeat(61) }).error?.issues[0]?.message).toBe('Cada cargo tem até 60 letras.');
    expect(CargosForm.safeParse({ cargos: Array.from({ length: 31 }, (_, i) => `C${i}`).join('\n') }).error?.issues[0]?.message).toBe('Até 30 cargos.');
  });
});
describe('SetorForm e ServicoForm', () => {
  it('nome obrigatório', () => {
    expect(SetorForm.safeParse({ nome: ' ', descricao_assuntos: '' }).error?.issues[0]?.message).toBe('Dê um nome ao setor.');
    expect(ServicoForm.safeParse({ nome: '', setor_id: null }).error?.issues[0]?.message).toBe('Dê um nome ao serviço.');
  });
});
