import { estaNoExpediente } from '@escritorio/core';
import type { Configuracoes, ContatoEncontrado, Conversa, EmpresaDoContato, OrientacaoAgente, Repos } from '@escritorio/db';

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
};

export async function carregarContexto(
  repos: Repos, conversa: Conversa, contato: ContatoEncontrado | null, config: Configuracoes, agora: Date,
): Promise<ContextoAgente> {
  const empresas = contato?.empresas ?? [];
  let empresaEmFoco = empresas.find((e) => e.id === conversa.cliente_em_foco) ?? null;
  if (!empresaEmFoco && empresas.length === 1) {
    empresaEmFoco = empresas[0]!;
    await repos.atualizarConversa(conversa.id, { cliente_em_foco: empresaEmFoco.id });
  }
  return {
    conversa,
    contato,
    empresaEmFoco,
    setores: await repos.setoresAtivos(),
    respostasProntas: await repos.respostasProntas(),
    orientacoes: await repos.orientacoesAtivas(),
    servicosContratados: empresaEmFoco ? await repos.servicosDoCliente(empresaEmFoco.id) : [],
    noExpediente: estaNoExpediente(agora, config.expediente),
    config,
    agora,
  };
}
