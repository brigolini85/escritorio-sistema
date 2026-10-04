import { describe, expect, it } from 'vitest';
import {
  aplicarFiltrosContatos, digitosDaBusca, estadoDaConversa, filtroBusca, lerEmpresasDaVisao, lerFiltrosContatos, lerResumoWhatsapp, selosDoContato,
  textoAtendimentos, textoCadastro, textoConversaAgora, textoResolvidas, textoUltimoContato, type ConversaDoContato, type Vinculo,
} from './contatos';

const AGORA = new Date('2026-10-09T15:00:00-03:00');
const E = '22222222-2222-4222-8222-222222222222';

// Grava os métodos chamados, na ordem, como o construtor do PostgREST os receberia.
function gravador() {
  const ops: [string, unknown[]][] = [];
  const q: Record<string, (...a: unknown[]) => unknown> = {};
  for (const m of ['eq', 'is', 'contains', 'gte', 'lt', 'or']) q[m] = (...a: unknown[]) => { ops.push([m, a]); return q; };
  return { q: q as never, ops };
}

describe('lerFiltrosContatos', () => {
  it('busca segura, filtro rápido, empresa (só uuid) e período; o resto vira nulo', () => {
    expect(lerFiltrosContatos({ q: ' Mercado, (Central) ', filtro: 'nota', empresa: E, periodo: '7d' }))
      .toEqual({ q: 'Mercado Central', rapido: 'nota', empresa: E, periodo: '7d' });
    expect(lerFiltrosContatos({ q: '  ', filtro: 'todos', empresa: 'x', periodo: 'ontem' }))
      .toEqual({ q: null, rapido: null, empresa: null, periodo: null });
  });
});

describe('aplicarFiltrosContatos', () => {
  it('só ativos; busca por nome, telefone ou empresa; filtro rápido; empresa; "há mais de 30 dias"', () => {
    const { q, ops } = gravador();
    aplicarFiltrosContatos(q, { q: 'Mercado', rapido: 'sem_empresa', empresa: E, periodo: 'antigo' }, AGORA);
    expect(ops).toEqual([
      ['eq', ['ativo', true]],
      ['or', ['nome.ilike.%Mercado%,empresas_busca.ilike.%Mercado%']],
      ['eq', ['n_empresas', 0]],
      ['contains', ['empresa_ids', [E]]],
      ['lt', ['ultimo_contato_em', '2026-09-09T18:00:00.000Z']],
    ]);
  });
  it('telefone pelos dígitos; "sem conversa" e "hoje" pelo último contato; o filtro rápido pode ser trocado (contagens, D4)', () => {
    const a = gravador();
    aplicarFiltrosContatos(a.q, { q: '11 97777', rapido: 'nota', empresa: null, periodo: 'nunca' }, AGORA, null);
    expect(a.ops).toEqual([
      ['eq', ['ativo', true]],
      ['or', ['nome.ilike.%11 97777%,telefone.ilike.%1197777%,empresas_busca.ilike.%11 97777%']],
      ['is', ['ultimo_contato_em', null]],
    ]);
    const b = gravador();
    aplicarFiltrosContatos(b.q, { q: null, rapido: null, empresa: null, periodo: 'hoje' }, AGORA, 'desligado');
    expect(b.ops).toEqual([['eq', ['ativo', true]], ['eq', ['agente_pausado', true]], ['gte', ['ultimo_contato_em', '2026-10-09T03:00:00.000Z']]]);
  });
  it('telefone só com 4 dígitos ou mais: "Loja 2" não casa quase todo telefone', () => {
    expect(filtroBusca('Loja 2')).toBe('nome.ilike.%Loja 2%,empresas_busca.ilike.%Loja 2%');
    expect(filtroBusca('977')).toBe('nome.ilike.%977%,empresas_busca.ilike.%977%');
    expect(filtroBusca('9777')).toBe('nome.ilike.%9777%,telefone.ilike.%9777%,empresas_busca.ilike.%9777%');
    expect(digitosDaBusca('Loja 2')).toBeNull();
    expect(digitosDaBusca('11 9')).toBeNull();
    expect(digitosDaBusca('(11) 97')).toBe('1197');
  });
  it('filtros rápidos "Pode pedir nota" e "Muda preço" pelas colunas da visão (empresas ativas, D5)', () => {
    const a = gravador();
    aplicarFiltrosContatos(a.q, { q: null, rapido: 'nota', empresa: null, periodo: null }, AGORA);
    expect(a.ops).toEqual([['eq', ['ativo', true]], ['eq', ['pode_pedir_nota_alguma', true]]]);
    const b = gravador();
    aplicarFiltrosContatos(b.q, { q: null, rapido: 'preco', empresa: null, periodo: null }, AGORA);
    expect(b.ops).toEqual([['eq', ['ativo', true]], ['eq', ['muda_preco_alguma', true]]]);
  });
  it('"Últimos 7 dias" e "Últimos 30 dias": agora menos 7 e 30 dias; "há mais de 30" é o complemento exato do 30d', () => {
    const a = gravador();
    aplicarFiltrosContatos(a.q, { q: null, rapido: null, empresa: null, periodo: '7d' }, AGORA);
    expect(a.ops).toEqual([['eq', ['ativo', true]], ['gte', ['ultimo_contato_em', '2026-10-02T18:00:00.000Z']]]);
    const b = gravador();
    aplicarFiltrosContatos(b.q, { q: null, rapido: null, empresa: null, periodo: '30d' }, AGORA);
    expect(b.ops).toEqual([['eq', ['ativo', true]], ['gte', ['ultimo_contato_em', '2026-09-09T18:00:00.000Z']]]);
    // 30d é >= o limite e "antigo" é < o mesmo limite: nenhum contato cai nos dois nem fica de fora.
    const c = gravador();
    aplicarFiltrosContatos(c.q, { q: null, rapido: null, empresa: null, periodo: 'antigo' }, AGORA);
    expect(c.ops).toEqual([['eq', ['ativo', true]], ['lt', ['ultimo_contato_em', '2026-09-09T18:00:00.000Z']]]);
  });
});

const v = (empresa: string, nota: boolean, preco: boolean): Vinculo => ({ empresaId: empresa, empresa, podePedirNota: nota, podeMudarPreco: preco });

describe('selosDoContato (D11)', () => {
  it('"1 de 2" quando vale só em parte das empresas; "Só conversa" sem marcação; nada sem empresa', () => {
    expect(selosDoContato([])).toEqual([]);
    expect(selosDoContato([v('Rede', true, false), v('Mercado', false, false)]))
      .toEqual([{ rotulo: 'Pede nota · 1 de 2', tom: 'nota', titulo: 'Em: Rede' }]);
    expect(selosDoContato([v('Rede', true, true)])).toEqual([
      { rotulo: 'Pede nota', tom: 'nota', titulo: 'Em: Rede' },
      { rotulo: 'Muda preço e cadastra produto', tom: 'preco', titulo: 'Em: Rede' },
    ]);
    expect(selosDoContato([v('Auto Peças', false, false)]))
      .toEqual([{ rotulo: 'Só conversa', tom: 'conversa', titulo: 'Não pede nota nem muda preço' }]);
  });
});

describe('lerEmpresasDaVisao', () => {
  it('converte o jsonb da visão e descarta o que vier estranho', () => {
    expect(lerEmpresasDaVisao([{ id: 'e1', nome: 'Rede', pode_pedir_nota: true, pode_atualizar_preco: false }, { id: 3 }, null]))
      .toEqual([{ empresaId: 'e1', empresa: 'Rede', podePedirNota: true, podeMudarPreco: false }]);
    expect(lerEmpresasDaVisao('x')).toEqual([]);
  });
});

describe('textos de data', () => {
  it('último contato: hoje, ontem, dia do ano, outro ano, nada', () => {
    expect(textoUltimoContato('2026-10-09T14:48:00-03:00', AGORA)).toBe('hoje 14:48');
    expect(textoUltimoContato('2026-10-09T01:30:00Z', AGORA)).toBe('ontem 22:30');
    expect(textoUltimoContato('2026-09-29T15:20:00-03:00', AGORA)).toBe('29/09 15:20');
    expect(textoUltimoContato('2025-12-30T10:00:00-03:00', AGORA)).toBe('30/12/2025');
    expect(textoUltimoContato(null, AGORA)).toBe('—');
  });
  it('cadastro: com o ano só quando não é o corrente', () => {
    expect(textoCadastro('2026-03-14T10:00:00-03:00', AGORA)).toBe('cadastro em 14/03');
    expect(textoCadastro('2025-03-14T10:00:00-03:00', AGORA)).toBe('cadastro em 14/03/2025');
  });
});

describe('estadoDaConversa e textoConversaAgora (D2, D15)', () => {
  const base: ConversaDoContato = { conversaId: 'k1', estado: 'agente', atendenteId: null, atendenteNome: null, esperaDesde: null };
  const ctx = { euId: 'eu', veTodas: true };
  it('sem conversa, esperando, com pessoa, com o agente', () => {
    expect(estadoDaConversa({ ...base, conversaId: null }, ctx)).toEqual({ texto: 'sem conversa', tom: 'sem' });
    expect(estadoDaConversa({ ...base, conversaId: null }, { euId: 'eu', veTodas: false })).toEqual({ texto: 'nenhuma conversa visível', tom: 'sem' });
    expect(estadoDaConversa({ ...base, esperaDesde: '2026-10-09T14:42:00-03:00' }, ctx)).toEqual({ texto: 'esperando pessoa', tom: 'espera' });
    expect(estadoDaConversa({ ...base, estado: 'humano', atendenteId: 'eu', atendenteNome: 'Thiago' }, ctx).texto).toBe('com você');
    expect(estadoDaConversa({ ...base, estado: 'humano', atendenteId: 'u2', atendenteNome: 'Ana Souza' }, ctx).texto).toBe('com Ana');
    expect(estadoDaConversa({ ...base, estado: 'humano' }, ctx).texto).toBe('com a equipe');
    expect(estadoDaConversa(base, ctx)).toEqual({ texto: 'com o agente', tom: 'agente' });
  });
  it('conversa agora: a espera leva os minutos', () => {
    expect(textoConversaAgora({ ...base, esperaDesde: '2026-10-09T14:42:00-03:00' }, ctx, AGORA)).toBe('esperando pessoa · 18 min');
    expect(textoConversaAgora(base, ctx, AGORA)).toBe('com o agente');
  });
});

describe('resumo do WhatsApp (D3)', () => {
  it('lê, calcula a porcentagem e descarta o estranho', () => {
    expect(lerResumoWhatsapp({ atendimentos: 47, resolvidas_agente: 33 })).toEqual({ atendimentos: 47, resolvidas: 33 });
    expect(textoResolvidas({ atendimentos: 47, resolvidas: 33 })).toBe('70%');
    expect(textoResolvidas({ atendimentos: 0, resolvidas: 0 })).toBe('—');
    expect(textoResolvidas(null)).toBe('—');
    expect(lerResumoWhatsapp({ atendimentos: 2, resolvidas_agente: 3 })).toBeNull();
    expect(lerResumoWhatsapp(null)).toBeNull();
    expect(textoAtendimentos({ atendimentos: 1, resolvidas: 0 })).toBe('1 atendimento');
    expect(textoAtendimentos({ atendimentos: 47, resolvidas: 33 })).toBe('47 atendimentos');
    expect(textoAtendimentos(null)).toBeNull();
  });
});
