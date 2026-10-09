import { MOTIVOS_PASSAGEM } from '@escritorio/core';
import type { Repos } from '@escritorio/db';
import type { Alertas } from './alertas';
import type { CanalWhatsApp } from './canal/tipos';
import type { Email } from './email';
import { enviarDoSistema, type DepsEnvio } from './envio';
import {
  FILAS, TRAVA_VEZ_SEGUNDOS, agendarAssistente, agendarAviso, agendarPedidoPendencia, agendarProcessamento, agendarTarefa, naVez, type Fila,
} from './fila';
import { conferirAlertaIa80, passarAEquipeSemResposta } from './processar-conversa';

export type DepsTarefas = { repos: Repos; canal: CanalWhatsApp; alertas: Alertas; envio: DepsEnvio; email: Email; fila: Fila; relogio: () => Date };

export const MSG_WHATSAPP_DESCONECTADO =
  'O WhatsApp do escritório está desconectado. Abra o painel da Z-API e leia o QR code de novo com o celular do escritório.';

/**
 * Auditoria 4.7: cada recuperação no seu try (a falha de uma não pula as outras, as mensagens paradas nem o WhatsApp) e o
 * sinal "fila" gravado no fim, depois delas. O erro das recuperações volta no fim e o job consta como falho.
 */
export async function batimento(d: DepsTarefas): Promise<void> {
  const erros: unknown[] = [];
  const passo = async (nome: string, f: () => Promise<unknown>) => {
    try {
      await f();
    } catch (e) {
      console.error(`[batimento] ${nome}`, e);
      erros.push(e);
    }
  };
  // Resposta do painel que não entrou na fila (ex.: falha ao enfileirar) é reenfileirada.
  await passo('respostas do painel', async () => {
    for (const mensagemId of await d.repos.respostasPendentesAntigas(2)) {
      await d.fila.enviar(FILAS.enviarMensagem, { mensagemId }, { singletonKey: mensagemId });
    }
  });
  // Pergunta ao assistente sem resposta há mais de 2 minutos (o job não entrou ou se perdeu) volta para a fila.
  await passo('assistente', async () => {
    for (const p of await d.repos.perguntasAssistenteParadas(2)) {
      await agendarAssistente(d.fila, { usuarioId: p.usuarioId, canal: p.canal, conversaId: p.conversaId, telefone: p.canal === 'whatsapp' ? p.telefone : null });
    }
  });
  // Parte I3a (D8): tarefa "trabalhando" sem vez em andamento há 2 minutos (o job não entrou ou se perdeu) volta para a fila.
  await passo('tarefas', async () => { for (const tarefaId of await d.repos.tarefasParadas(2)) await agendarTarefa(d.fila, tarefaId); });
  // Parte I3a (F5): pedido ao cliente aprovado que não saiu (job perdido, tentativas esgotadas, queda entre reservar e marcar) volta para a fila;
  // o banco solta antes as reservas de mais de 10 min sem mensagem.
  await passo('pedidos ao cliente', async () => {
    for (const pendenciaId of await d.repos.pedidosAoClienteParados(2)) await agendarPedidoPendencia(d.fila, pendenciaId, 'batimento');
  });
  // Parte I4 (D9): aviso que não saiu (fila perdida, fora do horário) volta para a fila.
  await passo('avisos de tarefa', async () => { for (const avisoId of await d.repos.avisosTarefaParados()) await agendarAviso(d.fila, avisoId); });
  // Revisão da Task 9: mensagem incerta sem eco há 10 min avisa a equipe (uma vez); falha aqui não derruba o batimento.
  await avisarIncertosAntigos(d).catch((e) => console.error('[incerto] aviso de mensagens não confirmadas', e));
  // Revisão geral C1: mensagem de cliente parada; uma falha aqui não derruba o resto do batimento (o WhatsApp abaixo).
  await mensagensParadas(d).catch((e) => console.error('[parada] mensagens paradas', e));
  await passo('sinal fila', () => d.repos.registrarSinalVida('fila'));
  await passo('whatsapp', () => conferirWhatsApp(d));
  if (erros.length === 1) throw erros[0];
  if (erros.length > 1) throw new Error(`Batimento: ${erros.map((e) => (e instanceof Error ? e.message : String(e))).join('; ')}`);
}

async function conferirWhatsApp(d: DepsTarefas): Promise<void> {
  const conectado = await d.canal.status().then((s) => s.conectado).catch(() => false);
  if (conectado) {
    await d.repos.registrarSinalVida('whatsapp');
    return;
  }
  if (!(await d.repos.alertaRecente(MSG_WHATSAPP_DESCONECTADO, 30))) {
    await d.alertas.alertar({ nivel: 'critico', mensagem: MSG_WHATSAPP_DESCONECTADO });
  }
}

/**
 * Auditoria 4.13: mensagem de cliente sem resposta há mais de 24 h (fora das conversas com pessoa) sai do batimento; o dono
 * recebe, uma vez por dia (dia de São Paulo, marca no banco), a quantidade. Sem telefone no texto.
 */
export async function alertaEntradasEsquecidas(d: Pick<DepsTarefas, 'repos' | 'alertas' | 'relogio'>): Promise<number> {
  const { entradasEsquecidas: n } = await d.repos.indicadoresSaude();
  if (n === 0) return 0;
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d.relogio());
  if (!(await d.repos.marcarAvisoUnico(`entradas-esquecidas:${dia}`))) return n;
  const quantas = n === 1 ? '1 mensagem de cliente está' : `${n} mensagens de cliente estão`;
  await d.alertas.alertar({ nivel: 'operacional',
    mensagem: `${quantas} sem resposta há mais de 24 h. Abra o Atendimento e assuma essas conversas.` });
  return n;
}

/**
 * Revisão da Task 9 (auditoria 3.2): mensagem do agente ou do sistema "incerto" (a Z-API pode ter entregado) que nenhum
 * eco confirmou em 10 min: a equipe confere no WhatsApp. Uma vez por mensagem (marca no banco); só os 4 últimos dígitos.
 */
export async function avisarIncertosAntigos(d: Pick<DepsTarefas, 'repos' | 'alertas'>): Promise<void> {
  for (const c of await d.repos.marcarIncertosAntigos()) {
    await d.alertas.alertar({ nivel: 'aviso', mensagem: `Mensagem para …${c.telefone.slice(-4)} não confirmada há 10 min; confira no WhatsApp` });
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
// Auditoria 4.12: o alerta de 80% do mês também roda aqui, para o gasto fora do atendimento (assistente, tarefas, Radar, sugestão).
// Auditoria 4.13: e o das mensagens esquecidas há mais de 24 h (uma vez por dia).
export async function alertasPeriodicos(
  d: DepsTarefas, tarefas: ((d: DepsTarefas) => Promise<unknown>)[] = [alertaFila, alertaVencimento, conferirAlertaIa80, alertaEntradasEsquecidas],
): Promise<void> {
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
  // Revisão geral M1: e-mail fora não derruba o job (a nova tentativa mandaria o WhatsApp ao dono de novo).
  if (cfg.emailAlertas) await d.email.enviar(cfg.emailAlertas, 'Resumo do dia', texto).catch((e) => console.error('[resumo e-mail]', e));
}

/** Todo dia de manhã: certificado perto de vencer vira demanda no Fiscal (spec 7D.1, D21). O dia é o de São Paulo. */
export async function demandasDeCertificado(d: Pick<DepsTarefas, 'repos' | 'relogio'>): Promise<number> {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d.relogio());
  return d.repos.gerarDemandasCertificado(hoje);
}

/** Revisão geral C1: a mensagem parada volta à fila no máximo 2 vezes (3 min entre elas); 5 min depois da última, vai à equipe. */
export const PARADA = { deMin: 3, ateMin: 24 * 60, maxDevolucoes: 2, entreDevolucoesMin: 3, antesDaEquipeMin: 5 } as const;

/**
 * Revisão geral C1: mensagem de cliente que ninguém processou (enfileirar falhou no webhook, reentrega duplicada, tentativas da
 * fila esgotadas antes do agente). Primeiro tenta de novo; sem sucesso, a conversa vai para a equipe. Conversa com a vez em
 * andamento, com a equipe ou com mensagem de mais de 24 h fica de fora (conversas_com_mensagem_parada).
 */
export async function mensagensParadas(d: DepsTarefas): Promise<{ devolvidas: number; aEquipe: number }> {
  let devolvidas = 0;
  let aEquipe = 0;
  for (const p of await d.repos.conversasComMensagemParada(PARADA.deMin, PARADA.ateMin)) {
    const desdeUltima = p.ultimoReenvio ? Date.now() - new Date(p.ultimoReenvio).getTime() : Number.POSITIVE_INFINITY;
    try {
      if (p.reenvios < PARADA.maxDevolucoes) {
        if (desdeUltima < PARADA.entreDevolucoesMin * 60_000) continue;
        await agendarProcessamento(d.fila, p.conversaId);
        await d.repos.marcarReenfileirada(p.conversaId);
        devolvidas++;
        continue;
      }
      if (desdeUltima < PARADA.antesDaEquipeMin * 60_000) continue;
      // Auditoria 4.10: dentro da vez da conversa (a mesma trava do agente). Uma vez começou depois da consulta: pula; ela
      // atende as mensagens, e a próxima batida confere de novo.
      const r = await naVez(d.repos, `conversa:${p.conversaId}`, TRAVA_VEZ_SEGUNDOS,
        () => passarAEquipeSemResposta(d, p.conversaId, 'Mensagem do cliente sem resposta do agente', MOTIVOS_PASSAGEM.semResposta), async () => {});
      if (r !== 'escalado') continue;
      aEquipe++;
      const c = await d.repos.obterConversa(p.conversaId);
      await d.alertas.alertar({ nivel: 'aviso', mensagem: `A mensagem de ${c.telefone} ficou sem resposta do agente e passou para a equipe (Triagem).` })
        .catch((e) => console.error('[parada] alerta não registrado', p.conversaId, e));
    } catch (e) {
      // Uma conversa com problema não para as outras; ela volta na próxima batida.
      console.error('[parada] conversa não tratada', p.conversaId, e);
    }
  }
  return { devolvidas, aEquipe };
}
