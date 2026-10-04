import type { Repos } from '@escritorio/db';
import type { Alertas } from './alertas';
import type { CanalWhatsApp } from './canal/tipos';
import type { Email } from './email';
import { enviarDoSistema, type DepsEnvio } from './envio';
import { FILAS, agendarAssistente, type Fila } from './fila';

export type DepsTarefas = { repos: Repos; canal: CanalWhatsApp; alertas: Alertas; envio: DepsEnvio; email: Email; fila: Fila; relogio: () => Date };

export const MSG_WHATSAPP_DESCONECTADO =
  'O WhatsApp do escritório está desconectado. Abra o painel da Z-API e leia o QR code de novo com o celular do escritório.';

export async function batimento(d: DepsTarefas): Promise<void> {
  await d.repos.registrarSinalVida('fila');
  // Resposta do painel que não entrou na fila (ex.: falha ao enfileirar) é reenfileirada.
  for (const mensagemId of await d.repos.respostasPendentesAntigas(2)) {
    await d.fila.enviar(FILAS.enviarMensagem, { mensagemId }, { singletonKey: mensagemId });
  }
  // Pergunta ao assistente sem resposta há mais de 2 minutos (o job não entrou ou se perdeu) volta para a fila.
  for (const p of await d.repos.perguntasAssistenteParadas(2)) {
    await agendarAssistente(d.fila, { usuarioId: p.usuarioId, canal: p.canal, conversaId: p.conversaId, telefone: p.canal === 'whatsapp' ? p.telefone : null });
  }
  const conectado = await d.canal.status().then((s) => s.conectado).catch(() => false);
  if (conectado) {
    await d.repos.registrarSinalVida('whatsapp');
    return;
  }
  if (!(await d.repos.alertaRecente(MSG_WHATSAPP_DESCONECTADO, 30))) {
    await d.alertas.alertar({ nivel: 'critico', mensagem: MSG_WHATSAPP_DESCONECTADO });
  }
}

export async function alertaFila(d: DepsTarefas): Promise<number> {
  const cfg = await d.repos.obterConfiguracoes();
  const chamados = await d.repos.chamadosSemResponsavelParaAlertar(cfg.minutosAlertaFila);
  for (const c of chamados) {
    await d.alertas.alertar({
      nivel: 'aviso', setorId: c.setor_id,
      mensagem: `Demanda #${c.numero} "${c.titulo}" está sem responsável há mais de ${cfg.minutosAlertaFila} minutos.`,
    });
  }
  await d.repos.marcarAlertadoFila(chamados.map((c) => c.id));
  return chamados.length;
}

/** Demanda vencida: avisa o responsável (sem responsável, o setor), uma vez por prazo (spec 6.5). */
export async function alertaVencimento(d: DepsTarefas): Promise<number> {
  const vencidas = await d.repos.demandasVencidasParaAlertar(d.relogio());
  for (const c of vencidas) {
    await d.alertas.alertar({
      nivel: 'aviso',
      usuarioId: c.responsavelId,
      setorId: c.responsavelId ? null : c.setorId,
      mensagem: `Demanda #${c.numero} "${c.titulo}" venceu o prazo.`,
    });
  }
  await d.repos.marcarAlertadoVencimento(vencidas.map((c) => c.id));
  return vencidas.length;
}

/** A cada 5 minutos: cada alerta no seu try, para a falha de um não pular o outro; o erro volta no fim e o job consta como falho. */
export async function alertasPeriodicos(d: DepsTarefas, tarefas: ((d: DepsTarefas) => Promise<unknown>)[] = [alertaFila, alertaVencimento]): Promise<void> {
  const erros: unknown[] = [];
  for (const tarefa of tarefas) {
    try {
      await tarefa(d);
    } catch (e) {
      erros.push(e);
    }
  }
  if (erros.length === 1) throw erros[0];
  if (erros.length > 1) throw new Error(`Alertas periódicos falharam: ${erros.map((e) => (e instanceof Error ? e.message : String(e))).join('; ')}`);
}

export function inicioDoDiaSP(agora: Date): Date {
  const data = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
  return new Date(`${data}T00:00:00-03:00`);
}

export function montarResumo(r: { abertosPorSetor: { setor: string; total: number }[]; concluidosHoje: number; semResponsavel: number }): string {
  const setores = r.abertosPorSetor.length ? r.abertosPorSetor.map((s) => `• ${s.setor}: ${s.total}`).join('\n') : '• nenhum';
  return `📋 Resumo do dia\nConcluídos hoje: ${r.concluidosHoje}\nSem responsável: ${r.semResponsavel}\nAbertos por setor:\n${setores}`;
}

export async function resumoDiario(d: DepsTarefas): Promise<void> {
  const cfg = await d.repos.obterConfiguracoes();
  const texto = montarResumo(await d.repos.resumoDoDia(inicioDoDiaSP(d.relogio())));
  if (cfg.telefoneDono) {
    const conversa = await d.repos.obterOuCriarConversa(cfg.telefoneDono, null);
    await enviarDoSistema(d.envio, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'sistema', texto })
      .catch((e) => console.error('[resumo whatsapp]', e));
  }
  if (cfg.emailAlertas) await d.email.enviar(cfg.emailAlertas, 'Resumo do dia', texto);
}

/** Todo dia de manhã: certificado perto de vencer vira demanda no Fiscal (spec 7D.1, D21). O dia é o de São Paulo. */
export async function demandasDeCertificado(d: Pick<DepsTarefas, 'repos' | 'relogio'>): Promise<number> {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d.relogio());
  return d.repos.gerarDemandasCertificado(hoje);
}
