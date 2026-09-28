import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { escolherResponsavel, formatarMensagem } from '@escritorio/core';
import type { Repos } from '@escritorio/db';
import { enviarDocumentoDoSistema, enviarDoSistema, type DepsEnvio } from '../envio';
import { buscarParceiros, buscarProdutos } from './cadastros';
import type { ClienteIa } from './cliente-ia';
import { cnpjFormatado, formatarReais, montarPedidoNota, type ItemPedido } from './pedido-nota';
import type { ContextoAgente } from './contexto';

export type DepsAgente = { repos: Repos; envio: DepsEnvio; ia: ClienteIa };
export type EstadoExecucao = { ctx: ContextoAgente; respondeu: boolean };

const TRIAGEM = 'triagem';
const MAX_PARTES_RESPOSTA = 3;
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
    name: 'abrir_pedido_nota',
    description: 'Abre a demanda de nota fiscal no Fiscal, já organizada: destinatário (ou fornecedor, na devolução) e itens identificados nos cadastros, com o preço da tabela preenchido pelo sistema. Use depois de buscar_parceiros e buscar_produtos. unidade_id/produto_id vazios (null) = não cadastrado.',
    input_schema: objeto({
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
      pedido_original: { type: 'string', description: 'Texto do pedido do cliente, copiado sem alterar.' },
    }, ['tipo', 'unidade_id', 'texto_destinatario', 'itens', 'pedido_original']),
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
    name: 'responder',
    description: 'Envia texto ao cliente no WhatsApp. Cada parágrafo (separado por uma linha em branco) vira uma mensagem separada, no máximo 3.',
    input_schema: objeto({ texto: { type: 'string' } }, ['texto']),
  },
];

const Entradas = {
  selecionar_empresa: z.object({ cliente_id: z.string() }),
  abrir_chamado: z.object({ setor_id: z.string(), titulo: z.string().min(3).max(120), resumo: z.string().min(1).max(4000), fora_do_contrato: z.boolean() }),
  consultar_chamados: z.object({}),
  sinalizar_nao_entendido: z.object({}),
  buscar_parceiros: z.object({ texto: z.string().min(1).max(200), tipo: z.enum(['cliente', 'fornecedor']) }),
  buscar_produtos: z.object({ textos: z.array(z.string().min(1).max(200)).min(1).max(30) }),
  abrir_pedido_nota: z.object({
    tipo: z.enum(['venda', 'devolucao']),
    unidade_id: z.string().nullable(),
    texto_destinatario: z.string().min(1).max(300),
    itens: z.array(z.object({
      produto_id: z.string().nullable(), texto: z.string().min(1).max(200), quantidade: z.number().positive(), unidade: z.string().max(20),
    })).min(1).max(50),
    pedido_original: z.string().min(1).max(4000),
  }),
  listar_documentos: z.object({}),
  enviar_documento: z.object({ documento_id: z.string() }),
  consultar_cadastro: z.object({ unidade_id: z.string().optional() }),
  consultar_preco: z.object({ unidade_id: z.string(), produto_id: z.string() }),
  alterar_preco: z.object({ unidade_id: z.string(), produto_id: z.string(), novo_valor: z.number().positive().max(1_000_000), confirmado_pelo_cliente: z.boolean() }),
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

/** Ferramentas de cadastro só funcionam com a empresa em foco definida (e nunca para número desconhecido). */
function exigirEmpresa(estado: EstadoExecucao): { clienteId: string } | Resultado {
  const bloqueio = empresaDefinida(estado);
  if (bloqueio) return bloqueio;
  const empresa = estado.ctx.empresaEmFoco;
  if (!empresa) return falha('Nenhuma empresa definida para este contato. Número desconhecido: use abrir_chamado com "triagem".');
  return { clienteId: empresa.id };
}

function avisoForaDoHorario(ctx: ContextoAgente): string | null {
  return ctx.noExpediente ? null : formatarMensagem(ctx.config.mensagens.fora_do_horario ?? '', ctx.config.expediente as never);
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

    case 'abrir_pedido_nota': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      const tipoParceiro = entrada.tipo === 'venda' ? 'cliente' : 'fornecedor';
      const unidades = await d.repos.unidadesDaEmpresa(e.clienteId, tipoParceiro);
      const destino = entrada.unidade_id ? unidades.find((u) => u.id === entrada.unidade_id) ?? null : null;
      if (entrada.unidade_id && !destino) {
        return falha(`unidade_id não é ${tipoParceiro === 'cliente' ? 'um cliente' : 'um fornecedor'} desta empresa. Use buscar_parceiros com o tipo certo.`);
      }
      const produtos = await d.repos.produtosDaEmpresa(e.clienteId);
      const itensEntrada = entrada.itens as { produto_id: string | null; texto: string; quantidade: number; unidade: string }[];
      if (itensEntrada.some((i) => i.produto_id && !produtos.some((p) => p.id === i.produto_id))) {
        return falha('produto_id não pertence a esta empresa. Use buscar_produtos.');
      }
      const precos = entrada.tipo === 'venda' && destino
        ? await d.repos.precosVigentes(e.clienteId, destino.grupoId, itensEntrada.flatMap((i) => (i.produto_id ? [i.produto_id] : [])))
        : {};
      const itens: ItemPedido[] = itensEntrada.map((i) => ({
        produto: produtos.find((p) => p.id === i.produto_id) ?? null, texto: i.texto, quantidade: i.quantidade, unidade: i.unidade,
        preco: i.produto_id ? precos[i.produto_id] ?? null : null,
      }));
      const { titulo, resumo } = montarPedidoNota({
        tipo: entrada.tipo, destino, textoDestinatario: entrada.texto_destinatario, itens,
        pedidoOriginal: entrada.pedido_original, semPermissao: !ctx.empresaEmFoco!.podePedirNota,
      });
      const setorId = await d.repos.setorPorNome('Fiscal');
      const responsavelId = escolherResponsavel(setorId, await d.repos.responsaveisDoCliente(e.clienteId));
      const { numero } = await d.repos.abrirChamado({
        clienteId: e.clienteId, conversaId: ctx.conversa.id, setorId, responsavelId,
        titulo, resumo, foraDoContrato: false, origem: 'agente',
      });
      await d.repos.atualizarConversa(ctx.conversa.id, { tentativas_nao_entendido: 0 });
      const aviso = avisoForaDoHorario(ctx);
      return ok({
        numero, setor: setorId ? 'Fiscal' : 'Triagem', itens_sem_cadastro: itens.filter((i) => !i.produto).length,
        sem_preco: entrada.tipo === 'venda' ? itens.filter((i) => i.produto && i.preco === null).length : 0,
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
      if (!doc) return falha('Documento não encontrado nesta empresa. Use listar_documentos.');
      if (!doc.iaPodeEnviar) return falha('Este documento não está liberado para envio automático. Abra uma demanda com abrir_chamado para a equipe enviar.');
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
        return falha('Antes de alterar, confirme com o cliente o novo valor (produto, rede, de quanto para quanto) e só então chame de novo com confirmado_pelo_cliente = true.');
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

    case 'responder': {
      // Como uma pessoa no WhatsApp: cada parágrafo vai numa mensagem; o excedente fica junto na última.
      const paragrafos = entrada.texto.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
      const partes = paragrafos.length > MAX_PARTES_RESPOSTA
        ? [...paragrafos.slice(0, MAX_PARTES_RESPOSTA - 1), paragrafos.slice(MAX_PARTES_RESPOSTA - 1).join('\n\n')]
        : paragrafos;
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
