import type Anthropic from '@anthropic-ai/sdk';
import { calcularCustoUsd, mesReferencia } from '@escritorio/core';
import { erroTemporarioIa } from '../agente/cliente-ia';
import { carregarContextoAssistente, podeVerConversa } from '../assistente/contexto';
import { novoEstado, type DepsAssistente } from '../assistente/ferramentas';
import { usaAssistentePor } from '../assistente/visibilidade';
import { ENTREGAR_RASCUNHO, FERRAMENTAS_SUGESTAO, executarLeituraSugestao, reposDaSugestao, type EstadoSugestao } from './ferramentas';
import { montarSistemaSugestao } from './prompt';

export const SUGESTAO_SEM_ASSISTENTE = 'Sugerir resposta usa o assistente: peça acesso ao administrador.';
export const SUGESTAO_SEM_ACESSO = 'Sem acesso a esta conversa.';
export const SUGESTAO_FORA_DO_HORARIO = 'Fora do seu horário de acesso.';
export const SUGESTAO_TETO = 'Limite mensal de gasto com IA atingido. Fale com o administrador.';
export const SUGESTAO_FALHA = 'Não consegui sugerir agora. Tente de novo em alguns minutos.';
export const SUGESTAO_VAZIA = 'Não consegui montar uma sugestão. Escreva a resposta ou tente de novo.';
/** Rodadas com a IA (spec 7A.2): na última, ela é obrigada a entregar o rascunho. */
export const MAX_RODADAS = 3;
const LIMITE_TEXTO = 4000;
const LIMITE_ERRO = 300;

/**
 * Fila sugerir_resposta: confere permissão, acesso à conversa, horário e teto; roda o assistente só com leituras;
 * grava o resultado na própria sugestão. Nada vai para a conversa, nada é enviado (spec 7A.1).
 */
export async function processarSugestao(d: DepsAssistente, sugestaoId: string, ultimaTentativa: boolean): Promise<'pronta' | 'falhou' | 'ignorada'> {
  const s = await d.repos.obterSugestao(sugestaoId);
  if (!s || s.status !== 'pendente') return 'ignorada';
  const falhar = async (erro: string) => {
    // Limites da tabela (texto até 4000, erro até 300): acima disso o check do banco recusaria a conclusão.
    await d.repos.concluirSugestao(s.id, { status: 'falhou', erro: erro.slice(0, LIMITE_ERRO) });
    return 'falhou' as const;
  };

  const usuario = await d.repos.obterUsuarioAssistente(s.usuario_id);
  if (!usuario || !usaAssistentePor(usuario, 'site')) return falhar(SUGESTAO_SEM_ASSISTENTE);
  if (!(await d.repos.horarioPermite(usuario.id, new Date()))) return falhar(SUGESTAO_FORA_DO_HORARIO);
  if (!(await podeVerConversa(d.repos, usuario, s.conversa_id))) return falhar(SUGESTAO_SEM_ACESSO);
  const config = await d.repos.obterConfiguracoes();
  if ((await d.repos.custoIaDoMes(mesReferencia(new Date()))) >= config.tetoIaUsd) return falhar(SUGESTAO_TETO);

  const repos = reposDaSugestao(d.repos, s);
  const dl: DepsAssistente = { repos, ia: d.ia, canal: d.canal };
  try {
    const ctx = await carregarContextoAssistente(repos, usuario, 'site', s.conversa_id, new Date());
    if (!ctx.conversa) return falhar(SUGESTAO_SEM_ACESSO);
    const estado: EstadoSugestao = { ...novoEstado(ctx), rascunho: null };
    const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: montarSistemaSugestao(ctx) }];
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: 'Sugira a próxima resposta da equipe a este cliente.' }];
    const preco = config.precosModelos[config.modeloConversa] ?? { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };

    for (let i = 0; i < MAX_RODADAS && estado.rascunho === null; i++) {
      const ultima = i === MAX_RODADAS - 1;
      const r = await dl.ia.criar({
        model: config.modeloConversa, max_tokens: 4000, system, tools: FERRAMENTAS_SUGESTAO, messages,
        ...(ultima ? { tool_choice: { type: 'tool' as const, name: ENTREGAR_RASCUNHO.name } } : {}),
      });
      const uso = { entrada: r.usage.input_tokens, saida: r.usage.output_tokens, cacheLeitura: r.usage.cache_read_input_tokens ?? 0, cacheEscrita: r.usage.cache_creation_input_tokens ?? 0 };
      await repos.registrarUsoIa({ conversaId: s.conversa_id, modelo: config.modeloConversa, tokensEntrada: uso.entrada, tokensSaida: uso.saida,
        tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita, custoUsd: calcularCustoUsd(uso, preco) });
      const usos = r.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (r.stop_reason !== 'tool_use' || usos.length === 0) continue;
      messages.push({ role: 'assistant', content: r.content });
      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const u of usos) {
        const res = await executarLeituraSugestao(dl, estado, u.name, u.input);
        resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.resultado, is_error: res.erro });
      }
      messages.push({ role: 'user', content: resultados });
    }
    if (estado.rascunho === null) return falhar(SUGESTAO_VAZIA);
    await d.repos.concluirSugestao(s.id, { status: 'pronta', texto: estado.rascunho.slice(0, LIMITE_TEXTO) });
    return 'pronta';
  } catch (e) {
    // Só falha temporária da IA tenta de novo; qualquer outra repetiria o mesmo erro.
    if (!ultimaTentativa && erroTemporarioIa(e)) throw e;
    console.error('[sugestão] falha', e);
    return falhar(SUGESTAO_FALHA);
  }
}
