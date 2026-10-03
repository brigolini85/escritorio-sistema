import { describe, expect, it } from 'vitest';
import { descreverHorario, HORARIO_PADRAO, horarioPermiteEm, lerHorarioAcesso, lerHorarioDoBanco, situacaoDe } from './horario-acesso';

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
};

describe('horário de acesso (Parte D)', () => {
  it('descreve o horário como a pessoa lê', () => {
    expect(descreverHorario(null)).toBe('sem restrição de horário');
    expect(descreverHorario(HORARIO_PADRAO)).toBe('seg a sex 08:00 às 18:00 · sábado bloqueado · domingo bloqueado');
  });

  it('lê o formulário: sem restrição, dias permitidos e bloqueados', () => {
    expect(lerHorarioAcesso(form({ horario_restrito: 'nao' }))).toEqual({ ok: true, valor: null });
    expect(lerHorarioAcesso(form({
      horario_restrito: 'sim', horario_semana: 'permitido', horario_semana_de: '08:00', horario_semana_ate: '18:00',
      horario_sabado: 'permitido', horario_sabado_de: '08:00', horario_sabado_ate: '12:00', horario_domingo: 'bloqueado',
    }))).toEqual({ ok: true, valor: { semana: { de: '08:00', ate: '18:00' }, sabado: { de: '08:00', ate: '12:00' }, domingo: null } });
  });

  it('recusa fim antes do início e hora vazia, dizendo o dia', () => {
    expect(lerHorarioAcesso(form({ horario_restrito: 'sim', horario_semana: 'permitido', horario_semana_de: '18:00', horario_semana_ate: '08:00',
      horario_sabado: 'bloqueado', horario_domingo: 'bloqueado' }))).toEqual({ ok: false, erro: 'Seg a sex: o fim precisa ser depois do início.' });
    expect(lerHorarioAcesso(form({ horario_restrito: 'sim', horario_semana: 'bloqueado', horario_sabado: 'permitido', horario_sabado_de: '',
      horario_sabado_ate: '12:00', horario_domingo: 'bloqueado' }))).toEqual({ ok: false, erro: 'Sábado: informe o início e o fim.' });
  });

  it('mesma regra do banco, no fuso de Brasília (só para mostrar; quem decide é o banco)', () => {
    expect(horarioPermiteEm(HORARIO_PADRAO, new Date('2026-10-05T12:00:00-03:00'))).toBe(true);
    expect(horarioPermiteEm(HORARIO_PADRAO, new Date('2026-10-05T18:00:00-03:00'))).toBe(true);
    expect(horarioPermiteEm(HORARIO_PADRAO, new Date('2026-10-05T18:01:00-03:00'))).toBe(false);
    expect(horarioPermiteEm(HORARIO_PADRAO, new Date('2026-10-03T10:00:00-03:00'))).toBe(false);
    expect(horarioPermiteEm(null, new Date('2026-10-04T03:00:00-03:00'))).toBe(true);
  });

  it('lê o horário e a situação que vêm do banco', () => {
    expect(lerHorarioDoBanco(HORARIO_PADRAO)).toEqual(HORARIO_PADRAO);
    expect(lerHorarioDoBanco(null)).toBeNull();
    expect(situacaoDe({ situacao: 'fora_do_horario', horario: HORARIO_PADRAO })).toBe('fora_do_horario');
    expect(situacaoDe({ situacao: 'qualquer' })).toBe('inativo');
    expect(situacaoDe(null)).toBe('inativo');
  });
});
