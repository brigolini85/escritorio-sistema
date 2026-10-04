'use server';
import { revalidatePath } from 'next/cache';
import { cifrar, cofreConfigurado, contextoAcesso, decifrar } from '@/lib/cofre';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { SEM_CHAVE, SEM_PERMISSAO_MUDAR, SEM_PERMISSAO_VER } from './acessos-textos';
import { UUID } from './ficha';

// Spec 7D.1 item 8: a senha entra aqui em claro, sai cifrada para o banco e só volta decifrada para quem revelou.
// Nada deste arquivo escreve no console nem põe a senha em mensagem de erro (teste de guarda).
// "Ver acessos de portais" (D6) é conferida pelo banco em salvar_acesso/remover_acesso/revelar_acesso, antes de gravar ou devolver.

export type EstadoAcesso = { ok: true } | { ok: false; erros: { portal?: string; usuario?: string; senha?: string; geral?: string } };
const FALHA = 'Não consegui salvar agora. Tente de novo.';
const NAO_ABRE = 'Não consegui abrir esta senha. Cadastre de novo.';
// Recusas (raise exception, P0001) das funções do banco que viram texto da tela; outra mensagem nunca aparece.
const RECUSAS = new Map([
  ['Sem permissão para mudar acessos de portais.', SEM_PERMISSAO_MUDAR],
  ['Sem permissão para ver acessos de portais.', SEM_PERMISSAO_VER],
  ['Este acesso não tem senha guardada.', 'Este acesso não tem senha guardada.'],
  ['Acesso não encontrado.', 'Acesso não encontrado.'],
  ['Cliente não encontrado.', 'Cliente não encontrado.'],
]);
function recusa(error: { code?: string; message: string }, padrao: string): string {
  return error.code === undefined || error.code === 'P0001' ? (RECUSAS.get(error.message) ?? padrao) : padrao;
}
const ehId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const textoDe = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : '');

export async function salvarAcesso(clienteId: string, acessoId: string | null, formData: FormData): Promise<EstadoAcesso> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erros: { geral: SEM_PERMISSAO_MUDAR } };
  if (!ehId(clienteId) || (acessoId !== null && !ehId(acessoId)) || !(formData instanceof FormData)) return { ok: false, erros: { geral: FALHA } };
  const portal = textoDe(formData.get('portal')).trim();
  const usuario = textoDe(formData.get('usuario')).trim();
  const semSenha = formData.get('sem_senha') === 'on';
  const senha = textoDe(formData.get('senha'));
  const erros: { portal?: string; usuario?: string; senha?: string } = {};
  if (!portal || portal.length > 80) erros.portal = 'Informe o portal (até 80 letras).';
  if (usuario.length > 120) erros.usuario = 'Usuário com até 120 letras.';
  if (!semSenha && senha.length > 200) erros.senha = 'Senha com até 200 letras.';
  if (!semSenha && !senha && acessoId === null) erros.senha = 'Informe a senha ou marque "Sem senha".';
  if (Object.keys(erros).length) return { ok: false, erros };
  // Sem a chave, cadastrar e editar ficam desligados (D8); remover continua.
  if (!cofreConfigurado()) return { ok: false, erros: { geral: SEM_CHAVE } };

  // nulo = mantém a senha guardada; '' = sem senha (D6).
  let cifrada: string | null = null;
  if (semSenha) cifrada = '';
  else if (senha) {
    try {
      cifrada = cifrar(senha, contextoAcesso(clienteId));
    } catch {
      return { ok: false, erros: { geral: SEM_CHAVE } };
    }
  }
  const { error } = await (await supabaseServidor()).rpc('salvar_acesso', {
    p_id: acessoId as string, p_cliente: clienteId, p_portal: portal, p_usuario: usuario, p_senha_cifrada: cifrada as string,
  });
  if (error) return { ok: false, erros: { geral: recusa(error, FALHA) } };
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

export async function removerAcesso(clienteId: string, acessoId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erro: SEM_PERMISSAO_MUDAR };
  if (!ehId(clienteId) || !ehId(acessoId)) return { ok: false, erro: FALHA };
  const { error } = await (await supabaseServidor()).rpc('remover_acesso', { p_id: acessoId });
  if (error) return { ok: false, erro: recusa(error, FALHA) };
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

type SenhaAberta = { ok: true; senha: string } | { ok: false; erro: string };

/**
 * Revelar e copiar passam pelo banco (permissão + auditoria, D5) e só depois a senha é decifrada aqui.
 * A senha volta só na resposta desta chamada: nada é guardado, refeito em cache nem posto em URL.
 */
async function abrir(acessoId: string, acao: 'revelar' | 'copiar'): Promise<SenhaAberta> {
  await obterUsuario();
  if (!ehId(acessoId)) return { ok: false, erro: 'Acesso não encontrado.' };
  if (!cofreConfigurado()) return { ok: false, erro: SEM_CHAVE };
  const { data, error } = await (await supabaseServidor()).rpc('revelar_acesso', { p_id: acessoId, p_acao: acao });
  if (error) return { ok: false, erro: recusa(error, 'Não consegui abrir a senha agora. Tente de novo.') };
  const r = data as { cliente_id?: unknown; senha_cifrada?: unknown } | null;
  if (!r || !ehId(r.cliente_id) || typeof r.senha_cifrada !== 'string') return { ok: false, erro: NAO_ABRE };
  try {
    return { ok: true, senha: decifrar(r.senha_cifrada, contextoAcesso(r.cliente_id)) };
  } catch {
    return { ok: false, erro: NAO_ABRE };
  }
}

export async function revelarAcesso(acessoId: string): Promise<SenhaAberta> {
  return abrir(acessoId, 'revelar');
}

export async function copiarAcesso(acessoId: string): Promise<SenhaAberta> {
  return abrir(acessoId, 'copiar');
}
