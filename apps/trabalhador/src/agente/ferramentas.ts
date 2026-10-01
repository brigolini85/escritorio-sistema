import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { escolherResponsavel, formatarMensagem } from '@escritorio/core';
import type { Repos, UnidadeParceiro } from '@escritorio/db';
import { enviarDocumentoDoSistema, enviarDoSistema, type DepsEnvio } from '../envio';
import { buscarParceiros, buscarProdutos } from './cadastros';
import type { ClienteIa } from './cliente-ia';
import { acharResumoConferido, chaveConferencia, cnpjFormatado, formatarReais, montarPedidoNota, montarPedidoVenda, montarResumoParaCliente, type ItemPedido } from './pedido-nota';
import type { ContextoAgente } from './contexto';

export type DepsAgente = { repos: Repos; envio: DepsEnvio; ia: ClienteIa };
export type EstadoExecucao = { ctx: ContextoAgente; respondeu: boolean };

const TRIAGEM = 'triagem';
const MAX_PARTES_RESPOSTA = 3;
const objeto = (properties: Record<string, object>, required: string[]) =>
  ({ type: 'object' as const, properties, required, additionalProperties: false });

/** Campos de um pedido de nota, iguais no resumo para o cliente e na demanda do Fiscal. */
const CAMPOS_PEDIDO = {
  tipo: { type: 'string', enum: ['venda', 'devolucao'] },
  unidade_id: { type: ['string', 'null'] },
  texto_destinatario: { type: 'string', description: 'Como o cliente se referiu ao destinatário.' },
  itens: {
    type: 'array',
    items: objeto({
      produto_id: { type: ['string', 'null'] },
      texto: { type: 'string', description: 'Como o cliente escreveu o item.' },
      quantidade: { type: 'number' },
      unidade: { type: 'string', description: 'PAC, kg, UN… como o cliente informou.' },
    }, ['produto_id', 'texto', 'quantidade', 'unidade']),
  },
  data_prevista: { type: ['string', 'null'], description: 'Data de entrega combinada, DD/MM/AAAA (calcule a partir de "Hoje" no contexto). null se o cliente não disse.' },
  forma_pagamento: { type: ['string', 'null'], description: 'Como o cliente disse: PIX, Boleto, Dinheiro, Cartão… null se não disse.' },
  valor_frete: { type: ['number', 'null'], description: 'Valor do frete em reais, se o cliente disse. null se não disse.' },
  tipo_frete: { type: ['string', 'null'], enum: ['R', 'D', null], description: 'R = frete por conta de quem vende (CIF); D = por conta de quem recebe (FOB). null se não disse.' },
  transportadora: { type: ['string', 'null'] },
  observacoes: { type: ['string', 'null'], description: 'Resumo curto do que foi combinado (horário de entrega…). null se nada.' },
  entrega: {
    type: ['object', 'null'],
    description: 'Só se o cliente pedir entrega num endereço diferente do cadastro do destinatário. null = entrega no endereço cadastrado.',
    properties: {
      endereco: { type: 'string', description: 'Rua/avenida, sem o número.' }, numero: { type: ['string', 'null'] }, complemento: { type: ['string', 'null'] },
      bairro: { type: ['string', 'null'] }, cidade: { type: ['string', 'null'] }, uf: { type: ['string', 'null'] }, cep: { type: ['string', 'null'] },
    },
    required: ['endereco'],
  },
};
const OBRIGATORIOS_PEDIDO = ['tipo', 'unidade_id', 'texto_destinatario', 'itens'];

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
    description: 'Lista os chamados em aberto da empresa em foco (com a data de abertura em aberta_em, dd/mm), para informar o andamento ao cliente.',
    input_schema: objeto({}, []),
  },
  {
    name: 'sinalizar_nao_entendido',
    description: 'Use quando não conseguir entender o que o cliente quer.',
    input_schema: objeto({}, []),
  },
  {
    name: 'buscar_parceiros',
    description: 'Procura, nos cadastros da empresa em foco, as unidades de clientes (tipo "cliente", para nota de venda) ou de fornecedores (tipo "fornecedor", para nota de devolução) que combinam com o texto do cliente. Devolve até 5 candidatos.',
    input_schema: objeto({
      texto: { type: 'string', description: 'Como o cliente se referiu ao destinatário, por exemplo "Brasil Santa Efigênia".' },
      tipo: { type: 'string', enum: ['cliente', 'fornecedor'] },
    }, ['texto', 'tipo']),
  },
  {
    name: 'buscar_produtos',
    description: 'Procura, nos produtos cadastrados da empresa em foco, cada item citado pelo cliente (nome, apelido ou código). Devolve até 5 candidatos por item.',
    input_schema: objeto({ textos: { type: 'array', items: { type: 'string' } } }, ['textos']),
  },
  {
    name: 'resumir_pedido_nota',
    description: 'Manda ao cliente, pelo WhatsApp, o resumo de uma nota para ele conferir antes de ir para o Fiscal: destinatário com CNPJ, produtos com código, quantidade, preço da tabela e total, e o que foi combinado. O sistema monta o texto. Uma chamada por nota. Use depois de buscar_parceiros e buscar_produtos. unidade_id/produto_id vazios (null) = não cadastrado.',
    input_schema: objeto(CAMPOS_PEDIDO, OBRIGATORIOS_PEDIDO),
  },
  {
    name: 'abrir_pedido_nota',
    description: 'Passa a nota para o Fiscal, já organizada, com o preço da tabela preenchido pelo sistema. Só depois de o cliente confirmar o resumo mandado por resumir_pedido_nota (cliente_confirmou_resumo = true), com o mesmo destinatário e os mesmos itens do resumo. Uma chamada por nota.',
    input_schema: objeto({
      ...CAMPOS_PEDIDO,
      pedido_original: { type: 'string', description: 'Texto do pedido do cliente, copiado sem alterar.' },
      cliente_confirmou_resumo: { type: 'boolean', description: 'true só depois de o cliente confirmar o resumo e dizer que não tem mais nota para pedir agora.' },
    }, [...OBRIGATORIOS_PEDIDO, 'pedido_original', 'cliente_confirmou_resumo']),
  },
  {
    name: 'listar_documentos',
    description: 'Lista os documentos cadastrados da empresa em foco (contrato social etc.) e se cada um pode ser enviado pela IA.',
    input_schema: objeto({}, []),
  },
  {
    name: 'enviar_documento',
    description: 'Envia pelo WhatsApp um documento da empresa em foco que esteja liberado para envio pela IA.',
    input_schema: objeto({ documento_id: { type: 'string' } }, ['documento_id']),
  },
  {
    name: 'consultar_cadastro',
    description: 'Dados cadastrais (razão social, CNPJ, inscrição estadual, endereço, regime) da empresa em foco ou, com unidade_id, de um cliente ou fornecedor cadastrado dela (use buscar_parceiros para achar o id). Use quando o contato pedir essas informações. Nunca inclui preços.',
    input_schema: objeto({ unidade_id: { type: 'string', description: 'Opcional: id de uma unidade de cliente ou fornecedor da empresa em foco.' } }, []),
  },
  {
    name: 'consultar_preco',
    description: 'Preço de tabela de um produto para uma unidade de cliente da empresa em foco (ache os ids com buscar_parceiros e buscar_produtos). O preço é da rede: só para consultar ou alterar preço, qualquer unidade da rede serve (não pergunte a unidade por causa do preço). Para nota fiscal a unidade importa.',
    input_schema: objeto({ unidade_id: { type: 'string' }, produto_id: { type: 'string' } }, ['unidade_id', 'produto_id']),
  },
  {
    name: 'alterar_preco',
    description: 'Altera o preço de tabela de um produto para a rede de uma unidade de cliente. Só use depois de o cliente confirmar explicitamente o novo valor (confirmado_pelo_cliente = true). Exige que o contato tenha permissão para mudar preço.',
    input_schema: objeto({
      unidade_id: { type: 'string' }, produto_id: { type: 'string' },
      novo_valor: { type: 'number', description: 'Em reais, ex.: 10.5' },
      confirmado_pelo_cliente: { type: 'boolean' },
    }, ['unidade_id', 'produto_id', 'novo_valor', 'confirmado_pelo_cliente']),
  },
  {
    name: 'cadastrar_produto',
    description: 'Cadastra um produto novo na empresa em foco. Só use depois de o cliente confirmar explicitamente código, descrição e unidade (confirmado_pelo_cliente = true). Exige que o contato tenha permissão para mudar preço. O preço é por rede: depois de cadastrar, use alterar_preco se o cliente informar o valor.',
    input_schema: objeto({
      codigo: { type: 'string', description: 'Código do produto na empresa, como o cliente informou.' },
      descricao: { type: 'string', description: 'Nome do produto, ex.: "Lasanha Bolonhesa".' },
      unidade: { type: 'string', description: 'PAC, KG, UN, CX…' },
      apelidos: { type: 'array', items: { type: 'string' }, description: 'Outros nomes que o cliente usa para o produto (pode ser vazio).' },
      confirmado_pelo_cliente: { type: 'boolean' },
    }, ['codigo', 'descricao', 'unidade', 'apelidos', 'confirmado_pelo_cliente']),
  },
  {
    name: 'responder',
    description: 'Envia texto ao cliente no WhatsApp. Cada parágrafo (separado por uma linha em branco) vira uma mensagem separada, no máximo 3.',
    input_schema: objeto({ texto: { type: 'string' } }, ['texto']),
  },
];

export const PedidoNota = z.object({
  tipo: z.enum(['venda', 'devolucao']),
  unidade_id: z.string().nullable(),
  texto_destinatario: z.string().min(1).max(300),
  itens: z.array(z.object({
    produto_id: z.string().nullable(), texto: z.string().min(1).max(200), quantidade: z.number().positive(), unidade: z.string().max(20),
  })).min(1).max(50),
  data_prevista: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'data_prevista no formato DD/MM/AAAA').nullish(),
  forma_pagamento: z.string().max(60).nullish(),
  valor_frete: z.number().min(0).max(1_000_000).nullish(),
  tipo_frete: z.enum(['R', 'D']).nullish(),
  transportadora: z.string().max(120).nullish(),
  observacoes: z.string().max(500).nullish(),
  entrega: z.object({
    endereco: z.string().trim().min(1).max(200), numero: z.string().max(20).nullish(), complemento: z.string().max(100).nullish(),
    bairro: z.string().max(100).nullish(), cidade: z.string().max(100).nullish(), uf: z.string().max(2).nullish(), cep: z.string().max(10).nullish(),
  }).nullish(),
});

const Entradas = {
  selecionar_empresa: z.object({ cliente_id: z.string() }),
  abrir_chamado: z.object({ setor_id: z.string(), titulo: z.string().min(3).max(120), resumo: z.string().min(1).max(4000), fora_do_contrato: z.boolean() }),
  consultar_chamados: z.object({}),
  sinalizar_nao_entendido: z.object({}),
  buscar_parceiros: z.object({ texto: z.string().min(1).max(200), tipo: z.enum(['cliente', 'fornecedor']) }),
  buscar_produtos: z.object({ textos: z.array(z.string().min(1).max(200)).min(1).max(30) }),
  resumir_pedido_nota: PedidoNota,
  abrir_pedido_nota: PedidoNota.extend({ pedido_original: z.string().min(1).max(4000), cliente_confirmou_resumo: z.boolean() }),
  listar_documentos: z.object({}),
  enviar_documento: z.object({ documento_id: z.string() }),
  consultar_cadastro: z.object({ unidade_id: z.string().optional() }),
  consultar_preco: z.object({ unidade_id: z.string(), produto_id: z.string() }),
  alterar_preco: z.object({ unidade_id: z.string(), produto_id: z.string(), novo_valor: z.number().positive().max(1_000_000), confirmado_pelo_cliente: z.boolean() }),
  cadastrar_produto: z.object({
    codigo: z.string().trim().min(1).max(40), descricao: z.string().trim().min(1).max(200), unidade: z.string().trim().max(20),
    apelidos: z.array(z.string().trim().min(1).max(100)).max(10), confirmado_pelo_cliente: z.boolean(),
  }),
  responder: z.object({ texto: z.string().min(1).max(4000) }),
};

/** Dia e mês (dd/mm) em Brasília: a data de abertura que consultar_chamados mostra ao modelo (regra 13, cobrança). */
export const diaMes = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(iso));

/** Textos devolvidos ao modelo, iguais no atendimento de verdade e na simulação (Treinar o agente). */
export const AVISOS = {
  empresaAlheia: 'Essa empresa não está ligada a este contato. Não informe nada sobre ela.',
  setorInvalido: 'setor_id inválido. Use um id da lista de SETORES ou "triagem".',
  pedidoSemConfirmacao: 'Ainda não passe o pedido: mande o resumo com resumir_pedido_nota e espere o cliente confirmar que está certo e que não tem mais nota. Depois chame de novo com cliente_confirmou_resumo = true (uma chamada por nota).',
  pedidoNaoConferido: 'O cliente não conferiu este pedido: mande o resumo com resumir_pedido_nota (com o mesmo destinatário e os mesmos itens) e espere a confirmação antes de passar para o Fiscal.',
  pedidoAmbiguo: 'Mais de um resumo enviado combina com este pedido. Chame de novo com o unidade_id e os produto_id usados no resumo que o cliente confirmou.',
  documentoNaoEncontrado: 'Documento não encontrado nesta empresa. Use listar_documentos.',
  documentoNaoLiberado: 'Este documento não está liberado para envio automático. Abra uma demanda com abrir_chamado para a equipe enviar.',
  precoSemConfirmacao: 'Antes de alterar, confirme com o cliente o novo valor (produto, rede, de quanto para quanto) e só então chame de novo com confirmado_pelo_cliente = true.',
  produtoSemConfirmacao: 'Antes de cadastrar, confirme com o cliente o código, a descrição e a unidade do produto e só então chame de novo com confirmado_pelo_cliente = true.',
  textoVazio: 'Texto vazio: escreva a resposta em palavras, sem emoji.',
  instrucaoExplicarDeNovo: 'Peça gentilmente para o cliente explicar de outra forma.',
  instrucaoEquipeContinua: 'Diga ao cliente que uma pessoa da equipe vai continuar o atendimento.',
  instrucaoResumo: 'O resumo já chegou ao cliente. Se for a última nota a resumir agora, pergunte numa mensagem curta se está tudo certo e se tem mais alguma nota. Não repita o resumo.',
};

/** O escritório não usa emoji com os clientes (pedido do dono, 2026-09-29): tira o que o modelo escapar. */
export function semEmoji(texto: string): string {
  return texto
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/[ \t]+([.,!?;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/** Como uma pessoa no WhatsApp: cada parágrafo vai numa mensagem (sem emoji); o excedente fica junto na última. */
export function partesDaResposta(texto: string): string[] {
  const paragrafos = semEmoji(texto).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paragrafos.length > MAX_PARTES_RESPOSTA
    ? [...paragrafos.slice(0, MAX_PARTES_RESPOSTA - 1), paragrafos.slice(MAX_PARTES_RESPOSTA - 1).join('\n\n')]
    : paragrafos;
}

export type Resultado = { resultado: string; erro: boolean };
export const ok = (dados: object): Resultado => ({ resultado: JSON.stringify(dados), erro: false });
export const falha = (mensagem: string): Resultado => ({ resultado: JSON.stringify({ erro: mensagem }), erro: true });

export function empresaDefinida(estado: EstadoExecucao): Resultado | null {
  const empresas = estado.ctx.contato?.empresas ?? [];
  if (empresas.length > 1 && !estado.ctx.empresaEmFoco) {
    return falha('O contato fala por mais de uma empresa. Pergunte de qual empresa se trata e use selecionar_empresa antes.');
  }
  return null;
}

/** Ferramentas de cadastro só funcionam com a empresa em foco definida (e nunca para número desconhecido). */
export function exigirEmpresa(estado: EstadoExecucao): { clienteId: string } | Resultado {
  const bloqueio = empresaDefinida(estado);
  if (bloqueio) return bloqueio;
  const empresa = estado.ctx.empresaEmFoco;
  if (!empresa) return falha('Nenhuma empresa definida para este contato. Número desconhecido: use abrir_chamado com "triagem".');
  return { clienteId: empresa.id };
}

export function avisoForaDoHorario(ctx: ContextoAgente): string | null {
  return ctx.noExpediente ? null : formatarMensagem(ctx.config.mensagens.fora_do_horario ?? '', ctx.config.expediente as never);
}

/** Destinatário e itens do pedido de nota, conferidos contra os cadastros da empresa, com o preço da tabela. */
export async function prepararPedido(d: DepsAgente, clienteId: string, entrada: z.infer<typeof PedidoNota>): Promise<{ destino: UnidadeParceiro | null; itens: ItemPedido[] } | Resultado> {
  const tipoParceiro = entrada.tipo === 'venda' ? 'cliente' : 'fornecedor';
  const unidades = await d.repos.unidadesDaEmpresa(clienteId, tipoParceiro);
  const destino = entrada.unidade_id ? unidades.find((u) => u.id === entrada.unidade_id) ?? null : null;
  if (entrada.unidade_id && !destino) {
    return falha(`unidade_id não é ${tipoParceiro === 'cliente' ? 'um cliente' : 'um fornecedor'} desta empresa. Use buscar_parceiros com o tipo certo.`);
  }
  const produtos = await d.repos.produtosDaEmpresa(clienteId);
  if (entrada.itens.some((i) => i.produto_id && !produtos.some((p) => p.id === i.produto_id))) {
    return falha('produto_id não pertence a esta empresa. Use buscar_produtos.');
  }
  const precos = entrada.tipo === 'venda' && destino
    ? await d.repos.precosVigentes(clienteId, destino.grupoId, entrada.itens.flatMap((i) => (i.produto_id ? [i.produto_id] : [])))
    : {};
  const itens: ItemPedido[] = entrada.itens.map((i) => ({
    produto: produtos.find((p) => p.id === i.produto_id) ?? null, texto: i.texto, quantidade: i.quantidade, unidade: i.unidade,
    preco: i.produto_id ? precos[i.produto_id] ?? null : null,
  }));
  return { destino, itens };
}

async function executarValidada(d: DepsAgente, estado: EstadoExecucao, nome: keyof typeof Entradas, entrada: any): Promise<Resultado> {
  const { ctx } = estado;
  switch (nome) {
    case 'selecionar_empresa': {
      const empresa = ctx.contato?.empresas.find((e) => e.id === entrada.cliente_id);
      if (!empresa) return falha(AVISOS.empresaAlheia);
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
        if (!setor) return falha(AVISOS.setorInvalido);
        setorId = setor.id;
      }
      const clienteId = desconhecido ? null : ctx.empresaEmFoco?.id ?? null;
      const responsavelId = clienteId ? escolherResponsavel(setorId, await d.repos.responsaveisDoCliente(clienteId)) : null;
      // Triagem já aberta nesta conversa: acrescenta as informações novas em vez de abrir outra.
      const triagemAberta = setorId === null
        ? (await d.repos.chamadosAbertosDaConversa(ctx.conversa.id)).find((c) => c.setor_id === null)
        : undefined;
      let numero: number;
      if (triagemAberta) {
        await d.repos.complementarChamado(triagemAberta.id, entrada.resumo);
        numero = Number(triagemAberta.numero);
      } else {
        ({ numero } = await d.repos.abrirChamado({
          clienteId, conversaId: ctx.conversa.id, setorId, responsavelId,
          titulo: entrada.titulo, resumo: entrada.resumo, foraDoContrato: entrada.fora_do_contrato, origem: 'agente',
        }));
      }
      await d.repos.atualizarConversa(ctx.conversa.id, { tentativas_nao_entendido: 0 });
      const setorNome = ctx.setores.find((s) => s.id === setorId)?.nome ?? 'Triagem';
      const aviso = avisoForaDoHorario(ctx);
      return ok({ numero, setor: setorNome, fora_do_horario: !ctx.noExpediente, aviso_para_o_cliente: aviso });
    }

    case 'consultar_chamados': {
      const bloqueio = empresaDefinida(estado);
      if (bloqueio) return bloqueio;
      if (!ctx.empresaEmFoco) return ok({ chamados: [] });
      const chamados = await d.repos.chamadosAbertosDoCliente(ctx.empresaEmFoco.id);
      return ok({ chamados: chamados.map((c) => ({ numero: c.numero, titulo: c.titulo, status: c.status, setor: c.setor_nome ?? 'Triagem', aberta_em: diaMes(c.criado_em) })) });
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
        return ok({ instrucao: AVISOS.instrucaoEquipeContinua });
      }
      await d.repos.atualizarConversa(ctx.conversa.id, { tentativas_nao_entendido: tentativas });
      return ok({ instrucao: AVISOS.instrucaoExplicarDeNovo });
    }

    case 'buscar_parceiros': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      return ok({ candidatos: await buscarParceiros(d.repos, e.clienteId, entrada.texto, entrada.tipo) });
    }

    case 'buscar_produtos': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      return ok({ resultados: await buscarProdutos(d.repos, e.clienteId, entrada.textos) });
    }

    case 'resumir_pedido_nota': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      const p = await prepararPedido(d, e.clienteId, entrada);
      if ('erro' in p) return p;
      const atual = await d.repos.obterConversa(ctx.conversa.id);
      if (atual.estado === 'humano') return falha('Um atendente assumiu esta conversa. Não envie nada.');
      await enviarDoSistema(d.envio, {
        conversaId: ctx.conversa.id, telefone: ctx.conversa.telefone, clienteId: e.clienteId, autor: 'agente',
        texto: montarResumoParaCliente({ tipo: entrada.tipo, destino: p.destino, textoDestinatario: entrada.texto_destinatario, itens: p.itens, extras: entrada }),
      });
      estado.respondeu = true;
      return ok({
        enviado: true, conferencia: chaveConferencia(entrada),
        instrucao: AVISOS.instrucaoResumo,
      });
    }

    case 'abrir_pedido_nota': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      if (!entrada.cliente_confirmou_resumo) {
        return falha(AVISOS.pedidoSemConfirmacao);
      }
      // Trava: só abre o pedido que o cliente conferiu (um resumo enviado nas últimas 24 h). O que vai para o Fiscal é o
      // pedido do resumo, não o remontado pelo modelo depois do "sim" (que perde ids e troca PAC por PC).
      const resumos = await d.repos.resumosEnviados(ctx.conversa.id, new Date(ctx.agora.getTime() - 24 * 3600_000));
      const achado = acharResumoConferido(entrada, resumos, (x): x is z.infer<typeof PedidoNota> => PedidoNota.safeParse(x).success);
      if (achado === null) {
        return falha(AVISOS.pedidoNaoConferido);
      }
      if ('ambiguo' in achado) {
        return falha(AVISOS.pedidoAmbiguo);
      }
      const conferido = { ...PedidoNota.parse(achado.resumo.entrada), pedido_original: entrada.pedido_original };
      const p = await prepararPedido(d, e.clienteId, conferido);
      if ('erro' in p) return p;
      const { destino, itens } = p;
      const { titulo, resumo } = montarPedidoNota({
        tipo: conferido.tipo, destino, textoDestinatario: conferido.texto_destinatario, itens,
        pedidoOriginal: conferido.pedido_original, semPermissao: !ctx.empresaEmFoco!.podePedirNota,
      });
      const setorId = await d.repos.setorPorNome('Fiscal');
      const responsavelId = escolherResponsavel(setorId, await d.repos.responsaveisDoCliente(e.clienteId));
      const { id: chamadoId, numero } = await d.repos.abrirChamado({
        clienteId: e.clienteId, conversaId: ctx.conversa.id, setorId, responsavelId,
        titulo, resumo, foraDoContrato: false, origem: 'agente',
      });
      // Pedido de venda para a equipe baixar no painel como arquivo do Bling (o cliente nunca recebe).
      if (conferido.tipo === 'venda') {
        await d.repos.anexarPedidoVenda(chamadoId, montarPedidoVenda({ agora: ctx.agora, destino, textoDestinatario: conferido.texto_destinatario, itens, extras: conferido }));
      }
      await d.repos.atualizarConversa(ctx.conversa.id, { tentativas_nao_entendido: 0 });
      const aviso = avisoForaDoHorario(ctx);
      return ok({
        numero, setor: setorId ? 'Fiscal' : 'Triagem', itens_sem_cadastro: itens.filter((i) => !i.produto).length,
        sem_preco: conferido.tipo === 'venda' ? itens.filter((i) => i.produto && i.preco === null).length : 0,
        fora_do_horario: !ctx.noExpediente, aviso_para_o_cliente: aviso,
      });
    }

    case 'listar_documentos': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      const docs = await d.repos.documentosDaEmpresa(e.clienteId);
      return ok({ documentos: docs.map((x) => ({ id: x.id, nome: x.nome, ia_pode_enviar: x.iaPodeEnviar })) });
    }

    case 'enviar_documento': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      const doc = (await d.repos.documentosDaEmpresa(e.clienteId)).find((x) => x.id === entrada.documento_id);
      if (!doc) return falha(AVISOS.documentoNaoEncontrado);
      if (!doc.iaPodeEnviar) return falha(AVISOS.documentoNaoLiberado);
      const atual = await d.repos.obterConversa(ctx.conversa.id);
      if (atual.estado === 'humano') return falha('Um atendente assumiu esta conversa. Não envie nada.');
      await enviarDocumentoDoSistema(d.envio, { conversaId: ctx.conversa.id, telefone: ctx.conversa.telefone, clienteId: e.clienteId, documento: doc });
      estado.respondeu = true;
      return ok({ enviado: true, documento: doc.nome });
    }

    case 'consultar_cadastro': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      if (!entrada.unidade_id) {
        const x = await d.repos.dadosDaEmpresa(e.clienteId);
        return ok({ empresa: { razao_social: x.razaoSocial, nome_fantasia: x.nomeFantasia, cnpj: cnpjFormatado(x.cnpj),
          inscricao_estadual: x.inscricaoEstadual, regime: x.regime, endereco: x.endereco, uf: x.uf } });
      }
      const unidades = [...await d.repos.unidadesDaEmpresa(e.clienteId, 'cliente'), ...await d.repos.unidadesDaEmpresa(e.clienteId, 'fornecedor')];
      const u = unidades.find((x) => x.id === entrada.unidade_id);
      if (!u) return falha('Essa unidade não é um cliente ou fornecedor cadastrado desta empresa. Não informe nada sobre ela.');
      return ok({ parceiro: { tipo: u.tipo, rede: u.rede, unidade: u.unidade, razao_social: u.razaoSocial,
        cnpj: u.cnpj ? cnpjFormatado(u.cnpj) : null, inscricao_estadual: u.ie, bairro: u.bairro, cidade: u.cidade, uf: u.uf } });
    }

    case 'consultar_preco':
    case 'alterar_preco': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      const unidade = (await d.repos.unidadesDaEmpresa(e.clienteId, 'cliente')).find((u) => u.id === entrada.unidade_id);
      if (!unidade) return falha('Essa unidade não é um cliente cadastrado desta empresa. Use buscar_parceiros.');
      const produto = (await d.repos.produtosDaEmpresa(e.clienteId)).find((p) => p.id === entrada.produto_id);
      if (!produto) return falha('Esse produto não é desta empresa. Use buscar_produtos.');
      const atual = (await d.repos.precosVigentes(e.clienteId, unidade.grupoId, [produto.id]))[produto.id] ?? null;
      const base = { rede: unidade.rede, produto: produto.descricao, unidade: produto.unidade };
      if (nome === 'consultar_preco') return ok({ ...base, preco: atual === null ? null : formatarReais(atual) });
      if (!entrada.confirmado_pelo_cliente) {
        return falha(AVISOS.precoSemConfirmacao);
      }
      try {
        await d.repos.definirPrecoPeloAgente(unidade.grupoId, produto.id, entrada.novo_valor, ctx.contato!.id);
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : '';
        if (msg.includes('sem permissão')) return falha('Este contato não tem permissão para mudar preço (sem permissão). Não altere: abra uma demanda com abrir_chamado para a equipe decidir.');
        throw erro;
      }
      return ok({ ...base, antes: atual === null ? null : formatarReais(atual), depois: formatarReais(entrada.novo_valor) });
    }

    case 'cadastrar_produto': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      if (!entrada.confirmado_pelo_cliente) {
        return falha(AVISOS.produtoSemConfirmacao);
      }
      const produto = { codigo: entrada.codigo, descricao: entrada.descricao, unidade: entrada.unidade.toUpperCase() || 'UN', apelidos: entrada.apelidos };
      try {
        await d.repos.cadastrarProdutoPeloAgente(e.clienteId, produto, ctx.contato!.id);
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : '';
        if (msg.includes('sem permissão')) return falha('Este contato não tem permissão para cadastrar produto (sem permissão). Não cadastre: abra uma demanda com abrir_chamado para a equipe cadastrar.');
        if (msg.includes('já cadastrado')) return falha('Já existe um produto com esse código nesta empresa. Use buscar_produtos e confirme com o cliente.');
        throw erro;
      }
      return ok({ cadastrado: true, codigo: produto.codigo, descricao: produto.descricao, unidade: produto.unidade });
    }

    case 'responder': {
      const partes = partesDaResposta(entrada.texto);
      if (partes.length === 0) return falha(AVISOS.textoVazio);
      let enviadas = 0;
      for (const parte of partes) {
        // Relê antes de cada parte: se um atendente assumiu no meio, para de mandar.
        const atual = await d.repos.obterConversa(ctx.conversa.id);
        if (atual.estado === 'humano') break;
        await enviarDoSistema(d.envio, {
          conversaId: ctx.conversa.id, telefone: ctx.conversa.telefone, clienteId: ctx.empresaEmFoco?.id ?? null,
          autor: 'agente', texto: parte,
        });
        enviadas++;
      }
      if (enviadas === 0) return falha('Um atendente assumiu esta conversa. Não envie nada.');
      estado.respondeu = true;
      return ok({ enviado: true, mensagens: enviadas });
    }
  }
}

export type NomeFerramenta = keyof typeof Entradas;

/** Confere nome e entrada de uma ferramenta; devolve a entrada validada ou o erro para o modelo. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validarEntrada(nome: string, entrada: unknown): { nome: NomeFerramenta; dados: any } | Resultado {
  if (!(nome in Entradas)) return falha(`Ferramenta desconhecida: ${nome}`);
  const validada = Entradas[nome as NomeFerramenta].safeParse(entrada);
  return validada.success
    ? { nome: nome as NomeFerramenta, dados: validada.data }
    : falha(`Entrada inválida: ${validada.error.issues.map((i) => i.message).join('; ')}`);
}

/** Quem executa as ferramentas pedidas pelo modelo: o de verdade, ou o da simulação (Treinar o agente). */
export type ExecutorFerramentas = (d: DepsAgente, estado: EstadoExecucao, nome: string, entrada: unknown) => Promise<Resultado>;

export async function executarFerramenta(d: DepsAgente, estado: EstadoExecucao, nome: string, entrada: unknown): Promise<Resultado> {
  const v = validarEntrada(nome, entrada);
  const r = 'erro' in v ? v : await executarValidada(d, estado, v.nome, v.dados);
  await d.repos.registrarDecisao({
    conversaId: estado.ctx.conversa.id, clienteId: estado.ctx.empresaEmFoco?.id ?? null,
    etapa: nome, entrada, saida: JSON.parse(r.resultado),
  });
  return r;
}
