import { describe, expect, it } from 'vitest';
import { EsperaForm, esquemaAvisoLogin, ExpedienteForm, PrazosForm, TetoAlertasForm } from './esquemas';

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
    expect(TetoAlertasForm.parse(f)).toEqual({ teto_ia_usd: 80, minutos_alerta_fila: 30, email_alertas: 'dono@escritorio.com', telefone_dono: '5531977770000' });
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
