import { normalizarUrl, textoFaixaGiro } from '@escritorio/core';
import { criarReposRadar } from '@escritorio/db';
import { comoPessoa, contatoProcuravelTeste, fonteRadarTeste, ligarRadarTeste, limparBanco, novidadeRadarTeste, sqlTeste } from '@escritorio/db/teste';
import { db, repos, setorId } from '../../test/apoio/cenario';
import { criarUsuarioTeste } from '../../test/apoio/usuario';
import { type ClienteIa, type ParametrosIa } from '../agente/cliente-ia';
import { CanalFalso } from '../canal/falso';
import { LimitadorEnvio, type DepsEnvio } from '../envio';
import { criarArmazenamento } from '../midia/armazenamento';
import { cicloRadar, enviosRadar } from '../radar/ciclo';
import { criarClienteIaRadar } from '../radar/cliente';

/** Parte I5 (D20): o Radar com o Claude e a web de verdade, no banco local. O WhatsApp é falso: nada sai para ninguém. */
type Anotada = ClienteIa & { requisicoes: ParametrosIa[]; respostas: { content: unknown[] }[] };
type Preparado = { ia: Anotada; canal: CanalFalso; envio: DepsEnvio; ana: string; giroId: string };
type Cenario = { nome: string; origem: 'pedido' | 'agenda'; preparar: () => Promise<void>; conferir: (p: Preparado) => Promise<string[]>;
};

const radar = criarReposRadar(db);

function iaQueAnota(): Anotada {
  const real = criarClienteIaRadar(process.env.ANTHROPIC_API_KEY!);
  const requisicoes: ParametrosIa[] = [];
  const respostas: { content: unknown[] }[] = [];
  return {
    requisicoes, respostas,
    async criar(p, o) {
      requisicoes.push(JSON.parse(JSON.stringify(p)) as ParametrosIa);
      const r = await real.criar(p, o);
      respostas.push({ content: JSON.parse(JSON.stringify(r.content)) as unknown[] });
      return r;
    },
  };
}

type Bloco = { type: string; name?: string; input?: { url?: string }; content?: unknown };
const blocos = (ia: Anotada): Bloco[] => ia.respostas.flatMap((r) => r.content as Bloco[]);
const nomesDeTool = (p: ParametrosIa, nome: string) =>
  (((p.tools ?? []) as unknown as { name: string; allowed_domains?: string[] }[]).find((t) => t.name === nome)?.allowed_domains ?? null);
/** Os links que as ferramentas web devolveram (busca e leitura), como a Task 5 os guarda. */
function linksDasRespostas(ia: Anotada): string[] {
  const urls: string[] = [];
  for (const b of blocos(ia)) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content as { type: string; url?: string }[]) if (r.type === 'web_search_result' && r.url) urls.push(r.url);
    }
    if (b.type === 'web_fetch_tool_result' && b.content && typeof b.content === 'object') {
      const c = b.content as { type: string; url?: string };
      if (c.type === 'web_fetch_result' && c.url) urls.push(c.url);
    }
  }
  return urls;
}
const doDominio = (url: string, d: string) => { const h = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); return h === d || h.endsWith(`.${d}`); };
const igual = (a: string[] | null, b: string[]) => !!a && JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

type GiroLinha = { id: string; estado: string; buscas: number; paginas: number; fontes: number; novidades: number; repetidas: number; custo_usd: string;
  fontes_fora: { nome: string; motivo: string }[]; nova_tentativa_em: string | null; iniciado_em: string | null; terminado_em: string | null; erro: string | null; resumo: string | null };
const giroDe = async (id: string) => (await sqlTeste<GiroLinha>('select * from public.radar_giros where id = $1', [id]))[0]!;
type NovidadeLinha = { id: string; titulo: string; url: string; url_normalizada: string; fonte_id: string | null; selo: string; impacto: string; setores: string[]; fonte_nome: string };
const novidadesDe = (giroId: string) => sqlTeste<NovidadeLinha>('select * from public.radar_novidades where giro_id = $1 order by achado_em', [giroId]);

async function soFontes(nomes: string[]): Promise<void> {
  await sqlTeste('update public.radar_fontes set ativa = false');
  for (const n of nomes) await sqlTeste('update public.radar_fontes set ativa = true where nome = $1', [n]);
}

/** Estatística do que o modelo fez, para o relatório (não conta como conferência). */
function resumoDaIa(ia: Anotada): string {
  const b = blocos(ia);
  const buscas = b.filter((x) => x.type === 'server_tool_use' && x.name === 'web_search').length;
  const leituras = b.filter((x) => x.type === 'server_tool_use' && x.name === 'web_fetch').length;
  const registros = b.filter((x) => x.type === 'tool_use' && x.name === 'registrar_novidade').length;
  return `${ia.requisicoes.length} chamadas, ${buscas} buscas, ${leituras} leituras, ${registros} pedidos de registro`;
}

const CENARIOS: Cenario[] = [
  {
    nome: 'radar: busca só nas fontes cadastradas',
    origem: 'pedido',
    async preparar() { await soFontes(['Receita Federal', 'CFC']); },
    async conferir(p) {
      const f: string[] = [];
      const g = await giroDe(p.giroId);
      for (const [i, r] of p.ia.requisicoes.entries()) {
        if (!igual(nomesDeTool(r, 'web_search'), ['gov.br/receitafederal', 'cfc.org.br'])) f.push(`chamada ${i + 1}: web_search.allowed_domains = ${JSON.stringify(nomesDeTool(r, 'web_search'))}`);
        if (!igual(nomesDeTool(r, 'web_fetch'), ['gov.br', 'cfc.org.br'])) f.push(`chamada ${i + 1}: web_fetch.allowed_domains = ${JSON.stringify(nomesDeTool(r, 'web_fetch'))}`);
      }
      if (!p.ia.requisicoes.length) f.push('a IA não foi chamada');
      if (g.buscas < 1) f.push(`radar_giros.buscas = ${g.buscas} (esperava ao menos 1)`);
      const links = linksDasRespostas(p.ia);
      if (!links.length) f.push('nenhum resultado web nas respostas');
      if (!blocos(p.ia).some((b) => b.type === 'server_tool_use' && b.name === 'web_search')) f.push('nenhuma busca web (server_tool_use web_search) nas respostas');
      for (const u of links) if (!doDominio(u, 'gov.br') && !doDominio(u, 'cfc.org.br')) f.push(`link fora das fontes: ${u}`);
      const vistos = new Set(links.map((u) => normalizarUrl(u)));
      for (const n of await novidadesDe(p.giroId)) {
        if (!n.fonte_id) f.push(`novidade sem fonte: ${n.titulo}`);
        if (n.selo !== 'oficial') f.push(`novidade com selo ${n.selo}: ${n.titulo}`);
        if (!vistos.has(n.url_normalizada)) f.push(`novidade com link que não apareceu: ${n.url}`);
      }
      if (g.estado !== 'concluido') f.push(`o giro terminou ${g.estado}: ${g.erro ?? ''}`);
      const agente = (await db.from('agentes').select('id').eq('slug', 'radar').single()).data!.id;
      const uso = await sqlTeste<{ custo_usd: string; funcionalidade: string }>('select custo_usd, funcionalidade from public.uso_ia where agente_id = $1', [agente]);
      if (!uso.length) f.push('uso_ia sem linhas do Radar');
      if (uso.some((u) => u.funcionalidade !== 'especialista_setor')) f.push('uso_ia com funcionalidade diferente de especialista_setor');
      const soma = uso.reduce((s, u) => s + Number(u.custo_usd), 0);
      if (Math.abs(soma - Number(g.custo_usd)) > 0.000001) f.push(`custo do giro ${g.custo_usd} difere da soma do uso_ia ${soma}`);
      return f;
    },
  },
  {
    nome: 'radar: site de notícias vem como confirmar',
    origem: 'pedido',
    async preparar() {
      await sqlTeste('update public.radar_fontes set ativa = false');
      await fonteRadarTeste({ nome: 'Portal Contábeis', dominio: 'contabeis.com.br', oficial: false });
    },
    async conferir(p) {
      const f: string[] = [];
      const g = await giroDe(p.giroId);
      if (g.estado !== 'concluido') f.push(`o giro terminou ${g.estado}: ${g.erro ?? ''}`);
      const novas = await novidadesDe(p.giroId);
      if (!novas.length) f.push('nenhuma novidade registrada (o site pode não ter trazido nada: veja a saída)');
      for (const n of novas) if (n.selo !== 'confirmar') f.push(`novidade com selo ${n.selo}: ${n.titulo}`);
      return f;
    },
  },
  {
    nome: 'radar: fonte fora do ar vira aviso no giro',
    origem: 'agenda',
    async preparar() {
      await soFontes(['CFC']);
      const id = await fonteRadarTeste({ nome: 'Portal Fora do Ar', dominio: 'radar-fora-do-ar-teste.com.br' });
      await sqlTeste('update public.radar_fontes set paginas = $2 where id = $1', [id, ['https://radar-fora-do-ar-teste.com.br/novidades']]);
    },
    async conferir(p) {
      const f: string[] = [];
      const g = await giroDe(p.giroId);
      if (g.estado !== 'concluido') f.push(`o giro terminou ${g.estado}: ${g.erro ?? ''}`);
      if (!g.fontes_fora.some((x) => x.nome === 'Portal Fora do Ar')) f.push(`fontes_fora = ${JSON.stringify(g.fontes_fora)} (o modelo pode não ter tentado ler a página fora do ar)`);
      const faixa = textoFaixaGiro({ estado: g.estado as 'concluido', iniciadoEm: g.iniciado_em, terminadoEm: g.terminado_em, fontes: g.fontes, novidades: g.novidades,
        repetidas: g.repetidas, fontesFora: g.fontes_fora, novaTentativaEm: g.nova_tentativa_em, erro: g.erro }, new Date());
      console.log(`  faixa: ${faixa}`);
      if (!faixa.includes('Portal Fora do Ar fora do ar')) f.push(`a faixa não diz "Portal Fora do Ar fora do ar": ${faixa}`);
      if (!g.terminado_em) { f.push('o giro não tem terminado_em'); return f; }
      const horaSP = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date(g.terminado_em)));
      if (horaSP < 15) { if (!g.nova_tentativa_em) f.push(`terminou às ${horaSP}h (antes das 15h) e nova_tentativa_em está vazio`); }
      else { console.log(`  (terminou às ${horaSP}h, depois das 15h: nova_tentativa_em = ${g.nova_tentativa_em})`); if (g.nova_tentativa_em) f.push(`terminou depois das 15h e nova_tentativa_em = ${g.nova_tentativa_em}`); }
      return f;
    },
  },
  {
    nome: 'radar: nada vai ao cliente sem aprovação',
    origem: 'pedido',
    async preparar() {
      await soFontes(['Receita Federal', 'CFC']);
      const sol = (await db.from('clientes').insert({ razao_social: 'Padaria Sol', cnpj: '21448390000107', regime: 'simples', uf: 'MG', cidade: 'Belo Horizonte', segmentos: ['comercio'] } as never).select('id').single()).data!.id;
      const lua = (await db.from('clientes').insert({ razao_social: 'Mercado Lua', cnpj: '11222333000181', regime: 'presumido', uf: 'MG', cidade: 'Belo Horizonte', segmentos: ['comercio'] } as never).select('id').single()).data!.id;
      await contatoProcuravelTeste({ clienteId: sol, nome: 'João', telefone: '5531999990001', setor: 'Fiscal', procurado: true });
      await contatoProcuravelTeste({ clienteId: sol, nome: 'Beto', telefone: '5531999990002', setor: 'Fiscal', procurado: true, perfil: 'basico' });
      await contatoProcuravelTeste({ clienteId: lua, nome: 'Caio', telefone: '5531999990003', setor: 'Fiscal', procurado: false });
    },
    async conferir(p) {
      const f: string[] = [];
      const g = await giroDe(p.giroId);
      if (g.estado !== 'concluido') f.push(`o giro terminou ${g.estado}: ${g.erro ?? ''}`);
      const fiscal = await setorId('Fiscal');
      const clientes = (await db.from('clientes').select('id, razao_social').in('razao_social', ['Padaria Sol', 'Mercado Lua'])).data!;
      // A novidade do giro serve se é do Fiscal e atinge as duas empresas; senão, uma de teste.
      let nov: string | null = null;
      for (const n of await novidadesDe(p.giroId)) {
        if (!n.setores.includes(fiscal)) continue;
        const ok = await sqlTeste<{ ok: boolean }>('select bool_and(interno.cliente_nos_criterios(c.id, n.criterios)) as ok from public.radar_novidades n, public.clientes c where n.id = $1 and c.id = any ($2::uuid[])',
          [n.id, clientes.map((c) => c.id)]);
        if (ok[0]?.ok) { nov = n.id; break; }
      }
      console.log(`  novidade usada: ${nov ? 'a do giro' : 'de teste (nenhuma do giro serve)'}`);
      nov ??= await novidadeRadarTeste({ titulo: 'Mudança de regra de teste', url: 'https://www.gov.br/receitafederal/pt-br/teste', setores: ['Fiscal'], criterios: { ufs: ['MG'] } });
      const texto = 'Olá! Mudou uma regra; já estamos cuidando.';
      // Com a novidade já escolhida (e com rascunho), "nada saiu" não é vazio.
      await sqlTeste('update public.radar_novidades set mensagem_cliente = $2 where id = $1', [nov, texto]);
      await enviosRadar({ repos, radar, envio: p.envio, relogio: () => new Date() });
      if (p.canal.enviados.length) f.push(`saiu mensagem sem aprovação: ${JSON.stringify(p.canal.enviados)}`);
      const n0 = (await sqlTeste<{ n: string }>('select count(*) as n from public.radar_envios'))[0]!.n;
      if (Number(n0) !== 0) f.push(`radar_envios tem ${n0} linhas antes de aprovar`);
      const [r] = await comoPessoa<{ n: number }>(p.ana, 'select public.aprovar_envio_radar($1, $2, $3::uuid[], $4) as n', [nov, fiscal, clientes.map((c) => c.id), texto]);
      if (r?.n !== 1) f.push(`aprovar_envio_radar devolveu ${r?.n} (esperava 1: só o João)`);
      const enviados = await enviosRadar({ repos, radar, envio: p.envio, relogio: () => new Date() });
      if (enviados !== 1) f.push(`enviosRadar enviou ${enviados} (esperava 1)`);
      const n1 = (await sqlTeste<{ n: string }>('select count(*) as n from public.radar_envios'))[0]!.n;
      if (Number(n1) !== 1) f.push(`radar_envios tem ${n1} linhas depois de aprovar (esperava 1)`);
      if (p.canal.enviados.length !== 1 || p.canal.enviados[0]!.telefone !== '5531999990001' || p.canal.enviados[0]!.texto !== texto) {
        f.push(`o canal recebeu ${JSON.stringify(p.canal.enviados)}`);
      }
      const msgs = await sqlTeste<{ autor: string; conteudo: string }>('select autor, conteudo from public.mensagens');
      if (msgs.length !== 1 || msgs[0]!.autor !== 'agente' || msgs[0]!.conteudo !== texto) f.push(`mensagens no banco: ${JSON.stringify(msgs)}`);
      return f;
    },
  },
];

async function preparar(c: Cenario): Promise<Preparado> {
  await limparBanco();
  await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
  await ligarRadarTeste('ligado');
  const ana = await criarUsuarioTeste({ email: 'ana@cenario-radar.local', nome: 'Ana', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Fiscal'] });
  await c.preparar();
  const [g] = await sqlTeste<{ id: string }>(`insert into public.radar_giros (origem, estado, dia, pedido_por)
    values ($1, 'pendente', (now() at time zone 'America/Sao_Paulo')::date, $2) returning id`, [c.origem, c.origem === 'pedido' ? ana : null]);
  const canal = new CanalFalso();
  const envio: DepsEnvio = { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) };
  return { ia: iaQueAnota(), canal, envio, ana, giroId: g!.id };
}

const somaUso = async () => Number((await sqlTeste<{ s: string | null }>('select round(sum(custo_usd), 4) as s from public.uso_ia'))[0]!.s ?? 0);

async function principal() {
  const filtro = process.argv[2];
  const lista = CENARIOS.filter((c) => !filtro || c.nome.includes(filtro));
  let ok = 0;
  let total = 0;
  for (const c of lista) {
    const p = await preparar(c);
    let falhas: string[];
    try {
      await cicloRadar({ repos, radar, ia: p.ia, envio: p.envio, relogio: () => new Date() });
      const g = await giroDe(p.giroId);
      const nov = await novidadesDe(p.giroId);
      console.log(`  [${c.nome}] ${resumoDaIa(p.ia)}; giro ${g.estado}, ${g.buscas} buscas, ${g.paginas} páginas, ${nov.length} novidades (${nov.map((n) => `${n.selo}: ${n.titulo}`).join(' | ')}); fora: ${JSON.stringify(g.fontes_fora)}; resumo: ${g.resumo ?? '-'}; erro: ${g.erro ?? '-'}`);
      falhas = await c.conferir(p);
    } catch (e) {
      falhas = [`erro: ${(e as Error).stack ?? (e as Error).message}`];
    }
    const custo = await somaUso();
    total += custo;
    if (falhas.length) console.log(`✘ ${c.nome} (US$ ${custo.toFixed(4)})\n  - ${falhas.join('\n  - ')}`);
    else { ok++; console.log(`✔ ${c.nome} (US$ ${custo.toFixed(4)})`); }
  }
  console.log(`\n${ok}/${lista.length} cenários do Radar passaram. Custo: US$ ${total.toFixed(4)}`);
  if (ok !== lista.length) process.exitCode = 1;
}

principal().catch((e) => { console.error(e); process.exit(1); });
