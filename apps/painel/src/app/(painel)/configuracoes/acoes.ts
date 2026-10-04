'use server';
import { revalidatePath } from 'next/cache';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { exigirAdmin, exigirConfiguracoes } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { z } from 'zod';
import { COLUNA_PRAZO, PRIORIDADES, type ImpactoPrazo, type Resultado } from '@/lib/configuracoes';
import { ROTULO_PRIORIDADE } from '@/lib/demandas';
import { CargosForm, CotacaoForm, EsperaForm, esquemaAvisoLogin, ExpedienteForm, FeriadoForm, modelosForm, PrazosForm, RespostaForm, ServicoForm, SetorForm, TetoAlertasForm } from './esquemas';

// Respostas dos cartões (D21): nada de redirect com ?erro=; o cartão mostra o erro e mantém o que foi digitado.
const ok = (mensagem: string): Resultado => ({ ok: true, mensagem });
const falha = (erro: string): Resultado => ({ ok: false, erro });
/** Só o "raise exception" do banco (P0001) é frase para a pessoa; o resto do Postgres fica no log do servidor. */
const textoDoBanco = (e: { message: string; code?: string }, generico = 'Não consegui salvar. Tente de novo.'): string => {
  if (e.code === 'P0001') return mensagemDoBanco(e.message);
  console.error('configuracoes: erro do banco', e.code, e.message);
  if (e.code === '42501') return 'Você não tem permissão para mudar isto.';
  if (e.code === '23514') return 'Algum valor está fora do permitido. Confira os campos.';
  return generico;
};
const doBanco = (e: { message: string; code?: string }): Resultado => falha(textoDoBanco(e));
const primeiroErro = (e: z.ZodError): Resultado => falha(e.issues[0]?.message ?? 'Confira os campos.');
const lerPrazos = (f: FormData) => Object.fromEntries(PRIORIDADES.map((p) => [COLUNA_PRAZO[p], String(f.get(COLUNA_PRAZO[p]) ?? '')]));

const recarregar = () => revalidatePath('/configuracoes');
function checar(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message);
}

/** Setores e serviços aparecem em demandas, atendimento, empresas, usuários, início e no treino do agente: sem revalidar, essas telas mostrariam a lista velha. */
function recarregarCadastros() {
  recarregar();
  for (const p of ['/demandas', '/atendimento', '/clientes', '/usuarios', '/inicio', '/treinar-agente']) revalidatePath(p, 'layout');
}
/** Nome repetido (unique de setores/servicos, 23505): a frase certa em vez do "não consegui salvar". */
const nomeRepetido = (e: { message: string; code?: string }, frase: string): Resultado => (e.code === '23505' ? falha(frase) : doBanco(e));

export async function salvarSetor(id: string | null, formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = SetorForm.safeParse({ nome: String(formData.get('nome') ?? ''), descricao_assuntos: String(formData.get('descricao_assuntos') ?? '') });
  if (!v.success) return primeiroErro(v.error);
  const dados = { ...v.data, ativo: formData.get('ativo') !== null || !id };
  const sb = await supabaseServidor();
  const { error } = id ? await sb.from('setores').update(dados).eq('id', id) : await sb.from('setores').insert(dados);
  if (error) return nomeRepetido(error, 'Já existe um setor com este nome.');
  recarregarCadastros();
  return ok(id ? 'Setor salvo.' : 'Setor criado.');
}

export async function salvarServico(id: string | null, formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = ServicoForm.safeParse({ nome: String(formData.get('nome') ?? ''), setor_id: String(formData.get('setor_id') || '') || null });
  if (!v.success) return primeiroErro(v.error);
  const dados = { ...v.data, ativo: formData.get('ativo') !== null || !id };
  const sb = await supabaseServidor();
  const { error } = id ? await sb.from('servicos').update(dados).eq('id', id) : await sb.from('servicos').insert(dados);
  if (error) return nomeRepetido(error, 'Já existe um serviço com este nome.');
  recarregarCadastros();
  return ok(id ? 'Serviço salvo.' : 'Serviço criado.');
}

/** Lista de cargos da ficha da pessoa (D10): Configurações: Sim; o banco confere de novo (cargos_validos). */
export async function salvarCargos(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = CargosForm.safeParse({ cargos: String(formData.get('cargos') ?? '') });
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('configuracoes').update({ cargos: v.data }).eq('id', 1);
  // O check cargos_validos (23514) só pega o que o Zod deixou passar (ex.: maiúsculas que o lower do banco junta e o pt-BR não).
  if (error) return error.code === '23514' ? falha('A lista de cargos tem cargo repetido, vazio ou longo demais.') : doBanco(error);
  recarregar();
  revalidatePath('/usuarios', 'layout');
  return ok('Cargos salvos.');
}

/** A conversa do Atendimento lê as respostas ativas: sem revalidar, o compositor mostraria a lista velha. */
const recarregarRespostas = () => { recarregar(); revalidatePath('/atendimento', 'layout'); };

/** Cria (id null) ou edita uma resposta pronta. Nova nasce ativa. */
export async function salvarResposta(id: string | null, formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  if (id !== null && !z.string().uuid().safeParse(id).success) return falha('Essa resposta não existe mais. Recarregue a página.');
  const v = RespostaForm.safeParse({
    pergunta: String(formData.get('pergunta') ?? ''), resposta: String(formData.get('resposta') ?? ''),
    ativo: id ? formData.get('ativo') !== null : true,
  });
  if (!v.success) return primeiroErro(v.error);
  const sb = await supabaseServidor();
  if (id) {
    // .select('id'): update que não achou a linha (apagada por outra pessoa) não pode dizer "salva".
    const { data, error } = await sb.from('respostas_prontas').update(v.data).eq('id', id).select('id');
    if (error) return doBanco(error);
    if (!data?.length) return falha('Essa resposta não existe mais. Recarregue a página.');
  } else {
    const { error } = await sb.from('respostas_prontas').insert(v.data);
    if (error) return doBanco(error);
  }
  recarregarRespostas();
  return ok(id ? 'Resposta pronta salva.' : 'Resposta pronta adicionada.');
}

export async function removerResposta(id: string) {
  await exigirConfiguracoes();
  checar(await (await supabaseServidor()).from('respostas_prontas').delete().eq('id', id));
  recarregarRespostas();
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

/** Teto de IA e alertas: só o administrador (P12 da Parte D); o gatilho configuracoes_so_admin recusa de novo no banco. */
export async function salvarTetoAlertas(formData: FormData): Promise<Resultado> {
  await exigirAdmin();
  const v = TetoAlertasForm.safeParse(formData);
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('configuracoes').update(v.data).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Teto e alertas salvos.');
}

export async function salvarCotacao(formData: FormData): Promise<Resultado> {
  await exigirAdmin();
  const v = CotacaoForm.safeParse(formData);
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('configuracoes').update(v.data).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Cotação e custo da transcrição salvos.');
}

export async function salvarModelos(formData: FormData): Promise<Resultado> {
  await exigirAdmin();
  const sb = await supabaseServidor();
  const { data: cfg, error: erroPrecos } = await sb.from('configuracoes').select('precos_modelos').eq('id', 1).single();
  if (erroPrecos) return doBanco(erroPrecos);
  const v = modelosForm(Object.keys((cfg?.precos_modelos ?? {}) as Record<string, unknown>)).safeParse(formData);
  if (!v.success) return primeiroErro(v.error);
  const { error } = await sb.from('configuracoes').update(v.data).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Modelos salvos.');
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

export async function salvarMensagens(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  // Com o agente pausado nada é enviado ao cliente (decisão do dono, 2026-09-28): não há mensagem de pausa.
  const chaves = ['aviso_lgpd', 'fora_do_horario', 'ia_indisponivel'];
  const mensagens = Object.fromEntries(chaves.map((k) => [k, String(formData.get(k) ?? '').trim()]));
  const { error } = await (await supabaseServidor()).from('configuracoes').update({ mensagens }).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Mensagens salvas.');
}

export async function salvarAvisoLogin(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = esquemaAvisoLogin.safeParse({ aviso_login: String(formData.get('aviso_login') ?? '') });
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('configuracoes').update({ aviso_login: v.data.aviso_login }).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Aviso do login salvo.');
}

const COLUNAS_PRAZO = 'prazo_urgente_dias, prazo_alta_dias, prazo_normal_dias, prazo_baixa_dias';

/** Impacto de cada prioridade mudada nas demandas abertas, sem gravar (simular_mudanca_prazo é stable). */
export async function simularPrazos(formData: FormData): Promise<{ ok: true; impactos: ImpactoPrazo[] } | { ok: false; erro: string }> {
  await exigirConfiguracoes();
  const v = PrazosForm.safeParse(lerPrazos(formData));
  if (!v.success) return { ok: false, erro: 'Cada prazo vai de 0 a 30 dias úteis.' };
  const sb = await supabaseServidor();
  const { data: cfg, error } = await sb.from('configuracoes').select(COLUNAS_PRAZO).eq('id', 1).single();
  if (error || !cfg) return { ok: false, erro: error ? textoDoBanco(error, 'Não consegui ler os prazos.') : 'Não consegui ler os prazos.' };
  const impactos: ImpactoPrazo[] = [];
  for (const p of PRIORIDADES) {
    const col = COLUNA_PRAZO[p];
    // Diferença 0 não recalcula nada (D1 desloca pela diferença): a prioridade nem entra na janela.
    if (v.data[col] === cfg[col]) continue;
    const r = await sb.rpc('simular_mudanca_prazo', { p_prioridade: p, p_dias: v.data[col] });
    // Homologação sem a migração (D25) cai aqui: a janela não abre e o cartão avisa.
    if (r.error) return { ok: false, erro: `Não consegui calcular o impacto: ${textoDoBanco(r.error, 'o banco não respondeu. Nada foi salvo.')}` };
    impactos.push(r.data as unknown as ImpactoPrazo);
  }
  return { ok: true, impactos };
}

/** Prazos por prioridade. Com aplicar=sim, cada prioridade mudada grava a regra e recalcula as abertas na mesma transação (D2). */
export async function salvarPrazos(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = PrazosForm.safeParse(lerPrazos(formData));
  if (!v.success) return falha('Cada prazo vai de 0 a 30 dias úteis.');
  const sb = await supabaseServidor();
  if (formData.get('aplicar') !== 'sim') {
    const { error } = await sb.from('configuracoes').update(v.data).eq('id', 1);
    if (error) return doBanco(error);
    recarregar();
    return ok('Prazos salvos. Valem para as demandas novas.');
  }
  const { data: cfg, error } = await sb.from('configuracoes').select(COLUNAS_PRAZO).eq('id', 1).single();
  if (error || !cfg) return error ? doBanco(error) : falha('Não consegui ler os prazos.');
  let mudaram = 0;
  const feitas: string[] = [];
  for (const p of PRIORIDADES) {
    const col = COLUNA_PRAZO[p];
    if (v.data[col] === cfg[col]) continue;
    const r = await sb.rpc('aplicar_prazo_abertas', { p_prioridade: p, p_dias: v.data[col] });
    if (r.error) {
      recarregar();
      return falha(`${feitas.length ? `Já aplicado: ${feitas.join(', ')}. ` : ''}${ROTULO_PRIORIDADE[p]}: ${textoDoBanco(r.error)}`);
    }
    mudaram += Number(r.data ?? 0);
    feitas.push(ROTULO_PRIORIDADE[p]);
  }
  recarregar();
  revalidatePath('/demandas');
  return ok(`Prazos salvos e aplicados: ${mudaram === 1 ? '1 demanda aberta mudou de prazo' : `${mudaram} demandas abertas mudaram de prazo`}.`);
}

/** Limites do cronômetro de espera (P18): "Configurações: Sim" como as outras seções; o banco valida de novo (check das colunas). */
export async function salvarLimitesEspera(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = EsperaForm.safeParse({ espera_verde_min: String(formData.get('espera_verde_min') ?? ''), espera_ambar_min: String(formData.get('espera_ambar_min') ?? '') });
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('configuracoes').update(v.data).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  revalidatePath('/atendimento');
  return ok('Limites de espera salvos.');
}
