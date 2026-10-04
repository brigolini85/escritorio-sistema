import { describe, expect, it } from 'vitest';
import { dataCadastro, sugestoesDeCargo, textoUltimoAcesso } from './usuarios';

const agora = new Date('2026-10-05T15:00:00-03:00');

describe('ficha da pessoa (Parte D)', () => {
  it('último acesso: hoje, ontem, data, nunca', () => {
    expect(textoUltimoAcesso('2026-10-05T08:12:00-03:00', agora)).toBe('hoje 08:12');
    expect(textoUltimoAcesso('2026-10-04T17:40:00-03:00', agora)).toBe('ontem 17:40');
    expect(textoUltimoAcesso('2026-08-12T09:05:00-03:00', agora)).toBe('12/08/2026 09:05');
    expect(textoUltimoAcesso(null, agora)).toBe('nunca entrou');
  });
  it('data de cadastro no fuso de Brasília', () => {
    expect(dataCadastro('2026-08-13T01:00:00Z')).toBe('12/08/2026');
  });
  it('cargos: os quatro de sempre e os já usados, sem repetir', () => {
    expect(sugestoesDeCargo(['Analista', 'Contadora', null, ' ', 'Contadora']))
      .toEqual(['Auxiliar', 'Analista', 'Coordenador', 'Sócio', 'Contadora']);
  });
  it('cargos: a lista de Configurações no lugar das quatro de sempre (Parte G1)', () => {
    expect(sugestoesDeCargo(['Contadora', null], ['Auxiliar', 'Estagiário'])).toEqual(['Auxiliar', 'Estagiário', 'Contadora']);
  });
});
