import { describe, expect, it } from 'vitest';
import { ROTULO_ORIGEM, nomeDaPlanilha, textoProvisorias } from './tarefas-tela';

describe('tarefa na I3b', () => {
  it('nome da planilha diz se é rascunho', () => {
    expect(nomeDaPlanilha({ numero: 7, estado: 'pronta' })).toBe('tarefa-7-rascunho.xlsx');
    expect(nomeDaPlanilha({ numero: 7, estado: 'aprovada' })).toBe('tarefa-7-aprovada.xlsx');
  });
  it('aviso de linhas provisórias só quando há', () => {
    expect(textoProvisorias(0)).toBeNull();
    expect(textoProvisorias(1)).toBe('1 linha provisória: confira antes de aprovar ou peça ajuste.');
    expect(textoProvisorias(3)).toBe('3 linhas provisórias: confira antes de aprovar ou peça ajuste.');
  });
  it('a origem do arquivo na tela', () => {
    expect(ROTULO_ORIGEM).toEqual({ enviado: 'Enviado', conversa: 'Da conversa', drive: 'Drive · só leitura' });
  });
});
