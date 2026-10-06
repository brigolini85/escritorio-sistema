import type Anthropic from '@anthropic-ai/sdk';
import { LIMITES_RADAR, custoChamadaRadarUsd, ferramentasWeb, mesReferencia, usoDaResposta } from '@escritorio/core';
import type { FimDoGiro, GiroParaRodar, Repos, ReposRadar } from '@escritorio/db';
import type { ClienteIa } from '../agente/cliente-ia';
import { FERRAMENTAS_SKILL } from '../agente/ferramentas';
import { carregarPerfil, modeloDoPerfil } from '../agente/perfil';
import { temSkillSobDemanda } from '../agente/skills';
import { FERRAMENTAS_RADAR, executarFerramentaRadar, lerResultadosWeb, novaVez } from './ferramentas';
import { LEMBRETE_GIRO, montarPedidoGiro, montarSistemaRadar } from './prompt';

export type DepsGiro = { repos: Repos; radar: ReposRadar; ia: ClienteIa; relogio: () => Date };
export type ResultadoGiro = FimDoGiro & { novas: string[] };

const falhou = (erro: string): ResultadoGiro =>
  ({ estado: 'falhou', fontes: 0, paginas: 0, buscas: 0, fontesFora: [], lidas: [], resumo: null, erro, novas: [] });

/** D8: uma conversa com o Claude e as ferramentas web; para no limite do giro, no teto do mês ou nas 12 rodadas. */
export async function rodarGiro(d: DepsGiro, g: GiroParaRodar): Promise<ResultadoGiro> {
  if (!g.fontes.length) return falhou('Nenhuma fonte ligada.');
  const agora = d.relogio();
  const config = await d.repos.obterConfiguracoes();
  if ((await d.repos.custoIaDoMes(mesReferencia(agora))) >= config.tetoIaUsd) return falhou('Teto de gastos com IA do mês atingido.');
  const perfil = await carregarPerfil(d.repos, 'radar');
  const orientacoes = await d.repos.orientacoesAtivas(perfil.id);
  const modelo = modeloDoPerfil(perfil, config);
  const preco = config.precosModelos[modelo] ?? { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  const tools = [
    ...(ferramentasWeb(g.origem === 'confirmar' ? g.fontes.filter((f) => f.oficial) : g.fontes) as unknown as Anthropic.ToolUnion[]),
    ...FERRAMENTAS_RADAR,
    ...(temSkillSobDemanda(perfil.skills) ? FERRAMENTAS_SKILL : []),
  ];
  const system = montarSistemaRadar(perfil, orientacoes, g.setores);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: montarPedidoGiro(g, agora) }];
  const vez = novaVez(g, perfil);
  let custo = 0;
  let lembrado = false;
  let parouNoLimite = false;
  let erro: string | null = null;
  for (let i = 0; i < LIMITES_RADAR.rodadasPorGiro; i++) {
    if (custo >= g.config.limiteUsdGiro) { parouNoLimite = true; break; }
    const r = await d.ia.criar({ model: modelo, max_tokens: 8000, system, tools, messages, output_config: { effort: 'medium' } });
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
    // pause_turn: a busca no servidor pausou; manda de volta a resposta como veio, sem mensagem nova (documentação das ferramentas de servidor).
    if (r.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: r.content }); continue; }
    const usos = r.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || usos.length === 0) {
      if (vez.terminou || lembrado) break;
      lembrado = true;
      // A API recusa turno do assistente vazio: sem conteúdo, só o lembrete.
      if (r.content.length) messages.push({ role: 'assistant', content: r.content });
      messages.push({ role: 'user', content: [{ type: 'text', text: LEMBRETE_GIRO }] });
      continue;
    }
    messages.push({ role: 'assistant', content: r.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const u of usos) {
      const res = await executarFerramentaRadar({ radar: d.radar, repos: d.repos }, vez, u.name, u.input);
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.conteudo, is_error: res.erro });
    }
    // Só tool_result: uma leitura que ficou pendente nesta resposta roda na próxima chamada (texto aqui encerraria a vez dela).
    messages.push({ role: 'user', content: resultados });
    if (vez.terminou) break;
  }
  const resumo = [vez.resumo, parouNoLimite ? 'Parou no limite de custo do giro.' : null].filter(Boolean).join(' ') || null;
  return {
    estado: erro ? 'falhou' : 'concluido', fontes: g.fontes.length, paginas: vez.lidas.length, buscas: vez.buscas,
    fontesFora: [...vez.fontesFora.values()], lidas: vez.lidas, resumo, erro, novas: vez.novas,
  };
}
