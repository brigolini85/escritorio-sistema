import { SLUG_ATENDIMENTO, empresaDoUso, estaNoExpediente, type AcessoContato } from '@escritorio/core';
import type { Configuracoes, ContatoEncontrado, Conversa, EmpresaDoContato, OrientacaoAgente, PerfilAgente, Repos } from '@escritorio/db';
import { carregarPerfil } from './perfil';

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
  };
}
