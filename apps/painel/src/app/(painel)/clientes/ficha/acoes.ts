'use server';
import { somenteDigitos, validarCnpj } from '@escritorio/core';
import { revalidatePath } from 'next/cache';
import { consultarCep, consultarCnpj, type DadosCep, type DadosCnpj, type ResultadoBusca } from '@/lib/consultas-publicas';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { LIMITES, lerFicha, UFS, UUID, type ErrosFicha, type EstadoFicha } from './ficha';

const SEM_PERMISSAO = 'Não foi possível salvar: você não tem permissão para editar clientes.';
const FALHA = 'Não foi possível salvar: não consegui gravar agora. Tente de novo.';
// Recusas de salvar_ficha_cliente que já falam com a pessoa; o resto vira aviso fixo (o original fica no log).
const RECUSAS = new Set([
  'Você não tem permissão para editar clientes.', 'Informe a razão social.', 'Cliente não encontrado.',
  'Informe a UF de cada inscrição de substituto tributário.', 'UF repetida nas inscrições de substituto tributário.',
]);

/** A aba Dados inteira numa chamada (D13). O erro volta para a tela, no campo, sem perder o que foi digitado. */
export async function salvarFicha(id: string | null, formData: FormData): Promise<EstadoFicha> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erros: { geral: SEM_PERMISSAO } };
  // A ação é chamável pelo navegador com qualquer argumento: só texto no formato de id (ou nulo) segue.
  if (id !== null && (typeof id !== 'string' || !UUID.test(id))) return { ok: false, erros: { geral: FALHA } };
  if (!(formData instanceof FormData)) return { ok: false, erros: { geral: FALHA } };
  const lido = lerFicha(formData, { admin: u.papel === 'admin' });
  if (!lido.ok) return lido;
  const sb = await supabaseServidor();
  // O tipo gerado pede string em p_id; o PostgREST envia o nulo como nulo (cliente novo).
  const { data, error } = await sb.rpc('salvar_ficha_cliente', { p_id: id as string, p_dados: lido.dados as never });
  if (error) return { ok: false, erros: await errosDoBanco(sb, error, lido.dados.cnpj) };
  revalidatePath('/clientes');
  revalidatePath(`/clientes/${data}`);
  return { ok: true, id: data as string };
}

async function errosDoBanco(sb: Awaited<ReturnType<typeof supabaseServidor>>, error: { code?: string; message: string }, cnpj: string): Promise<ErrosFicha> {
  if (error.code === '23505' || error.message.includes('duplicate')) {
    // CNPJ é único também entre os arquivados: aponta o caminho em vez de um "já existe" sem saída (texto de hoje).
    const { data: arquivado } = await sb.from('clientes').select('id').eq('cnpj', cnpj).eq('ativo', false).maybeSingle();
    return {
      cnpj: 'CNPJ já cadastrado',
      geral: `Não foi possível salvar: ${arquivado ? 'Este CNPJ é de um cliente arquivado. Restaure em Clientes › Arquivados.' : 'Já existe cliente com este CNPJ.'}`,
    };
  }
  // Só o "raise exception" da função (P0001) com texto conhecido chega à tela; mensagem crua do Postgres nunca.
  if ((error.code === undefined || error.code === 'P0001') && RECUSAS.has(error.message)) return { geral: `Não foi possível salvar: ${error.message}` };
  console.error('[ficha do cliente] salvar recusado', error.code, error.message);
  return { geral: FALHA };
}

export type RespostaBusca<T> = ResultadoBusca<T> | { ok: false; motivo: 'invalido' | 'sem_permissao' };

const corte = (v: string | null, max: number) => (v ? v.slice(0, max) : null);
const ufValida = (v: string | null) => (v && /^[A-Z]{2}$/.test(v) && (UFS as readonly string[]).includes(v) ? v : null);

/** Resposta de fora conferida antes de ir para a tela: textos no tamanho dos campos, UF de 2 letras, CEP de 8 números. */
function limparCnpj(d: DadosCnpj): DadosCnpj {
  return {
    razao_social: corte(d.razao_social, LIMITES.razao_social), nome_fantasia: corte(d.nome_fantasia, LIMITES.nome_fantasia),
    cnae_principal: corte(d.cnae_principal, LIMITES.cnae_principal), cep: d.cep && /^\d{8}$/.test(d.cep) ? d.cep : null,
    logradouro: corte(d.logradouro, LIMITES.logradouro), numero: corte(d.numero, LIMITES.numero),
    complemento: corte(d.complemento, LIMITES.complemento), bairro: corte(d.bairro, LIMITES.bairro), cidade: corte(d.cidade, LIMITES.cidade),
    uf: ufValida(d.uf),
  };
}
function limparCep(d: DadosCep): DadosCep {
  return {
    logradouro: corte(d.logradouro, LIMITES.logradouro), bairro: corte(d.bairro, LIMITES.bairro), cidade: corte(d.cidade, LIMITES.cidade),
    uf: ufValida(d.uf),
  };
}

/** Busca pública pelo servidor (spec 7D.1, D15): só para pessoa ativa que edita clientes (nunca ponte aberta), só com o número. */
export async function buscarCnpj(cnpj: string): Promise<RespostaBusca<DadosCnpj>> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, motivo: 'sem_permissao' };
  if (typeof cnpj !== 'string' || cnpj.length > 40) return { ok: false, motivo: 'invalido' };
  const numero = somenteDigitos(cnpj);
  if (!validarCnpj(numero)) return { ok: false, motivo: 'invalido' };
  const r = await consultarCnpj(numero);
  return r.ok ? { ok: true, dados: limparCnpj(r.dados) } : r;
}

export async function buscarCep(cep: string): Promise<RespostaBusca<DadosCep>> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, motivo: 'sem_permissao' };
  if (typeof cep !== 'string' || cep.length > 20) return { ok: false, motivo: 'invalido' };
  const numero = somenteDigitos(cep);
  if (numero.length !== 8) return { ok: false, motivo: 'invalido' };
  const r = await consultarCep(numero);
  return r.ok ? { ok: true, dados: limparCep(r.dados) } : r;
}
