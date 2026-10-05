import type Anthropic from '@anthropic-ai/sdk';
import type { ContextoAgente } from './contexto';
import { executarAgente, type ResultadoAgente } from './executar';
import type { DepsAgente } from './ferramentas';
import { NAO_CONSEGUIU_SEGUIR, acessoAoSetor } from './roteamento';

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
    // Sem conseguir encerrar, o Thiago atende mesmo assim (F9/F10); a próxima mensagem confere e tenta de novo.
    await d.repos.encerrarConducao(ctx.conversa.id, 'o contato não trata deste setor')
      .catch((e) => console.error('[agente] condução não encerrada; o Thiago atende', ctx.conversa.id, e));
    return executarAgente(d, semAgente(ctx, a.id), conteudo);
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
    await d.repos.encerrarConducao(ctx.conversa.id, 'passou para a equipe');
    return r;
  }
  await d.repos.encerrarConducao(ctx.conversa.id, r.motivo);
  // Já respondeu ao cliente nesta vez e devolveu ("assunto acabou"): o Thiago não responde de novo à mesma mensagem.
  if (r.respondeu) return { status: 'ok' };
  return executarAgente(d, semAgente(ctx, a.id), conteudo);
}

/** O mesmo contexto sem o agente que acabou de devolver (D16); o objeto é novo, mas a conversa e a empresa são as mesmas. */
const semAgente = (ctx: ContextoAgente, id: string): ContextoAgente =>
  ({ ...ctx, conducao: null, agentesSetor: (ctx.agentesSetor ?? []).filter((x) => x.id !== id) });
