import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { APROVACAO_FERRAMENTA, CATALOGO_COMPLETO, FERRAMENTAS_DO_CATALOGO, modoParaAssunto, type AcessoContato, type ModoContato } from '@escritorio/core';
import type { AgenteSetor } from '@escritorio/db';
import { ehBasico, trataSetor } from './acesso';
import type { PapelExecucao, ResultadoAgente } from './executar';
import { acessoNaEmpresa, exigirEmpresa, falha, ok, type DepsAgente, type EstadoExecucao, type Resultado } from './ferramentas';
import { recusarForaDoAcesso } from './fora-do-acesso';
import { limparTextoOrientacao } from './orientacoes';

/** Parte I2: o Thiago chama o agente do setor (D1–D7, D16). Os textos voltam ao modelo; nunca chegam ao cliente. */
export const AVISOS_AGENTE = {
  naoEncontrado: 'Esse agente não está na lista AGENTES DOS SETORES desta conversa. Siga você.',
  jaChamou: 'Você já chamou um agente nesta vez. Siga com o resultado dele.',
  basico: 'Este contato ainda não fala com os agentes dos setores. Siga como de costume. Não fale em permissão, acesso nem cadastro.',
  semAcesso: 'Este contato não trata deste setor nesta empresa. Devolva ao Thiago sem tratar do assunto.',
  porTrasNaoEnvia: 'No modo por trás você não fala com o cliente. Use devolver_resposta.',
  porTras: 'O agente do setor respondeu só para você. Responda ao cliente com suas palavras, como Thiago, sem dizer que consultou alguém. Se ele indicou algo para a equipe, abra a demanda no setor dele.',
  mesmaVoz: 'O agente do setor já respondeu ao cliente em seu nome. Não repita nem complemente o assunto; se a mensagem tiver outro assunto, trate só o outro.',
  passa: 'A conversa passou para o agente do setor, que já se apresentou e segue com o cliente. Não mande mais nada.',
  devolvido: 'O agente do setor devolveu o assunto para você. Siga você (responda ou abra a demanda); não chame o mesmo agente de novo nesta vez.',
  naoConseguiu: 'O agente do setor não conseguiu tratar. Siga você: responda ou abra a demanda no setor dele.',
  /** Revisão da Task 9: o agente já falou com o cliente e depois devolveu ou não conseguiu; o Thiago não manda outra mensagem (trava em despachar). */
  jaRespondeuDevolveu: 'O agente do setor já respondeu ao cliente e devolveu o assunto. Não mande mensagem ao cliente nesta vez; '
    + 'se ele indicou algo para a equipe, só abra a demanda no setor dele (abrir_chamado), sem responder.',
  /** Sobra da I2 (D24d): Passa a conversa deu certo; o agente já falou e segue com o cliente. */
  conduzindo: 'A conversa passou para o agente do setor, que já respondeu ao cliente. Não mande mensagem ao cliente nesta vez.',
  /** I3b (D1b): o Thiago pediu para enviar na mesma rodada em que o agente do setor já respondeu; ele escreveu sem ver a resposta do agente. */
  mesmaRodada: 'O agente do setor já respondeu ao cliente nesta mensagem, com o cumprimento. Não mande mais nada sobre isso nesta vez.',
  /** I3b (D1c): gravado na decisão quando a Mesma voz vira por trás porque o Thiago já tinha falado nesta vez. */
  rebaixado: 'o Thiago já tinha mandado mensagem nesta vez',
};

export const NOMES_MODO: ReadonlySet<string> = new Set(['devolver_resposta', 'devolver_ao_thiago']);
/** Não leem dado de cliente: não passam pela conferência do setor (D7). */
export const SEM_CONFERIR_ACESSO: ReadonlySet<string> = new Set(['ler_skill', 'ler_referencia', ...NOMES_MODO]);
/** Falam com o cliente ou dependem do "sim" dele: nunca no modo por trás (segunda trava, D4). */
export const ENVIAM: ReadonlySet<string> = new Set(FERRAMENTAS_DO_CATALOGO.filter((f) =>
  CATALOGO_COMPLETO[f].efeito === 'envia' || APROVACAO_FERRAMENTA[f] === 'cliente' || APROVACAO_FERRAMENTA[f] === 'conversa'));
/** Motivo gravado ao encerrar a condução quando o agente não chega a devolver (D6, F10). */
export const NAO_CONSEGUIU_SEGUIR = 'não conseguiu seguir';

const EntradaChamar = z.object({ agente: z.string().trim().min(1).max(40), assunto: z.string().trim().min(1).max(80), pedido: z.string().trim().min(1).max(1000) });
const EntradaDevolverResposta = z.object({ resposta_ao_cliente: z.string().trim().min(1).max(2000), para_a_equipe: z.string().trim().max(1000).nullish() });
const EntradaDevolverAoThiago = z.object({ motivo: z.string().trim().min(1).max(200) });

/** O que o cliente mandou nesta vez + o pedido do Thiago (texto do modelo neutralizado). */
export function conteudoParaAgente(conteudo: readonly Anthropic.ContentBlockParam[], assunto: string, pedido: string): Anthropic.ContentBlockParam[] {
  return [...conteudo, { type: 'text', text: `<pedido_do_thiago>\nAssunto: ${limparTextoOrientacao(assunto)}\nPedido: ${limparTextoOrientacao(pedido)}\n</pedido_do_thiago>` }];
}

export type RodarEspecialista = (papel: PapelExecucao, conteudo: Anthropic.ContentBlockParam[]) => Promise<ResultadoAgente>;

/** D7 (F14): a única conferência do contato com o setor de um agente nesta empresa. Básico nunca fala com os agentes dos setores. */
export type SituacaoNoSetor = 'ok' | 'basico' | 'sem';
export async function acessoAoSetor(
  d: DepsAgente, estado: EstadoExecucao, clienteId: string, setorId: string,
): Promise<{ situacao: SituacaoNoSetor; acesso: AcessoContato }> {
  const acesso = await acessoNaEmpresa(d, estado, clienteId);
  return { situacao: ehBasico(acesso) ? 'basico' : trataSetor(acesso, setorId) ? 'ok' : 'sem', acesso };
}

function resultadoParaThiago(a: AgenteSetor, modo: ModoContato, r: ResultadoAgente): object {
  const base = { agente: a.nome, modo };
  const jaRespondeu = r.respondeu ? { ja_respondeu_ao_cliente: true } : {};
  if (r.status === 'escalar') return { ...base, ...jaRespondeu, instrucao: r.respondeu ? AVISOS_AGENTE.jaRespondeuDevolveu : AVISOS_AGENTE.naoConseguiu };
  if (r.status === 'devolvido') {
    return { ...base, devolvido: true, motivo: r.motivo, ...jaRespondeu, instrucao: r.respondeu ? AVISOS_AGENTE.jaRespondeuDevolveu : AVISOS_AGENTE.devolvido };
  }
  if (modo === 'por_tras') {
    return { ...base, resposta_do_agente: r.devolucao?.respostaAoCliente ?? '', para_a_equipe: r.devolucao?.paraAEquipe ?? null, instrucao: AVISOS_AGENTE.porTras };
  }
  return { ...base, instrucao: modo === 'mesma_voz' ? AVISOS_AGENTE.mesmaVoz : AVISOS_AGENTE.passa };
}

/** chamar_agente (D1–D3, D7): confere a lista, a empresa e o acesso; o sistema escolhe o modo; roda o agente; devolve ao Thiago o que fazer. */
export async function chamarAgente(d: DepsAgente, estado: EstadoExecucao, entrada: unknown, rodar: RodarEspecialista): Promise<Resultado> {
  const { ctx } = estado;
  let saida: Resultado;
  let registro: Record<string, unknown> = {};
  const v = EntradaChamar.safeParse(entrada);
  const agente = v.success ? (ctx.agentesSetor ?? []).find((a) => a.slug === v.data.agente) : undefined;
  if (!v.success) saida = falha(`Entrada inválida: ${v.error.issues.map((i) => i.message).join('; ')}`);
  else if (estado.chamouAgente) saida = falha(AVISOS_AGENTE.jaChamou);
  else if (!agente) saida = falha(AVISOS_AGENTE.naoEncontrado);
  else {
    const e = exigirEmpresa(estado);
    if ('erro' in e) saida = e;
    else {
      const { situacao, acesso } = await acessoAoSetor(d, estado, e.clienteId, agente.setorId);
      if (situacao === 'basico') saida = ok({ instrucao: AVISOS_AGENTE.basico });
      else if (situacao === 'sem') {
        // A mesma recusa neutra da Parte H2 (D7): texto fixo ao cliente, demanda "Fora do acesso" no setor e aviso ao sócio.
        saida = ok(await recusarForaDoAcesso(d, estado, {
          clienteId: e.clienteId, setor: { id: agente.setorId, nome: agente.setor }, titulo: v.data.pedido.slice(0, 100), resumo: v.data.pedido, acesso, motivo: 'setor',
        }));
      } else {
        estado.chamouAgente = true;
        const { modo: modoDaRegra, regraId } = modoParaAssunto(agente.regras, v.data.assunto, agente.modo);
        // I3b (D1c): o Thiago já falou nesta vez; uma segunda voz "como Thiago" seria a mensagem repetida. O agente devolve e o Thiago repassa.
        const rebaixou = modoDaRegra === 'mesma_voz' && estado.respondeu;
        const modo: ModoContato = rebaixou ? 'por_tras' : modoDaRegra;
        registro = { agente_id: agente.id, regra_id: regraId, modo, ...(rebaixou ? { modo_da_regra: modoDaRegra, rebaixado: AVISOS_AGENTE.rebaixado } : {}) };
        if (modo === 'passa_conversa') await d.repos.iniciarConducao(ctx.conversa.id, agente.id);
        let r: ResultadoAgente;
        try {
          r = await rodar({ tipo: 'especialista', agente, modo }, conteudoParaAgente(estado.conteudo ?? [], v.data.assunto, v.data.pedido));
        } catch (erro) {
          // F10: sem isso a conversa ficaria 24 h "com o agente" sem ele ter se apresentado. O erro original segue.
          if (modo === 'passa_conversa') {
            await d.repos.encerrarConducao(ctx.conversa.id, NAO_CONSEGUIU_SEGUIR)
              .catch((e2) => console.error('[agente] condução não encerrada depois do erro', ctx.conversa.id, e2));
          }
          throw erro;
        }
        if (modo === 'passa_conversa' && r.status !== 'ok') {
          // Revisão final (como a D24a): falha ao encerrar não derruba a vez do Thiago depois que o agente já falou (refazer duplicaria).
          await d.repos.encerrarConducao(ctx.conversa.id, r.status === 'devolvido' ? r.motivo : NAO_CONSEGUIU_SEGUIR)
            .catch((e) => console.error('[agente] condução não encerrada; o Thiago segue', ctx.conversa.id, e));
        }
        if (r.respondeu) {
          estado.respondeu = true;
          // I3b (D1b): o que o Thiago pediu para enviar nesta mesma rodada foi escrito sem ver a resposta do agente.
          estado.agenteFalouNaRodada = true;
        }
        // Devolveu, não conseguiu, ou passou a conversa: o Thiago não manda outra mensagem nesta vez (no ok de Mesma voz ele ainda trata outro assunto).
        if (r.respondeu && (r.status !== 'ok' || modo === 'passa_conversa')) {
          estado.agenteRespondeu = true;
          if (r.status === 'ok') estado.avisoTrava = AVISOS_AGENTE.conduzindo;
        }
        saida = ok(resultadoParaThiago(agente, modo, r));
      }
    }
  }
  // Decisão do Thiago (sem agente_id, D11); agente, regra e modo vão na saída para o "uso no mês" das regras.
  await d.repos.registrarDecisao({
    conversaId: ctx.conversa.id, clienteId: ctx.empresaEmFoco?.id ?? null, etapa: 'chamar_agente', entrada,
    saida: { ...(JSON.parse(saida.resultado) as object), ...registro }, turno: estado.turno ?? null,
  });
  return saida;
}

/** devolver_resposta (por trás) e devolver_ao_thiago (mesma voz, passa a conversa): terminam a parte do agente do setor. */
export async function ferramentaDoModo(d: DepsAgente, estado: EstadoExecucao, nome: string, entrada: unknown): Promise<Resultado> {
  let r: Resultado;
  if (nome === 'devolver_resposta') {
    const v = EntradaDevolverResposta.safeParse(entrada);
    if (v.success) {
      estado.devolucao = { respostaAoCliente: v.data.resposta_ao_cliente, paraAEquipe: v.data.para_a_equipe || null };
      r = ok({ entregue: true });
    } else r = falha('Escreva em resposta_ao_cliente o que o Thiago deve passar ao cliente.');
  } else {
    const v = EntradaDevolverAoThiago.safeParse(entrada);
    if (v.success) { estado.devolvido = v.data.motivo; r = ok({ devolvido: true }); } else r = falha('Diga o motivo em poucas palavras.');
  }
  await d.repos.registrarDecisao({
    conversaId: estado.ctx.conversa.id, clienteId: estado.ctx.empresaEmFoco?.id ?? null, etapa: nome, entrada,
    saida: JSON.parse(r.resultado), turno: estado.turno ?? null, agenteId: estado.agenteSetor?.id ?? null,
  });
  return r;
}

/**
 * D7: antes da primeira ferramenta que lê dado de cliente, o contato precisa tratar do setor do agente nesta empresa.
 * Chamado por chamar_agente, o agente já começa conferido (F4); a conferência vale para quem roda sem ele (a condução).
 */
export async function conferirAcessoDoSetor(d: DepsAgente, estado: EstadoExecucao): Promise<Resultado | null> {
  const a = estado.agenteSetor;
  if (!a || estado.acessoSetorConferido) return null;
  const empresa = estado.ctx.empresaEmFoco;
  if (!empresa) return falha(AVISOS_AGENTE.semAcesso);
  const { situacao, acesso } = await acessoAoSetor(d, estado, empresa.id, a.setorId);
  if (situacao === 'ok') { estado.acessoSetorConferido = true; return null; }
  // Por trás nunca fala com o cliente, nem com a recusa neutra (F4): só a falha, e o Thiago segue.
  if (situacao === 'basico' || estado.modo === 'por_tras') return falha(AVISOS_AGENTE.semAcesso);
  return ok(await recusarForaDoAcesso(d, estado, {
    clienteId: empresa.id, setor: { id: a.setorId, nome: a.setor }, titulo: `Pedido ao ${a.setor}`,
    resumo: `Pedido tratado pelo ${a.nome} sem o setor no acesso do contato.`, acesso, motivo: 'setor',
  }));
}
