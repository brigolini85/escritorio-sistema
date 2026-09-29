import { describe, expect, it } from 'vitest';
import { GeraisForm } from './esquemas';

describe('GeraisForm', () => {
  it('valida horários, dias úteis e teto', () => {
    const f = new FormData();
    f.set('horario_inicio', '08:00'); f.set('horario_fim', '18:00'); f.append('dia', '1'); f.append('dia', '5');
    f.set('teto_ia_usd', '80'); f.set('minutos_alerta_fila', '30'); f.set('email_alertas', 'dono@escritorio.com'); f.set('telefone_dono', '(31) 97777-0000');
    expect(GeraisForm.parse(f)).toMatchObject({ dias_uteis: [1, 5], teto_ia_usd: 80, telefone_dono: '5531977770000' });
  });
  it('fim antes do início é recusado', () => {
    const f = new FormData();
    f.set('horario_inicio', '18:00'); f.set('horario_fim', '08:00'); f.set('teto_ia_usd', '80'); f.set('minutos_alerta_fila', '30');
    expect(GeraisForm.safeParse(f).success).toBe(false);
  });
});
