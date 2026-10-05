'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { ESTADOS_AGENTE, MODOS_CONTATO, TIPOS_AGENTE, slugDoNome, type TipoAgente } from '@escritorio/core';
import type { ContatoTeste } from '@/lib/agentes';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };
const FALHA = 'Não foi possível salvar agora. Tente de novo.';
const Slug = z.string().regex(/^[a-z][a-z0-9-]{1,39}$/, 'Agente não encontrado.');
const Uuid = z.string().uuid('Contato inválido.');

const DadosAgente = z.object({
  nome: z.string().trim().min(2, 'O nome do agente tem de 2 a 60 letras.').max(60, 'O nome do agente tem de 2 a 60 letras.'),
  descricao: z.string().trim().max(120, 'A descrição tem até 120 letras.'),
  setorId: z.string().uuid('Setor não encontrado ou inativo.').nullable(),
  tipos: z.array(z.enum(TIPOS_AGENTE)).min(1, 'Escolha Conversa, Trabalho ou os dois.').max(2, 'Escolha Conversa, Trabalho ou os dois.'),
  estado: z.enum(ESTADOS_AGENTE, { message: 'Estado inválido.' }),
  modelo: z.string().trim().max(100).nullable(),
  modoContato: z.enum(MODOS_CONTATO, { message: 'Modo de falar com o cliente inválido.' }).nullable(),
  ferramentas: z.array(z.string().max(60)).max(60),
}).partial().strict();
export type DadosAgente = z.input<typeof DadosAgente>;

/** Chama a função do banco; P0001 é a frase para a pessoa (D11: o banco confere o dono de novo). */
async function chamar(rodar: (sb: Awaited<ReturnType<typeof supabaseServidor>>) => PromiseLike<{ error: { code?: string; message: string } | null }>): Promise<ResultadoAcao> {
  try {
    await obterUsuario();
    const { error } = await rodar(await supabaseServidor());
    if (error) {
      if (error.code !== 'P0001') console.error('[agentes] falha ao salvar', error);
      return { ok: false, erro: error.code === 'P0001' ? mensagemDoBanco(error.message) : FALHA };
    }
    revalidatePath('/agentes', 'layout');
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);   // sessão vencida: redirect para /entrar continua valendo
    console.error('[agentes] falha ao salvar', e);
    return { ok: false, erro: FALHA };
  }
}

export async function salvarAgente(slug: string, dados: DadosAgente): Promise<ResultadoAcao> {
  const s = Slug.safeParse(slug);
  const v = DadosAgente.safeParse(dados);
  if (!s.success) return { ok: false, erro: 'Agente não encontrado.' };
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? 'Dados do agente inválidos.' };
  const d = v.data;
  // Só as chaves que vieram: o banco mexe só nelas (e registra uma frase por mudança, D28).
  const p_dados = {
    ...(d.nome !== undefined ? { nome: d.nome } : {}), ...(d.descricao !== undefined ? { descricao: d.descricao } : {}),
    ...(d.setorId !== undefined ? { setor_id: d.setorId } : {}), ...(d.tipos !== undefined ? { tipos: d.tipos } : {}),
    ...(d.estado !== undefined ? { estado: d.estado } : {}), ...(d.modelo !== undefined ? { modelo: d.modelo } : {}),
    ...(d.modoContato !== undefined ? { modo_contato: d.modoContato } : {}), ...(d.ferramentas !== undefined ? { ferramentas: d.ferramentas } : {}),
  };
  return chamar((sb) => sb.rpc('salvar_agente', { p_slug: s.data, p_dados }));
}

export async function definirContatosTeste(slug: string, contatoIds: string[]): Promise<ResultadoAcao> {
  if (!Slug.safeParse(slug).success) return { ok: false, erro: 'Agente não encontrado.' };
  if (contatoIds.length > 20) return { ok: false, erro: 'Em teste, no máximo 20 contatos.' };
  if (!contatoIds.every((id) => Uuid.safeParse(id).success)) return { ok: false, erro: 'Contato inválido.' };
  return chamar((sb) => sb.rpc('definir_contatos_teste', { p_slug: slug, p_contatos: [...new Set(contatoIds)] }));
}

const Regra = z.object({
  assunto: z.string().trim().min(2, 'O assunto tem de 2 a 80 letras.').max(80, 'O assunto tem de 2 a 80 letras.'),
  exemplo: z.string().trim().max(200, 'O exemplo tem até 200 letras.'),
  modo: z.enum(MODOS_CONTATO, { message: 'Escolha como o agente fala com o cliente nesse assunto.' }),
});
export async function salvarRegraAssunto(slug: string, id: string | null, dados: z.input<typeof Regra>): Promise<ResultadoAcao> {
  const v = Regra.safeParse(dados);
  if (!Slug.safeParse(slug).success) return { ok: false, erro: 'Agente não encontrado.' };
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? 'Regra inválida.' };
  if (id !== null && !Uuid.safeParse(id).success) return { ok: false, erro: 'Regra não encontrada.' };
  return chamar((sb) => sb.rpc('salvar_regra_assunto', {
    p_slug: slug, p_id: id as unknown as string, p_assunto: v.data.assunto, p_exemplo: v.data.exemplo, p_modo: v.data.modo,
  }));
}

export async function excluirRegraAssunto(id: string): Promise<ResultadoAcao> {
  if (!Uuid.safeParse(id).success) return { ok: false, erro: 'Regra não encontrada.' };
  return chamar((sb) => sb.rpc('excluir_regra_assunto', { p_id: id }));
}

/** + NOVO AGENTE (D25): o endereço sai do nome. */
export async function criarAgente(dados: { nome: string; setorId: string | null; tipos: TipoAgente[]; descricao: string }): Promise<{ ok: true; slug: string } | { ok: false; erro: string }> {
  const v = DadosAgente.pick({ nome: true, setorId: true, tipos: true, descricao: true }).required().safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? 'Dados do agente inválidos.' };
  let slug = '';
  const r = await chamar(async (sb) => {
    const resposta = await sb.rpc('criar_agente', { p_dados: {
      slug: slugDoNome(v.data.nome), nome: v.data.nome, setor_id: v.data.setorId, tipos: v.data.tipos, descricao: v.data.descricao,
    } });
    slug = typeof resposta.data === 'string' ? resposta.data : '';
    return resposta;
  });
  return r.ok ? { ok: true, slug } : r;
}

/** Busca para "+ ADICIONAR CONTATO" do Teste: nome ou telefone, só contatos ativos, até 10. */
export async function buscarContatosParaTeste(q: string): Promise<ContatoTeste[]> {
  const termo = q.trim().slice(0, 60);
  if (termo.length < 2) return [];
  try {
    await obterUsuario();
    const sb = await supabaseServidor();
    const digitos = termo.replace(/\D/g, '');
    const consulta = sb.from('contatos').select('id, nome, telefone').eq('ativo', true).order('nome').limit(10);
    const { data } = await (digitos.length >= 4 ? consulta.like('telefone', `%${digitos}%`) : consulta.ilike('nome', `%${termo.replace(/[%_]/g, '')}%`));
    return data ?? [];
  } catch (e) {
    unstable_rethrow(e);
    return [];
  }
}
