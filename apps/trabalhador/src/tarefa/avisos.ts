import { MIME_XLSX, mensagemPausada, mensagemPendencias, mensagemPronta, quemAprova } from '@escritorio/core';
import type { Repos } from '@escritorio/db';
import type { CanalWhatsApp } from '../canal/tipos';
import { agendarAviso, type Fila } from '../fila';
import { planilhaDaTarefa } from './planilha';

let avisouSemI4 = false;

/** Tenta de novo o que só grava (o aviso já saiu): uma falha passageira do banco não pode virar envio repetido. */
async function gravarComNovasTentativas(rotulo: string, f: () => Promise<unknown>, tentativas = 3, esperaMs = 250): Promise<boolean> {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await f();
      return true;
    } catch (e) {
      console.error(`[avisos] ${rotulo} (tentativa ${i} de ${tentativas})`, e);
      if (i < tentativas) await new Promise((r) => setTimeout(r, esperaMs * i));
    }
  }
  return false;
}

/** D9: depois de cada vez; o banco decide o que avisar (uma vez por momento) e devolve o que vai pelo WhatsApp. Nunca derruba a vez. */
export async function registrarAvisos(d: { repos: Repos; fila: Fila }, tarefaId: string): Promise<void> {
  try {
    const ids = await d.repos.registrarAvisosDaTarefa(tarefaId);
    if (ids === null) {
      if (!avisouSemI4) { avisouSemI4 = true; console.warn('[avisos] o banco ainda não tem a Parte I4: sem avisos de tarefa'); }
      return;
    }
    for (const id of ids) await agendarAviso(d.fila, id);
  } catch (e) {
    console.error('[avisos] não registrei os avisos da tarefa', tarefaId, e);
  }
}

/**
 * D9, D12: manda um aviso ao WhatsApp de quem pediu (arquivo antes do texto) e guarda o texto no histórico do Assistente dela.
 * Reserva antes de mandar; antes de o texto sair, a falha marca "não enviado" (vai ao painel). Depois que a Z-API aceitou o texto,
 * nunca marca falha nem relança (sairia em dobro): só grava, com novas tentativas; a reserva esquecida o batimento resolve (F4).
 */
export async function enviarAvisoTarefa(d: { repos: Repos; canal: CanalWhatsApp }, avisoId: string): Promise<'enviado' | 'nada' | 'falhou'> {
  const a = await d.repos.reservarAvisoTarefa(avisoId);
  if (!a) return 'nada';
  let texto: string;
  try {
    const t = await d.repos.tarefaParaTrabalho(a.tarefaId);
    if (!t) throw new Error('tarefa sumiu');
    const base = { tarefa: t.numero, agente: t.agenteNome, demanda: t.chamadoNumero };
    if (a.tipo === 'pendencias') {
      // As do aviso (o banco guardou as abertas no registro) que continuam abertas.
      const abertas = t.pendencias.filter((p) => p.estado === 'aberta' && (a.pendencias.length === 0 || a.pendencias.includes(p.numero)));
      texto = mensagemPendencias({ ...base, empresa: t.empresa, setor: t.setor,
        analista: abertas.filter((p) => p.tipo === 'analista').map((p) => ({ numero: p.numero, pergunta: p.pergunta, detalhe: p.detalhe, opcoes: p.opcoes })),
        cliente: abertas.filter((p) => p.tipo === 'cliente').length });
    } else if (a.tipo === 'pronta') {
      const planilha = planilhaDaTarefa(t);
      if (planilha) {
        await d.canal.enviarArquivo(a.telefone, { url: `data:${MIME_XLSX};base64,${Buffer.from(planilha).toString('base64')}`, nome: `tarefa-${t.numero}-rascunho.xlsx` });
      }
      texto = mensagemPronta({ ...base, empresa: t.empresa, resumo: t.resultado?.resumo ?? '', linhas: t.resultado?.linhas.length ?? 0,
        provisorias: t.resultado?.linhas.filter((l) => l.provisoria).length ?? 0, comPlanilha: planilha !== null,
        quemAprova: quemAprova({ responsavel: a.responsavel, pedeNoSetor: a.pedeNoSetor, setor: t.setor }) });
    } else {
      texto = mensagemPausada({ ...base, motivo: a.motivoPausa ?? 'falha' });
    }
    await d.canal.enviarTexto(a.telefone, texto);
  } catch (e) {
    console.error('[avisos] o aviso não saiu; vai ao painel', avisoId, e);
    await d.repos.marcarAvisoTarefa(avisoId, false).catch((err) => console.error('[avisos] não marquei a falha', avisoId, err));
    return 'falhou';
  }
  // O texto saiu: daqui em diante só grava.
  await gravarComNovasTentativas('histórico do Assistente não gravado', () =>
    d.repos.registrarMensagemAssistente({ usuarioId: a.usuarioId, canal: 'whatsapp', conversaId: null, papel: 'assistente', conteudo: texto, processada: true }));
  const marcado = await gravarComNovasTentativas('aviso não marcado como enviado', () => d.repos.marcarAvisoTarefa(avisoId, true));
  if (!marcado) console.error('[avisos] ATENÇÃO: aviso enviado e não marcado; nada é reenviado', avisoId);
  return 'enviado';
}
