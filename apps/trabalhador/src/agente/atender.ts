import type Anthropic from '@anthropic-ai/sdk';
import type { ContextoAgente } from './contexto';
import { executarAgente, type ResultadoAgente } from './executar';
import type { DepsAgente } from './ferramentas';
import { acessoAoSetor } from './roteamento';

/**
 * Parte I2 (D6, D7, D16): quem atende esta mensagem. Com condução valendo e o contato ainda no setor, o agente do setor;
 * se ele devolver, o Thiago trata a mesma mensagem (sem o mesmo agente na lista). Sem condução, o Thiago (que pode chamar um agente).
 */
export async function atenderComAgentes(d: DepsAgente, ctx: ContextoAgente, conteudo: Anthropic.ContentBlockParam[]): Promise<ResultadoAgente> {
  const a = ctx.conducao;
  if (!a) return executarAgente(d, ctx, conteudo);
  // A mesma conferência do chamar_agente (F14). Sem acessoConferido: o agente confere de novo antes de cada ferramenta (D7).
  const situacao = ctx.empresaEmFoco ? (await acessoAoSetor(d, { ctx, respondeu: false }, ctx.empresaEmFoco.id, a.setorId)).situacao : 'sem';
  if (situacao !== 'ok') {
    await d.repos.encerrarConducao(ctx.conversa.id, 'o contato não trata deste setor');
    return executarAgente(d, semAgente(ctx, a.id), conteudo);
  }
  const r = await executarAgente(d, ctx, conteudo, undefined, { papel: { tipo: 'especialista', agente: a, modo: 'passa_conversa' } });
  if (r.status === 'ok') return { status: 'ok' };
  if (r.status === 'escalar') {
    await d.repos.encerrarConducao(ctx.conversa.id, 'passou para a equipe');
    return r;
  }
  await d.repos.encerrarConducao(ctx.conversa.id, r.motivo);
  return executarAgente(d, semAgente(ctx, a.id), conteudo);
}

/** O mesmo contexto sem o agente que acabou de devolver (D16); o objeto é novo, mas a conversa e a empresa são as mesmas. */
const semAgente = (ctx: ContextoAgente, id: string): ContextoAgente =>
  ({ ...ctx, conducao: null, agentesSetor: (ctx.agentesSetor ?? []).filter((x) => x.id !== id) });
