// apps/painel/src/lib/arquivo-acoes.ts
'use server';
import { revalidatePath } from 'next/cache';
import { obterUsuario, temPermissao, type UsuarioPainel } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ehTipoCadastro, lerRestauroUnidade, lerUso, ROTAS_DO_TIPO, type RedeArquivada, type TipoCadastro, type UsoDoCadastro } from './arquivo';

export type ResultadoArquivo = { ok: true } | { ok: false; erro: string };
/** Restaurar unidade de rede arquivada devolve a pergunta em vez de restaurar (a tela confirma e chama com comRede). */
export type ResultadoRestaurar = ResultadoArquivo | { ok: false; redeArquivada: RedeArquivada };
type Conferido = { u: UsuarioPainel; tipo: TipoCadastro; id: string } | { erro: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mesma regra do banco (exigir_arquivar): a tela recusa antes, o banco recusa de novo. */
function motivoSemPermissao(u: UsuarioPainel, tipo: TipoCadastro): string | null {
  if (tipo === 'usuario') return u.papel === 'admin' ? null : 'Só o administrador arquiva pessoas.';
  return temPermissao(u, 'editar_clientes') ? null : 'Sem permissão para arquivar cadastros.';
}

async function conferir(tipo: unknown, id: unknown): Promise<Conferido> {
  if (!ehTipoCadastro(tipo) || typeof id !== 'string' || !UUID.test(id)) return { erro: 'Cadastro inválido.' };
  return { u: await obterUsuario(), tipo, id };
}

function revalidar(tipo: TipoCadastro) {
  for (const rota of ROTAS_DO_TIPO[tipo]) revalidatePath(rota, 'layout');
}

/** Chama a função do banco com a sessão da pessoa: a auditoria registra quem fez. */
async function chamar(nome: 'arquivar_cadastro' | 'restaurar_cadastro' | 'excluir_cadastro_definitivo', tipo: TipoCadastro, id: string) {
  const sb = await supabaseServidor();
  const { error } = await sb.rpc(nome, { p_tipo: tipo, p_id: id });
  return error ? error.message : null;
}

export async function consultarUso(tipo: TipoCadastro, id: string): Promise<{ ok: true; uso: UsoDoCadastro; admin: boolean } | { ok: false; erro: string }> {
  const c = await conferir(tipo, id);
  if ('erro' in c) return { ok: false, erro: c.erro };
  const motivo = motivoSemPermissao(c.u, c.tipo);
  if (motivo) return { ok: false, erro: motivo };
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('uso_do_cadastro', { p_tipo: c.tipo, p_id: c.id });
  if (error) return { ok: false, erro: error.message };
  try {
    return { ok: true, uso: lerUso(data), admin: c.u.papel === 'admin' };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

export async function arquivarCadastro(tipo: TipoCadastro, id: string): Promise<ResultadoArquivo> {
  const c = await conferir(tipo, id);
  if ('erro' in c) return { ok: false, erro: c.erro };
  const motivo = motivoSemPermissao(c.u, c.tipo);
  if (motivo) return { ok: false, erro: motivo };
  const erro = await chamar('arquivar_cadastro', c.tipo, c.id);
  if (erro) return { ok: false, erro };
  revalidar(c.tipo);
  return { ok: true };
}

export async function restaurarCadastro(tipo: TipoCadastro, id: string, opcoes: { comRede?: boolean } = {}): Promise<ResultadoRestaurar> {
  const c = await conferir(tipo, id);
  if ('erro' in c) return { ok: false, erro: c.erro };
  const motivo = motivoSemPermissao(c.u, c.tipo);
  if (motivo) return { ok: false, erro: motivo };
  if (c.tipo === 'unidade') {
    const sb = await supabaseServidor();
    const { data, error } = await sb.rpc('restaurar_unidade', { p_id: c.id, p_com_rede: opcoes.comRede === true });
    if (error) return { ok: false, erro: error.message };
    let r: ReturnType<typeof lerRestauroUnidade>;
    try {
      r = lerRestauroUnidade(data);
    } catch (e) {
      return { ok: false, erro: (e as Error).message };
    }
    if (!r.restaurada) return { ok: false, redeArquivada: r.rede };
    revalidar(c.tipo);
    return { ok: true };
  }
  const erro = await chamar('restaurar_cadastro', c.tipo, c.id);
  if (erro) return { ok: false, erro };
  revalidar(c.tipo);
  return { ok: true };
}

export async function excluirCadastroDeVez(tipo: TipoCadastro, id: string): Promise<ResultadoArquivo> {
  const c = await conferir(tipo, id);
  if ('erro' in c) return { ok: false, erro: c.erro };
  if (c.u.papel !== 'admin') return { ok: false, erro: 'Só o administrador exclui de vez.' };
  const erro = await chamar('excluir_cadastro_definitivo', c.tipo, c.id);
  if (erro) return { ok: false, erro };
  if (c.tipo === 'usuario') {
    // O banco já conferiu que a pessoa nunca atendeu e a tirou do painel; só a chave de serviço remove do login.
    const { error } = await supabaseServico().auth.admin.deleteUser(c.id);
    if (error) {
      console.error('[arquivo] pessoa excluída do painel, mas não do login', error.message);
      revalidar(c.tipo);
      return { ok: false, erro: `Saiu do painel, mas o login não foi removido: ${error.message}` };
    }
  }
  revalidar(c.tipo);
  return { ok: true };
}
