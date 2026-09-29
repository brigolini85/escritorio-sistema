import type Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { dividirPedidosBling, montarCsvVendaBling, nomeArquivoVendaBling, problemasPedidoBling, type PedidoVendaSalvo } from '@escritorio/core';
import type { ArquivoAssistente, Repos } from '@escritorio/db';
import type { ClienteIa } from '../agente/cliente-ia';
import { buscarParceiros, buscarProdutos } from '../agente/cadastros';
import { cnpjFormatado, formatarReais, mesmaUnidade, montarPedidoNota } from '../agente/pedido-nota';
import type { CanalWhatsApp } from '../canal/tipos';
import type { ContextoAssistente } from './contexto';
import { periodoEmIso, totaisDeVendas, totalDoPedido } from './vendas';
import { corrigirPedido, descreverPedido, pedidoOriginalDoResumo } from './pedido';
import { podeCorrigirPedidos, podeVerChamado } from './visibilidade';

export type DepsAssistente = { repos: Repos; ia: ClienteIa; canal: CanalWhatsApp };
export type EstadoAssistente = { ctx: ContextoAssistente; resposta: string[]; arquivo: ArquivoAssistente | null; csvs: { nome: string; conteudo: string }[];
  /** Prévias de correção mostradas nesta execução: só valem como confirmação na mensagem seguinte. */ previas: Set<string> };

type Resultado = { resultado: string; erro: boolean };
export const ok = (dados: object): Resultado => ({ resultado: JSON.stringify(dados), erro: false });
export const falha = (mensagem: string): Resultado => ({ resultado: JSON.stringify({ erro: mensagem }), erro: true });
export const objeto = (properties: Record<string, object>, required: string[]) =>
  ({ type: 'object' as const, properties, required, additionalProperties: false });

export const FERRAMENTAS_ASSISTENTE: Anthropic.Tool[] = [
  {
    name: 'listar_demandas',
    description: 'Lista demandas (as tarefas do escritório) visíveis a esta pessoa, as mais novas primeiro (até 30). Filtros opcionais.',
    input_schema: objeto({
      abertas: { type: 'boolean', description: 'true = só as não concluídas.' },
      status: { type: 'string', enum: ['aberto', 'em_andamento', 'aguardando_cliente', 'concluido'] },
      setor: { type: 'string', description: 'Nome do setor, ex.: Fiscal.' },
      empresa: { type: 'string', description: 'Nome ou CNPJ da empresa cliente do escritório.' },
      de: { type: 'string', description: 'DD/MM/AAAA' }, ate: { type: 'string', description: 'DD/MM/AAAA' },
      so_notas: { type: 'boolean', description: 'true = só pedidos de nota fiscal.' },
    }, []),
  },
  { name: 'ver_demanda', description: 'Detalhes de uma demanda pelo número: resumo, status, setor, responsável, eventos e o pedido de venda (itens, valores, total e pendências para o CSV do Bling).',
    input_schema: objeto({ numero: { type: 'integer' } }, ['numero']) },
  { name: 'buscar_empresas', description: 'Procura empresas clientes do escritório pelo nome ou CNPJ. Devolve id, nome e CNPJ.',
    input_schema: objeto({ texto: { type: 'string' } }, ['texto']) },
  { name: 'buscar_parceiros', description: 'Procura, nos cadastros de uma empresa (cliente_id de buscar_empresas), os clientes (tipo "cliente") ou fornecedores dela.',
    input_schema: objeto({ cliente_id: { type: 'string' }, texto: { type: 'string' }, tipo: { type: 'string', enum: ['cliente', 'fornecedor'] } }, ['cliente_id', 'texto', 'tipo']) },
  { name: 'buscar_produtos', description: 'Procura produtos cadastrados de uma empresa pelo nome, apelido ou código.',
    input_schema: objeto({ cliente_id: { type: 'string' }, textos: { type: 'array', items: { type: 'string' } } }, ['cliente_id', 'textos']) },
  { name: 'consultar_preco', description: 'Preço de tabela de um produto para a rede de uma unidade de cliente da empresa.',
    input_schema: objeto({ cliente_id: { type: 'string' }, unidade_id: { type: 'string' }, produto_id: { type: 'string' } }, ['cliente_id', 'unidade_id', 'produto_id']) },
  { name: 'dados_cadastro', description: 'Dados cadastrais da empresa ou, com unidade_id, de um cliente/fornecedor dela.',
    input_schema: objeto({ cliente_id: { type: 'string' }, unidade_id: { type: 'string' } }, ['cliente_id']) },
  { name: 'resumo_vendas', description: 'Pedidos de venda (das demandas de nota) no período: quantidade, total e total por rede. Opcional: só de uma empresa.',
    input_schema: objeto({ de: { type: 'string', description: 'DD/MM/AAAA' }, ate: { type: 'string', description: 'DD/MM/AAAA' }, cliente_id: { type: 'string' } }, ['de', 'ate']) },
  {
    name: 'alterar_pedido_venda',
    description: 'Corrige o pedido de venda de uma demanda de nota (itens, quantidades, unidade, preço, destinatário, pagamento, entrega). Sem confirmado mostra o antes e o depois sem gravar; com confirmado = true grava (só depois de a pessoa confirmar). itens substitui a lista inteira; sem valor_unitario usa o preço da tabela.',
    input_schema: objeto({
      numero: { type: 'integer' },
      unidade_id: { type: 'string', description: 'Novo destinatário (buscar_parceiros, tipo cliente).' },
      itens: { type: 'array', items: objeto({
        produto_id: { type: ['string', 'null'] }, texto: { type: 'string' }, quantidade: { type: 'number' }, unidade: { type: 'string' },
        valor_unitario: { type: ['number', 'null'], description: 'Só se a pessoa informar um preço diferente da tabela.' },
      }, ['produto_id', 'texto', 'quantidade', 'unidade']) },
      forma_pagamento: { type: 'string' }, data_prevista: { type: 'string', description: 'DD/MM/AAAA' }, valor_frete: { type: 'number' },
      tipo_frete: { type: 'string', enum: ['R', 'D'] }, transportadora: { type: 'string' }, observacoes: { type: 'string' },
      confirmado: { type: 'boolean' },
    }, ['numero', 'confirmado']),
  },
  {
    name: 'gerar_csv_bling',
    description: 'Gera o arquivo de pedidos de venda do Bling: das demandas pelos números, ou (abertas = true) de todas as demandas de venda abertas que a pessoa pode ver. No painel vira o botão de baixar; no WhatsApp o arquivo é enviado junto com a resposta.',
    input_schema: objeto({ numeros: { type: 'array', items: { type: 'integer' } }, abertas: { type: 'boolean' } }, []),
  },
  { name: 'responder', description: 'Envia a resposta para a pessoa da equipe.', input_schema: objeto({ texto: { type: 'string' } }, ['texto']) },
];

const MSG_DATA = 'data inválida (use DD/MM/AAAA)';
const DATA = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, MSG_DATA).refine((v) => {
  const [d, m, a] = v.split('/').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}, MSG_DATA);
const ID = z.string().uuid('identificador inválido (use o id devolvido pelas buscas)');
const depoisDe = (de?: string, ate?: string) => {
  if (!de || !ate) return false;
  const k = (v: string) => v.split('/').reverse().join('');
  return k(de) > k(ate);
};

const Entradas = {
  listar_demandas: z.object({
    abertas: z.boolean().optional(), status: z.enum(['aberto', 'em_andamento', 'aguardando_cliente', 'concluido']).optional(),
    setor: z.string().max(80).optional(), empresa: z.string().max(120).optional(),
    de: DATA.optional(), ate: DATA.optional(), so_notas: z.boolean().optional(),
  }),
  ver_demanda: z.object({ numero: z.number().int().positive() }),
  buscar_empresas: z.object({ texto: z.string().trim().min(2).max(120) }),
  buscar_parceiros: z.object({ cliente_id: ID, texto: z.string().min(1).max(200), tipo: z.enum(['cliente', 'fornecedor']) }),
  buscar_produtos: z.object({ cliente_id: ID, textos: z.array(z.string().min(1).max(200)).min(1).max(30) }),
  consultar_preco: z.object({ cliente_id: ID, unidade_id: ID, produto_id: ID }),
  dados_cadastro: z.object({ cliente_id: ID, unidade_id: ID.optional() }),
  resumo_vendas: z.object({ de: DATA, ate: DATA, cliente_id: ID.optional() }),
  alterar_pedido_venda: z.object({
    numero: z.number().int().positive(), unidade_id: ID.optional(),
    itens: z.array(z.object({ produto_id: ID.nullable(), texto: z.string().min(1).max(200), quantidade: z.number().positive(), unidade: z.string().max(20), valor_unitario: z.number().positive().nullish() })).min(1).max(50).optional(),
    forma_pagamento: z.string().max(60).optional(), data_prevista: DATA.optional(), valor_frete: z.number().min(0).optional(),
    tipo_frete: z.enum(['R', 'D']).optional(), transportadora: z.string().max(120).optional(), observacoes: z.string().max(500).optional(),
    confirmado: z.boolean(),
  }),
  gerar_csv_bling: z.object({ numeros: z.array(z.number().int().positive()).min(1).max(1000).optional(), abertas: z.boolean().optional() })
    .refine((x) => x.numeros || x.abertas, 'Informe os números das demandas ou abertas = true'),
  responder: z.object({ texto: z.string().trim().min(1).max(4000) }),
};

const dataCurta = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
const linhaItem = (i: { produto: string | null; sku: string | null; un: string | null; quantidade: number | null; valor_unitario: number | null }) =>
  `${String(i.quantidade ?? '?').replace('.', ',')} ${i.un ?? 'UN'} ${i.produto ?? ''}${i.sku ? ` (cód. ${i.sku})` : ''}` +
  (i.valor_unitario !== null && i.quantidade !== null ? ` × ${formatarReais(i.valor_unitario)} = ${formatarReais(Math.round(i.quantidade * i.valor_unitario * 100) / 100)}` : ' – sem preço');

async function empresaExiste(d: DepsAssistente, clienteId: string): Promise<boolean> {
  try { await d.repos.dadosDaEmpresa(clienteId); return true; } catch { return false; }
}

async function executarValidada(d: DepsAssistente, estado: EstadoAssistente, nome: keyof typeof Entradas, entrada: any): Promise<Resultado> {
  const u = estado.ctx.usuario;
  if ((nome === 'listar_demandas' || nome === 'resumo_vendas') && depoisDe(entrada.de, entrada.ate)) return falha('A data inicial é depois da final.');
  // Admin vê tudo; os demais, só o que o banco deixa (setores deles e o que respondem).
  const visivelPara = u.papel === 'admin' ? null : { usuarioId: u.id, setorIds: u.setores };
  switch (nome) {
    case 'listar_demandas': {
      let clienteIds: string[] | undefined;
      if (entrada.empresa) {
        clienteIds = (await d.repos.buscarEmpresas(entrada.empresa)).map((e) => e.id);
        if (clienteIds.length === 0) return ok({ demandas: [], aviso: 'Nenhuma empresa com esse nome ou CNPJ.' });
      }
      const setorId = entrada.setor ? estado.ctx.setores.find((s) => s.nome.toLowerCase() === entrada.setor.toLowerCase())?.id ?? null : undefined;
      if (entrada.setor && !setorId) return falha(`Setor não encontrado. Setores: ${estado.ctx.setores.map((s) => s.nome).join(', ')}.`);
      const lista = (await d.repos.chamadosRecentes({ status: entrada.status, abertas: entrada.abertas, ...periodoEmIso(entrada.de, entrada.ate), clienteIds, soNotas: entrada.so_notas, setorId: setorId ?? undefined, visivelPara, limite: 30 }))
        .filter((c) => podeVerChamado(u, c));
      return ok({ demandas: lista.map((c) => ({
        numero: c.numero, titulo: c.titulo, status: c.status, setor: c.setor ?? 'Triagem', empresa: c.empresa, criada_em: dataCurta(c.criado_em),
        responsavel: c.responsavel, total_pedido: c.pedido_venda ? formatarReais(totalDoPedido(c.pedido_venda)) : null,
      })) });
    }

    case 'ver_demanda': {
      const c = await d.repos.chamadoPorNumero(entrada.numero);
      if (!c || !podeVerChamado(u, c)) return falha('Demanda não encontrada entre as que você pode ver.');
      const eventos = await d.repos.eventosDoChamado(c.id, 10);
      let pedido: object | null = null;
      if (c.pedido_venda) {
        const [bling] = await d.repos.pedidosVendaParaBling([c.id]);
        pedido = {
          itens: c.pedido_venda.itens.map(linhaItem), total: formatarReais(totalDoPedido(c.pedido_venda)),
          forma_pagamento: c.pedido_venda.forma_pagamento, data_prevista: c.pedido_venda.data_prevista,
          pendencias_csv: bling ? problemasPedidoBling(bling) : [],
        };
      }
      return ok({
        numero: c.numero, titulo: c.titulo, status: c.status, setor: c.setor ?? 'Triagem', responsavel: c.responsavel, empresa: c.empresa,
        criada_em: dataCurta(c.criado_em), resumo: c.resumo,
        eventos: eventos.map((e) => `${dataCurta(e.criado_em)} ${e.tipo}${e.usuario ? ` (${e.usuario})` : ''}${e.texto ? `: ${e.texto}` : ''}`), pedido,
      });
    }

    case 'buscar_empresas':
      return ok({ empresas: await d.repos.buscarEmpresas(entrada.texto) });

    case 'buscar_parceiros':
      if (!(await empresaExiste(d, entrada.cliente_id))) return falha('Empresa não encontrada. Use buscar_empresas.');
      return ok({ candidatos: await buscarParceiros(d.repos, entrada.cliente_id, entrada.texto, entrada.tipo) });

    case 'buscar_produtos':
      if (!(await empresaExiste(d, entrada.cliente_id))) return falha('Empresa não encontrada. Use buscar_empresas.');
      return ok({ resultados: await buscarProdutos(d.repos, entrada.cliente_id, entrada.textos) });

    case 'consultar_preco': {
      const unidade = (await d.repos.unidadesDaEmpresa(entrada.cliente_id, 'cliente')).find((x) => x.id === entrada.unidade_id);
      const produto = (await d.repos.produtosDaEmpresa(entrada.cliente_id)).find((p) => p.id === entrada.produto_id);
      if (!unidade || !produto) return falha('Unidade ou produto não é desta empresa. Use buscar_parceiros e buscar_produtos.');
      const preco = (await d.repos.precosVigentes(entrada.cliente_id, unidade.grupoId, [produto.id]))[produto.id] ?? null;
      return ok({ rede: unidade.rede, produto: produto.descricao, unidade: produto.unidade, preco: preco === null ? null : formatarReais(preco) });
    }

    case 'dados_cadastro': {
      if (!(await empresaExiste(d, entrada.cliente_id))) return falha('Empresa não encontrada. Use buscar_empresas.');
      if (!entrada.unidade_id) {
        const x = await d.repos.dadosDaEmpresa(entrada.cliente_id);
        return ok({ empresa: { razao_social: x.razaoSocial, nome_fantasia: x.nomeFantasia, cnpj: cnpjFormatado(x.cnpj), inscricao_estadual: x.inscricaoEstadual, regime: x.regime, endereco: x.endereco, uf: x.uf } });
      }
      const todas = [...await d.repos.unidadesDaEmpresa(entrada.cliente_id, 'cliente'), ...await d.repos.unidadesDaEmpresa(entrada.cliente_id, 'fornecedor')];
      const p = todas.find((x) => x.id === entrada.unidade_id);
      if (!p) return falha('Essa unidade não é desta empresa. Use buscar_parceiros.');
      return ok({ parceiro: { tipo: p.tipo, rede: p.rede, unidade: p.unidade, razao_social: p.razaoSocial, cnpj: p.cnpj ? cnpjFormatado(p.cnpj) : null,
        inscricao_estadual: p.ie, endereco: p.endereco, numero: p.numero, complemento: p.complemento, bairro: p.bairro, cidade: p.cidade, uf: p.uf, cep: p.cep } });
    }

    case 'resumo_vendas': {
      const lista = (await d.repos.chamadosRecentes({ ...periodoEmIso(entrada.de, entrada.ate), clienteIds: entrada.cliente_id ? [entrada.cliente_id] : undefined, comPedido: true, visivelPara }))
        .filter((c) => c.pedido_venda && podeVerChamado(u, c));
      const redes = await d.repos.nomesDasRedes([...new Set(lista.flatMap((c) => (c.pedido_venda!.unidade_id ? [c.pedido_venda!.unidade_id] : [])))]);
      const t = totaisDeVendas(lista.map((c) => ({ salvo: c.pedido_venda!, rede: (c.pedido_venda!.unidade_id && redes[c.pedido_venda!.unidade_id]) || c.pedido_venda!.texto_destinatario })));
      return ok({ pedidos: t.pedidos, total: formatarReais(t.total), por_rede: t.porRede.map((r) => ({ rede: r.rede, pedidos: r.pedidos, total: formatarReais(r.total) })) });
    }

    case 'alterar_pedido_venda': {
      if (!podeCorrigirPedidos(u)) return falha('Você não tem permissão para corrigir pedidos de nota. Peça ao administrador para marcar "Corrigir pedidos de nota e gerar CSV do Bling" na aba Usuários.');
      const c = await d.repos.chamadoPorNumero(entrada.numero);
      if (!c || !podeVerChamado(u, c)) return falha('Demanda não encontrada entre as que você pode ver.');
      if (!c.pedido_venda || !c.cliente_id) return falha('Esta demanda não tem pedido de venda (só as notas de venda passadas pelo agente têm).');
      if (c.status === 'concluido') return falha('Esta demanda já foi concluída; o pedido não pode mudar.');
      const unidades = await d.repos.unidadesDaEmpresa(c.cliente_id, 'cliente');
      const unidadeId = entrada.unidade_id ?? c.pedido_venda.unidade_id;
      const destino = unidadeId ? unidades.find((x) => x.id === unidadeId) ?? null : null;
      if (entrada.unidade_id && !destino) return falha('Esse destinatário não é cliente desta empresa. Use buscar_parceiros com tipo "cliente".');
      const produtos = await d.repos.produtosDaEmpresa(c.cliente_id);
      if (entrada.itens?.some((i: { produto_id: string | null }) => i.produto_id && !produtos.some((p) => p.id === i.produto_id))) {
        return falha('Produto não é desta empresa. Use buscar_produtos.');
      }
      const precos = destino && entrada.itens
        ? await d.repos.precosVigentes(c.cliente_id, destino.grupoId, entrada.itens.flatMap((i: { produto_id: string | null }) => (i.produto_id ? [i.produto_id] : [])))
        : {};
      const trocou = !!entrada.unidade_id && entrada.unidade_id !== c.pedido_venda.unidade_id;
      if (trocou && !entrada.itens) return falha('Ao trocar o destinatário, mande os itens de novo para eu recalcular os preços da nova rede.');
      const { numero: _n, itens, unidade_id: _u, confirmado, ...resto } = entrada;
      const extras = trocou && destino ? { ...resto, texto_destinatario: `${destino.rede} / ${destino.unidade}` } : resto;
      const { novo, itensPedido } = corrigirPedido({ salvo: { ...c.pedido_venda, unidade_id: unidadeId }, destino, itens: itens ?? null, produtos, precos, extras, agora: estado.ctx.agora });
      const nomeDe = (p: PedidoVendaSalvo) => { const x = unidades.find((y) => y.id === p.unidade_id); return x ? `${x.rede} / ${x.unidade}` : p.texto_destinatario; };
      const antes = descreverPedido(c.pedido_venda, nomeDe(c.pedido_venda));
      const depois = descreverPedido(novo, nomeDe(novo));
      const conferencia = createHash('sha1').update(JSON.stringify({ numero: c.numero, novo })).digest('hex').slice(0, 12);
      if (confirmado) {
        if (estado.previas.has(conferencia)) return falha('Mostre o antes e o depois e espere a confirmação na próxima mensagem.');
        if (!(await d.repos.previaDoAssistente(conferencia, u.id, new Date(Date.now() - 24 * 3600 * 1000)))) {
          return falha('O pedido mudou ou ainda não foi mostrado. Mostre o antes e o depois de novo e espere a confirmação.');
        }
        if (isDeepStrictEqual(novo, c.pedido_venda)) return ok({ gravado: true, numero: c.numero, depois, ja_estava: true });
      }
      if (!confirmado) {
        estado.previas.add(conferencia);
        return ok({ gravado: false, antes, depois, conferencia, usuario: u.id, instrucao: 'Mostre o antes e o depois e pergunte se pode gravar. Só chame de novo com confirmado = true depois de um sim.' });
      }

      const itensResumo = itensPedido ?? novo.itens.map((i) => ({
        produto: produtos.find((p) => p.codigo === i.sku) ?? null, texto: i.produto ?? '', quantidade: i.quantidade ?? 0,
        unidade: i.un ?? 'UN', preco: i.valor_unitario,
        precoInformado: i.valor_unitario !== null && !!produtos.find((p) => p.codigo === i.sku) && !mesmaUnidade(i.un ?? 'UN', produtos.find((p) => p.codigo === i.sku)!.unidade),
      }));
      const { titulo, resumo } = montarPedidoNota({ tipo: 'venda', destino, textoDestinatario: novo.texto_destinatario, itens: itensResumo,
        pedidoOriginal: pedidoOriginalDoResumo(c.resumo), semPermissao: c.resumo.includes('Observação: contato sem permissão para pedir nota.') });
      await d.repos.atualizarPedidoVenda(c.id, { pedido: novo, resumo, ...(trocou ? { titulo } : {}) });
      await d.repos.registrarNotaInterna(c.id, c.cliente_id, u.id, `Pedido alterado pelo assistente a pedido de ${u.nome}.\nAntes:\n${antes}\nDepois:\n${depois}`);
      await d.repos.registrarAuditoria({ usuarioId: u.id, acao: 'assistente', entidade: 'pedido_venda', entidadeId: c.id, detalhes: { canal: estado.ctx.canal, antes: c.pedido_venda, depois: novo } });
      return ok({ gravado: true, numero: c.numero, depois });
    }

    case 'gerar_csv_bling': {
      if (!podeCorrigirPedidos(u)) return falha('Você não tem permissão para gerar o CSV do Bling. Peça ao administrador na aba Usuários.');
      const numeros: number[] | null = entrada.numeros ? [...new Set<number>(entrada.numeros)] : null;
      const chamados = numeros
        ? (await Promise.all(numeros.map((n: number) => d.repos.chamadoPorNumero(n)))).filter((c): c is NonNullable<typeof c> => c !== null)
        : await d.repos.chamadosRecentes({ abertas: true, comPedido: true, visivelPara });
      const escolhidos = chamados.filter((c) => c.pedido_venda && podeVerChamado(u, c));
      if (escolhidos.length === 0) return falha('Nenhuma demanda de venda com pedido entre as que você pode ver.');
      const pedidos = await d.repos.pedidosVendaParaBling(escolhidos.map((c) => c.id));
      const problemas = pedidos.flatMap(problemasPedidoBling);
      if (problemas.length) return falha(`Não dá para gerar ainda: ${problemas.join('; ')}.`);
      const partes = dividirPedidosBling(pedidos);
      const nomes = partes.map((_, i) => nomeArquivoVendaBling(estado.ctx.agora, partes.length > 1 ? i + 1 : undefined));
      if (estado.ctx.canal === 'site') {
        estado.arquivo = { tipo: 'csv_bling', chamados: [...new Set(escolhidos.map((c) => c.id))], nome: nomes[0]!, partes: partes.length };
      } else {
        partes.forEach((p, i) => estado.csvs.push({ nome: nomes[i]!, conteudo: montarCsvVendaBling(p) }));
      }
      await d.repos.registrarAuditoria({ usuarioId: u.id, acao: 'download', entidade: 'csv_bling', entidadeId: escolhidos.map((c) => c.id).join(','),
        detalhes: { canal: estado.ctx.canal, pedidos: pedidos.map((p) => p.numero), arquivos: nomes } });
      const incluidos = pedidos.map((p) => p.numero).sort((a, b) => a - b);
      const ignorados = numeros ? numeros.filter((n) => !incluidos.includes(n)).sort((a, b) => a - b) : [];
      return ok({ pedidos: pedidos.length, arquivos: nomes, incluidos,
        ...(numeros ? { ignorados, motivo_ignorados: 'não encontradas, sem pedido de venda ou fora das que você pode ver' } : {}),
        instrucao: (estado.ctx.canal === 'site' ? 'O botão de baixar aparece junto da sua resposta.' : 'O arquivo vai junto da sua resposta.') +
          (ignorados.length ? ' Diga à pessoa quais números ficaram de fora do arquivo (ignorados) e o motivo.' : '') });
    }

    case 'responder':
      estado.resposta.push(entrada.texto);
      return ok({ enviado: true });
  }
}

export async function executarFerramentaAssistente(d: DepsAssistente, estado: EstadoAssistente, nome: string, entrada: unknown): Promise<Resultado> {
  let r: Resultado;
  if (!(nome in Entradas)) r = falha(`Ferramenta desconhecida: ${nome}`);
  else {
    const v = Entradas[nome as keyof typeof Entradas].safeParse(entrada);
    if (!v.success) r = falha(`Entrada inválida: ${v.error.issues.map((i) => i.message).join('; ')}`);
    else {
      try { r = await executarValidada(d, estado, nome as keyof typeof Entradas, v.data); } catch (e) {
        console.error('[assistente] ferramenta', nome, e);
        r = falha('Não consegui consultar agora; tente de novo.');
      }
    }
  }
  await d.repos.registrarDecisao({ conversaId: null, clienteId: null, etapa: `assistente:${nome}`, entrada, saida: JSON.parse(r.resultado) });
  return r;
}
