import type Anthropic from '@anthropic-ai/sdk';
import type { AgenteSetor } from '@escritorio/db';
import type { ContextoAgente } from './contexto';
import { executarAgente, type ResultadoAgente } from './executar';
import type { DepsAgente } from './ferramentas';
import { NAO_CONSEGUIU_SEGUIR, acessoAoSetor } from './roteamento';

/**
 * Parte I2 (D6, D7, D16): quem atende esta mensagem. Com condução valendo e o contato ainda no setor, o agente do setor;
 * se ele devolver, o Thiago trata a mesma mensagem (sem o mesmo agente na lista). Sem condução, o Thiago (que pode chamar um agente).
 */
export async function atenderComAgentes(d: DepsAgente, ctx: ContextoAgente, conteudo: Anthropic.ContentBlockParam[]): Promise<ResultadoAgente> {
  // Parte I3a (D26): o contato escreveu com pedido aberto; a tarefa ganha o aviso (no máximo um por hora). Falha não para a vez.
  if (ctx.pedidosAoContato?.length && ctx.contato) {
    await d.repos.contatoRespondeuPendencias(ctx.contato.id).catch((e) => console.error('[tarefa] aviso de resposta não gravado', ctx.conversa.id, e));
  }
  const a = ctx.conducao;
  if (!a) return executarAgente(d, ctx, conteudo);
  // A mesma conferência do chamar_agente (F14). Sem acessoConferido: o agente confere de novo antes de cada ferramenta (D7).
  const situacao = ctx.empresaEmFoco ? (await acessoAoSetor(d, { ctx, respondeu: false }, ctx.empresaEmFoco.id, a.setorId)).situacao : 'sem';
  if (situacao !== 'ok') {
    // Sem conseguir encerrar, o Thiago atende mesmo assim (F9/F10); a próxima mensagem confere e tenta de novo.
    await d.repos.encerrarConducao(ctx.conversa.id, 'o contato não trata deste setor')
      .catch((e) => console.error('[agente] condução não encerrada; o Thiago atende', ctx.conversa.id, e));
    return executarAgente(d, semAgente(ctx, a), conteudo);
  }
  let r: ResultadoAgente;
  try {
    r = await executarAgente(d, ctx, conteudo, undefined, { papel: { tipo: 'especialista', agente: a, modo: 'passa_conversa' } });
  } catch (erro) {
    // D6 e F10: a falha também encerra; senão a conversa voltaria ao mesmo agente depois da pessoa. O erro original segue.
    await d.repos.encerrarConducao(ctx.conversa.id, NAO_CONSEGUIU_SEGUIR)
      .catch((e2) => console.error('[agente] condução não encerrada depois do erro', ctx.conversa.id, e2));
    throw erro;
  }
  if (r.status === 'ok') return { status: 'ok' };
  if (r.status === 'escalar') {
    await d.repos.encerrarConducao(ctx.conversa.id, 'passou para a equipe')
      .catch((e) => console.error('[agente] condução não encerrada; segue', ctx.conversa.id, e));
    return r;
  }
  await d.repos.encerrarConducao(ctx.conversa.id, r.motivo)
    .catch((e) => console.error('[agente] condução não encerrada; o Thiago atende', ctx.conversa.id, e));
  // Já respondeu ao cliente nesta vez e devolveu ("assunto acabou"): o Thiago não responde de novo à mesma mensagem.
  if (r.respondeu) return { status: 'ok' };
  return executarAgente(d, semAgente(ctx, a), conteudo);
}

/**
 * O mesmo contexto sem o agente que acabou de devolver (D16); o objeto é novo, mas a conversa e a empresa são as mesmas.
 * Sobra da I2 (D24f): ele fica lembrado em `agenteDevolvido`, para a pré-análise da demanda que o Thiago abrir ainda o achar.
 */
const semAgente = (ctx: ContextoAgente, a: AgenteSetor): ContextoAgente =>
  ({ ...ctx, conducao: null, agentesSetor: (ctx.agentesSetor ?? []).filter((x) => x.id !== a.id), agenteDevolvido: a });
