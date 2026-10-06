import { sqlTeste } from './limpar';

export async function ligarRadarTeste(estado: 'desligado' | 'teste' | 'ligado' = 'ligado'): Promise<void> {
  await sqlTeste(`update public.agentes set estado = $1 where slug = 'radar'`, [estado]);
}
export async function configRadarTeste(c: Partial<{ hora: string; dias: number[]; resumo_whatsapp: boolean; aviso_alto: boolean; avisar_painel: boolean; limite_usd_giro: number }>): Promise<void> {
  for (const [k, v] of Object.entries(c)) await sqlTeste(`update public.radar_config set ${k} = $1 where id = 1`, [v]);   // k vem do tipo acima
}
export async function fonteRadarTeste(f: { nome: string; dominio: string; caminho?: string | null; oficial?: boolean; ativa?: boolean }): Promise<string> {
  const [r] = await sqlTeste<{ id: string }>(`insert into public.radar_fontes (nome, dominio, caminho, oficial, ativa) values ($1, $2, $3, $4, $5) returning id`,
    [f.nome, f.dominio, f.caminho ?? null, f.oficial ?? true, f.ativa ?? true]);
  return r!.id;
}
export async function giroRadarTeste(p: { origem?: string; estado?: string; iniciadoEm?: string; terminadoEm?: string; novidades?: number;
  fontesFora?: { fonte_id: string | null; nome: string; motivo: string }[]; custoUsd?: number; dia?: string; pedidoPor?: string | null }): Promise<string> {
  const [r] = await sqlTeste<{ id: string }>(`insert into public.radar_giros (origem, estado, dia, iniciado_em, terminado_em, novidades, fontes_fora, custo_usd, pedido_por, fontes)
    values ($1, $2, coalesce($3::date, (now() at time zone 'America/Sao_Paulo')::date), coalesce($4::timestamptz, now()), $5, $6, $7, $8, $9, 9) returning id`,
    [p.origem ?? 'pedido', p.estado ?? 'concluido', p.dia ?? null, p.iniciadoEm ?? null, p.terminadoEm ?? (p.estado === 'rodando' ? null : new Date().toISOString()),
     p.novidades ?? 0, JSON.stringify(p.fontesFora ?? []), p.custoUsd ?? 0, p.pedidoPor ?? null]);
  return r!.id;
}
export async function novidadeRadarTeste(p: { titulo: string; url: string; impacto?: 'alto' | 'medio' | 'baixo'; setores?: string[];
  criterios?: Record<string, unknown>; selo?: 'oficial' | 'confirmar'; estado?: string; mensagem?: string | null; giroId?: string | null;
  achadoEm?: string; fonteNome?: string; resumo?: string; vigencia?: string | null }): Promise<string> {
  const [r] = await sqlTeste<{ id: string }>(`insert into public.radar_novidades (titulo, url, url_normalizada, fonte_nome, selo, resumo, impacto, setores,
      criterios, clientes_afetados, estado, mensagem_cliente, giro_id, achado_em, vigencia_texto, publicado_em)
    values ($1, $2, $2, $3, $4, $5, $6, array(select id from public.setores where nome = any ($7::text[]) order by nome), $8, 0, $9, $10, $11,
      coalesce($12::timestamptz, now()), $13, current_date) returning id`,
    [p.titulo, p.url, p.fonteNome ?? 'eSocial', p.selo ?? 'oficial', p.resumo ?? 'Resumo em linguagem simples da novidade.', p.impacto ?? 'medio',
     p.setores ?? ['Fiscal'], JSON.stringify(p.criterios ?? {}), p.estado ?? 'para_decidir', p.mensagem ?? null, p.giroId ?? null, p.achadoEm ?? null,
     p.vigencia ?? null]);
  await sqlTeste(`update public.radar_novidades n set clientes_afetados = (select count(*) from public.clientes c where c.ativo
     and interno.cliente_nos_criterios(c.id, n.criterios)) where n.id = $1`, [r!.id]);
  return r!.id;
}
/** Contato ligado ao cliente, com o setor e "pode ser procurado" (H2). Perfil padrão: personalizado. */
export async function contatoProcuravelTeste(p: { clienteId: string; nome: string; telefone: string; setor: string; procurado?: boolean;
  perfil?: 'basico' | 'personalizado' }): Promise<string> {
  const [c] = await sqlTeste<{ id: string }>(`insert into public.contatos (nome, telefone) values ($1, $2)
    on conflict (telefone) do update set nome = excluded.nome returning id`, [p.nome, p.telefone]);
  await sqlTeste(`insert into public.contato_clientes (contato_id, cliente_id, perfil) values ($1, $2, $3)
    on conflict (contato_id, cliente_id) do update set perfil = excluded.perfil`,
    [c!.id, p.clienteId, p.perfil ?? 'personalizado']);
  await sqlTeste(`insert into public.contato_cliente_setores (contato_id, cliente_id, setor_id, pode_ser_procurado)
    select $1, $2, s.id, $4 from public.setores s where s.nome = $3 on conflict (contato_id, cliente_id, setor_id) do update set pode_ser_procurado = excluded.pode_ser_procurado`,
    [c!.id, p.clienteId, p.setor, p.procurado ?? true]);
  return c!.id;
}
