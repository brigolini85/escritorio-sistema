import { CONDUCAO_EXPIRA_HORAS, SLUG_ATENDIMENTO, empresaDoUso, estaNoExpediente, type AcessoContato } from '@escritorio/core';
import type { AgenteSetor, Configuracoes, ContatoEncontrado, Conversa, EmpresaDoContato, OrientacaoAgente, PerfilAgente, Repos } from '@escritorio/db';
import { carregarAgentesSetor, carregarPerfil } from './perfil';

export type ContextoAgente = {
  conversa: Conversa;
  contato: ContatoEncontrado | null;
  empresaEmFoco: EmpresaDoContato | null;
  setores: { id: string; nome: string; descricao_assuntos: string }[];
  respostasProntas: { pergunta: string; resposta: string }[];
  /** Todas as orientações ligadas (Treinar o agente); o prompt escolhe a cada rodada as que valem para a empresa em foco. */
  orientacoes: OrientacaoAgente[];
  servicosContratados: string[];
  noExpediente: boolean;
  config: Configuracoes;
  agora: Date;
  /** Simulação (Treinar o agente): acesso fixo, sem ler o banco (o contato fictício não existe, D9). */
  acessoFixo?: AcessoContato;
  /** Perfil do agente no motor (Parte I1). Sem ele, o Thiago do código (o pedido de antes). */
  agente?: PerfilAgente;
  /** Parte I2: agentes dos setores ativos para este contato (D2). Vazio ou ausente: o Thiago de sempre. */
  agentesSetor?: AgenteSetor[];
  /** Parte I2 (D6): o agente que está conduzindo esta conversa ("Passa a conversa"), se ainda vale. */
  conducao?: AgenteSetor | null;
};

export async function carregarContexto(
  repos: Repos, conversa: Conversa, contato: ContatoEncontrado | null, config: Configuracoes, agora: Date,
): Promise<ContextoAgente> {
  const empresas = contato?.empresas ?? [];
  // A mesma regra da empresa do gasto (empresaDoUso): foco do contato, senão a única empresa, senão nenhuma.
  const idEmFoco = empresaDoUso(conversa.cliente_em_foco, empresas);
  const empresaEmFoco = empresas.find((e) => e.id === idEmFoco) ?? null;
  if (empresaEmFoco && empresaEmFoco.id !== conversa.cliente_em_foco) {
    await repos.atualizarConversa(conversa.id, { cliente_em_foco: empresaEmFoco.id });
  }
  const agente = await carregarPerfil(repos, SLUG_ATENDIMENTO);
  // Parte I2 (D2): só contato com empresa tem agente do setor; número desconhecido fica com o Thiago.
  // F9: erro ao ler os agentes não para o atendimento; o Thiago atende sozinho (sem agentes, sem condução).
  let agentesSetor: AgenteSetor[] = [];
  let lidos = true;
  try {
    agentesSetor = contato && empresas.length ? await carregarAgentesSetor(repos, contato.id) : [];
  } catch (erro) {
    lidos = false;
    console.error('[motor] agentes dos setores não lidos; só o Thiago atende', conversa.id, erro);
  }
  const conducao = lidos ? await conducaoQueVale(repos, conversa, agentesSetor, agora) : null;
  return {
    conversa,
    contato,
    empresaEmFoco,
    setores: await repos.setoresAtivos(),
    respostasProntas: await repos.respostasProntas(),
    orientacoes: await repos.orientacoesAtivas(agente.id),
    servicosContratados: empresaEmFoco ? await repos.servicosDoCliente(empresaEmFoco.id) : [],
    noExpediente: estaNoExpediente(agora, config.expediente),
    config,
    agora,
    agente,
    agentesSetor,
    conducao,
  };
}

/** A condução vale se o agente ainda atende o contato e a passagem tem menos de 24 h; senão, volta ao Thiago com o motivo (D6). */
async function conducaoQueVale(repos: Repos, conversa: Conversa, agentes: AgenteSetor[], agora: Date): Promise<AgenteSetor | null> {
  if (!conversa.agente_conduzindo_id) return null;
  const a = agentes.find((x) => x.id === conversa.agente_conduzindo_id);
  const desde = conversa.conduzindo_desde ? new Date(conversa.conduzindo_desde).getTime() : 0;
  if (a && agora.getTime() - desde < CONDUCAO_EXPIRA_HORAS * 3600_000) return a;
  try {
    await repos.encerrarConducao(conversa.id, a ? `passaram ${CONDUCAO_EXPIRA_HORAS} horas` : 'o agente não atende mais este contato');
  } catch (erro) {
    // F9: sem conseguir encerrar, segue sem condução nesta vez (a próxima mensagem tenta de novo).
    console.error('[motor] condução não encerrada; o Thiago atende', conversa.id, erro);
  }
  return null;
}
