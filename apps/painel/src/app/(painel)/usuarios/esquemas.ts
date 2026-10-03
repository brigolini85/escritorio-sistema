import { z } from 'zod';
import { normalizarTelefone } from '@escritorio/core';

/** Permissões por pessoa (aba Usuários). As do assistente valem também para o administrador. */
export const PERMISSOES = [
  { valor: 'editar_clientes', rotulo: 'Editar clientes e contatos' },
  { valor: 'editar_precos', rotulo: 'Editar preços' },
  { valor: 'emitir_notas', rotulo: 'Corrigir pedidos de nota e gerar CSV do Bling' },
  { valor: 'assistente_site', rotulo: 'Usar o assistente pelo site' },
  { valor: 'assistente_whatsapp', rotulo: 'Usar o assistente pelo WhatsApp (pelo telefone acima)' },
  { valor: 'treinar_agente', rotulo: 'Treinar o agente' },
] as const;

/** Vazio = sem telefone; preenchido tem de ser um telefone com DDD (senão o WhatsApp do assistente não reconheceria a pessoa). */
const telefoneOpcional = z.preprocess((v) => (v && String(v).trim() ? String(v) : null), z.string().nullable())
  .transform((v, ctx) => {
    if (v === null) return null;
    const t = normalizarTelefone(v);
    if (!t) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Telefone inválido' });
    return t;
  });

export const UsuarioForm = z.preprocess((v) => {
  const f = v as FormData;
  return {
    nome: f.get('nome'), email: f.get('email'), papel: f.get('papel'),
    telefone: f.get('telefone') || null, setores: f.getAll('setor'), permissoes: f.getAll('permissao'),
  };
}, z.object({
  nome: z.string().trim().min(2, 'Informe o nome'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  papel: z.enum(['admin', 'atendente']),
  telefone: telefoneOpcional,
  setores: z.array(z.string()),
  permissoes: z.array(z.enum(PERMISSOES.map((p) => p.valor) as [string, ...string[]], { message: 'Permissão desconhecida' })),
}).refine((u) => !u.permissoes.includes('assistente_whatsapp') || u.telefone !== null,
  { message: 'Informe o telefone para usar o assistente pelo WhatsApp', path: ['telefone'] }));

/** Resultado de salvar ou convidar: o erro volta para a tela, no campo (sobra 6 da Parte B), sem ?erro= na URL. */
export type CampoUsuario = 'nome' | 'email' | 'telefone' | 'papel' | 'geral';
export type ErrosUsuario = Partial<Record<CampoUsuario, string>>;
export type EstadoUsuario =
  | { ok: true }
  | { ok: false; erros: ErrosUsuario; telefoneDeArquivado?: { id: string; nome: string } };

const CAMPOS = new Set<string>(['nome', 'email', 'telefone', 'papel']);

/** Mensagens da validação agrupadas por campo; o que não é campo do formulário vai para "geral". */
export function errosDoFormulario(issues: { path: PropertyKey[]; message: string }[]): ErrosUsuario {
  const erros: ErrosUsuario = {};
  for (const i of issues) {
    const campo = (CAMPOS.has(String(i.path[0])) ? String(i.path[0]) : 'geral') as CampoUsuario;
    const atual = erros[campo];
    if (!atual) erros[campo] = i.message;
    else if (!atual.split('; ').includes(i.message)) erros[campo] = `${atual}; ${i.message}`;
  }
  return erros;
}
