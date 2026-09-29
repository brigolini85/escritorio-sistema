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
  // Uma única leitura: perguntas que chegarem durante o processamento ficam para a próxima execução.
  const historico = await d.repos.historicoAssistente(j.usuarioId, j.canal, j.conversaId, 30);
  const ids = historico.filter((m) => m.papel === 'usuario' && m.processada_em === null).map((m) => m.id);
  if (ids.length === 0) return 'sem-perguntas';
  const usuario = await d.repos.obterUsuarioAssistente(j.usuarioId);
  const permissao = j.canal === 'site' ? 'assistente_site' : 'assistente_whatsapp';
  if (!usuario || !usuario.ativo || !usuario.permissoes.includes(permissao)) {
    await d.repos.marcarPerguntasRespondidas(ids);
    return 'sem-permissao';
  }

  /** Entrega primeiro (WhatsApp) e só então grava a resposta e marca as perguntas. */
  const responder = async (texto: string, arquivo: ArquivoAssistente | null = null, csvs: { nome: string; conteudo: string }[] = []) => {
    let falhaEnvio: unknown = null;
    if (j.canal === 'whatsapp' && j.telefone) {
      try {
        await d.canal.enviarTexto(j.telefone, texto);
        for (const c of csvs) {
          await d.canal.enviarArquivo(j.telefone, { url: `data:text/csv;base64,${Buffer.from(c.conteudo, 'utf8').toString('base64')}`, nome: c.nome });
        }
      } catch (e) {
        if (!ultimaTentativa) throw e;
        falhaEnvio = e;
      }
    }
    if (falhaEnvio) console.error('[assistente] falha ao enviar pelo WhatsApp', falhaEnvio);
    await d.repos.registrarMensagemAssistente({ usuarioId: usuario.id, canal: j.canal, conversaId: j.conversaId, papel: 'assistente', conteudo: texto, arquivo, processada: true });
    await d.repos.marcarPerguntasRespondidas(ids);
  };

  const agora = new Date();
  const config = await d.repos.obterConfiguracoes();
  if ((await d.repos.custoIaDoMes(mesReferencia(agora))) >= config.tetoIaUsd) {
    await responder(MENSAGEM_TETO);
    return 'teto';
  }
  let r;
  try {
    const ctx = await carregarContextoAssistente(d.repos, usuario, j.canal, j.conversaId, agora);
    r = await executarAssistente(d, ctx, historico);
  } catch (e) {
    if (!ultimaTentativa) throw e;
    console.error('[assistente] falha', e);
    await responder(MENSAGEM_FALHA);
    return 'respondido';
  }
  await responder(r.resposta.join('\n\n') || MENSAGEM_VAZIA, r.arquivo, r.csvs);
  return 'respondido';
}
