import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { escolherResponsavel, formatarMensagem } from '@escritorio/core';
import type { Repos } from '@escritorio/db';
import { enviarDoSistema, type DepsEnvio } from '../envio';
import type { ClienteIa } from './cliente-ia';
import type { ContextoAgente } from './contexto';

export type DepsAgente = { repos: Repos; envio: DepsEnvio; ia: ClienteIa };
export type EstadoExecucao = { ctx: ContextoAgente; respondeu: boolean };

const TRIAGEM = 'triagem';
const objeto = (properties: Record<string, object>, required: string[]) =>
  ({ type: 'object' as const, properties, required, additionalProperties: false });

export const FERRAMENTAS: Anthropic.Tool[] = [
  {
    name: 'selecionar_empresa',
    description: 'Registra de qual empresa o contato está falando. Use apenas ids da lista "Empresas do contato".',
    input_schema: objeto({ cliente_id: { type: 'string' } }, ['cliente_id']),
  },
  {
    name: 'abrir_chamado',
    description: 'Abre um chamado para a equipe do escritório. setor_id é o id de um setor da lista, ou "triagem" para o administrador decidir.',
    input_schema: objeto({
      setor_id: { type: 'string' },
      titulo: { type: 'string', description: 'Título curto, por exemplo "Guia DAS de setembro".' },
      resumo: { type: 'string', description: 'O que o cliente pediu, com todos os detalhes informados.' },
      fora_do_contrato: { type: 'boolean' },
    }, ['setor_id', 'titulo', 'resumo', 'fora_do_contrato']),
  },
  {
    name: 'consultar_chamados',
    description: 'Lista os chamados em aberto da empresa em foco, para informar o andamento ao cliente.',
    input_schema: objeto({}, []),
  },
  {
    name: 'sinalizar_nao_entendido',
    description: 'Use quando não conseguir entender o que o cliente quer.',
    input_schema: objeto({}, []),
  },
  {
    name: 'responder',
    description: 'Envia uma mensagem de texto ao cliente no WhatsApp.',
    input_schema: objeto({ texto: { type: 'string' } }, ['texto']),
  },
];

const Entradas = {
  selecionar_empresa: z.object({ cliente_id: z.string() }),
  abrir_chamado: z.object({ setor_id: z.string(), titulo: z.string().min(3).max(120), resumo: z.string().min(1).max(4000), fora_do_contrato: z.boolean() }),
  consultar_chamados: z.object({}),
  sinalizar_nao_entendido: z.object({}),
  responder: z.object({ texto: z.string().min(1).max(4000) }),
};

type Resultado = { resultado: string; erro: boolean };
const ok = (dados: object): Resultado => ({ resultado: JSON.stringify(dados), erro: false });
const falha = (mensagem: string): Resultado => ({ resultado: JSON.stringify({ erro: mensagem }), erro: true });

function empresaDefinida(estado: EstadoExecucao): Resultado | null {
  const empresas = estado.ctx.contato?.empresas ?? [];
  if (empresas.length > 1 && !estado.ctx.empresaEmFoco) {
    return falha('O contato fala por mais de uma empresa. Pergunte de qual empresa se trata e use selecionar_empresa antes.');
  }
  return null;
}

async function executarValidada(d: DepsAgente, estado: EstadoExecucao, nome: keyof typeof Entradas, entrada: any): Promise<Resultado> {
  const { ctx } = estado;
  switch (nome) {
    case 'selecionar_empresa': {
      const empresa = ctx.contato?.empresas.find((e) => e.id === entrada.cliente_id);
      if (!empresa) return falha('Essa empresa não está ligada a este contato. Não informe nada sobre ela.');
      await d.repos.atualizarConversa(ctx.conversa.id, { cliente_em_foco: empresa.id });
      ctx.empresaEmFoco = empresa;
      ctx.servicosContratados = await d.repos.servicosDoCliente(empresa.id);
      return ok({ empresa: empresa.nome, servicos_contratados: ctx.servicosContratados });
    }

    case 'abrir_chamado': {
      const desconhecido = !ctx.contato || ctx.contato.empresas.length === 0;
      if (!desconhecido) {
        const bloqueio = empresaDefinida(estado);
        if (bloqueio) return bloqueio;
      }
      let setorId: string | null = null;
      if (!desconhecido && entrada.setor_id !== TRIAGEM) {
        const setor = ctx.setores.find((s) => s.id === entrada.setor_id);
        if (!setor) return falha('setor_id inválido. Use um id da lista de SETORES ou "triagem".');
        setorId = setor.id;
      }
      const clienteId = desconhecido ? null : ctx.empresaEmFoco?.id ?? null;
      const responsavelId = clienteId ? escolherResponsavel(setorId, await d.repos.responsaveisDoCliente(clienteId)) : null;
      const { numero } = await d.repos.abrirChamado({
        clienteId, conversaId: ctx.conversa.id, setorId, responsavelId,
        titulo: entrada.titulo, resumo: entrada.resumo, foraDoContrato: entrada.fora_do_contrato, origem: 'agente',
      });
      await d.repos.atualizarConversa(ctx.conversa.id, { tentativas_nao_entendido: 0 });
      const setorNome = ctx.setores.find((s) => s.id === setorId)?.nome ?? 'Triagem';
      const aviso = ctx.noExpediente ? null : formatarMensagem(ctx.config.mensagens.fora_do_horario ?? '', ctx.config.expediente as never);
      return ok({ numero, setor: setorNome, fora_do_horario: !ctx.noExpediente, aviso_para_o_cliente: aviso });
    }

    case 'consultar_chamados': {
      const bloqueio = empresaDefinida(estado);
      if (bloqueio) return bloqueio;
      if (!ctx.empresaEmFoco) return ok({ chamados: [] });
      const chamados = await d.repos.chamadosAbertosDoCliente(ctx.empresaEmFoco.id);
      return ok({ chamados: chamados.map((c) => ({ numero: c.numero, titulo: c.titulo, status: c.status, setor: c.setor_nome ?? 'Triagem' })) });
    }

    case 'sinalizar_nao_entendido': {
      const atual = await d.repos.obterConversa(ctx.conversa.id);
      const tentativas = atual.tentativas_nao_entendido + 1;
      if (tentativas >= 2) {
        await d.repos.abrirChamado({
          clienteId: ctx.empresaEmFoco?.id ?? null, conversaId: ctx.conversa.id, setorId: null, responsavelId: null,
          titulo: 'Mensagem não compreendida pelo agente', resumo: 'O agente não entendeu o pedido duas vezes seguidas.',
          foraDoContrato: false, origem: 'agente',
        });
        await d.repos.atualizarConversa(ctx.conversa.id, { tentativas_nao_entendido: 0 });
        return ok({ instrucao: 'Diga ao cliente que uma pessoa da equipe vai continuar o atendimento.' });
      }
      await d.repos.atualizarConversa(ctx.conversa.id, { tentativas_nao_entendido: tentativas });
      return ok({ instrucao: 'Peça gentilmente para o cliente explicar de outra forma.' });
    }

    case 'responder': {
      const atual = await d.repos.obterConversa(ctx.conversa.id);
      if (atual.estado === 'humano') return falha('Um atendente assumiu esta conversa. Não envie nada.');
      await enviarDoSistema(d.envio, {
        conversaId: ctx.conversa.id, telefone: ctx.conversa.telefone, clienteId: ctx.empresaEmFoco?.id ?? null,
        autor: 'agente', texto: entrada.texto,
      });
      estado.respondeu = true;
      return ok({ enviado: true });
    }
  }
}

export async function executarFerramenta(d: DepsAgente, estado: EstadoExecucao, nome: string, entrada: unknown): Promise<Resultado> {
  let r: Resultado;
  if (!(nome in Entradas)) {
    r = falha(`Ferramenta desconhecida: ${nome}`);
  } else {
    const validada = Entradas[nome as keyof typeof Entradas].safeParse(entrada);
    r = validada.success
      ? await executarValidada(d, estado, nome as keyof typeof Entradas, validada.data)
      : falha(`Entrada inválida: ${validada.error.issues.map((i) => i.message).join('; ')}`);
  }
  await d.repos.registrarDecisao({
    conversaId: estado.ctx.conversa.id, clienteId: estado.ctx.empresaEmFoco?.id ?? null,
    etapa: nome, entrada, saida: JSON.parse(r.resultado),
  });
  return r;
}
