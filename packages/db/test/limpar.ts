import pg from 'pg';

/** Endereço do banco dos testes. Recusa qualquer banco que não seja o local. */
function urlLocal(): string {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) throw new Error('limparBanco só roda no banco local');
  return url;
}

/** Apaga os dados de teste. Recusa rodar fora do banco local. */
export async function limparBanco(): Promise<void> {
  const c = new pg.Client({ connectionString: urlLocal() });
  await c.connect();
  await c.query(`truncate public.simulacoes_agente, public.orientacoes_agente_versoes, public.orientacoes_agente,
    public.assistente_mensagens, public.mensagens, public.chamado_eventos, public.chamados, public.decisoes_agente,
    public.auditoria_acessos, public.uso_ia, public.alertas, public.sinais_vida, public.conversas, public.contato_clientes,
    public.contatos, public.cliente_responsaveis, public.cliente_servicos, public.clientes,
    public.respostas_prontas, public.feriados cascade`);
  // Parte I1 (D24): skills, regras, contatos em teste e histórico somem; os 7 agentes voltam às sementes.
  await c.query(`truncate public.agente_skill_arquivos, public.agente_skill_versoes, public.agente_skills, public.agente_regras_assunto,
    public.agente_contatos_teste, public.agente_mudancas cascade`);
  await c.query('select public.restaurar_agentes_iniciais()');
  await c.query("delete from auth.users where email like '%.local'");
  await c.query(`update public.configuracoes set agente_pausado = false, alerta_ia_80_mes = null, teto_ia_usd = 50, telefone_dono = null,
    espera_verde_min = 5, espera_ambar_min = 15`);
  await c.end();
}

/** Marca a pessoa como dono (Parte I1, D11): só SQL direto muda a marcação; a API recusa. Só no banco local. */
export async function marcarDonoTeste(usuarioId: string): Promise<void> {
  const c = new pg.Client({ connectionString: urlLocal() });
  await c.connect();
  try {
    await c.query('begin');
    await c.query('update public.usuarios set dono = false where dono');
    await c.query('update public.usuarios set dono = true where id = $1', [usuarioId]);
    await c.query('commit');
  } finally {
    await c.end();
  }
}

/**
 * Cria uma skill de teste (versão 1) do agente `agenteSlug`, direto no postgres: service_role não escreve nas tabelas de skill
 * (o dono sobe pela tela). Devolve o id da skill. `ativo` padrão: true (skill ligada, que o agente usa; o banco, sozinho, criaria
 * desligada). Passe false para testar skill desligada / em teste. Só no banco local. Reuse em testes do trabalhador e e2e.
 */
export async function criarSkillTeste(
  agenteSlug: string, nome: string, tipo: string, ativo = true, arquivos: { caminho: string; conteudo: string }[] = [],
): Promise<string> {
  const c = new pg.Client({ connectionString: urlLocal() });
  await c.connect();
  try {
    await c.query('begin');
    const ag = await c.query('select id from public.agentes where slug = $1', [agenteSlug]);
    if (!ag.rows[0]) throw new Error(`criarSkillTeste: agente ${agenteSlug} não existe`);
    const s = await c.query('insert into public.agente_skills (agente_id, nome, tipo, ativo) values ($1, $2, $3, $4) returning id',
      [ag.rows[0].id, nome, tipo, ativo]);
    const v = await c.query(`insert into public.agente_skill_versoes (skill_id, versao, titulo, descricao, tipo, corpo, skill_md)
      values ($1, 1, $2, $3, $4, $5, '---') returning id`,
      [s.rows[0].id, `Título ${nome}`, `Quando ${nome}.`, tipo, `Texto de ${nome}.`]);
    for (const a of arquivos) {
      await c.query('insert into public.agente_skill_arquivos (versao_id, caminho, conteudo) values ($1, $2, $3)', [v.rows[0].id, a.caminho, a.conteudo]);
    }
    await c.query('commit');
    return s.rows[0].id as string;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    await c.end();
  }
}
