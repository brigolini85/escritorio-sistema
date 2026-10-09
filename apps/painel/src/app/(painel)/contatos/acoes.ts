'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { normalizarTelefone } from '@escritorio/core';
import { comAvisoNaUrl } from '@/lib/avisos';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { cadastrarContatoPeloTelefone, lerManter } from '@/lib/cadastro-contato';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Cadastra um contato, com ou sem empresa (o vínculo com empresa é feito na ficha dela). */
export async function cadastrarContato(formData: FormData) {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) throw new Error('Você não tem permissão para cadastrar contatos.');
  const nome = String(formData.get('nome') ?? '').trim();
  const telefone = normalizarTelefone(String(formData.get('telefone') ?? ''));
  if (nome.length < 2) throw new Error('Informe o nome do contato.');
  if (!telefone) throw new Error('Telefone inválido. Use DDD + número, ex.: (31) 99999-0000.');
  const sb = await supabaseServidor();
  // Telefone de contato arquivado traz o contato de volta só com as empresas de antes escolhidas na pergunta.
  const r = await cadastrarContatoPeloTelefone(sb, { nome, telefone, agentePausado: formData.get('agente_atende') !== 'on', manter: lerManter(formData) });
  // Recusa do banco (ex.: corrida com o mesmo número): o aviso vermelho da página, como nas outras telas.
  if ('erro' in r) redirect(`/contatos?erro=${encodeURIComponent(r.erro)}`);
  revalidatePath('/contatos');
  if (r.aviso) redirect(comAvisoNaUrl('/contatos', r.aviso));
}

export type ResultadoNome = { ok: true } | { ok: false; erro: string };

/** Nome do contato, pelo Editar do painel lateral (D6). Arquivado não se edita: volta pelo Restaurar. */
export async function renomearContato(id: string, formData: FormData): Promise<ResultadoNome> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erro: 'Você não tem permissão para editar contatos.' };
  const nome = String(formData.get('nome') ?? '').trim();
  if (nome.length < 2) return { ok: false, erro: 'Informe o nome do contato.' };
  const sb = await supabaseServidor();
  const { data, error } = await sb.from('contatos').update({ nome }).eq('id', id).eq('ativo', true).select('id');
  if (error) return { ok: false, erro: erroSeguro(error) };
  if (!data?.length) return { ok: false, erro: 'Contato não encontrado.' };
  revalidatePath('/contatos');
  revalidatePath('/clientes', 'layout');
  return { ok: true };
}

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };
export type CampoMarcacao = 'pode_pedir_nota' | 'pode_atualizar_preco';

const CAMPOS_MARCACAO: readonly string[] = ['pode_pedir_nota', 'pode_atualizar_preco'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEM_PERMISSAO_CONTATO = 'Você não tem permissão para editar contatos.';

/** Só o "raise exception" do banco (P0001) é frase para a pessoa; o resto do Postgres não vai para a tela. */
function erroSeguro(e: { code?: string; message: string }): string {
  return e.code === 'P0001' ? mensagemDoBanco(e.message) : 'Não foi possível salvar agora. Tente de novo.';
}

async function contatoEstaAtivo(sb: Awaited<ReturnType<typeof supabaseServidor>>, id: string): Promise<boolean> {
  const { data } = await sb.from('contatos').select('ativo').eq('id', id).maybeSingle();
  return data?.ativo === true;
}

// As marcações aparecem em Contatos, na ficha da empresa e na conversa aberta do Atendimento.
function revalidarMarcacoes(clienteId: string) {
  revalidatePath('/contatos');
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath('/atendimento', 'layout');
}

/**
 * Uma marcação de uma empresa do contato, pelo painel (spec 7C.2, D9). Mesma permissão de hoje: Clientes e contatos ≥
 * "Ver e editar"; a RLS (editar_clientes) recusa de novo e o gatilho de auditoria registra.
 */
export async function marcarEmpresaDoContato(contatoId: string, clienteId: string, campo: CampoMarcacao, valor: boolean): Promise<ResultadoAcao> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erro: SEM_PERMISSAO_CONTATO };
  // O campo e o valor vêm do navegador: só as duas marcações, só sim ou não.
  if (!CAMPOS_MARCACAO.includes(campo) || typeof valor !== 'boolean') return { ok: false, erro: 'Marcação inválida.' };
  const sb = await supabaseServidor();
  if (!(await contatoEstaAtivo(sb, contatoId))) return { ok: false, erro: 'Contato arquivado: restaure antes de mudar as marcações.' };
  const dados = campo === 'pode_pedir_nota' ? { pode_pedir_nota: valor } : { pode_atualizar_preco: valor };
  const { data, error } = await sb.from('contato_clientes').update(dados).eq('contato_id', contatoId).eq('cliente_id', clienteId).select('cliente_id');
  if (error) return { ok: false, erro: erroSeguro(error) };
  if (!data?.length) return { ok: false, erro: 'Este contato não está mais ligado a esta empresa.' };
  revalidarMarcacoes(clienteId);
  return { ok: true };
}

/** Liga o contato a uma empresa ativa, com as marcações escolhidas (D10). Insert, não upsert: repetido não apaga marcações. */
export async function vincularEmpresaAoContato(contatoId: string, formData: FormData): Promise<ResultadoAcao> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erro: SEM_PERMISSAO_CONTATO };
  const clienteId = String(formData.get('cliente_id') ?? '');
  if (!UUID.test(clienteId)) return { ok: false, erro: 'Escolha a empresa.' };
  const sb = await supabaseServidor();
  if (!(await contatoEstaAtivo(sb, contatoId))) return { ok: false, erro: 'Contato arquivado: restaure antes de vincular empresas.' };
  const { data: empresa } = await sb.from('clientes').select('ativo').eq('id', clienteId).maybeSingle();
  if (!empresa?.ativo) return { ok: false, erro: 'Empresa arquivada ou inexistente: escolha outra.' };
  const { error } = await sb.from('contato_clientes').insert({
    contato_id: contatoId, cliente_id: clienteId,
    pode_pedir_nota: formData.get('pode_pedir_nota') === 'on', pode_atualizar_preco: formData.get('pode_atualizar_preco') === 'on',
  });
  if (error) return { ok: false, erro: error.code === '23505' ? 'Este contato já está ligado a esta empresa.' : erroSeguro(error) };
  revalidarMarcacoes(clienteId);
  return { ok: true };
}
