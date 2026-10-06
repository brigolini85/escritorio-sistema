import { describe, expect, it } from 'vitest';
import {
  PRECO_BUSCA_WEB_USD, SEM_CRITERIO, criteriosParaBanco, custoChamadaRadarUsd, diaSP, dominiosDeBusca, dominiosDeLeitura, ferramentasWeb,
  fonteDaUrl, fraseCriterios, lerCriterios, lerEnderecoFonte, normalizarUrl, proximoGiro, regimeDoCliente, seloDaUrl, textoAgenda,
  textoAvisoAlto, textoFaixaGiro, textoResumoDiario, type FonteRadar,
} from '../src';

const f = (x: Partial<FonteRadar> & Pick<FonteRadar, 'dominio'>): FonteRadar =>
  ({ id: x.dominio + (x.caminho ?? ''), nome: x.dominio, caminho: null, etiqueta: 'FED', oficial: true, ativa: true, paginas: [], ...x });
const FONTES = [
  f({ id: 'rf', nome: 'Receita Federal', dominio: 'gov.br', caminho: '/receitafederal' }),
  f({ id: 'es', nome: 'eSocial', dominio: 'gov.br', caminho: '/esocial' }),
  f({ id: 'cfc', nome: 'CFC', dominio: 'cfc.org.br' }),
  f({ id: 'not', nome: 'Portal de notícias', dominio: 'contabeis.com.br', oficial: false }),
  f({ id: 'off', nome: 'Desligada', dominio: 'desligada.gov.br', ativa: false }),
];

describe('endereço da fonte (D3)', () => {
  it('guarda domínio sem www e até dois trechos de caminho', () => {
    expect(lerEnderecoFonte('https://www.gov.br/receitafederal/pt-br/assuntos')).toEqual({ ok: true, dominio: 'gov.br', caminho: '/receitafederal/pt-br' });
    expect(lerEnderecoFonte('gov.br/esocial')).toEqual({ ok: true, dominio: 'gov.br', caminho: '/esocial' });
    expect(lerEnderecoFonte(' CFC.org.br/ ')).toEqual({ ok: true, dominio: 'cfc.org.br', caminho: null });
  });
  it('recusa IP, localhost, nome sem ponto, outro esquema, porta, usuário e vazio', () => {
    for (const e of ['10.0.0.1', 'http://localhost:3000', 'intranet', 'ftp://cfc.org.br', '', 'javascript:alert(1)', 'cfc.org.br:8080', 'https://a@cfc.org.br']) {
      expect(lerEnderecoFonte(e).ok, e).toBe(false);
    }
  });
});

describe('domínios permitidos (D1, D22)', () => {
  it('busca usa domínio + caminho; leitura só o domínio; sem repetir; só ativas', () => {
    expect(dominiosDeBusca(FONTES)).toEqual(['gov.br/receitafederal', 'gov.br/esocial', 'cfc.org.br', 'contabeis.com.br']);
    expect(dominiosDeLeitura(FONTES)).toEqual(['gov.br', 'cfc.org.br', 'contabeis.com.br']);
  });
  it('as ferramentas web vão sempre com allowed_domains, nas versões básicas', () => {
    const [busca, leitura] = ferramentasWeb(FONTES);
    expect(busca).toEqual({ type: 'web_search_20250305', name: 'web_search', max_uses: 8, allowed_domains: dominiosDeBusca(FONTES) });
    expect(leitura).toEqual({ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 15, max_content_tokens: 12000, allowed_domains: dominiosDeLeitura(FONTES) });
  });
});

describe('URL, fonte e selo (D2, D9; Foco 1)', () => {
  it('normaliza: sem www, #, utm_*, barra final; domínio minúsculo; http = https', () => {
    expect(normalizarUrl('https://WWW.gov.br/receitafederal/noticia/?utm_source=x&id=3#topo')).toBe('gov.br/receitafederal/noticia?id=3');
    expect(normalizarUrl('http://gov.br/receitafederal/noticia')).toBe('gov.br/receitafederal/noticia');
    expect(normalizarUrl('não é url')).toBeNull();
    expect(normalizarUrl('ftp://gov.br/x')).toBeNull();
  });
  it('oficial só dentro da fonte oficial ativa (subdomínio vale; caminho vizinho não)', () => {
    expect(seloDaUrl('https://www.gov.br/receitafederal/pt-br/x', FONTES)).toBe('oficial');
    expect(fonteDaUrl('https://www.gov.br/esocial/pt-br/x', FONTES)?.id).toBe('es');
    expect(seloDaUrl('https://normas.cfc.org.br/x', FONTES)).toBe('oficial');
    expect(seloDaUrl('https://www.gov.br/receitafederalx/y', FONTES)).toBe('confirmar');
    expect(seloDaUrl('https://www.gov.br/anvisa/y', FONTES)).toBe('confirmar');
    expect(seloDaUrl('https://www.contabeis.com.br/noticias/1', FONTES)).toBe('confirmar');
    expect(seloDaUrl('https://desligada.gov.br/x', FONTES)).toBe('confirmar');
  });
  it('domínio parecido nunca é oficial', () => {
    for (const u of ['https://gov.br.exemplo.com/receitafederal', 'https://receitafederal.gov.br.golpe.net/x', 'https://fakegov.br/receitafederal',
      'https://gov.br@golpe.net/receitafederal', 'https://cfc.org.br.golpe.net']) {
      expect(seloDaUrl(u, FONTES), u).toBe('confirmar');
    }
  });
});

describe('clientes possivelmente afetados (D10)', () => {
  it('regime da ficha vira código', () => {
    expect(['Simples Nacional', 'simples', 'MEI', 'Lucro Presumido', 'Lucro Real', 'Imune/Isenta', null, 'outro'].map(regimeDoCliente))
      .toEqual(['simples', 'simples', 'mei', 'presumido', 'real', 'imune', null, null]);
  });
  it('lerCriterios limpa o que veio do modelo', () => {
    expect(lerCriterios({ regimes: ['Real', 'presumido', 'xx'], ufs: ['mg', 'ZZ'], cnaes: ['47.11-3', '9'], municipios: [' Conselheiro Lafaiete '], com_funcionarios: true }))
      .toEqual({ regimes: ['real', 'presumido'], ufs: ['MG'], cnaes: ['47113'], segmentos: [], municipios: ['Conselheiro Lafaiete'], comFuncionarios: true });
    expect(lerCriterios('lixo')).toEqual(SEM_CRITERIO);
  });
  it('vai ao banco em snake_case', () => {
    expect(criteriosParaBanco({ ...SEM_CRITERIO, comFuncionarios: true })).toEqual({ regimes: [], ufs: [], municipios: [], cnaes: [], segmentos: [], com_funcionarios: true });
  });
  it('frase dos critérios como na imagem', () => {
    expect(fraseCriterios({ ...SEM_CRITERIO, regimes: ['presumido', 'real'], segmentos: ['comercio'], ufs: ['MG'] })).toBe('regime normal · comércio · MG');
    expect(fraseCriterios({ ...SEM_CRITERIO, comFuncionarios: true })).toBe('todos com funcionário registrado');
    expect(fraseCriterios({ ...SEM_CRITERIO, regimes: ['simples'], segmentos: ['comercio'], ufs: ['MG'] })).toBe('Simples Nacional · comércio · MG');
    expect(fraseCriterios(SEM_CRITERIO)).toBe('todos os clientes ativos');
  });
});

describe('agenda (D5; Foco 4)', () => {
  it('texto da agenda', () => {
    expect(textoAgenda({ hora: '07:00', dias: [0, 1, 2, 3, 4, 5, 6] })).toBe('todo dia, 7h');
    expect(textoAgenda({ hora: '07:30', dias: [1, 2, 3, 4, 5] })).toBe('dias úteis, 7h30');
    expect(textoAgenda({ hora: '07:00', dias: [5, 1, 3] })).toBe('seg, qua e sex, 7h');
  });
  it('dia de São Paulo vira às 03:00 UTC', () => {
    expect(diaSP(new Date('2026-10-26T02:59:00Z'))).toBe('2026-10-25');
    expect(diaSP(new Date('2026-10-26T03:00:00Z'))).toBe('2026-10-26');
  });
  it('próximo giro: hoje se ainda não rodou; o próximo dia da lista se já rodou', () => {
    const todoDia = { hora: '07:00', dias: [0, 1, 2, 3, 4, 5, 6] };
    expect(proximoGiro(todoDia, new Date('2026-10-26T09:00:00Z'), false)?.toISOString()).toBe('2026-10-26T10:00:00.000Z');
    expect(proximoGiro(todoDia, new Date('2026-10-26T12:00:00Z'), true)?.toISOString()).toBe('2026-10-27T10:00:00.000Z');
    // 2026-10-30 é sexta: dias úteis → segunda 02/11
    expect(proximoGiro({ hora: '07:00', dias: [1, 2, 3, 4, 5] }, new Date('2026-10-30T12:00:00Z'), true)?.toISOString()).toBe('2026-11-02T10:00:00.000Z');
    const agora = new Date('2026-10-26T15:00:00Z');   // atrasado e não rodou: agora
    expect(proximoGiro(todoDia, agora, false)?.toISOString()).toBe(agora.toISOString());
    expect(proximoGiro({ hora: '07:00', dias: [] }, agora, false)).toBeNull();
  });
});

describe('custo e textos', () => {
  it('tokens + US$ 0,01 por busca (D16)', () => {
    expect(PRECO_BUSCA_WEB_USD).toBe(0.01);
    expect(custoChamadaRadarUsd({ entrada: 1_000_000, saida: 0, cacheLeitura: 0, cacheEscrita: 0 }, { entrada: 2, saida: 10, cacheLeitura: 0.2, cacheEscrita: 2.5 }, 3))
      .toBeCloseTo(2.03, 6);
    expect(custoChamadaRadarUsd({ entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 }, { entrada: 2, saida: 10, cacheLeitura: 0, cacheEscrita: 0 }, -1)).toBe(0);
  });
  it('faixa do giro como na imagem', () => {
    const agora = new Date('2026-10-26T13:00:00Z');
    expect(textoFaixaGiro({ estado: 'concluido', iniciadoEm: '2026-10-26T10:00:00Z', terminadoEm: '2026-10-26T10:03:00Z', fontes: 14, novidades: 3, repetidas: 2,
      fontesFora: [{ nome: 'Prefeitura de Conselheiro Lafaiete', motivo: 'fora do ar' }], novaTentativaEm: '2026-10-26T15:00:00Z', erro: null }, agora))
      .toBe('Giro de hoje terminou às 07:03. 14 fontes em 3 min · 3 novidades · 2 repetidas ignoradas · Prefeitura de Conselheiro Lafaiete fora do ar, tenta de novo às 12h.');
    expect(textoFaixaGiro({ estado: 'rodando', iniciadoEm: '2026-10-26T12:58:00Z', terminadoEm: null, fontes: 0, novidades: 0, repetidas: 0, fontesFora: [], novaTentativaEm: null, erro: null }, agora))
      .toBe('Procurando nas fontes. Começou às 09:58.');
    expect(textoFaixaGiro({ estado: 'falhou', iniciadoEm: '2026-10-25T10:00:00Z', terminadoEm: '2026-10-25T10:40:00Z', fontes: 0, novidades: 0, repetidas: 0, fontesFora: [], novaTentativaEm: null, erro: 'O giro parou no meio.' }, agora))
      .toBe('O giro de ontem às 07:00 não terminou: O giro parou no meio.');
  });
  it('resumo diário e aviso de impacto alto, sem palavras de sistema', () => {
    const r = textoResumoDiario([{ titulo: 'Novo leiaute do eSocial', impacto: 'alto', fonte: 'eSocial' }, { titulo: 'Prazo da DeSTDA', impacto: 'medio', fonte: 'SEFAZ-MG' }],
      ['Prefeitura de Conselheiro Lafaiete']);
    expect(r).toContain('Radar de legislação: 2 novidades hoje.');
    expect(r).toContain('• [Alto] Novo leiaute do eSocial (eSocial)');
    expect(r).toContain('Fora do ar hoje: Prefeitura de Conselheiro Lafaiete.');
    expect(r).not.toMatch(/token|job|fila|allowed/i);
    expect(textoAvisoAlto({ titulo: 'Novo leiaute', fonte: 'eSocial', vigencia: 'vale a partir de 01/01/2027' }))
      .toBe('Radar de legislação: impacto alto.\nNovo leiaute\nFonte: eSocial · vale a partir de 01/01/2027\nPara decidir no painel: Agentes › Radar de legislação.');
  });
});
