import type Anthropic from '@anthropic-ai/sdk';
import { IMPACTOS, LIMITES_RADAR, criteriosParaBanco, fonteDaUrl, lerCriterios, normalizarUrl, type Impacto } from '@escritorio/core';
import type { GiroParaRodar, PerfilAgente, Repos, ReposRadar } from '@escritorio/db';
import { lerReferenciaDoPerfil, lerSkillDoPerfil } from '../agente/skills';

export const FERRAMENTAS_RADAR: Anthropic.Tool[] = [
  {
    name: 'registrar_novidade',
    description: 'Registra uma novidade achada neste giro como sugestão para a equipe decidir. Use só um link que apareceu numa busca ou numa página lida neste giro.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título curto e claro (até 200 letras).' },
        url: { type: 'string', description: 'O link da notícia ou do ato, exatamente como apareceu na busca ou na leitura.' },
        publicado_em: { type: 'string', description: 'Data de publicação, AAAA-MM-DD, se a fonte disser.' },
        resumo: { type: 'string', description: 'De 2 a 4 frases simples: o que muda, para quem e a partir de quando.' },
        impacto: { type: 'string', enum: [...IMPACTOS] },
        setores: { type: 'array', items: { type: 'string' }, description: 'De 1 a 3 nomes da lista <setores>.' },
        criterios: {
          type: 'object', description: 'Quem é afetado. Deixe vazio o que não restringe.',
          properties: {
            regimes: { type: 'array', items: { type: 'string' } }, ufs: { type: 'array', items: { type: 'string' } },
            municipios: { type: 'array', items: { type: 'string' } }, cnaes: { type: 'array', items: { type: 'string' } },
            segmentos: { type: 'array', items: { type: 'string' } }, com_funcionarios: { type: 'boolean' },
          },
        },
        vigencia_inicio: { type: 'string', description: 'AAAA-MM-DD em que passa a valer, se houver.' },
        vigencia_texto: { type: 'string', description: 'Ex.: "vale a partir de 01/01/2027" ou "sem data ainda".' },
        mensagem_cliente: { type: 'string', description: 'Rascunho de mensagem aos clientes afetados, só se precisarem fazer ou saber algo.' },
        assunto: { type: 'string', description: 'O assunto vigiado a que pertence.' },
      },
      required: ['titulo', 'url', 'resumo', 'impacto', 'setores', 'vigencia_texto'],
    },
  },
  {
    name: 'fonte_fora_do_ar',
    description: 'Avisa que a página de uma fonte não abriu neste giro.',
    input_schema: { type: 'object', properties: { fonte: { type: 'string', description: 'O nome da fonte, como em <fontes>.' } }, required: ['fonte'] },
  },
  {
    name: 'terminar_giro',
    description: 'Termina o giro. Chame sempre no fim, depois de registrar as novidades.',
    input_schema: { type: 'object', properties: { resumo: { type: 'string', description: 'Uma ou duas frases do que você viu.' } }, required: ['resumo'] },
  },
];

export type VezDoGiro = {
  giro: GiroParaRodar; perfil: PerfilAgente;
  /** URL normalizada → título: tudo o que apareceu em busca ou leitura neste giro (D1, barreira 2). */
  linksVistos: Map<string, { url: string; titulo: string }>;
  /** server_tool_use de leitura ainda sem resultado (o resultado pode chegar na resposta seguinte). */
  leiturasPendentes: Map<string, string>;
  lidas: { url: string; titulo: string }[];
  fontesFora: Map<string, { fonteId: string | null; nome: string; motivo: string }>;
  /** Buscas e leituras (com ou sem erro) do giro inteiro: o teto da D8 vale para o giro, não para cada chamada. */
  buscas: number; leituras: number; terminou: boolean; resumo: string | null; novas: string[];
};
export const novaVez = (giro: GiroParaRodar, perfil: PerfilAgente): VezDoGiro => ({
  giro, perfil, linksVistos: new Map(), leiturasPendentes: new Map(), lidas: [], fontesFora: new Map(), buscas: 0, leituras: 0, terminou: false, resumo: null, novas: [],
});

const FORA_DO_AR = new Set(['url_not_accessible', 'unavailable']);
// Só fonte do giro e motivo fixo: nada escrito pelo modelo vai para a faixa nem para o WhatsApp do dono.
function marcarFora(vez: VezDoGiro, fonte: { id: string; nome: string }) {
  if (!vez.fontesFora.has(fonte.id)) vez.fontesFora.set(fonte.id, { fonteId: fonte.id, nome: fonte.nome, motivo: 'fora do ar' });
}

/** Lê os blocos das ferramentas de servidor desta resposta: links vistos, páginas lidas e leituras que falharam (D1, D15). */
export function lerResultadosWeb(conteudo: readonly Anthropic.ContentBlock[], vez: VezDoGiro): void {
  for (const b of conteudo as unknown as { type: string; id?: string; name?: string; input?: { url?: string }; tool_use_id?: string; content?: unknown }[]) {
    if (b.type === 'server_tool_use' && b.name === 'web_fetch' && b.id && typeof b.input?.url === 'string') vez.leiturasPendentes.set(b.id, b.input.url);
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content as { type: string; url?: string; title?: string }[]) {
        const n = r.type === 'web_search_result' && r.url ? normalizarUrl(r.url) : null;
        if (n) vez.linksVistos.set(n, { url: r.url!, titulo: r.title ?? r.url! });
      }
    }
    if (b.type === 'web_fetch_tool_result') vez.leituras += 1;
    if (b.type === 'web_fetch_tool_result' && b.content && typeof b.content === 'object') {
      const c = b.content as { type: string; url?: string; error_code?: string; content?: { title?: string } };
      const pedida = b.tool_use_id ? vez.leiturasPendentes.get(b.tool_use_id) : undefined;
      if (c.type === 'web_fetch_result' && c.url) {
        const n = normalizarUrl(c.url);
        const titulo = c.content?.title ?? c.url;
        if (n) vez.linksVistos.set(n, { url: c.url, titulo });
        // O link pedido também conta (redirecionamento: o resultado traz o endereço final).
        const np = pedida ? normalizarUrl(pedida) : null;
        // Guarda o endereço que a ferramenta devolveu, nunca o pedido (que pode ter vindo do modelo com âncora ou usuário).
        if (np && !vez.linksVistos.has(np)) vez.linksVistos.set(np, { url: c.url, titulo });
        if (vez.lidas.length < LIMITES_RADAR.lidasPorGiro) vez.lidas.push({ url: c.url, titulo });
      } else if (c.type === 'web_fetch_tool_result_error' && pedida && FORA_DO_AR.has(c.error_code ?? '')) {
        const f = fonteDaUrl(pedida, vez.giro.fontes);
        if (f) marcarFora(vez, f);
      }
      if (b.tool_use_id) vez.leiturasPendentes.delete(b.tool_use_id);
    }
  }
}

type DepsFerramentas = { radar: ReposRadar; repos: Pick<Repos, 'referenciaDaSkill'> };
const ok = (dados: unknown) => ({ conteudo: JSON.stringify(dados), erro: false });
const falha = (texto: string) => ({ conteudo: texto, erro: true });
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const data = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);

export async function executarFerramentaRadar(d: DepsFerramentas, vez: VezDoGiro, nome: string, entrada: unknown): Promise<{ conteudo: string; erro: boolean }> {
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
  try {
    if (nome === 'registrar_novidade') {
      const url = texto(e.url, 2000);
      const norm = url ? normalizarUrl(url) : null;
      if (!url || !norm) return falha('Link inválido.');
      // Grava o endereço como apareceu na busca ou na leitura, nunca o texto do modelo (âncora, usuário e esquema diferentes passariam).
      const visto = vez.linksVistos.get(norm);
      if (!visto) return falha('Cite um link que apareceu na busca ou na leitura deste giro.');
      const nomes = Array.isArray(e.setores) ? e.setores.filter((s): s is string => typeof s === 'string').map((s) => s.trim().toLowerCase()) : [];
      const setores = vez.giro.setores.filter((s) => nomes.includes(s.nome.toLowerCase())).map((s) => s.id).slice(0, LIMITES_RADAR.setoresPorNovidade);
      if (!setores.length) return falha('Escolha de 1 a 3 setores da lista <setores>.');
      const impacto = (IMPACTOS as readonly string[]).includes(String(e.impacto)) ? (e.impacto as Impacto) : null;
      if (!impacto) return falha('Impacto: alto, medio ou baixo.');
      const r = await d.radar.registrarNovidadeRadar(vez.giro.id, {
        titulo: texto(e.titulo, 200) ?? '', url: visto.url, urlNormalizada: norm, publicadoEm: data(e.publicado_em), resumo: texto(e.resumo, LIMITES_RADAR.resumo) ?? '',
        impacto, setores, criterios: criteriosParaBanco(lerCriterios(e.criterios)), vigenciaInicio: data(e.vigencia_inicio),
        vigenciaTexto: texto(e.vigencia_texto, 120), mensagemCliente: texto(e.mensagem_cliente, LIMITES_RADAR.mensagemCliente), assunto: texto(e.assunto, 60),
      });
      if (r.situacao === 'nova') { vez.novas.push(r.id); return ok({ registrada: true, selo: r.selo, clientes_possivelmente_afetados: r.clientes }); }
      if (r.situacao === 'repetida') return ok({ registrada: false, motivo: 'Já registrada nos últimos 30 dias. Siga para a próxima.' });
      if (r.situacao === 'confirmada') return ok({ confirmada: true });
      return falha('Esse link não é de uma fonte oficial cadastrada. Procure o ato numa fonte oficial.');
    }
    if (nome === 'fonte_fora_do_ar') {
      const alvo = (texto(e.fonte, 80) ?? '').toLowerCase();
      if (!alvo) return falha('Diga o nome da fonte, como em <fontes>.');
      const f = vez.giro.fontes.find((x) => x.nome.toLowerCase() === alvo) ?? vez.giro.fontes.find((x) => x.nome.toLowerCase().includes(alvo)) ?? null;
      if (!f) return falha('Essa fonte não está em <fontes>. Use o nome de uma delas.');
      marcarFora(vez, f);
      return ok({ anotado: true });
    }
    if (nome === 'terminar_giro') {
      vez.terminou = true;
      vez.resumo = texto(e.resumo, 900);
      return ok({ terminado: true });
    }
    if (nome === 'ler_skill') {
      const r = lerSkillDoPerfil(vez.perfil, String(e.nome ?? ''));
      return r.ok ? ok(r.dados) : falha(r.erro);
    }
    if (nome === 'ler_referencia') {
      const r = await lerReferenciaDoPerfil(d.repos, vez.perfil, String(e.skill ?? ''), String(e.arquivo ?? ''), Number(e.parte ?? 1) || 1);
      return r.ok ? ok(r.dados) : falha(r.erro);
    }
    return falha('Ferramenta desconhecida.');
  } catch (erro) {
    // Frase do banco (P0001) volta ao modelo; o resto vira um aviso curto (o giro continua).
    const msg = erro instanceof Error ? erro.message.replace(/^[a-zA-Z]+: /, '') : 'Erro ao gravar.';
    return falha(msg.slice(0, 300));
  }
}
