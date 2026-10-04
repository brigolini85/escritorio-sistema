import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Banco falso: cada consulta grava os métodos chamados; o cenário de cada teste decide a resposta olhando a consulta.
type Op = [string, unknown[]];
type Consulta = { tabela: string; ops: Op[] };
const SEM_FUNCAO = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
const cenario = {
  responder: (_c: Consulta): unknown => ({ data: null, error: { code: 'XX000', message: 'sem cenário' } }),
  rpc: {} as Record<string, unknown>,
  consultas: [] as Consulta[],
};

function clienteFalso() {
  return {
    rpc: (nome: string) => Promise.resolve(nome in cenario.rpc ? cenario.rpc[nome] : SEM_FUNCAO),
    from: (tabela: string) => {
      const c: Consulta = { tabela, ops: [] };
      cenario.consultas.push(c);
      const cadeia: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'is', 'in', 'or', 'contains', 'gte', 'lt', 'order', 'range', 'limit']) {
        cadeia[m] = (...a: unknown[]) => { c.ops.push([m, a]); return cadeia; };
      }
      cadeia.maybeSingle = () => Promise.resolve(cenario.responder(c));
      cadeia.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve(cenario.responder(c)).then(ok, erro);
      return cadeia;
    },
  };
}

const { lerListaContatos, lerWhatsappDoContato } = await import('./dados-contatos');
const sb = () => clienteFalso() as never;
const tem = (c: Consulta, m: string, ...a: unknown[]) => c.ops.some(([n, args]) => n === m && JSON.stringify(args) === JSON.stringify(a));
const ehContagem = (c: Consulta) => c.ops.some(([n, a]) => n === 'select' && (a[1] as { head?: boolean } | undefined)?.head === true);
const AGORA = new Date('2026-10-09T15:00:00-03:00');
const SEM_FILTRO = { q: null, rapido: null, empresa: null, periodo: null };
const ORDEM = { coluna: 'ultimo', direcao: 'desc' } as const;
const logs = () => vi.mocked(console.error).mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cenario.consultas = [];
  cenario.rpc = {};
  vi.spyOn(console, 'error').mockReset().mockImplementation(() => {});
});

describe('lerListaContatos', () => {
  it('cinco contagens, cada uma com o seu filtro rápido e a mesma busca; o total segue o filtro escolhido (D4)', async () => {
    cenario.responder = (c) => {
      if (c.tabela !== 'contatos_lista') return { data: null, error: { code: 'XX000', message: 'inesperado' } };
      if (!ehContagem(c)) return { data: [], error: null };
      const n = tem(c, 'eq', 'agente_pausado', true) ? 9 : tem(c, 'eq', 'n_empresas', 0) ? 4
        : tem(c, 'eq', 'pode_pedir_nota_alguma', true) ? 58 : tem(c, 'eq', 'muda_preco_alguma', true) ? 17 : 214;
      return { data: null, count: n, error: null };
    };
    const r = await lerListaContatos(sb(), { ...SEM_FILTRO, q: 'Mercado', rapido: 'nota' }, ORDEM, 1, AGORA);
    expect(r.contagens).toEqual({ todos: 214, desligado: 9, sem_empresa: 4, nota: 58, preco: 17 });
    expect(r.paginacao.total).toBe(58);
    expect(r.completa).toBe(true);
    expect(r.ordem).toEqual(ORDEM);
    const lista = cenario.consultas.filter((c) => c.tabela === 'contatos_lista');
    expect(lista).toHaveLength(6);
    for (const c of lista) {
      expect(tem(c, 'eq', 'ativo', true)).toBe(true);
      expect(c.ops.some(([n]) => n === 'or')).toBe(true);
    }
    const pagina = lista.find((c) => !ehContagem(c))!;
    expect(tem(pagina, 'eq', 'pode_pedir_nota_alguma', true)).toBe(true);
    expect(tem(pagina, 'order', 'ultimo_contato_em', { ascending: false, nullsFirst: false })).toBe(true);
    expect(tem(pagina, 'range', 0, 49)).toBe(true);
    expect(logs()).toEqual([]);
  });

  it('sem a visão (homologação antes do "ok", D14): pelo nome em contatos, sem contagens, conversa pela caixa_entrada, nada no log', async () => {
    cenario.responder = (c) => {
      // Como o postgrest-js 2.117.2 responde de verdade: o HEAD do 404 sem corpo vira 204 sem erro e sem contagem;
      // só o GET traz o PGRST205.
      if (c.tabela === 'contatos_lista') {
        return ehContagem(c)
          ? { data: null, count: null, error: null, status: 204 }
          : { data: null, count: null, error: { code: 'PGRST205', message: 'Could not find the table' }, status: 404 };
      }
      if (c.tabela === 'contatos') {
        return ehContagem(c) ? { data: null, count: 1, error: null } : {
          data: [{ id: 'c1', nome: 'Carla', telefone: '5511977772211', agente_pausado: false, contato_clientes: [
            { pode_pedir_nota: true, pode_atualizar_preco: false, clientes: { id: 'e1', razao_social: 'Rede Bom Preço Ltda', nome_fantasia: null, ativo: true } },
            { pode_pedir_nota: false, pode_atualizar_preco: true, clientes: { id: 'e2', razao_social: 'Zeta', nome_fantasia: null, ativo: false } },
          ] }],
          error: null,
        };
      }
      if (c.tabela === 'caixa_entrada') {
        return { data: [{ id: 'k1', telefone: '5511977772211', ultima_em: '2026-10-09T14:48:00-03:00', estado: 'agente', atendente_id: null, espera_desde: '2026-10-09T14:30:00-03:00' }], error: null };
      }
      return { data: null, error: { code: 'XX000', message: 'inesperado' } };
    };
    const r = await lerListaContatos(sb(), { ...SEM_FILTRO, q: 'Carla' }, ORDEM, 1, AGORA);
    expect(r).toMatchObject({ completa: false, contagens: null, erro: false });
    expect(r.linhas).toEqual([expect.objectContaining({
      id: 'c1', conversaId: 'k1', ultimoEm: '2026-10-09T14:48:00-03:00', esperaDesde: '2026-10-09T14:30:00-03:00',
      vinculos: [{ empresaId: 'e1', empresa: 'Rede Bom Preço Ltda', podePedirNota: true, podeMudarPreco: false }],
    })]);
    const pagina = cenario.consultas.find((c) => c.tabela === 'contatos' && !ehContagem(c))!;
    expect(tem(pagina, 'order', 'nome', { ascending: true })).toBe(true);
    // A ordem pedida era pelo último contato: sem a visão, a tela mostra a que valeu (nome, crescente).
    expect(r.ordem).toEqual({ coluna: 'nome', direcao: 'asc' });
    expect(logs()).toEqual([]);
  });

  it('sem a visão: só o GET da página acusa a falta (contagens sem erro): cai na leitura de antes, sem log', async () => {
    cenario.responder = (c) => {
      if (c.tabela === 'contatos_lista') {
        return ehContagem(c) ? { data: null, count: 3, error: null } : { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } };
      }
      if (c.tabela === 'contatos') return ehContagem(c) ? { data: null, count: 0, error: null } : { data: [], error: null };
      return { data: null, error: { code: 'XX000', message: 'inesperado' } };
    };
    const r = await lerListaContatos(sb(), SEM_FILTRO, ORDEM, 1, AGORA);
    expect(r).toMatchObject({ completa: false, contagens: null, erro: false, linhas: [] });
    expect(logs()).toEqual([]);
  });

  it('sem a visão: o filtro rápido da URL não filtra (os botões nem aparecem); nome decrescente pedido vale', async () => {
    cenario.responder = (c) => (c.tabela === 'contatos_lista'
      ? (ehContagem(c) ? { data: null, count: null, error: null } : { data: null, error: { code: 'PGRST205', message: 'x' } })
      : c.tabela === 'contatos' ? (ehContagem(c) ? { data: null, count: 0, error: null } : { data: [], error: null })
        : { data: null, error: { code: 'XX000', message: 'inesperado' } });
    const r = await lerListaContatos(sb(), { ...SEM_FILTRO, rapido: 'desligado' }, { coluna: 'nome', direcao: 'desc' }, 1, AGORA);
    const contatos = cenario.consultas.filter((c) => c.tabela === 'contatos');
    expect(contatos).toHaveLength(2);
    for (const c of contatos) expect(tem(c, 'eq', 'agente_pausado', true)).toBe(false);
    expect(tem(contatos.find((c) => !ehContagem(c))!, 'order', 'nome', { ascending: false })).toBe(true);
    expect(r.ordem).toEqual({ coluna: 'nome', direcao: 'desc' });
  });

  it('falha que não é falta da visão: erro na tela e no log', async () => {
    cenario.responder = () => ({ data: null, count: null, error: { code: 'XX000', message: 'caiu' } });
    const r = await lerListaContatos(sb(), SEM_FILTRO, ORDEM, 1, AGORA);
    expect(r).toMatchObject({ erro: true, contagens: null, linhas: [] });
    expect(logs()).toContain('[contatos] falha ao contar a lista');
  });
});

describe('lerWhatsappDoContato', () => {
  it('sem a função do resumo (PGRST202): sem %, sem log; sem conversa visível: tudo vazio', async () => {
    cenario.responder = (c) => (c.tabela === 'caixa_entrada' ? { data: null, error: null } : { data: null, error: { code: 'XX000', message: '?' } });
    const w = await lerWhatsappDoContato(sb(), { id: 'c1', telefone: '5511977772211' });
    expect(w).toEqual({ conversaId: null, estado: null, atendenteId: null, atendenteNome: null, esperaDesde: null, ultimaEm: null, resumo: null });
    expect(logs()).toEqual([]);
  });
  it('resumo e o nome de quem atende', async () => {
    cenario.rpc = { contato_whatsapp_resumo: { data: { atendimentos: 47, resolvidas_agente: 33 }, error: null } };
    cenario.responder = (c) => (c.tabela === 'caixa_entrada'
      ? { data: { id: 'k1', ultima_em: '2026-10-09T14:48:00-03:00', estado: 'humano', atendente_id: 'u2', espera_desde: null }, error: null }
      : c.tabela === 'usuarios' ? { data: { nome: 'Ana Souza' }, error: null } : { data: null, error: { code: 'XX000', message: '?' } });
    const w = await lerWhatsappDoContato(sb(), { id: 'c1', telefone: '5511977772211' });
    expect(w).toMatchObject({ conversaId: 'k1', estado: 'humano', atendenteNome: 'Ana Souza', resumo: { atendimentos: 47, resolvidas: 33 } });
  });
});

describe('lerListaContatos sem a visão: busca', () => {
  it('nome ou telefone; o telefone só entra com 4 dígitos ou mais (como na visão)', async () => {
    cenario.responder = (c) => (c.tabela === 'contatos_lista'
      ? { data: null, count: null, error: { code: '42P01', message: 'relation does not exist' } }
      : c.tabela === 'contatos' ? (ehContagem(c) ? { data: null, count: 0, error: null } : { data: [], error: null })
        : { data: null, error: { code: 'XX000', message: 'inesperado' } });
    await lerListaContatos(sb(), { ...SEM_FILTRO, q: 'Loja 2' }, ORDEM, 1, AGORA);
    const curta = cenario.consultas.filter((c) => c.tabela === 'contatos');
    expect(curta).toHaveLength(2);
    for (const c of curta) expect(tem(c, 'or', 'nome.ilike.%Loja 2%')).toBe(true);
    cenario.consultas = [];
    await lerListaContatos(sb(), { ...SEM_FILTRO, q: '11 97777' }, ORDEM, 1, AGORA);
    for (const c of cenario.consultas.filter((x) => x.tabela === 'contatos')) {
      expect(tem(c, 'or', 'nome.ilike.%11 97777%,telefone.ilike.%1197777%')).toBe(true);
    }
    expect(logs()).toEqual([]);
  });
});
