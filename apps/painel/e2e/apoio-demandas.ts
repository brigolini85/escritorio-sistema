import { db } from './apoio';

export async function setorId(nome: string): Promise<string> {
  const { data } = await db.from('setores').select('id').eq('nome', nome).single();
  return data!.id as string;
}

export async function empresaE2e(razao: string, cnpj: string): Promise<string> {
  await db.from('chamados').delete().in('cliente_id', (await db.from('clientes').select('id').eq('cnpj', cnpj)).data?.map((c) => c.id) ?? []);
  await db.from('clientes').delete().eq('cnpj', cnpj);
  const { data, error } = await db.from('clientes').insert({ razao_social: razao, cnpj }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

/** Demanda de teste, direto no banco (o gatilho calcula o prazo quando prazoEm não vem). */
export async function demandaE2e(d: {
  titulo: string; setor: string; resumo?: string; clienteId?: string; status?: string; prioridade?: string; prazoEm?: string;
  responsavelId?: string; origem?: string; conversaId?: string; pedidoVenda?: unknown; contatoId?: string;
}): Promise<{ id: string; numero: number }> {
  await db.from('chamados').delete().eq('titulo', d.titulo);
  const { data, error } = await db.from('chamados').insert({
    titulo: d.titulo, resumo: d.resumo ?? '', setor_id: await setorId(d.setor), cliente_id: d.clienteId ?? null,
    status: d.status ?? 'aberto', prioridade: d.prioridade ?? 'normal', prazo_em: d.prazoEm ?? null, responsavel_id: d.responsavelId ?? null,
    origem: d.origem ?? 'agente', conversa_id: d.conversaId ?? null, pedido_venda: d.pedidoVenda ?? null, contato_id: d.contatoId ?? null,
  } as never).select('id, numero').single();
  if (error) throw error;
  return { id: data.id as string, numero: Number(data.numero) };
}

export async function limparDemandasE2e(prefixo: string): Promise<void> {
  await db.from('chamados').delete().like('titulo', `${prefixo}%`);
}
