import { escolherResponsavel, FUSO_HORARIO, ROTULO_PERFIL, setorComArtigo, type AcessoContato } from '@escritorio/core';
import { enviarDoSistema } from '../envio';
import { INSTRUCAO_FORA_DO_ACESSO, TEXTO_FORA_DO_ACESSO } from './acesso';
import type { DepsAgente, EstadoExecucao } from './ferramentas';

/**
 * Pedido fora do acesso (spec 7D.2, D13–D15): a resposta ao cliente é fixa e sai daqui, não do modelo; a equipe do setor
 * recebe uma demanda com a explicação; os contatos marcados para alertas de acesso são avisados. Um por contato,
 * empresa, setor e dia de São Paulo.
 */
export type PedidoForaDoAcesso = {
  clienteId: string; setor: { id: string; nome: string }; titulo: string; resumo: string; acesso: AcessoContato; motivo: 'setor' | 'valores';
};

export const diaEmSaoPaulo = (agora: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_HORARIO }).format(agora);
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

export const tituloForaDoAcesso = (titulo: string) => `Fora do acesso: ${titulo}`.slice(0, 120);

export function notaForaDoAcesso(p: { contato: string; perfil: string; empresa: string; motivo: 'setor' | 'valores'; avisados: string[]; falhas: string[] }): string {
  const porque = p.motivo === 'valores' ? 'não tem "Ver valores"' : 'não pode tratar deste setor';
  const quem = p.avisados.length || p.falhas.length
    ? (p.avisados.length ? `Avisados pelo WhatsApp: ${p.avisados.join(', ')}.` : '')
    : 'A empresa não tem ninguém marcado para receber alertas de acesso: só este setor sabe.';
  const falhou = p.falhas.length ? ` Aviso não enviado para: ${p.falhas.join(', ')}.` : '';
  return `${p.contato} (${p.perfil}) ${porque} na empresa ${p.empresa}. O agente respondeu "${TEXTO_FORA_DO_ACESSO}" e não informou nada. ${quem}${falhou} Confirme com o responsável da empresa antes de responder.`
    .replace(/\s{2,}/g, ' ');
}

/** O aviso ao sócio diz o setor, nunca o conteúdo do pedido (D14). */
export function avisoAoSocio(p: { socio: string; contato: string; setor: string; empresa: string; motivo: 'setor' | 'valores' }): string {
  const oQue = p.motivo === 'valores'
    ? `valores (honorários, boletos ou salários) da empresa ${p.empresa}, que não estão liberados`
    : `um assunto ${setorComArtigo(p.setor)} da empresa ${p.empresa}, que não está liberado`;
  return `Oi, ${primeiroNome(p.socio)}! Aqui é o Thiago, do atendimento do escritório. ${p.contato} pediu pelo WhatsApp ${oQue} para esse contato no escritório. Não passei nada. Se for para liberar, é só avisar a equipe por aqui.`;
}

export async function recusarForaDoAcesso(d: DepsAgente, estado: EstadoExecucao, p: PedidoForaDoAcesso): Promise<object> {
  const { ctx } = estado;
  const contato = ctx.contato!;
  const empresa = ctx.empresaEmFoco!.nome;
  const registro = await d.repos.registrarPedidoForaDoAcesso({ contatoId: contato.id, clienteId: p.clienteId, setorId: p.setor.id, dia: diaEmSaoPaulo(ctx.agora) });
  // Registro do dia sem demanda (a tentativa anterior caiu antes de concluir): cria agora, senão o setor nunca saberia.
  if (registro.novo || !registro.chamadoId) {
    const responsavelId = escolherResponsavel(p.setor.id, await d.repos.responsaveisDoCliente(p.clienteId));
    const { id: chamadoId, numero } = await d.repos.abrirChamado({
      clienteId: p.clienteId, conversaId: ctx.conversa.id, setorId: p.setor.id, responsavelId,
      titulo: tituloForaDoAcesso(p.titulo), resumo: p.resumo, foraDoContrato: false, origem: 'agente', prioridade: 'normal',
    });
    // Duas tentativas ao mesmo tempo: só quem liga a demanda ao registro avisa; a outra vira "Pediu de novo" e a repetida sai da fila.
    const vinculo = await d.repos.vincularPedidoForaDoAcesso(registro.id, chamadoId);
    if (!vinculo.vinculado) {
      if (vinculo.chamadoId) await d.repos.registrarNotaDoSistema(vinculo.chamadoId, p.clienteId, `Pediu de novo: ${p.resumo}`);
      await d.repos.concluirChamadoRepetido(chamadoId, p.clienteId, `Demanda repetida (#${numero}): o mesmo pedido fora do acesso já está em outra demanda deste dia.`);
      return responderForaDoAcesso(d, estado, p.clienteId);
    }
    // Quem pediu nunca recebe o próprio alerta, mesmo marcado (o banco já tira; aqui é a segunda trava).
    const socios = (await d.repos.sociosParaAlerta(p.clienteId, contato.id)).filter((s) => s.contatoId !== contato.id);
    const avisados: string[] = [];
    const falhas: string[] = [];
    for (const s of socios) {
      try {
        const conversa = await d.repos.obterOuCriarConversa(s.telefone, s.contatoId);
        await enviarDoSistema(d.envio, {
          conversaId: conversa.id, telefone: conversa.telefone, clienteId: p.clienteId, autor: 'sistema',
          texto: avisoAoSocio({ socio: s.nome, contato: contato.nome, setor: p.setor.nome, empresa, motivo: p.motivo }),
        });
        avisados.push(s.nome);
      } catch (e) {
        // O aviso é extra: a recusa ao cliente e a demanda do setor valem mesmo sem ele (D14).
        console.error('[acesso] aviso ao sócio não enviado', s.contatoId, e);
        falhas.push(s.nome);
      }
    }
    await d.repos.registrarNotaDoSistema(chamadoId, p.clienteId, notaForaDoAcesso({
      contato: contato.nome, perfil: ROTULO_PERFIL[p.acesso.perfil], empresa, motivo: p.motivo, avisados, falhas,
    }));
    await d.repos.concluirPedidoForaDoAcesso(registro.id, chamadoId, avisados.length);
  } else {
    await d.repos.registrarNotaDoSistema(registro.chamadoId, p.clienteId, `Pediu de novo: ${p.resumo}`);
  }
  return responderForaDoAcesso(d, estado, p.clienteId);
}

/** A resposta neutra ao cliente, uma vez por turno; conversa assumida por uma pessoa não recebe nada do agente. */
async function responderForaDoAcesso(d: DepsAgente, estado: EstadoExecucao, clienteId: string): Promise<object> {
  const { ctx } = estado;
  if (!estado.recusou) {
    const atual = await d.repos.obterConversa(ctx.conversa.id);
    if (atual.estado !== 'humano') {
      await enviarDoSistema(d.envio, {
        conversaId: ctx.conversa.id, telefone: ctx.conversa.telefone, clienteId, autor: 'agente', texto: TEXTO_FORA_DO_ACESSO,
        turnoAgente: estado.turno ?? null,
      });
      estado.respondeu = true;
    }
    estado.recusou = true;
  }
  return { fora_do_acesso: true, resposta_enviada: true, instrucao: INSTRUCAO_FORA_DO_ACESSO };
}
