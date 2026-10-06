import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { LIMITES_TAREFA, TIPOS_PENDENCIA, conferirFontes, leituraDoArquivo, numeroDaPendencia, type ResultadoTarefa } from '@escritorio/core';
import type { PerfilAgente, Repos, TarefaParaTrabalho } from '@escritorio/db';
import { FERRAMENTAS_SKILL, objeto } from '../agente/ferramentas';
import { lerReferenciaDoPerfil, lerSkillDoPerfil, temSkillSobDemanda } from '../agente/skills';
import type { ArmazenamentoMidia } from '../midia/armazenamento';
import { lerArquivoDaTarefa, type ConteudoFerramenta } from './arquivos';

/** Parte I3a (D19): automáticas para os agentes de Trabalho. Nenhuma envia nem grava fora da tarefa. */
export const FERRAMENTAS_TAREFA: Anthropic.Tool[] = [
  { name: 'listar_arquivos', description: 'Lista os arquivos desta tarefa (nome, tipo e se já foi lido).', input_schema: objeto({}, []) },
  {
    name: 'ler_arquivo',
    description: 'Lê um arquivo desta tarefa pelo nome. PDF e imagem vêm inteiros; texto (XML, CSV, TXT, OFX) vem em partes: peça a parte seguinte.',
    input_schema: objeto({ nome: { type: 'string' }, parte: { type: 'integer', minimum: 1 } }, ['nome']),
  },
  {
    name: 'dados_da_empresa',
    description: 'Dados cadastrais da empresa da demanda: razão social, nome fantasia, CNPJ, inscrição estadual, regime, endereço e UF.',
    input_schema: objeto({}, []),
  },
  {
    name: 'concluir_etapa',
    description: 'Marca uma etapa como feita, com um resumo curto que aparece na barra para a pessoa. Não use na última (Aprovação).',
    input_schema: objeto({ etapa: { type: 'integer', minimum: 1 }, resumo: { type: 'string', description: 'Até 200 letras, ex.: "214 lançamentos".' } }, ['etapa', 'resumo']),
  },
  {
    name: 'anotar',
    description: 'Guarda suas anotações para a próxima vez (substitui as anteriores; até 8.000 letras): o que já fez, o que falta e onde parou.',
    input_schema: objeto({ texto: { type: 'string' } }, ['texto']),
  },
  {
    name: 'abrir_pendencia',
    description: 'Abre uma pendência em vez de chutar: "cliente" quando falta documento ou informação do cliente (escreva a mensagem que o Thiago mandaria); '
      + '"analista" para uma pergunta à equipe, com até 4 respostas rápidas.',
    input_schema: objeto({
      tipo: { type: 'string', enum: [...TIPOS_PENDENCIA] },
      pergunta: { type: 'string', description: 'Curta: o que falta ou o que decidir.' },
      detalhe: { type: ['string', 'null'], description: 'De onde veio a dúvida (arquivo, página, valor). null se nada.' },
      opcoes: { type: 'array', items: { type: 'string' }, description: 'Só para o analista: até 4 respostas rápidas. [] para o cliente.' },
      mensagem_ao_cliente: { type: ['string', 'null'], description: 'Só para o cliente: a mensagem curta e educada. null para o analista.' },
    }, ['tipo', 'pergunta', 'detalhe', 'opcoes', 'mensagem_ao_cliente']),
  },
  {
    name: 'entregar_resultado',
    description: 'Entrega o resultado como rascunho para uma pessoa do setor aprovar. Cada linha precisa da fonte: o nome de um arquivo lido nesta tarefa, '
      + 'ou "pendência N" (respondida; aberta só com provisoria = true). Resumo e destaques só citam valores das linhas (o de uma linha, '
      + 'o total das linhas ou o total de um arquivo). Entregue de novo para corrigir.',
    input_schema: objeto({
      resumo: { type: 'string' },
      destaques: { type: 'array', items: objeto({ rotulo: { type: 'string' }, valor: { type: 'string' }, detalhe: { type: ['string', 'null'] } }, ['rotulo', 'valor', 'detalhe']) },
      linhas: {
        type: 'array',
        items: objeto({
          descricao: { type: 'string' }, valor: { type: ['number', 'null'] }, texto: { type: ['string', 'null'] }, fonte: { type: 'string' }, provisoria: { type: 'boolean' },
        }, ['descricao', 'valor', 'texto', 'fonte', 'provisoria']),
      },
      observacoes: { type: ['string', 'null'] },
    }, ['resumo', 'destaques', 'linhas', 'observacoes']),
  },
];

export function ferramentasDaTarefa(perfil: Pick<PerfilAgente, 'skills'>): Anthropic.Tool[] {
  return temSkillSobDemanda(perfil.skills) ? [...FERRAMENTAS_TAREFA, ...FERRAMENTAS_SKILL] : FERRAMENTAS_TAREFA;
}

export const AVISOS_TAREFA = {
  arquivoNaoEncontrado: 'Arquivo não encontrado nesta tarefa. Use um nome de listar_arquivos.',
  semFonte: 'Nada foi guardado: nunca invente valores. Cite em cada linha um arquivo lido nesta tarefa ou "pendência N"; o que não tem documento vira pendência (abrir_pendencia).',
  valorSemLinha: 'Nada foi guardado: o resumo e os destaques só citam valores das linhas, no formato R$ 1.234,56. Use o valor de uma linha, o total das linhas ou o total de um arquivo; '
    + 'para outro valor (um saldo, um imposto), ponha uma linha com ele e a fonte.',
  semEmpresa: 'A demanda não tem empresa.',
  mensagemCliente: 'Escreva em mensagem_ao_cliente a mensagem curta que o Thiago mandaria ao cliente.',
  pendenciaCliente: 'Uma pessoa do setor confere a mensagem e manda ao cliente. Siga com o que der; marque como provisória a linha que depende disso.',
  pendenciaAnalista: 'O analista responde no painel. Siga com o que der; marque como provisória a linha que depende disso.',
  entregue: 'Rascunho guardado. Uma pessoa do setor aprova; nada vale antes disso.',
};

export type VezDaTarefa = { tarefa: TarefaParaTrabalho; perfil: PerfilAgente; entregou: boolean; abriuPendencia: boolean; lidosNaVez: number };
export type DepsFerramentasTarefa = { repos: Repos; midia: Pick<ArmazenamentoMidia, 'ler'> };
export type ResultadoFerramentaTarefa = { conteudo: ConteudoFerramenta; erro: boolean };
const ok = (dados: object): ResultadoFerramentaTarefa => ({ conteudo: JSON.stringify(dados), erro: false });
const falha = (mensagem: string): ResultadoFerramentaTarefa => ({ conteudo: JSON.stringify({ erro: mensagem }), erro: true });
/** A frase do banco (raise exception) sem o contexto do repositório ("concluirEtapaTarefa: …"). */
const doBanco = (e: unknown) => (e instanceof Error ? e.message.replace(/^[\w.]+: /, '') : 'Não foi possível gravar agora.');

const listaCurta = (problemas: string[]) => `${problemas.slice(0, 10).join(' ')}${problemas.length > 10 ? ` (e mais ${problemas.length - 10})` : ''}`;

/** Número no texto (com "R$" na frente, se houver): a sequência inteira de dígitos, pontos e vírgulas; pedaço de data fica de fora. */
const NUMERO_NO_TEXTO = /(R\$\s*)?(?<![\d.,/])-?(\d(?:[\d.,]*\d)?)(?!\d|[.,]\d)/g;
/** Formato brasileiro: 1.234,56 / 1234,56 / 12,5 / 1.234 / 12. */
const FORMATO_BR = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;
const centavos = (v: number) => Math.round(Math.abs(v) * 100);
const chaveDaFonte = (f: string) => {
  const n = numeroDaPendencia(f);
  return n !== null ? `pendência ${n}` : f.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
};

/**
 * F9 ("nunca inventa valores" no resumo e nos cartões): todo valor em reais citado tem de ser o de uma linha, o total das linhas
 * ou o total de uma fonte (também só entradas ou só saídas). Uma soma qualquer de algumas linhas não é aceita: vira uma linha.
 */
export function conferirValoresCitados(r: ResultadoTarefa): string[] {
  const aceitos = new Set<number>();
  const grupos = new Map<string, number[]>([['', []]]);
  for (const l of r.linhas) {
    if (l.valor === null) continue;
    aceitos.add(centavos(l.valor));
    grupos.get('')!.push(l.valor);
    const k = chaveDaFonte(l.fonte);
    grupos.set(k, [...(grupos.get(k) ?? []), l.valor]);
  }
  const soma = (vs: number[]) => vs.reduce((a, b) => a + b, 0);
  for (const vs of grupos.values()) {
    aceitos.add(centavos(soma(vs)));
    aceitos.add(centavos(soma(vs.filter((v) => v > 0))));
    aceitos.add(centavos(soma(vs.filter((v) => v < 0))));
  }
  const problemas: string[] = [];
  const conferir = (onde: string, texto: string) => {
    const rsConferidos = new Set<number>();
    for (const m of texto.matchAll(NUMERO_NO_TEXTO)) {
      const depois = texto.slice(m.index + m[0].length);
      const emReais = !!m[1] || /^\s*reais\b/i.test(depois);
      if (m[1]) rsConferidos.add(m.index);
      if (!emReais && /^\s*%/.test(depois)) continue;
      const br = FORMATO_BR.exec(m[2]!);
      // Dinheiro em outro formato ("R$ 12.50", "R$ 1,234.56", "1.234,567 reais") não passa calado: o modelo reescreve.
      if (!br) {
        if (emReais) problemas.push(`${onde}: ${m[0].trim()} — escreva no formato R$ 1.234,56, só com valores das linhas.`);
        continue;
      }
      if (!emReais && br[1] === undefined) continue;
      const [inteiro, cent = ''] = m[2]!.split(',');
      const valor = Number(inteiro!.replace(/\./g, '')) * 100 + Number(cent.padEnd(2, '0'));
      if (!aceitos.has(valor)) problemas.push(`${onde}: ${m[0].trim()} não está em nenhuma linha.`);
    }
    // Todo "R$" tem de vir com um número conferido acima ("R$ doze", "R$ ?" também voltam).
    for (const m of texto.matchAll(/R\$/g)) {
      if (!rsConferidos.has(m.index)) problemas.push(`${onde}: "${texto.slice(m.index, m.index + 20).trim()}" — escreva no formato R$ 1.234,56, só com valores das linhas.`);
    }
  };
  conferir('Resumo', r.resumo);
  r.destaques.forEach((d, i) => conferir(`Destaque ${i + 1} (${d.rotulo.trim().slice(0, 40)})`, [d.rotulo, d.valor, d.detalhe ?? ''].join(' ')));
  return problemas;
}

const Entradas = {
  listar_arquivos: z.object({}).passthrough(),
  ler_arquivo: z.object({ nome: z.string().trim().min(1).max(200), parte: z.number().int().min(1).default(1) }),
  dados_da_empresa: z.object({}).passthrough(),
  concluir_etapa: z.object({ etapa: z.number().int().min(1), resumo: z.string().trim().min(1).max(200) }),
  anotar: z.object({ texto: z.string().max(LIMITES_TAREFA.anotacoes) }),
  abrir_pendencia: z.object({
    tipo: z.enum(TIPOS_PENDENCIA), pergunta: z.string().trim().min(3).max(LIMITES_TAREFA.pergunta),
    detalhe: z.string().trim().max(LIMITES_TAREFA.detalhe).nullish(),
    opcoes: z.array(z.string().trim().min(1).max(LIMITES_TAREFA.opcao)).max(LIMITES_TAREFA.opcoes).default([]),
    mensagem_ao_cliente: z.string().trim().max(LIMITES_TAREFA.mensagem).nullish(),
  }),
  entregar_resultado: z.object({
    resumo: z.string().trim().min(1).max(LIMITES_TAREFA.resumo),
    destaques: z.array(z.object({ rotulo: z.string().trim().min(1).max(40), valor: z.string().trim().min(1).max(40), detalhe: z.string().trim().max(120).nullish() }))
      .max(LIMITES_TAREFA.destaques),
    linhas: z.array(z.object({
      descricao: z.string().trim().min(1).max(LIMITES_TAREFA.descricaoLinha), valor: z.number().finite().nullable(),
      texto: z.string().trim().max(300).nullish(), fonte: z.string().trim().max(200), provisoria: z.boolean(),
    })).max(LIMITES_TAREFA.linhas),
    observacoes: z.string().trim().max(2000).nullish(),
  }),
  ler_skill: z.object({ nome: z.string() }),
  ler_referencia: z.object({ skill: z.string(), arquivo: z.string(), parte: z.number().int().min(1).default(1) }),
};

/** As ferramentas da tarefa. A vez guarda o que mudou (a próxima ferramenta já vê). Nenhuma fala com o cliente. */
export async function executarFerramentaTarefa(
  d: DepsFerramentasTarefa, vez: VezDaTarefa, nome: string, entrada: unknown,
): Promise<ResultadoFerramentaTarefa> {
  if (!(nome in Entradas)) return falha(`Ferramenta não liberada para tarefas: ${nome}.`);
  const v = Entradas[nome as keyof typeof Entradas].safeParse(entrada ?? {});
  if (!v.success) return falha(`Entrada inválida: ${v.error.issues.map((i) => i.message).join('; ')}`);
  const t = vez.tarefa;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = v.data as any;
  switch (nome) {
    case 'listar_arquivos':
      return ok({ arquivos: t.arquivos.map((a) => ({ nome: a.nome, tipo: leituraDoArquivo(a.nome) ?? 'o agente não lê', lido: a.lido, detalhe: a.detalhe })) });
    case 'ler_arquivo': {
      const a = t.arquivos.find((x) => x.nome.toLowerCase() === String(e.nome).toLowerCase());
      if (!a) return falha(AVISOS_TAREFA.arquivoNaoEncontrado);
      const r = await lerArquivoDaTarefa(d.midia, a, e.parte);
      if (!r.ok) return falha(r.erro);
      if (!a.lido) {
        await d.repos.marcarArquivoLido(a.id, r.detalhe);
        a.lido = true;
        a.detalhe = r.detalhe;
        vez.lidosNaVez++;
      }
      return { conteudo: r.conteudo, erro: false };
    }
    case 'dados_da_empresa': {
      if (!t.clienteId) return falha(AVISOS_TAREFA.semEmpresa);
      const x = await d.repos.dadosDaEmpresa(t.clienteId);
      // Nunca honorários, contrato nem acessos de portais (spec 7D.1): só o cadastro.
      return ok({ razao_social: x.razaoSocial, nome_fantasia: x.nomeFantasia, cnpj: x.cnpj, inscricao_estadual: x.inscricaoEstadual,
        regime: x.regime, endereco: x.endereco, uf: x.uf });
    }
    case 'concluir_etapa': {
      try {
        await d.repos.concluirEtapaTarefa(t.id, e.etapa, e.resumo);
      } catch (erro) {
        return falha(doBanco(erro));
      }
      const atual = t.etapas[e.etapa - 1];
      if (atual) t.etapas[e.etapa - 1] = { ...atual, concluida: true, resumo: e.resumo };
      t.etapaAtual = Math.max(t.etapaAtual, Math.min(e.etapa + 1, t.etapas.length));
      return ok({ etapa: e.etapa, feita: true });
    }
    case 'anotar': {
      try {
        await d.repos.anotarTarefa(t.id, e.texto);
      } catch (erro) {
        return falha(doBanco(erro));
      }
      t.anotacoes = e.texto;
      return ok({ anotado: true });
    }
    case 'abrir_pendencia': {
      if (e.tipo === 'cliente' && !e.mensagem_ao_cliente?.trim()) return falha(AVISOS_TAREFA.mensagemCliente);
      let numero: number;
      try {
        numero = await d.repos.abrirPendenciaTarefa({ tarefaId: t.id, tipo: e.tipo, pergunta: e.pergunta, detalhe: e.detalhe ?? null,
          opcoes: e.tipo === 'analista' ? e.opcoes : [], mensagem: e.tipo === 'cliente' ? e.mensagem_ao_cliente : null });
      } catch (erro) {
        return falha(doBanco(erro));
      }
      vez.abriuPendencia = true;
      if (!t.pendencias.some((p) => p.numero === numero)) {
        t.pendencias.push({ id: '', numero, tipo: e.tipo, pergunta: e.pergunta, detalhe: e.detalhe ?? null, opcoes: e.opcoes, mensagem: e.mensagem_ao_cliente ?? null,
          estado: 'aberta', resposta: null, vista: false, pedidaAoCliente: false });
      }
      return ok({ pendencia: numero, instrucao: e.tipo === 'cliente' ? AVISOS_TAREFA.pendenciaCliente : AVISOS_TAREFA.pendenciaAnalista });
    }
    case 'entregar_resultado': {
      const r: ResultadoTarefa = {
        versao: 1, resumo: e.resumo, observacoes: e.observacoes ?? null,
        destaques: e.destaques.map((x: { rotulo: string; valor: string; detalhe?: string | null }) => ({ rotulo: x.rotulo, valor: x.valor, detalhe: x.detalhe ?? null })),
        linhas: e.linhas.map((l: { descricao: string; valor: number | null; texto?: string | null; fonte: string; provisoria: boolean }) =>
          ({ descricao: l.descricao, valor: l.valor, texto: l.texto ?? null, fonte: l.fonte, provisoria: l.provisoria })),
      };
      // D9: "nunca inventa valores" conferido aqui, não só no prompt.
      const problemas = conferirFontes(r, {
        arquivosLidos: t.arquivos.filter((a) => a.lido).map((a) => a.nome),
        pendenciasRespondidas: t.pendencias.filter((p) => p.estado === 'respondida').map((p) => p.numero),
        pendenciasAbertas: t.pendencias.filter((p) => p.estado === 'aberta').map((p) => p.numero),
      });
      if (problemas.length) return falha(`${AVISOS_TAREFA.semFonte} ${listaCurta(problemas)}`);
      // F9: o resumo e os cartões também não trazem valor que não esteja nas linhas conferidas acima.
      const soltos = conferirValoresCitados(r);
      if (soltos.length) return falha(`${AVISOS_TAREFA.valorSemLinha} ${listaCurta(soltos)}`);
      try {
        await d.repos.entregarResultadoTarefa(t.id, r);
      } catch (erro) {
        return falha(doBanco(erro));
      }
      vez.entregou = true;
      t.resultado = r;
      t.ajustePendente = false;
      return ok({ entregue: true, linhas: r.linhas.length, instrucao: AVISOS_TAREFA.entregue });
    }
    case 'ler_skill': {
      const r = lerSkillDoPerfil(vez.perfil, e.nome);
      return r.ok ? ok(r.dados) : falha(r.erro);
    }
    default: {
      const r = await lerReferenciaDoPerfil(d.repos, vez.perfil, e.skill, e.arquivo, e.parte);
      return r.ok ? ok(r.dados) : falha(r.erro);
    }
  }
}
