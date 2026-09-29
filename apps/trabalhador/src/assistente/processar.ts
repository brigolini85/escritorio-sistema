import { mesReferencia } from '@escritorio/core';
import type { ArquivoAssistente } from '@escritorio/db';
import type { JobAssistente } from '../fila';
import { carregarContextoAssistente } from './contexto';
import { executarAssistente } from './executar';
import type { DepsAssistente } from './ferramentas';

export const MENSAGEM_TETO = 'Limite mensal de gasto com IA atingido. Fale com o administrador.';
export const MENSAGEM_FALHA = 'Não consegui responder agora. Tente de novo em alguns minutos.';
const MENSAGEM_VAZIA = 'Não consegui concluir. Pode pedir de outro jeito?';

export async function processarAssistente(d: DepsAssistente, j: JobAssistente, ultimaTentativa: boolean): Promise<'sem-perguntas' | 'sem-permissao' | 'teto' | 'respondido'> {
  const pendentes = await d.repos.perguntasPendentes(j.usuarioId, j.canal, j.conversaId);
  if (pendentes.length === 0) return 'sem-perguntas';
  const ids = pendentes.map((m) => m.id);
  const usuario = await d.repos.obterUsuarioAssistente(j.usuarioId);
  const permissao = j.canal === 'site' ? 'assistente_site' : 'assistente_whatsapp';
  if (!usuario || !usuario.ativo || !usuario.permissoes.includes(permissao)) {
    await d.repos.marcarPerguntasRespondidas(ids);
    return 'sem-permissao';
  }

  const responder = async (texto: string, arquivo: ArquivoAssistente | null = null, csvs: { nome: string; conteudo: string }[] = []) => {
    await d.repos.registrarMensagemAssistente({ usuarioId: usuario.id, canal: j.canal, conversaId: j.conversaId, papel: 'assistente', conteudo: texto, arquivo, processada: true });
    await d.repos.marcarPerguntasRespondidas(ids);
    if (j.canal === 'whatsapp' && j.telefone) {
      await d.canal.enviarTexto(j.telefone, texto);
      for (const c of csvs) {
        await d.canal.enviarArquivo(j.telefone, { url: `data:text/csv;base64,${Buffer.from(c.conteudo, 'utf8').toString('base64')}`, nome: c.nome });
      }
    }
  };

  const agora = new Date();
  const config = await d.repos.obterConfiguracoes();
  if ((await d.repos.custoIaDoMes(mesReferencia(agora))) >= config.tetoIaUsd) {
    await responder(MENSAGEM_TETO);
    return 'teto';
  }
  try {
    const ctx = await carregarContextoAssistente(d.repos, usuario, j.canal, j.conversaId, agora);
    const historico = await d.repos.historicoAssistente(usuario.id, j.canal, j.conversaId, 30);
    const r = await executarAssistente(d, ctx, historico);
    await responder(r.resposta.join('\n\n') || MENSAGEM_VAZIA, r.arquivo, r.csvs);
    return 'respondido';
  } catch (e) {
    if (!ultimaTentativa) throw e;
    console.error('[assistente] falha', e);
    await responder(MENSAGEM_FALHA);
    return 'respondido';
  }
}
