import pg from 'pg';
import { criarClienteServico } from '../src';

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
  // Parte I3a (D13): os limites das tarefas voltam ao padrão (restaurar_agentes_iniciais não conhece as colunas novas).
  await c.query(`do $$ begin
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agentes' and column_name = 'tarefa_limite_usd') then
      update public.agentes set tarefa_limite_usd = 2, tarefa_limite_minutos = 20;
    end if; end $$`);
  // Parte I3b: a situação do Drive some e a guarda volta a "nunca apagar" (tabelas de uma linha, fora do truncate).
  await c.query(`do $$ begin
    if to_regclass('public.drive_conta') is not null then delete from public.drive_conta; end if;
    if to_regclass('public.tarefas_guarda') is not null then update public.tarefas_guarda set dias = null, atualizado_por = null; end if;
    end $$`);
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
  texto?: { titulo: string; descricao: string; corpo: string },   // padrão: textos genéricos derivados do nome
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
      [s.rows[0].id, texto?.titulo ?? `Título ${nome}`, texto?.descricao ?? `Quando ${nome}.`, tipo, texto?.corpo ?? `Texto de ${nome}.`]);
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

type ModoTeste = 'por_tras' | 'mesma_voz' | 'passa_conversa';
/**
 * Configura um agente para testes e cenários (Parte I2), direto no postgres: service_role só lê `agentes` (D11 da I1). Os gatilhos do banco
 * valem (ferramentas "só do Thiago" no agente do setor são recusadas). Campo ausente fica como está. Devolve o id do agente.
 */
export async function configurarAgenteTeste(slug: string, cfg: {
  estado?: 'desligado' | 'teste' | 'ligado'; modo?: ModoTeste | null; ferramentas?: string[]; contatos?: string[];
  regras?: { assunto: string; exemplo?: string; modo: ModoTeste }[]; tipos?: string[];
}): Promise<string> {
  const c = new pg.Client({ connectionString: urlLocal() });
  await c.connect();
  try {
    await c.query('begin');
    const a = await c.query('select id from public.agentes where slug = $1 for update', [slug]);
    if (!a.rows[0]) throw new Error(`configurarAgenteTeste: agente ${slug} não existe`);
    const id = a.rows[0].id as string;
    if (cfg.contatos) {
      await c.query('delete from public.agente_contatos_teste where agente_id = $1', [id]);
      for (const contato of cfg.contatos) await c.query('insert into public.agente_contatos_teste (agente_id, contato_id) values ($1, $2)', [id, contato]);
    }
    if (cfg.regras) {
      await c.query('delete from public.agente_regras_assunto where agente_id = $1', [id]);
      for (const r of cfg.regras) {
        await c.query('insert into public.agente_regras_assunto (agente_id, assunto, exemplo, modo) values ($1, $2, $3, $4)', [id, r.assunto, r.exemplo ?? '', r.modo]);
      }
    }
    if (cfg.estado !== undefined) await c.query('update public.agentes set estado = $2 where id = $1', [id, cfg.estado]);
    if (cfg.modo !== undefined) await c.query('update public.agentes set modo_contato = $2 where id = $1', [id, cfg.modo]);
    if (cfg.ferramentas !== undefined) await c.query('update public.agentes set ferramentas = $2 where id = $1', [id, cfg.ferramentas]);
    if (cfg.tipos !== undefined) await c.query('update public.agentes set tipos = $2 where id = $1', [id, cfg.tipos]);
    await c.query('commit');
    return id;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    await c.end();
  }
}

type EstadoTeste = 'trabalhando' | 'aguardando_pendencias' | 'pausada' | 'pronta' | 'aprovada' | 'descartada';
type PendenciaTeste = {
  tipo: 'cliente' | 'analista'; pergunta: string; opcoes?: string[]; mensagem?: string | null; resposta?: string | null;
  contatoId?: string | null; pedidoTexto?: string | null; enviado?: boolean;
};
/**
 * Parte I3a: tarefa de teste direto no postgres (o painel cria pela função, com a sessão da pessoa). Etapas pelos nomes; pendências
 * numeradas na ordem. Só no banco local. Devolve o id, o número e os ids das pendências.
 */
export async function criarTarefaTeste(p: {
  chamadoId: string; agente?: string; pedidaPor?: string | null; pedido?: string; skill?: string | null; estado?: EstadoTeste; motivoPausa?: string | null;
  etapas?: string[]; resultado?: object | null; limiteUsd?: number; limiteMinutos?: number; custoUsd?: number; pendencias?: PendenciaTeste[];
}): Promise<{ id: string; numero: number; pendencias: string[] }> {
  const c = new pg.Client({ connectionString: urlLocal() });
  await c.connect();
  try {
    await c.query('begin');
    const estado = p.estado ?? 'trabalhando';
    const etapas = (p.etapas ?? []).map((nome) => ({ nome, concluida: false, resumo: null }));
    const t = await c.query(`insert into public.agente_tarefas (agente_id, chamado_id, cliente_id, setor_id, pedida_por, pedido, skill_nome, estado,
        motivo_pausa, etapas, resultado, limite_usd, limite_minutos, custo_usd, decidida_em)
      select a.id, ch.id, ch.cliente_id, ch.setor_id, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11,
             case when $5 in ('aprovada', 'descartada') then now() end
        from public.agentes a, public.chamados ch where a.slug = $1 and ch.id = $12
      returning id, numero`,
      [p.agente ?? 'contabil', p.pedidaPor ?? null, p.pedido ?? 'Fazer o fechamento de outubro', p.skill ?? null, estado,
        estado === 'pausada' ? p.motivoPausa ?? 'pessoa' : null, JSON.stringify(etapas), p.resultado ? JSON.stringify(p.resultado) : null,
        p.limiteUsd ?? 2, p.limiteMinutos ?? 20, p.custoUsd ?? 0, p.chamadoId]);
    if (!t.rows[0]) throw new Error('criarTarefaTeste: agente ou demanda não existe');
    const id = t.rows[0].id as string;
    const pendencias: string[] = [];
    for (const [i, x] of (p.pendencias ?? []).entries()) {
      const r = await c.query(`insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta, opcoes, mensagem, estado, resposta, respondida_em,
          contato_id, pedido_texto, pedido_em, pedidos, pedido_enviado_em)
        values ($1, $2, $3, $4, $5, $6, $7, $8, case when $8::text is null then null else now() end, $9, $10,
                case when $9::uuid is null then null else now() end, case when $9::uuid is null then 0 else 1 end,
                case when $11 then now() end)
        returning id`,
        [id, i + 1, x.tipo, x.pergunta, x.opcoes ?? [], x.mensagem ?? (x.tipo === 'cliente' ? `Pode mandar: ${x.pergunta}?` : null),
          x.resposta ? 'respondida' : 'aberta', x.resposta ?? null, x.contatoId ?? null, x.pedidoTexto ?? null, x.enviado === true]);
      // Enviado de fato = com a mensagem na conversa do contato (revisão final: a reserva sozinha não conta como envio).
      if (x.enviado && x.contatoId) {
        await c.query(`with cv as (insert into public.conversas (telefone, contato_id) select telefone, id from public.contatos where id = $1
                                    on conflict (telefone) do update set telefone = excluded.telefone returning id),
                           m as (insert into public.mensagens (conversa_id, direcao, autor, conteudo, status_envio)
                                 select cv.id, 'saida', 'agente', coalesce($2, 'Pedido do escritório'), 'enviada' from cv returning id)
                      update public.agente_pendencias set mensagem_id = (select id from m) where id = $3`,
          [x.contatoId, x.pedidoTexto ?? null, r.rows[0].id]);
      }
      pendencias.push(r.rows[0].id as string);
    }
    await c.query('commit');
    return { id, numero: Number(t.rows[0].numero), pendencias };
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    await c.end();
  }
}

/** O compartimento "tarefas" só aceita alguns tipos (F7): sem `mime`, vale o da extensão (texto simples se não houver). */
const MIME_POR_EXTENSAO: Record<string, string> = { csv: 'text/csv', xml: 'text/xml', txt: 'text/plain', pdf: 'application/pdf', ofx: 'application/x-ofx', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
/** Parte I3a: arquivo enviado à tarefa (Storage "tarefas" + linha), como o painel faz. Só no banco local. Devolve o id da linha. */
export async function anexarArquivoTeste(tarefaId: string, a: { nome: string; conteudo: string | Uint8Array; mime?: string; lido?: boolean }): Promise<string> {
  urlLocal();
  const sb = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const mime = a.mime ?? MIME_POR_EXTENSAO[a.nome.split('.').pop()?.toLowerCase() ?? ''] ?? 'text/plain';
  const bytes = typeof a.conteudo === 'string' ? new TextEncoder().encode(a.conteudo) : a.conteudo;
  const caminho = `${tarefaId}/${Date.now()}-${a.nome.replace(/[^\w.-]+/g, '_')}`;
  const up = await sb.storage.from('tarefas').upload(caminho, bytes, { contentType: mime });
  if (up.error) throw new Error(`anexarArquivoTeste: ${up.error.message}`);
  const c = new pg.Client({ connectionString: urlLocal() });
  await c.connect();
  try {
    const r = await c.query(`insert into public.agente_tarefa_arquivos (tarefa_id, origem, bucket, caminho, nome, mime, tamanho, lido_em)
      values ($1, 'enviado', 'tarefas', $2, $3, $4, $5, case when $6 then now() end) returning id`,
      [tarefaId, caminho, a.nome, mime, bytes.length, a.lido === true]);
    return r.rows[0].id as string;
  } finally {
    await c.end();
  }
}

/** SQL direto no banco local (dono do banco): para testes que mudam o que o service_role não pode (ex.: pausar no meio da vez). */
export async function sqlTeste<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: urlLocal() });
  await c.connect();
  try {
    return (await c.query(sql, params)).rows as T[];
  } finally {
    await c.end();
  }
}

/** Roda SQL como a pessoa (role authenticated + o "sub" dela), como o painel faz com a sessão. Só no banco local. */
export async function comoPessoa<T = Record<string, unknown>>(usuarioId: string, sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: urlLocal() });
  await c.connect();
  try {
    await c.query('begin');
    await c.query('set local role authenticated');
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: usuarioId, role: 'authenticated' })]);
    const r = await c.query(sql, params);
    await c.query('commit');
    return r.rows as T[];
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    await c.end();
  }
}

/** Parte I3b: "Pasta no Drive" de um cliente direto no banco local (o painel usa salvar_pasta_drive). */
export async function definirPastaDriveTeste(clienteId: string, pasta: string | null): Promise<void> {
  await sqlTeste('update public.clientes set drive_pasta_id = $2 where id = $1', [clienteId, pasta]);
}
/** Parte I3b: a situação do Drive como o trabalhador gravaria (só no banco local). */
export async function situacaoDriveTeste(email: string | null, erro: string | null = null): Promise<void> {
  await sqlTeste(`insert into public.drive_conta (id, email, erro) values (1, $1, $2)
    on conflict (id) do update set email = excluded.email, erro = excluded.erro, verificado_em = now()`, [email, erro]);
}

/** Parte I4: as opções do pedido numa tarefa criada por criarTarefaTeste. Só no banco local. */
export async function opcoesPedidoTeste(tarefaId: string, o: {
  prazo?: string | null; lerDrive?: boolean; subpasta?: string | null; avisarPainel?: boolean; avisarWhatsapp?: boolean;
}): Promise<void> {
  await sqlTeste(`update public.agente_tarefas set prazo_desejado = coalesce($2::timestamptz, prazo_desejado), ler_drive = coalesce($3, ler_drive),
      drive_subpasta = coalesce($4, drive_subpasta), avisar_painel = coalesce($5, avisar_painel), avisar_whatsapp = coalesce($6, avisar_whatsapp) where id = $1`,
  [tarefaId, o.prazo ?? null, o.lerDrive ?? null, o.subpasta ?? null, o.avisarPainel ?? null, o.avisarWhatsapp ?? null]);
}
/** O nível de um módulo para uma pessoa de teste (ex.: assistente = site_whatsapp). */
export async function nivelTeste(usuarioId: string, modulo: string, nivel: string): Promise<void> {
  await sqlTeste(`insert into public.usuario_permissoes (usuario_id, modulo, nivel) values ($1, $2, $3)
    on conflict (usuario_id, modulo) do update set nivel = excluded.nivel`, [usuarioId, modulo, nivel]);
}
/** A pendência foi mandada ao WhatsApp de quem pediu (o Assistente passa a aceitar a resposta). */
export async function repassarPendenciaTeste(tarefaId: string, numero: number): Promise<void> {
  await sqlTeste('update public.agente_pendencias set repassada_em = now() where tarefa_id = $1 and numero = $2', [tarefaId, numero]);
}
