import { mesReferencia } from '@escritorio/core';
import type { ArquivoAssistente, MensagemAssistente } from '@escritorio/db';
import type { JobAssistente } from '../fila';
import { carregarContextoAssistente } from './contexto';
import { MENSAGEM_VAZIA, executarAssistente } from './executar';
import type { DepsAssistente } from './ferramentas';
import { usaAssistentePor } from './visibilidade';

export const MENSAGEM_TETO = 'Limite mensal de gasto com IA atingido. Fale com o administrador.';
export const MENSAGEM_FALHA = 'Não consegui responder agora. Tente de novo em alguns minutos.';
export const MENSAGEM_FORA_DO_HORARIO = 'Fora do seu horário de acesso. O assistente volta a responder quando o seu horário começar.';
export const AVISO_ARQUIVO_FALHOU = 'Não consegui enviar o arquivo; peça de novo.';
const MAX_PENDENTES = 100;

export async function processarAssistente(d: DepsAssistente, j: JobAssistente, ultimaTentativa: boolean): Promise<'sem-perguntas' | 'sem-permissao' | 'fora-do-horario' | 'teto' | 'respondido'> {
  // Uma única leitura: perguntas que chegarem durante o processamento ficam para a próxima execução.
  // Todas as pendentes entram (não só as que cabem na janela do histórico), para nenhuma ficar esquecida.
  const [janela, pendentes] = await Promise.all([
    d.repos.historicoAssistente(j.usuarioId, j.canal, j.conversaId, 30),
    d.repos.perguntasPendentes(j.usuarioId, j.canal, j.conversaId, MAX_PENDENTES),
  ]);
  const porId = new Map<string, MensagemAssistente>([...janela, ...pendentes].map((m) => [m.id, m]));
  const quando = (m: MensagemAssistente) => new Date(m.criado_em).getTime();
  const historico = [...porId.values()].sort((a, b) => quando(a) - quando(b));
  const perguntas = historico.filter((m) => m.papel === 'usuario' && m.processada_em === null);
  const ids = perguntas.map((m) => m.id);
  if (ids.length === 0) return 'sem-perguntas';
  const usuario = await d.repos.obterUsuarioAssistente(j.usuarioId);
  if (!usuario || !usaAssistentePor(usuario, j.canal)) {
    await d.repos.marcarPerguntasRespondidas(ids);
    return 'sem-permissao';
  }

  /**
   * Entrega primeiro (WhatsApp) e só então grava a resposta e marca as perguntas.
   * Arquivos antes do texto: se um arquivo falhar antes da última tentativa, nenhum texto saiu e a nova tentativa não o repete.
   */
  const responder = async (texto: string, arquivo: ArquivoAssistente | null = null, csvs: { nome: string; conteudo: string }[] = []) => {
    if (j.canal === 'whatsapp' && j.telefone) {
      try {
        for (const c of csvs) {
          await d.canal.enviarArquivo(j.telefone, { url: `data:text/csv;base64,${Buffer.from(c.conteudo, 'utf8').toString('base64')}`, nome: c.nome });
        }
      } catch (e) {
        if (!ultimaTentativa) throw e;
        console.error('[assistente] falha ao enviar o arquivo pelo WhatsApp', e);
        texto = `${texto}\n\n${AVISO_ARQUIVO_FALHOU}`;
        arquivo = null;
      }
      try {
        await d.canal.enviarTexto(j.telefone, texto);
      } catch (e) {
        if (!ultimaTentativa) throw e;
        console.error('[assistente] falha ao enviar pelo WhatsApp', e);
      }
    }
    await d.repos.registrarMensagemAssistente({ usuarioId: usuario.id, canal: j.canal, conversaId: j.conversaId, papel: 'assistente', conteudo: texto, arquivo, processada: true });
    await d.repos.marcarPerguntasRespondidas(ids);
  };

  // Horário de acesso (spec 7.2, P17): avisa e não chama a IA. O banco decide (admin nunca é bloqueado).
  if (!(await d.repos.horarioPermite(usuario.id, new Date()))) {
    await responder(MENSAGEM_FORA_DO_HORARIO);
    return 'fora-do-horario';
  }

  const agora = new Date();
  const config = await d.repos.obterConfiguracoes();
  if ((await d.repos.custoIaDoMes(mesReferencia(agora))) >= config.tetoIaUsd) {
    await responder(MENSAGEM_TETO);
    return 'teto';
  }
  let r;
  try {
    const ctx = await carregarContextoAssistente(d.repos, usuario, j.canal, j.conversaId, agora);
    ctx.perguntaMaisRecenteEm = new Date(perguntas.at(-1)!.criado_em);
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
