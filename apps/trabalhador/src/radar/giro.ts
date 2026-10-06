import type Anthropic from '@anthropic-ai/sdk';
import { LIMITES_RADAR, custoChamadaRadarUsd, ferramentasWeb, mesReferencia, usoDaResposta } from '@escritorio/core';
import type { FimDoGiro, GiroParaRodar, Repos, ReposRadar } from '@escritorio/db';
import type { ClienteIa } from '../agente/cliente-ia';
import { FERRAMENTAS_SKILL } from '../agente/ferramentas';
import { carregarPerfil, modeloDoPerfil } from '../agente/perfil';
import { temSkillSobDemanda } from '../agente/skills';
import { FERRAMENTAS_RADAR, executarFerramentaRadar, lerResultadosWeb, novaVez } from './ferramentas';
import { AVISO_FIM_BUSCAS, LEMBRETE_GIRO, montarPedidoGiro, montarSistemaRadar } from './prompt';

/** agoraMs: o relógio do prazo (revisão geral I2); padrão Date.now. */
export type DepsGiro = { repos: Repos; radar: ReposRadar; ia: ClienteIa; relogio: () => Date; agoraMs?: () => number };
/** Revisão geral I2: o giro para de abrir rodadas aos 25 min; com uma chamada de até 10 min (2 x 300 s), fecha antes dos 40 min
 * em que o banco fecha o giro travado e bem antes de o job expirar (50 min). */
export const PRAZO_GIRO_MS = 25 * 60_000;
export type ResultadoGiro = FimDoGiro & { novas: string[] };

const falhou = (erro: string): ResultadoGiro =>
  ({ estado: 'falhou', fontes: 0, paginas: 0, buscas: 0, fontesFora: [], lidas: [], resumo: null, erro, novas: [] });

/** D8: uma conversa com o Claude e as ferramentas web; para no limite do giro, no teto do mês ou nas 12 rodadas. */
export async function rodarGiro(d: DepsGiro, g: GiroParaRodar): Promise<ResultadoGiro> {
  if (!g.fontes.length) return falhou('Nenhuma fonte ligada.');
  const fontesWeb = g.origem === 'confirmar' ? g.fontes.filter((f) => f.oficial) : g.fontes;
  if (g.origem === 'confirmar' && !fontesWeb.length) return falhou('Nenhuma fonte oficial ligada.');
  const web = ferramentasWeb(fontesWeb);
  // D1: sem domínio permitido a ferramenta web buscaria na internet inteira; nunca chama a IA assim.
  if (web.some((t) => t.allowed_domains.length === 0)) return falhou('Nenhuma fonte ligada.');
  const agora = d.relogio();
  const config = await d.repos.obterConfiguracoes();
  if ((await d.repos.custoIaDoMes(mesReferencia(agora))) >= config.tetoIaUsd) return falhou('Teto de gastos com IA do mês atingido.');
  const perfil = await carregarPerfil(d.repos, 'radar');
  const orientacoes = await d.repos.orientacoesAtivas(perfil.id);
  const modelo = modeloDoPerfil(perfil, config);
  const preco = config.precosModelos[modelo] ?? { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  // As ferramentas (e o max_uses) não mudam entre rodadas: mudá-las quebraria o cache.
  const tools = [
    ...(web as unknown as Anthropic.ToolUnion[]),
    ...FERRAMENTAS_RADAR,
    ...(temSkillSobDemanda(perfil.skills) ? FERRAMENTAS_SKILL : []),
  ];
  const system = montarSistemaRadar(perfil, orientacoes, g.setores);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: montarPedidoGiro(g, agora) }];
  const vez = novaVez(g, perfil);
  let custo = 0;
  let lembrado = false;
  let avisouFim = false;
  let parouNoLimite = false;
  let parouNoTempo = false;
  const agoraMs = d.agoraMs ?? Date.now;
  const inicio = agoraMs();
  let erro: string | null = null;
  for (let i = 0; i < LIMITES_RADAR.rodadasPorGiro; i++) {
    if (custo >= g.config.limiteUsdGiro) { parouNoLimite = true; break; }
    if (agoraMs() - inicio >= PRAZO_GIRO_MS) { parouNoTempo = true; break; }
    // Cache automático no topo: a conversa que cresce a cada rodada é lida do cache (as mensagens guardadas não mudam).
    const r = await d.ia.criar({
      model: modelo, max_tokens: 8000, system, tools, messages, output_config: { effort: 'medium' }, cache_control: { type: 'ephemeral' },
    });
    const buscas = (r.usage as { server_tool_use?: { web_search_requests?: number } | null }).server_tool_use?.web_search_requests ?? 0;
    const uso = usoDaResposta(r.usage);
    const c = custoChamadaRadarUsd(uso, preco, buscas);
    await d.repos.registrarUsoIa({
      funcionalidade: 'especialista_setor', usuarioId: g.pedidoPor, conversaId: null, clienteId: null, modelo,
      tokensEntrada: uso.entrada, tokensSaida: uso.saida, tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita,
      custoUsd: c, agenteId: perfil.id,
    });
    await d.radar.somarCustoGiro(g.id, c);
    custo += c;
    vez.buscas += buscas;
    lerResultadosWeb(r.content, vez);
    if (r.stop_reason === 'refusal') { erro = 'O modelo recusou o giro.'; break; }
    if (r.stop_reason === 'max_tokens') { erro = 'A resposta do modelo foi cortada.'; break; }
    // D8: o max_uses vale por chamada; o teto do giro é contado aqui. Esta é a última rodada depois do aviso.
    const ultima = avisouFim;
    const esgotou = !avisouFim && (vez.buscas >= LIMITES_RADAR.buscasPorGiro || vez.leituras >= LIMITES_RADAR.leiturasPorGiro);
    if (esgotou) avisouFim = true;
    const aviso: Anthropic.TextBlockParam[] = esgotou ? [{ type: 'text', text: AVISO_FIM_BUSCAS }] : [];
    // pause_turn: a busca no servidor pausou; manda de volta a resposta como veio, sem mensagem nova (documentação das ferramentas de servidor).
    if (r.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: r.content });
      if (ultima) break;
      // Esgotou no meio da pausa: interrompe a vez do servidor com o aviso.
      if (esgotou) messages.push({ role: 'user', content: aviso });
      continue;
    }
    const usos = r.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || usos.length === 0) {
      if (vez.terminou || lembrado || ultima) break;
      lembrado = true;
      // A API recusa turno do assistente vazio: sem conteúdo, só o lembrete.
      if (r.content.length) messages.push({ role: 'assistant', content: r.content });
      messages.push({ role: 'user', content: esgotou ? aviso : [{ type: 'text', text: LEMBRETE_GIRO }] });
      continue;
    }
    messages.push({ role: 'assistant', content: r.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const u of usos) {
      const res = await executarFerramentaRadar({ radar: d.radar, repos: d.repos }, vez, u.name, u.input);
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.conteudo, is_error: res.erro });
    }
    // Só tool_result: uma leitura que ficou pendente nesta resposta roda na próxima chamada (texto aqui encerraria a vez dela).
    // A exceção é o aviso do fim das buscas, que encerra a vez de propósito.
    messages.push({ role: 'user', content: [...resultados, ...aviso] });
    if (vez.terminou || ultima) break;
  }
  const resumo = [vez.resumo, parouNoLimite ? 'Parou no limite de custo do giro.' : null, parouNoTempo ? 'Parou no tempo máximo do giro.' : null]
    .filter(Boolean).join(' ') || null;
  return {
    estado: erro ? 'falhou' : 'concluido', fontes: g.fontes.length, paginas: vez.lidas.length, buscas: vez.buscas,
    fontesFora: [...vez.fontesFora.values()], lidas: vez.lidas, resumo, erro, novas: vez.novas,
  };
}
