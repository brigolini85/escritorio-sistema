import { z } from 'zod';
import { LIMITE_TEXTO, LIMITE_TITULO, TIPOS, type TipoOrientacao } from '../../../lib/orientacoes';
import { valorParam, type ParamsBusca } from '../../../lib/tabela-url';
import { mascararCNPJ } from '../../../lib/formatos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (v: string | null | undefined): v is string => Boolean(v && UUID.test(v));

export type ValePara = 'todos' | 'empresa' | 'setor';

/**
 * Formulário da orientação (painel lateral). Campos: titulo, tipo, vale (todos | empresa | setor), cliente_id, setor_id,
 * texto e ativo (Switch: "on" quando ligado). Só o id do "vale para" escolhido segue: trocar de Empresa para Todos
 * não leva a empresa junto. As mensagens são as mesmas das funções do banco, que conferem tudo de novo.
 */
export const OrientacaoForm = z.preprocess((v) => {
  const f = v as FormData;
  const texto = (k: string) => {
    const x = f.get(k);
    return typeof x === 'string' ? x : '';
  };
  return {
    titulo: texto('titulo'), texto: texto('texto'), tipo: texto('tipo'), vale: texto('vale') || 'todos',
    clienteId: texto('cliente_id'), setorId: texto('setor_id'), ativo: f.get('ativo') === 'on',
  };
}, z.object({
  titulo: z.string().trim().min(1, 'Informe o título da orientação.').max(LIMITE_TITULO, `O título pode ter no máximo ${LIMITE_TITULO} caracteres.`),
  // Quebras de linha do navegador (CRLF) contam como uma só, como no banco depois do trim.
  texto: z.string().transform((t) => t.replace(/\r\n/g, '\n').trim())
    .pipe(z.string().min(1, 'Escreva o texto da orientação.').max(LIMITE_TEXTO, `O texto pode ter no máximo ${LIMITE_TEXTO} caracteres.`)),
  tipo: z.enum(TIPOS as [TipoOrientacao, ...TipoOrientacao[]], { message: 'Escolha o tipo da orientação.' }),
  vale: z.enum(['todos', 'empresa', 'setor'], { message: 'Escolha para quem a orientação vale.' }),
  clienteId: z.string(),
  setorId: z.string(),
  ativo: z.boolean(),
}).transform((d, ctx) => {
  const clienteId = d.vale === 'empresa' ? d.clienteId : null;
  const setorId = d.vale === 'setor' ? d.setorId : null;
  if (d.vale === 'empresa' && !ehUuid(clienteId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Escolha a empresa.' });
  if (d.vale === 'setor' && !ehUuid(setorId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Escolha o setor.' });
  return { titulo: d.titulo, texto: d.texto, tipo: d.tipo, clienteId, setorId, ativo: d.ativo };
}));
export type DadosOrientacao = z.output<typeof OrientacaoForm>;

/** Filtros da lista (?tipo=, ?vale=, ?ativo=, ?q=). Valor desconhecido na URL vale como "sem filtro". */
export function lerFiltrosOrientacoes(params: ParamsBusca) {
  const tipo = valorParam(params, 'tipo');
  const vale = valorParam(params, 'vale');
  const ativo = valorParam(params, 'ativo');
  return {
    tipo: TIPOS.includes(tipo as TipoOrientacao) ? (tipo as TipoOrientacao) : null,
    vale: vale === 'todos' || vale === 'empresa' || vale === 'setor' ? (vale as ValePara) : null,
    ativo: ativo === 'ligadas' || ativo === 'desligadas' ? (ativo as 'ligadas' | 'desligadas') : null,
    q: (valorParam(params, 'q') ?? '').trim(),
  };
}

/** Busca sem diferenciar acentos nem maiúsculas. */
export function normalizarBusca(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}

/** Para onde a action volta: só endereços desta tela (o valor vem do formulário). */
export function destinoDaTela(voltar: unknown): string {
  const v = typeof voltar === 'string' ? voltar : '';
  return /^\/treinar-agente(\?[^\s]*)?$/.test(v) ? v : '/treinar-agente';
}

/** Modelos do estado vazio: clicar abre o formulário já preenchido (?orientacao=nova&modelo=<id>). */
export const MODELOS = [
  {
    id: 'cumprimento', tipo: 'jeito', titulo: 'Cumprimento',
    texto: 'Comece sempre pelo nome do cliente e responda em no máximo duas frases.',
  },
  {
    id: 'prazo-documentos', tipo: 'regra', titulo: 'Prazo de documentos',
    texto: 'Documentos pedidos até as 15h saem no mesmo dia; depois disso, no dia útil seguinte.',
  },
  {
    id: 'segunda-via-boleto', tipo: 'situacao', titulo: '2ª via de boleto',
    texto: 'Pergunte o mês de competência antes de abrir a demanda para o Financeiro.',
  },
] as const satisfies readonly { id: string; tipo: TipoOrientacao; titulo: string; texto: string }[];

export function modeloPorId(id: string | undefined) {
  return MODELOS.find((m) => m.id === id) ?? null;
}

type LinhaEmpresa = { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string; ativo: boolean };
export const nomeEmpresa = (c: Pick<LinhaEmpresa, 'razao_social' | 'nome_fantasia'>) => c.nome_fantasia || c.razao_social;

/** Linha de clientes → opção do EscolherEmpresa (nome fantasia, razão social + CNPJ no detalhe). */
export function opcaoEmpresa(c: LinhaEmpresa): { id: string; nome: string; detalhe: string; inativa: boolean } {
  return { id: c.id, nome: nomeEmpresa(c), detalhe: [c.nome_fantasia ? c.razao_social : null, mascararCNPJ(c.cnpj)].filter(Boolean).join(' · '), inativa: !c.ativo };
}

export const AVISO_EMPRESAS_INCOMPLETAS = 'Não consegui carregar todas as empresas: alguma pode faltar na busca.';
