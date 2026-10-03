'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { exigirAdmin, exigirConfiguracoes } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { z } from 'zod';
import { COLUNA_PRAZO, PRIORIDADES, type Resultado } from '@/lib/configuracoes';
import { EsperaForm, esquemaAvisoLogin, ExpedienteForm, FeriadoForm, PrazosForm, TetoAlertasForm } from './esquemas';

// Respostas dos cartões (D21): nada de redirect com ?erro=; o cartão mostra o erro e mantém o que foi digitado.
const ok = (mensagem: string): Resultado => ({ ok: true, mensagem });
const falha = (erro: string): Resultado => ({ ok: false, erro });
/** Só o "raise exception" do banco (P0001) é frase para a pessoa; o resto do Postgres fica no log do servidor. */
const doBanco = (e: { message: string; code?: string }): Resultado => {
  if (e.code === 'P0001') return falha(mensagemDoBanco(e.message));
  console.error('configuracoes: erro do banco', e.code, e.message);
  if (e.code === '42501') return falha('Você não tem permissão para mudar isto.');
  if (e.code === '23514') return falha('Algum valor está fora do permitido. Confira os campos.');
  return falha('Não consegui salvar. Tente de novo.');
};
const primeiroErro = (e: z.ZodError): Resultado => falha(e.issues[0]?.message ?? 'Confira os campos.');
const lerPrazos = (f: FormData) => Object.fromEntries(PRIORIDADES.map((p) => [COLUNA_PRAZO[p], String(f.get(COLUNA_PRAZO[p]) ?? '')]));

const recarregar = () => revalidatePath('/configuracoes');
function checar(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message);
}

export async function salvarSetor(id: string | null, formData: FormData) {
  await exigirConfiguracoes();
  const sb = await supabaseServidor();
  const dados = { nome: String(formData.get('nome')).trim(), descricao_assuntos: String(formData.get('descricao_assuntos') ?? '').trim(), ativo: formData.get('ativo') !== null || !id };
  checar(id ? await sb.from('setores').update(dados).eq('id', id) : await sb.from('setores').insert(dados));
  recarregar();
}

export async function salvarServico(id: string | null, formData: FormData) {
  await exigirConfiguracoes();
  const sb = await supabaseServidor();
  const dados = { nome: String(formData.get('nome')).trim(), setor_id: String(formData.get('setor_id') || '') || null, ativo: formData.get('ativo') !== null || !id };
  checar(id ? await sb.from('servicos').update(dados).eq('id', id) : await sb.from('servicos').insert(dados));
  recarregar();
}

export async function salvarResposta(formData: FormData) {
  await exigirConfiguracoes();
  const sb = await supabaseServidor();
  checar(await sb.from('respostas_prontas').insert({ pergunta: String(formData.get('pergunta')).trim(), resposta: String(formData.get('resposta')).trim() }));
  recarregar();
}

export async function removerResposta(id: string) {
  await exigirConfiguracoes();
  checar(await (await supabaseServidor()).from('respostas_prontas').delete().eq('id', id));
  recarregar();
}

export async function salvarExpediente(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = ExpedienteForm.safeParse(formData);
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('configuracoes').update(v.data).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Expediente salvo.');
}

/** Teto de IA e alertas: só o administrador (P12); o gatilho configuracoes_so_admin recusa de novo no banco. */
export async function salvarTetoAlertas(formData: FormData) {
  await exigirAdmin();
  checar(await (await supabaseServidor()).from('configuracoes').update(TetoAlertasForm.parse(formData)).eq('id', 1));
  recarregar();
}

export async function adicionarFeriado(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = FeriadoForm.safeParse({ data: String(formData.get('data') ?? ''), descricao: String(formData.get('descricao') ?? '') });
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('feriados').upsert(v.data);
  if (error) return doBanco(error);
  recarregar();
  return ok('Feriado adicionado.');
}

export async function removerFeriado(data: string) {
  await exigirConfiguracoes();
  checar(await (await supabaseServidor()).from('feriados').delete().eq('data', data));
  recarregar();
}

export async function salvarMensagens(formData: FormData) {
  await exigirConfiguracoes();
  // Com o agente pausado nada é enviado ao cliente (decisão do dono, 2026-09-28): não há mensagem de pausa.
  const chaves = ['aviso_lgpd', 'fora_do_horario', 'ia_indisponivel'];
  const mensagens = Object.fromEntries(chaves.map((k) => [k, String(formData.get(k) ?? '').trim()]));
  checar(await (await supabaseServidor()).from('configuracoes').update({ mensagens }).eq('id', 1));
  recarregar();
}

export async function salvarAvisoLogin(formData: FormData) {
  await exigirConfiguracoes();
  const dados = esquemaAvisoLogin.safeParse({ aviso_login: String(formData.get('aviso_login') ?? '') });
  if (!dados.success) redirect('/configuracoes?erro=aviso_login#aviso-login');
  checar(await (await supabaseServidor()).from('configuracoes').update({ aviso_login: dados.data.aviso_login }).eq('id', 1));
  recarregar();
}

/** Prazos por prioridade, só para as demandas novas (a janela de impacto entra na Task 6). */
export async function salvarPrazos(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = PrazosForm.safeParse(lerPrazos(formData));
  if (!v.success) return falha('Cada prazo vai de 0 a 30 dias úteis.');
  const { error } = await (await supabaseServidor()).from('configuracoes').update(v.data).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Prazos salvos. Valem para as demandas novas.');
}

/** Limites do cronômetro de espera (P18): "Configurações: Sim" como as outras seções; o banco valida de novo (check das colunas). */
export async function salvarLimitesEspera(formData: FormData) {
  await exigirConfiguracoes();
  const v = EsperaForm.safeParse({ espera_verde_min: String(formData.get('espera_verde_min') ?? ''), espera_ambar_min: String(formData.get('espera_ambar_min') ?? '') });
  if (!v.success) return { ok: false as const, erro: v.error.issues[0]!.message };
  const { error } = await (await supabaseServidor()).from('configuracoes').update(v.data).eq('id', 1);
  if (error) return { ok: false as const, erro: mensagemDoBanco(error.message) };
  recarregar();
  revalidatePath('/atendimento');
  return { ok: true as const, mensagem: 'Limites de espera salvos.' };
}
