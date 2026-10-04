import { describe, expect, it } from 'vitest';
import { linhasHistorico, paresHistorico } from './tela';
import type { Versao } from './versoes';

const versao = (id: string, titulo: string, criadoEm: string): Versao => ({
  id, acao: 'editar', titulo, texto: `texto ${titulo}`, tipo: 'regra', clienteId: null, setorId: null, ativo: true, usuario: 'Ana', criadoEm,
});

describe('paresHistorico (Restaurar leva a versão da própria linha)', () => {
  const v1 = versao('v1', 'Um', '2026-10-01T12:00:00Z');
  const v2 = versao('v2', 'Dois', '2026-10-02T12:00:00Z');
  const v3 = versao('v3', 'Três', '2026-10-03T12:00:00Z');
  const linhas = linhasHistorico([v3, v2, v1], { titulo: 'Agora', texto: 'agora', tipo: 'regra', clienteId: null, setorId: null }, false);

  it('versões em outra ordem: cada linha fica com a versão do mesmo id', () => {
    const pares = paresHistorico(linhas, [v1, v3, v2]);
    expect(pares.map((p) => [p.linha.id, p.versao.id])).toEqual([['v3', 'v3'], ['v2', 'v2'], ['v1', 'v1']]);
    for (const p of pares) expect(p.versao.titulo).toBe({ v1: 'Um', v2: 'Dois', v3: 'Três' }[p.linha.id]);
  });

  it('linha sem versão correspondente some (nunca usa a versão vizinha)', () => {
    const pares = paresHistorico(linhas, [v1, v3]);
    expect(pares.map((p) => [p.linha.id, p.versao.id])).toEqual([['v3', 'v3'], ['v1', 'v1']]);
  });

  it('versão a mais sem linha não aparece', () => {
    const extra = versao('v9', 'Nove', '2026-10-09T12:00:00Z');
    expect(paresHistorico(linhas.slice(0, 1), [extra, v1, v2, v3]).map((p) => p.versao.id)).toEqual(['v3']);
  });
});
