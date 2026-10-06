import type { Configuracoes, MensagemAssistente, Repos, UsuarioAssistente } from '@escritorio/db';
import type { ContextoAssistente } from '../../src/assistente/contexto';
import { executarAssistente } from '../../src/assistente/executar';
import { IaRoteirizada, fim, usarFerramentas } from './ia-roteirizada';

// Parte I4, Task 1 (D1): dados fixos — o retrato não depende do banco, do relógio nem de ids gerados.
const AGORA = new Date('2026-10-06T13:00:00Z');
const FISCAL = { id: '10000000-0000-4000-8000-000000000001', nome: 'Fiscal' };
const CONTABIL = { id: '10000000-0000-4000-8000-000000000002', nome: 'Contábil' };
const PESSOAL = { id: '10000000-0000-4000-8000-000000000003', nome: 'Pessoal' };
const CONFIG = { modeloConversa: 'claude-sonnet-5', precosModelos: {}, tetoIaUsd: 1000 } as unknown as Configuracoes;

type Niveis = UsuarioAssistente['niveis'];
const usuario = (p: Partial<Omit<UsuarioAssistente, 'niveis'>> & { niveis?: Record<string, string> }): UsuarioAssistente => ({
  id: '50000000-0000-4000-8000-000000000001', nome: 'Cláudia', papel: 'atendente', setores: [CONTABIL.id], telefone: '5531911110001', ativo: true,
  ...p,
  niveis: { atendimento: 'meus_setores', demandas: 'meu_setor', clientes: 'ver', precos: 'ver', notas: 'ver', assistente: 'site_whatsapp',
    treinar: 'nao', prazos: 'sim', configuracoes: 'nao', ...(p.niveis ?? {}) } as unknown as Niveis,
});
const msg = (papel: 'usuario' | 'assistente', conteudo: string, criado_em: string, pendente = false): MensagemAssistente =>
  ({ id: `${papel}-${criado_em}`, papel, conteudo, criado_em, processada_em: pendente ? null : criado_em }) as unknown as MensagemAssistente;
const contexto = (p: Partial<ContextoAssistente>): ContextoAssistente => ({
  usuario: usuario({}), canal: 'site', conversaId: null, agora: AGORA, config: CONFIG, setores: [FISCAL, CONTABIL, PESSOAL], conversa: null, ...p,
});

/** Os quatro jeitos de o Assistente montar o pedido: geral no painel, correção no WhatsApp, dentro de uma conversa e pergunta que cita um setor. */
export const CASOS_RETRATO_ASSISTENTE: Record<string, () => { ctx: ContextoAssistente; historico: MensagemAssistente[] }> = {
  'admin-site-geral': () => ({
    ctx: contexto({ usuario: usuario({ nome: 'Thiago', papel: 'admin', setores: [] }) }),
    historico: [msg('usuario', 'quais notas estão abertas?', '2026-10-06T12:59:00Z', true)],
  }),
  'atendente-whatsapp-corrige': () => ({
    ctx: contexto({ canal: 'whatsapp', usuario: usuario({ setores: [FISCAL.id, CONTABIL.id], niveis: { notas: 'corrigir' } }) }),
    historico: [
      msg('usuario', 'bom dia', '2026-10-06T12:00:00Z'), msg('assistente', 'Bom dia, Cláudia!', '2026-10-06T12:00:10Z'),
      msg('usuario', 'o pedido 12 era 15 PAC de costela, corrige e me manda o CSV', '2026-10-06T12:59:00Z', true),
    ],
  }),
  'site-com-conversa': () => ({
    ctx: contexto({
      conversaId: '30000000-0000-4000-8000-000000000001',
      conversa: { telefone: '5531999990001', contato: 'Ana', empresa: { id: '20000000-0000-4000-8000-000000000001', nome: 'Padaria Sol ME' },
        empresaIdentificadaId: '20000000-0000-4000-8000-000000000001',
        demandas: [{ numero: 21, titulo: 'Guia do DAS de setembro', status: 'aberto' }], mensagens: ['Cliente: preciso da guia do DAS'] },
    }),
    historico: [msg('usuario', 'qual o status da guia dela?', '2026-10-06T12:59:00Z', true)],
  }),
  'whatsapp-pergunta-com-setor': () => ({
    ctx: contexto({ canal: 'whatsapp' }),
    historico: [msg('usuario', 'quais demandas do contábil estão abertas?', '2026-10-06T12:59:00Z', true)],
  }),
};

/** O primeiro pedido que o Assistente manda à IA, como sai para a API (JSON com as chaves na ordem em que o código monta). */
export async function retratoDoAssistente(caso: { ctx: ContextoAssistente; historico: MensagemAssistente[] }): Promise<string> {
  const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
  const repos = { registrarUsoIa: async () => {}, registrarDecisao: async () => {} } as unknown as Repos;
  await executarAssistente({ repos, ia, canal: {} as never }, caso.ctx, caso.historico);
  return `${JSON.stringify(ia.recebidos[0], null, 2)}\n`;
}
