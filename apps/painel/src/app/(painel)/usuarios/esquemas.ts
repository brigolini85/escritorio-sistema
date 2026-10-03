import { MODULOS, NIVEIS, normalizarTelefone, type Modulo, type Niveis } from '@escritorio/core';
import { z } from 'zod';
import { lerHorarioAcesso, type HorarioAcesso } from '@/lib/horario-acesso';

/** Erro de cada campo da ficha. Erro ao salvar mantém tudo o que foi digitado (spec 7.1). */
export type CampoUsuario = 'nome' | 'email' | 'cargo' | 'telefone' | 'papel' | 'setores' | 'niveis' | 'horario' | 'observacoes' | 'geral';
export type ErrosUsuario = Partial<Record<CampoUsuario, string>>;
export type EstadoUsuario =
  | { ok: true; id: string }
  | { ok: false; erros: ErrosUsuario; telefoneDeArquivado?: { id: string; nome: string } };

export type DadosFicha = {
  nome: string; email: string; cargo: string | null; papel: 'admin' | 'atendente'; telefone: string | null;
  setores: string[]; niveis: Partial<Niveis>; observacoes: string | null;
  /** undefined = não mexe (administrador: o bloco fica escondido); null = sem restrição. */
  horario: HorarioAcesso | null | undefined;
};

/** Vazio = sem telefone; preenchido tem de ser um telefone com DDD (senão o WhatsApp do assistente não reconheceria a pessoa). */
const telefoneOpcional = z.preprocess((v) => (v && String(v).trim() ? String(v) : null), z.string().nullable())
  .transform((v, ctx) => {
    if (v === null) return null;
    const t = normalizarTelefone(v);
    if (!t) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Telefone inválido' });
    return t;
  });

const Base = z.object({
  nome: z.string().trim().min(2, 'Informe o nome'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  cargo: z.string().trim().max(60, 'Até 60 caracteres').transform((v) => v || null),
  papel: z.enum(['admin', 'atendente'], { message: 'Escolha se é administrador' }),
  telefone: telefoneOpcional,
  setores: z.array(z.string().uuid('Setor desconhecido')),
  observacoes: z.string().trim().max(1000, 'Até 1000 caracteres').transform((v) => v || null),
});

const CAMPOS = new Set<string>(['nome', 'email', 'cargo', 'telefone', 'papel', 'setores', 'observacoes']);

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

/** Lê a ficha. Níveis que não vieram (escondidos para o administrador) ficam de fora: o banco não os apaga. */
export function lerFicha(f: FormData): { ok: true; dados: DadosFicha } | { ok: false; erros: ErrosUsuario } {
  const base = Base.safeParse({
    nome: f.get('nome') ?? '', email: f.get('email') ?? '', cargo: f.get('cargo') ?? '', papel: f.get('papel'),
    telefone: f.get('telefone') || null, setores: f.getAll('setor'), observacoes: f.get('observacoes') ?? '',
  });
  const erros: ErrosUsuario = base.success ? {} : errosDoFormulario(base.error.issues);
  const niveis: Partial<Record<Modulo, string>> = {};
  for (const m of MODULOS) {
    const v = f.get(`nivel_${m}`);
    if (v === null) continue;
    if ((NIVEIS[m] as readonly string[]).includes(String(v))) niveis[m] = String(v);
    else erros.niveis = 'Nível desconhecido.';
  }
  let horario: HorarioAcesso | null | undefined;
  if (f.get('papel') !== 'admin') {
    const h = lerHorarioAcesso(f);
    if (!h.ok) erros.horario = h.erro;
    // Restrito sem nenhum dia liberado trancaria a pessoa para fora sem querer.
    else if (h.valor && !h.valor.semana && !h.valor.sabado && !h.valor.domingo) erros.horario = 'Escolha ao menos um dia com horário.';
    else horario = h.valor;
  }
  if (niveis.assistente === 'site_whatsapp' && base.success && base.data.telefone === null) {
    erros.telefone = 'Informe o telefone para usar o assistente pelo WhatsApp';
  }
  if (!base.success || Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, dados: { ...base.data, niveis: niveis as Partial<Niveis>, horario } };
}

/** O que salvar_usuario recebe (sem horario_acesso quando o bloco estava escondido). */
export function paraBanco(d: DadosFicha): Record<string, unknown> {
  return {
    nome: d.nome, email: d.email, papel: d.papel, cargo: d.cargo, telefone: d.telefone, setores: d.setores,
    niveis: d.niveis, observacoes: d.observacoes,
    ...(d.horario === undefined ? {} : { horario_acesso: d.horario }),
  };
}

export const FALHA_AO_SALVAR = 'Não consegui salvar agora. Tente de novo.';
export const FALHA_NO_CONVITE = 'Não consegui enviar o convite agora. Tente de novo em alguns minutos.';
/** Recusas de salvar_usuario e das travas de acesso que já falam com a pessoa: estas aparecem como vieram. */
const RECUSAS_DO_BANCO = new Set([
  'Só o administrador muda pessoas.', 'Escolha se é administrador.', 'Setor não encontrado.', 'Informe o e-mail.',
  'Esta pessoa está arquivada. Restaure antes de mudar.', 'Acesso desativado.', 'Fora do seu horário de acesso.',
]);

/**
 * Recusa do banco (ou do convite) no campo certo. Texto desconhecido (inglês do Auth, Postgres, RLS) não vai para a
 * tela: a pessoa vê um aviso fixo e o original fica no log do servidor.
 */
export function errosDoBanco(mensagem: string, origem: 'ficha' | 'convite' = 'ficha'): ErrosUsuario {
  if (mensagem.includes('already been registered') || mensagem.includes('usuarios_email_key')) return { email: 'Já existe uma pessoa com este e-mail.' };
  if (origem === 'convite') {
    console.error('[usuarios] convite recusado', mensagem);
    return { geral: FALHA_NO_CONVITE };
  }
  if (mensagem.includes('telefone para usar o assistente')) return { telefone: 'Informe o telefone para usar o assistente pelo WhatsApp' };
  if (mensagem.includes('próprio acesso de administrador')) return { papel: 'Você não pode tirar o seu próprio acesso de administrador.' };
  if (mensagem.includes('Horário de acesso inválido')) return { horario: 'Horário de acesso inválido.' };
  if (mensagem.includes('Informe o nome')) return { nome: 'Informe o nome' };
  if (mensagem.startsWith('Nível inválido')) return { niveis: 'Nível desconhecido.' };
  if (RECUSAS_DO_BANCO.has(mensagem)) return { geral: mensagem };
  console.error('[usuarios] recusa do banco', mensagem);
  // A ficha não manda estes (lerFicha confere antes); se chegarem, a pessoa vê o que fazer, não o erro do Postgres.
  if (mensagem.includes('violates foreign key constraint')) return { geral: PESSOA_SEM_ACESSO };
  if (mensagem.includes('invalid input syntax') || mensagem.includes('non-object') || mensagem.includes('cannot call')) {
    return { geral: 'Não consegui salvar: a ficha veio num formato inesperado. Recarregue a página e tente de novo.' };
  }
  return { geral: FALHA_AO_SALVAR };
}

export const PESSOA_SEM_ACESSO = 'Não encontrei o acesso desta pessoa. Volte à lista e abra a ficha de novo.';
