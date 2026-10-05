import type { Mensagem, Repos } from '@escritorio/db';
import type { ContextoAgente } from '../../src/agente/contexto';
import { executarAgente } from '../../src/agente/executar';
import type { ExecutorFerramentas } from '../../src/agente/ferramentas';
import { montarConteudoUsuario } from '../../src/agente/prompt';
import { IaRoteirizada, fim, usarFerramentas } from './ia-roteirizada';

// Parte I1 (D2): dados fixos — o retrato não pode depender do banco, do relógio nem de ids gerados.
const AGORA = new Date('2026-09-28T13:00:00Z');
const FISCAL = { id: '10000000-0000-4000-8000-000000000001', nome: 'Fiscal', descricao_assuntos: 'Notas fiscais, guias de impostos (DAS, DARF)' };
const PESSOAL = { id: '10000000-0000-4000-8000-000000000002', nome: 'Pessoal', descricao_assuntos: 'Folha de pagamento, férias, admissão' };
const DIRECAO = { id: '10000000-0000-4000-8000-000000000003', nome: 'Direção', descricao_assuntos: 'Reclamação séria, assunto sensível' };
const SOL = { id: '20000000-0000-4000-8000-000000000001', nome: 'Padaria Sol ME', podePedirNota: true, agentePausado: false };
const REDE = { id: '20000000-0000-4000-8000-000000000002', nome: 'Rede Bom Preço', podePedirNota: false, agentePausado: false };
const CONVERSA = {
  id: '30000000-0000-4000-8000-000000000001', telefone: '5531999990001', contato_id: '40000000-0000-4000-8000-000000000001',
  cliente_em_foco: SOL.id, estado: 'agente', atendente_id: null, aviso_lgpd_enviado_em: '2026-09-01T12:00:00Z', tentativas_nao_entendido: 0,
  criado_em: '2026-09-01T12:00:00Z', atualizado_em: '2026-09-01T12:00:00Z', aguardando_pessoa_desde: null, motivo_pessoa: null, concluida_em: null,
} as unknown as ContextoAgente['conversa'];
const CONFIG = {
  modeloConversa: 'claude-sonnet-5', precosModelos: {}, mensagens: {}, agentePausado: false, tetoIaUsd: 1000,
} as unknown as ContextoAgente['config'];

const orientacao = (id: string, extra: object) => ({
  id, titulo: `Título ${id}`, texto: `Texto ${id}.`, tipo: 'jeito' as const, clienteId: null, setorId: null, setorNome: null,
  atualizadoEm: new Date('2026-09-01T12:00:00Z'), ...extra,
});

function contexto(parcial: Partial<ContextoAgente>): ContextoAgente {
  return {
    conversa: CONVERSA, contato: { id: CONVERSA.contato_id!, nome: 'João', agentePausado: false, empresas: [SOL] }, empresaEmFoco: SOL,
    setores: [FISCAL, PESSOAL], respostasProntas: [], orientacoes: [], servicosContratados: ['Contabilidade completa'],
    noExpediente: true, config: CONFIG, agora: AGORA, ...parcial,
  };
}

/** Os quatro jeitos de o Thiago montar o pedido: empresa única, orientações dos três tipos, número desconhecido e Direção. */
export const CASOS_RETRATO: Record<string, () => ContextoAgente> = {
  'contato-uma-empresa': () => contexto({}),
  'orientacoes-geral-setor-empresa': () => contexto({
    respostasProntas: [{ pergunta: 'Qual o horário?', resposta: 'Das 8h às 18h.' }],
    orientacoes: [
      orientacao('G1', { titulo: 'Cumprimento', texto: 'Chame o cliente pelo primeiro nome.' }),
      orientacao('F1', { tipo: 'regra', setorId: FISCAL.id, setorNome: 'Fiscal', titulo: 'Notas', texto: 'Notas até as 16h.' }),
      orientacao('S1', { tipo: 'situacao', clienteId: SOL.id, titulo: 'Entrega', texto: 'A Padaria Sol entrega às terças.\nSó de manhã.' }),
      orientacao('R1', { clienteId: REDE.id, titulo: 'Outra empresa', texto: 'Não pode aparecer aqui.' }),
    ],
  }),
  'numero-desconhecido': () => contexto({
    conversa: { ...CONVERSA, contato_id: null, cliente_em_foco: null }, contato: null, empresaEmFoco: null, servicosContratados: [],
    noExpediente: false,
  }),
  'duas-empresas-com-direcao': () => contexto({
    contato: { id: CONVERSA.contato_id!, nome: 'João', agentePausado: false, empresas: [SOL, REDE] }, empresaEmFoco: null,
    setores: [FISCAL, PESSOAL, DIRECAO], servicosContratados: [],
  }),
};

const msg = (autor: string, conteudo: string, criado_em: string) =>
  ({ autor, conteudo, criado_em, tipo: 'texto', transcricao: null, arquivo_nome: null }) as unknown as Mensagem;
const HISTORICO = [msg('cliente', 'Bom dia', '2026-09-27T12:00:00Z'), msg('agente', 'Bom dia, João!', '2026-09-27T12:00:30Z')];
const NOVAS = [msg('cliente', 'Preciso da guia do DAS de setembro', '2026-09-28T12:59:00Z')];

/** O primeiro pedido que o agente manda à IA, como sai para a API (JSON com as chaves na ordem em que o código monta). */
export async function retratoDoPedido(ctx: ContextoAgente): Promise<string> {
  const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
  const repos = {
    registrarUsoIa: async () => {}, registrarDecisao: async () => {}, ultimasOrientacoesCortadas: async () => null,
    obterConversa: async () => ctx.conversa,
  } as unknown as Repos;
  // Sem banco: a ferramenta só marca que respondeu.
  const executor: ExecutorFerramentas = async (_d, estado) => { estado.respondeu = true; return { resultado: '{"enviado":true}', erro: false }; };
  await executarAgente({ repos, ia, envio: {} as never }, ctx, montarConteudoUsuario(ctx, HISTORICO, NOVAS, []), executor);
  return `${JSON.stringify(ia.recebidos[0], null, 2)}\n`;
}
