import pg from 'pg';

/** Apaga os dados de teste. Recusa rodar fora do banco local. */
export async function limparBanco(): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) throw new Error('limparBanco só roda no banco local');
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query(`truncate public.simulacoes_agente, public.orientacoes_agente_versoes, public.orientacoes_agente,
    public.assistente_mensagens, public.mensagens, public.chamado_eventos, public.chamados, public.decisoes_agente,
    public.auditoria_acessos, public.uso_ia, public.alertas, public.sinais_vida, public.conversas, public.contato_clientes,
    public.contatos, public.cliente_responsaveis, public.cliente_servicos, public.clientes,
    public.respostas_prontas, public.feriados cascade`);
  await c.query("delete from auth.users where email like '%.local'");
  await c.query(`update public.configuracoes set agente_pausado = false, alerta_ia_80_mes = null, teto_ia_usd = 50, telefone_dono = null`);
  await c.end();
}
