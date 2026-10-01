import { describe, expect, it } from 'vitest';
import { destinoDaTela, lerFiltrosOrientacoes, MODELOS, modeloPorId, normalizarBusca, OrientacaoForm } from './esquemas';
import { mesmoConteudo, resumoVersao, type Versao } from './versoes';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const SETOR = '22222222-2222-4222-8222-222222222222';

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
};
const base = { titulo: ' Cumprimento ', tipo: 'jeito', texto: ' Comece pelo nome. ' };
const mensagens = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues.map((i) => i.message) ?? [];

describe('OrientacaoForm', () => {
  it('orientação para todos: tira espaços, sem empresa nem setor, ligada só com o Switch marcado', () => {
    expect(OrientacaoForm.parse(form({ ...base, vale: 'todos', cliente_id: EMPRESA, setor_id: SETOR, ativo: 'on' })))
      .toEqual({ titulo: 'Cumprimento', texto: 'Comece pelo nome.', tipo: 'jeito', clienteId: null, setorId: null, ativo: true });
    expect(OrientacaoForm.parse(form(base)).ativo).toBe(false);
  });

  it('só o id do "vale para" escolhido segue', () => {
    expect(OrientacaoForm.parse(form({ ...base, vale: 'empresa', cliente_id: EMPRESA, setor_id: SETOR })))
      .toMatchObject({ clienteId: EMPRESA, setorId: null });
    expect(OrientacaoForm.parse(form({ ...base, vale: 'setor', cliente_id: EMPRESA, setor_id: SETOR })))
      .toMatchObject({ clienteId: null, setorId: SETOR });
  });

  it('empresa ou setor escolhido sem o id: pede para escolher', () => {
    expect(mensagens(OrientacaoForm.safeParse(form({ ...base, vale: 'empresa' })))).toEqual(['Escolha a empresa.']);
    expect(mensagens(OrientacaoForm.safeParse(form({ ...base, vale: 'setor', setor_id: 'x' })))).toEqual(['Escolha o setor.']);
  });

  it('mesmas mensagens e limites do banco (título 120, texto 2.000, tipo)', () => {
    expect(mensagens(OrientacaoForm.safeParse(form({ titulo: '  ', texto: '', tipo: 'outro' }))))
      .toEqual(['Informe o título da orientação.', 'Escreva o texto da orientação.', 'Escolha o tipo da orientação.']);
    expect(mensagens(OrientacaoForm.safeParse(form({ ...base, titulo: 'x'.repeat(121) })))).toEqual(['O título pode ter no máximo 120 caracteres.']);
    expect(mensagens(OrientacaoForm.safeParse(form({ ...base, texto: 'x'.repeat(2001) })))).toEqual(['O texto pode ter no máximo 2000 caracteres.']);
  });

  it('quebra de linha do navegador (CRLF) conta como um caractere, como no campo', () => {
    const texto = `${'x'.repeat(999)}\r\n${'y'.repeat(1000)}`;
    expect(OrientacaoForm.parse(form({ ...base, texto })).texto).toHaveLength(2000);
  });
});

describe('lerFiltrosOrientacoes', () => {
  it('lê os filtros conhecidos e ignora o resto', () => {
    expect(lerFiltrosOrientacoes({ tipo: 'regra', vale: 'setor', ativo: 'ligadas', q: ' boleto ' }))
      .toEqual({ tipo: 'regra', vale: 'setor', ativo: 'ligadas', q: 'boleto' });
    expect(lerFiltrosOrientacoes({ tipo: 'x', vale: 'y', ativo: 'z' })).toEqual({ tipo: null, vale: null, ativo: null, q: '' });
  });
  it('busca sem acento nem maiúscula', () => {
    expect(normalizarBusca('Situação ESPECÍFICA')).toBe('situacao especifica');
  });
});

describe('destinoDaTela', () => {
  it('só volta para esta tela', () => {
    expect(destinoDaTela('/treinar-agente?orientacao=nova&tipo=regra')).toBe('/treinar-agente?orientacao=nova&tipo=regra');
    expect(destinoDaTela('/treinar-agente')).toBe('/treinar-agente');
    expect(destinoDaTela('https://outro.site/treinar-agente')).toBe('/treinar-agente');
    expect(destinoDaTela('//outro.site')).toBe('/treinar-agente');
    expect(destinoDaTela('/usuarios')).toBe('/treinar-agente');
    expect(destinoDaTela(null)).toBe('/treinar-agente');
  });
});

describe('MODELOS', () => {
  it('três modelos, um de cada tipo, que o formulário aceita', () => {
    expect(MODELOS.map((m) => m.tipo)).toEqual(['jeito', 'regra', 'situacao']);
    for (const m of MODELOS) expect(OrientacaoForm.safeParse(form({ titulo: m.titulo, texto: m.texto, tipo: m.tipo })).success).toBe(true);
    expect(modeloPorId('cumprimento')?.titulo).toBe('Cumprimento');
    expect(modeloPorId('nao-existe')).toBeNull();
  });
});

describe('resumoVersao', () => {
  let n = 0;
  const v = (extra: Partial<Versao>): Versao => ({
    id: `V${++n}`, acao: 'editar', titulo: 'T', texto: 'a', tipo: 'jeito', clienteId: null, setorId: null, ativo: false,
    usuario: 'Ana', criadoEm: '2026-09-30T12:00:00Z', ...extra,
  });

  it('descreve cada ação pelo que mudou em relação à versão anterior (lista da mais nova para a mais antiga)', () => {
    const lista = [
      v({ acao: 'restaurar', titulo: 'T', texto: 'a' }),
      v({ acao: 'ligar', titulo: 'T2', texto: 'b', ativo: true }),
      v({ acao: 'editar', titulo: 'T2', texto: 'b', clienteId: EMPRESA }),
      v({ acao: 'editar', titulo: 'T', texto: 'a', ativo: true }),
      v({ acao: 'criar', titulo: 'T', texto: 'a' }),
    ];
    expect(lista.map((_, i) => resumoVersao(lista, i))).toEqual([
      'Restaurou uma versão anterior: título e texto',
      'Ligou',
      'Editou: título, vale para e texto (e desligou)',
      'Editou e ligou',
      'Criou (desligada)',
    ]);
  });

  it('mesmoConteudo ignora ligada/desligada', () => {
    expect(mesmoConteudo(v({ ativo: true }), v({ ativo: false }))).toBe(true);
    expect(mesmoConteudo(v({ texto: 'a' }), v({ texto: 'b' }))).toBe(false);
  });
});
