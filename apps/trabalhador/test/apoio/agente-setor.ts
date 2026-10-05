import type { AgenteSetor, OrientacaoAgente, SkillCarregada } from '@escritorio/db';

export const skillTeste = (tipo: SkillCarregada['tipo'], nome: string, corpo: string): SkillCarregada =>
  ({ id: nome, nome, tipo, ativa: true, titulo: `Título ${nome}`, descricao: `Quando ${nome}.`, corpo, versao: 1, arquivos: [] });
export const orientacaoTeste = (titulo: string, texto: string): OrientacaoAgente =>
  ({ id: titulo, titulo, texto, tipo: 'regra', clienteId: null, setorId: null, setorNome: null, atualizadoEm: new Date('2026-09-01') });
/** Ferramentas de propósito com "só do Thiago" e responder: os testes provam que o motor as tira (D8). */
export const FISCAL: AgenteSetor = {
  id: 'f1500000-0000-4000-8000-000000000001', slug: 'fiscal', nome: 'Agente Fiscal', modelo: null, skillEmTeste: null,
  ferramentas: ['consultar_chamados', 'resumir_pedido_nota', 'abrir_pedido_nota', 'conferir_pedido_nota', 'nota_interna', 'abrir_chamado', 'responder'],
  skills: [], setorId: '10000000-0000-4000-8000-000000000001', setor: 'Fiscal', estado: 'ligado', modo: 'mesma_voz',
  regras: [{ id: 'r1', assunto: 'Pedido de nota de venda', exemplo: 'Preciso da nota do pedido 4512', modo: 'mesma_voz' },
    { id: 'r2', assunto: 'Dúvida sobre <imposto>', exemplo: '', modo: 'passa_conversa' }],
  orientacoes: [],
};
