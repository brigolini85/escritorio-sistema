import { lerNiveis, FUNCIONALIDADES_IA, type FuncionalidadeGravavel, type ProvedorIa, pedidoVendaBling, variantesTelefone, type Niveis, type PedidoVendaBling, type ConfigExpediente, type PrecoModelo, type PedidoVendaSalvo, PERFIS, type AcessoContato, type CanalAviso, type Perfil } from '@escritorio/core';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import type { Db } from './cliente';
import type { Database, Json } from './tipos.gen';

type Linha<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Conversa = Linha<'conversas'>;
export type Mensagem = Linha<'mensagens'>;
export type Chamado = Linha<'chamados'>;
export type SugestaoResposta = Linha<'sugestoes_resposta'>;
type TipoMensagem = Database['public']['Enums']['tipo_mensagem'];
export type Prioridade = Database['public']['Enums']['prioridade_demanda'];

export type EmpresaDoContato = { id: string; nome: string; podePedirNota: boolean; agentePausado: boolean };
export type ContatoEncontrado = { id: string; nome: string; agentePausado: boolean; empresas: EmpresaDoContato[] };
export type Configuracoes = {
  expediente: ConfigExpediente;
  agentePausado: boolean;
  tetoIaUsd: number;
  alertaIa80Mes: string | null;
  minutosAlertaFila: number;
  telefoneDono: string | null;
  emailAlertas: string | null;
  modeloConversa: string;
  precosModelos: Record<string, PrecoModelo>;
  custoMinutoTranscricaoUsd: number | null;
  mensagens: Record<string, string>;
};
export type NovaMensagemEntrada = {
  conversaId: string; clienteId: string | null; idProvedor: string; tipo: TipoMensagem;
  conteudo?: string | null; midiaUrlOrigem?: string | null; arquivoNome?: string | null; arquivoMime?: string | null;
};
/** Uma chamada à IA (spec 7B.2). Tudo obrigatório: caminho novo que esquecer a funcionalidade não compila (Prompt F). */
export type NovoUsoIa = {
  funcionalidade: FuncionalidadeGravavel; usuarioId: string | null; conversaId: string | null; clienteId: string | null;
  modelo: string; provedor?: ProvedorIa; tokensEntrada: number; tokensSaida: number; tokensCacheLeitura: number; tokensCacheEscrita: number;
  segundosAudio?: number | null; custoUsd: number;
};
export type NovoChamado = {
  clienteId: string | null; conversaId: string | null; setorId: string | null; responsavelId: string | null;
  titulo: string; resumo: string; foraDoContrato: boolean; origem: string;
  /** Sem ela, o banco usa 'normal'. O prazo é sempre calculado pelo banco. */
  prioridade?: Prioridade;
};
export type TipoParceiro = 'cliente' | 'fornecedor';
export type UnidadeParceiro = {
  id: string; grupoId: string; tipo: TipoParceiro; rede: string; unidade: string;
  razaoSocial: string | null; cnpj: string | null; ie: string | null; bairro: string | null; cidade: string | null; uf: string | null;
  endereco: string | null; numero: string | null; complemento: string | null; cep: string | null;
  palavrasChave: string[];
};
export type UsuarioAssistente = { id: string; nome: string; papel: 'admin' | 'atendente'; niveis: Niveis; setores: string[]; telefone: string | null; ativo: boolean };
const COLUNAS_ASSISTENTE = 'id, nome, papel, telefone, ativo, usuario_setores(setor_id), usuario_permissoes(modulo, nivel)';
type LinhaAssistente = {
  id: string; nome: string; papel: 'admin' | 'atendente'; telefone: string | null; ativo: boolean;
  usuario_setores: { setor_id: string }[]; usuario_permissoes: { modulo: string; nivel: string }[];
};
/** Linha de usuarios com setores e níveis (Parte D): o que o assistente precisa saber da pessoa. */
function paraUsuarioAssistente(u: LinhaAssistente): UsuarioAssistente {
  return {
    id: u.id, nome: u.nome, papel: u.papel, telefone: u.telefone, ativo: u.ativo,
    setores: u.usuario_setores.map((s) => s.setor_id),
    niveis: lerNiveis(Object.fromEntries(u.usuario_permissoes.map((p) => [p.modulo, p.nivel]))),
  };
}
export type CanalAssistente = 'site' | 'whatsapp';
export type MensagemAssistente = Linha<'assistente_mensagens'>;
export type ArquivoAssistente = { tipo: 'csv_bling'; chamados: string[]; nome: string; partes: number };
export type ChamadoResumo = {
  id: string; numero: number; titulo: string; resumo: string; status: string; setor_id: string | null; setor: string | null;
  responsavel_id: string | null; responsavel: string | null; cliente_id: string | null; empresa: string | null; criado_em: string;
  pedido_venda: PedidoVendaSalvo | null;
};
export type DadosEmpresa = { razaoSocial: string; nomeFantasia: string | null; cnpj: string; inscricaoEstadual: string | null;
  regime: string | null; endereco: string | null; uf: string | null; ativo: boolean };
export type ProdutoEmpresa = { id: string; codigo: string; descricao: string; unidade: string; apelidos: string[] };
export type DocumentoEmpresa = { id: string; nome: string; arquivoPath: string; arquivoNome: string; arquivoMime: string; iaPodeEnviar: boolean };
export type DemandaParaContato = { numero: number; titulo: string; status: string; setor_nome: string | null; criado_em: string };
export type PessoaParaAviso = { contatoId: string; nome: string; telefone: string };
export type TipoOrientacao = 'jeito' | 'regra' | 'situacao';
export type OrientacaoAgente = {
  id: string; titulo: string; texto: string; tipo: TipoOrientacao; clienteId: string | null; setorId: string | null;
  setorNome: string | null; atualizadoEm: Date;
};
/** Orientação ainda não salva incluída num teste (formato conferido por criar_simulacao). `id`: a orientação salva que ela edita (substitui essa no teste). */
export type RascunhoOrientacao = { id?: string | null; titulo: string; texto: string; tipo: TipoOrientacao; cliente_id: string | null; setor_id: string | null };
export type SimulacaoAgente = Omit<Linha<'simulacoes_agente'>, 'rascunho' | 'status'> & {
  rascunho: RascunhoOrientacao | null; status: 'pendente' | 'pronta' | 'erro';
};

/** Devolve os dados de uma consulta bem-sucedida; o tipo vem só do caso de sucesso. */
function checar<T>(r: PostgrestSingleResponse<T>, contexto: string): T {
  if (r.error) throw new Error(`${contexto}: ${r.error.message}`);
  return r.data;
}

/** Início do mês AAAA-MM em São Paulo (sem horário de verão desde 2019). */
function inicioDoMes(mes: string): string {
  return `${mes}-01T00:00:00-03:00`;
}
function proximoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

const SELECT_CHAMADO_RESUMO = 'id, numero, titulo, resumo, status, setor_id, responsavel_id, cliente_id, criado_em, pedido_venda, setores(nome), usuarios(nome), clientes(razao_social, nome_fantasia)';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function paraChamadoResumo(c: any): ChamadoResumo {
  return {
    id: c.id, numero: Number(c.numero), titulo: c.titulo, resumo: c.resumo, status: c.status, setor_id: c.setor_id, setor: c.setores?.nome ?? null,
    responsavel_id: c.responsavel_id, responsavel: c.usuarios?.nome ?? null, cliente_id: c.cliente_id,
    empresa: c.clientes ? c.clientes.nome_fantasia ?? c.clientes.razao_social : null, criado_em: c.criado_em,
    pedido_venda: (c.pedido_venda ?? null) as PedidoVendaSalvo | null,
  };
}

/** Máximo de linhas por consulta no Supabase (max_rows). */
const PAGINA = 1000;

const semAcento = (t: string) => t.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase();

/** acesso_do_contato (jsonb) → AcessoContato; o que vier estranho vira o mínimo (Básico). */
function paraAcesso(j: unknown): AcessoContato | null {
  if (!j || typeof j !== 'object') return null;
  const o = j as Record<string, unknown>;
  const perfil = (PERFIS as readonly string[]).includes(String(o.perfil)) ? (o.perfil as Perfil) : 'basico';
  const setores = Array.isArray(o.setores) ? o.setores as { id: string; nome: string; pode_ser_procurado: boolean }[] : [];
  return {
    perfil,
    setores: perfil === 'basico' ? [] : setores.map((s) => ({ id: s.id, nome: s.nome, podeSerProcurado: s.pode_ser_procurado === true })),
    podePedirNota: o.pode_pedir_nota === true, podeAtualizarPreco: o.pode_atualizar_preco === true,
    verValores: o.ver_valores === true, receberDocumentos: o.receber_documentos === true,
    avisarDocumentoNovo: (Array.isArray(o.avisar_documento_novo) ? o.avisar_documento_novo : []).filter((c): c is CanalAviso => c === 'whatsapp' || c === 'email'),
    recebeAlertasAcesso: o.recebe_alertas_acesso === true,
  };
}

export function criarRepos(db: Db) {
  return {
    async buscarContato(telefone: string): Promise<ContatoEncontrado | null> {
      const r = await db.from('contatos')
        .select('id, nome, agente_pausado, contato_clientes(pode_pedir_nota, clientes(id, razao_social, nome_fantasia, ativo, agente_pausado))')
        .in('telefone', variantesTelefone(telefone)).eq('ativo', true).limit(1).maybeSingle();
      const c = checar(r, 'buscarContato');
      if (!c) return null;
      const empresas = (c.contato_clientes ?? [])
        .filter((v) => v.clientes && v.clientes.ativo)
        .map((v) => ({
          id: v.clientes!.id,
          nome: v.clientes!.nome_fantasia ?? v.clientes!.razao_social,
          podePedirNota: v.pode_pedir_nota,
          agentePausado: v.clientes!.agente_pausado,
        }));
      return { id: c.id, nome: c.nome, agentePausado: c.agente_pausado, empresas };
    },

    async ehTelefoneInterno(telefone: string): Promise<boolean> {
      const variantes = variantesTelefone(telefone);
      // Pessoa arquivada (ativo = false) deixa de ser equipe interna.
      const u = checar(await db.from('usuarios').select('id').in('telefone', variantes).eq('ativo', true).limit(1), 'ehTelefoneInterno');
      if (u.length > 0) return true;
      const cfg = checar(await db.from('configuracoes').select('telefone_dono').eq('id', 1).single(), 'ehTelefoneInterno');
      return cfg.telefone_dono !== null && variantes.some((v) => variantesTelefone(cfg.telefone_dono!).includes(v));
    },

    async obterOuCriarConversa(telefone: string, contatoId: string | null): Promise<Conversa> {
      const existente = checar(await db.from('conversas').select('*').in('telefone', variantesTelefone(telefone)).limit(1).maybeSingle(), 'conversa');
      if (existente) {
        if (contatoId && existente.contato_id !== contatoId) {
          return checar(await db.from('conversas').update({ contato_id: contatoId }).eq('id', existente.id).select().single(), 'conversa');
        }
        return existente;
      }
      const criada = await db.from('conversas').insert({ telefone, contato_id: contatoId }).select().single();
      // Duas mensagens do mesmo número novo ao mesmo tempo: quem perdeu a corrida usa a conversa que a outra criou.
      if (criada.error?.code === '23505') return this.obterOuCriarConversa(telefone, contatoId);
      return checar(criada, 'conversa');
    },

    async obterConversa(id: string): Promise<Conversa> {
      return checar(await db.from('conversas').select('*').eq('id', id).single(), 'obterConversa');
    },

    async atualizarConversa(id: string, patch: Partial<Conversa>): Promise<void> {
      checar(await db.from('conversas').update({ ...patch, atualizado_em: new Date().toISOString() }).eq('id', id), 'atualizarConversa');
    },

    /** O agente passou para uma pessoa (spec 7A.2): guarda a primeira espera e o motivo; conversa assumida não marca. */
    async marcarAguardandoPessoa(conversaId: string, motivo: string): Promise<boolean> {
      return Boolean(checar(await db.rpc('marcar_aguardando_pessoa', { p_conversa: conversaId, p_motivo: motivo }), 'marcarAguardandoPessoa'));
    },

    /**
     * A equipe respondeu pelo celular: o mesmo que assumir_conversa faz (estado humano, espera limpa, marco "assumida"),
     * sem pessoa (o celular não diz quem foi). O filtro no próprio update evita marco repetido a cada resposta.
     */
    async assumirPeloCelular(conversaId: string): Promise<void> {
      const mudou = checar(await db.from('conversas').update({ estado: 'humano', aguardando_pessoa_desde: null, motivo_pessoa: null,
        concluida_em: null, atualizado_em: new Date().toISOString() }).eq('id', conversaId).neq('estado', 'humano').select('id'), 'assumirPeloCelular');
      if (mudou.length > 0) {
        checar(await db.from('conversa_eventos').insert({ conversa_id: conversaId, tipo: 'assumida' }), 'assumirPeloCelular');
        return;
      }
      // Já estava com a equipe: só garante que não sobrou espera de antes (não grava outro marco).
      checar(await db.from('conversas').update({ aguardando_pessoa_desde: null, motivo_pessoa: null }).eq('id', conversaId)
        .not('aguardando_pessoa_desde', 'is', null), 'assumirPeloCelular');
    },

    async inserirMensagemEntrada(m: NovaMensagemEntrada): Promise<{ id: string; duplicada: boolean }> {
      const r = await db.from('mensagens').upsert({
        conversa_id: m.conversaId, cliente_id: m.clienteId, direcao: 'entrada', autor: 'cliente', tipo: m.tipo,
        conteudo: m.conteudo ?? null, midia_url_origem: m.midiaUrlOrigem ?? null, arquivo_nome: m.arquivoNome ?? null,
        arquivo_mime: m.arquivoMime ?? null, id_provedor: m.idProvedor,
      }, { onConflict: 'id_provedor', ignoreDuplicates: true }).select('id');
      const linhas = checar(r, 'inserirMensagemEntrada');
      if (linhas.length === 0) {
        const existente = checar(await db.from('mensagens').select('id').eq('id_provedor', m.idProvedor).single(), 'inserirMensagemEntrada');
        return { id: existente.id, duplicada: true };
      }
      return { id: linhas[0]!.id, duplicada: false };
    },

    async mensagensNaoProcessadas(conversaId: string): Promise<Mensagem[]> {
      return checar(await db.from('mensagens').select('*').eq('conversa_id', conversaId).eq('direcao', 'entrada')
        .is('processada_em', null).order('criado_em'), 'mensagensNaoProcessadas');
    },

    async atualizarMensagem(id: string, patch: Partial<Mensagem>): Promise<void> {
      checar(await db.from('mensagens').update(patch).eq('id', id), 'atualizarMensagem');
    },

    async marcarProcessadas(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      checar(await db.from('mensagens').update({ processada_em: new Date().toISOString() }).in('id', ids), 'marcarProcessadas');
    },

    async historico(conversaId: string, limite: number): Promise<Mensagem[]> {
      const linhas = checar(await db.from('mensagens').select('*').eq('conversa_id', conversaId)
        .order('criado_em', { ascending: false }).limit(limite), 'historico');
      return linhas.reverse();
    },

    async criarSaidaPendente(m: {
      conversaId: string; clienteId: string | null; autor: 'agente' | 'sistema'; conteudo: string;
      /** Execução do agente que mandou (o "por quê?" do painel); documento que a IA enviou (link auditado). */
      turnoAgente?: string | null; documentoId?: string | null;
    }): Promise<string> {
      const r = await db.from('mensagens').insert({ conversa_id: m.conversaId, cliente_id: m.clienteId, direcao: 'saida',
        autor: m.autor, tipo: 'texto', conteudo: m.conteudo, status_envio: 'pendente',
        turno_agente: m.turnoAgente ?? null, documento_id: m.documentoId ?? null }).select('id').single();
      return checar(r, 'criarSaidaPendente').id;
    },

    async inserirSaidaExterna(m: { conversaId: string; clienteId: string | null; idProvedor: string; conteudo: string | null }): Promise<string> {
      const r = await db.from('mensagens').insert({ conversa_id: m.conversaId, cliente_id: m.clienteId, direcao: 'saida',
        autor: 'atendente', tipo: 'texto', conteudo: m.conteudo, id_provedor: m.idProvedor, status_envio: 'enviada' }).select('id').single();
      return checar(r, 'inserirSaidaExterna').id;
    },

    /** Reserva o envio de uma resposta do painel; só uma tarefa por vez (reserva expira em 2 min). */
    async reservarEnvio(id: string): Promise<boolean> {
      const limite = new Date(Date.now() - 2 * 60_000).toISOString();
      const r = await db.from('mensagens').update({ envio_reservado_em: new Date().toISOString() })
        .eq('id', id).in('status_envio', ['pendente', 'falhou'])
        .or(`envio_reservado_em.is.null,envio_reservado_em.lt.${limite}`).select('id');
      return checar(r, 'reservarEnvio').length > 0;
    },

    async liberarEnvio(id: string): Promise<void> {
      checar(await db.from('mensagens').update({ envio_reservado_em: null }).eq('id', id), 'liberarEnvio');
    },

    /**
     * Resposta com texto e arquivo: depois que o texto sai, ele vira uma mensagem própria (com o id do provedor,
     * para o eco ser reconhecido) e a original fica só com o arquivo, para uma nova tentativa não repetir o texto.
     */
    async separarTextoEnviado(mensagemId: string, idProvedor: string): Promise<void> {
      const m = checar(await db.from('mensagens').select('*').eq('id', mensagemId).single(), 'separarTextoEnviado');
      checar(await db.from('mensagens').insert({
        conversa_id: m.conversa_id, cliente_id: m.cliente_id, direcao: 'saida', autor: m.autor, atendente_id: m.atendente_id,
        tipo: 'texto', conteudo: m.conteudo, id_provedor: idProvedor, status_envio: 'enviada',
        criado_em: new Date(new Date(m.criado_em).getTime() - 1).toISOString(),
      }), 'separarTextoEnviado');
      checar(await db.from('mensagens').update({ conteudo: null }).eq('id', mensagemId), 'separarTextoEnviado');
    },

    async marcarEnviada(id: string, idProvedor: string): Promise<void> {
      checar(await db.from('mensagens').update({ status_envio: 'enviada', id_provedor: idProvedor }).eq('id', id), 'marcarEnviada');
    },

    async marcarFalha(id: string): Promise<void> {
      checar(await db.from('mensagens').update({ status_envio: 'falhou' }).eq('id', id), 'marcarFalha');
    },

    async obterMensagem(id: string): Promise<Mensagem> {
      return checar(await db.from('mensagens').select('*').eq('id', id).single(), 'obterMensagem');
    },

    async mensagemPorIdProvedor(idProvedor: string): Promise<Mensagem | null> {
      return checar(await db.from('mensagens').select('*').eq('id_provedor', idProvedor).maybeSingle(), 'mensagemPorIdProvedor');
    },

    async saidaPendenteComConteudo(conversaId: string, texto: string): Promise<Mensagem | null> {
      const desde = new Date(Date.now() - 2 * 60_000).toISOString();
      const r = await db.from('mensagens').select('*').eq('conversa_id', conversaId).eq('direcao', 'saida')
        .eq('status_envio', 'pendente').eq('conteudo', texto).gte('criado_em', desde).limit(1).maybeSingle();
      return checar(r, 'saidaPendenteComConteudo');
    },

    async abrirChamado(c: NovoChamado): Promise<{ id: string; numero: number }> {
      const novo = checar(await db.from('chamados').insert({
        cliente_id: c.clienteId, conversa_id: c.conversaId, setor_id: c.setorId, responsavel_id: c.responsavelId,
        titulo: c.titulo, resumo: c.resumo, fora_do_contrato: c.foraDoContrato, origem: c.origem, prioridade: c.prioridade ?? 'normal',
      }).select('id, numero').single(), 'abrirChamado');
      return { id: novo.id, numero: Number(novo.numero) };
    },

    /** Dados do pedido de venda para o painel gerar o arquivo do Bling (o comprador vem do cadastro na hora). */
    async anexarPedidoVenda(chamadoId: string, pedido: PedidoVendaSalvo): Promise<void> {
      checar(await db.from('chamados').update({ pedido_venda: pedido as never }).eq('id', chamadoId), 'anexarPedidoVenda');
    },

    /** Todas as demandas da conversa (abertas ou não), só com o necessário para conferir visibilidade. */
    async chamadosDaConversaParaVisibilidade(conversaId: string): Promise<{ id: string; setor_id: string | null; responsavel_id: string | null }[]> {
      return checar(await db.from('chamados').select('id, setor_id, responsavel_id').eq('conversa_id', conversaId), 'chamadosDaConversaParaVisibilidade');
    },

    async chamadosAbertosDaConversa(conversaId: string): Promise<Chamado[]> {
      return checar(await db.from('chamados').select('*').eq('conversa_id', conversaId).neq('status', 'concluido'), 'chamadosAbertosDaConversa');
    },

    /** Acrescenta informação nova ao resumo de um chamado aberto e registra no histórico dele. */
    async complementarChamado(id: string, texto: string): Promise<void> {
      const atual = checar(await db.from('chamados').select('resumo, cliente_id').eq('id', id).single(), 'complementarChamado');
      const resumo = atual.resumo ? `${atual.resumo}\n\n${texto}` : texto;
      checar(await db.from('chamados').update({ resumo, atualizado_em: new Date().toISOString() }).eq('id', id), 'complementarChamado');
      checar(await db.from('chamado_eventos').insert({ chamado_id: id, cliente_id: atual.cliente_id, tipo: 'nota_interna', texto }), 'complementarChamado');
    },

    async chamadosAbertosDoCliente(clienteId: string): Promise<(Chamado & { setor_nome: string | null })[]> {
      const linhas = checar(await db.from('chamados').select('*, setores(nome)').eq('cliente_id', clienteId)
        .neq('status', 'concluido').order('criado_em'), 'chamadosAbertosDoCliente');
      return linhas.map(({ setores, ...c }) => ({ ...c, setor_nome: setores?.nome ?? null }));
    },

    async registrarDecisao(d: { conversaId: string | null; clienteId: string | null; etapa: string; entrada: unknown; saida: unknown; justificativa?: string; turno?: string | null }): Promise<void> {
      checar(await db.from('decisoes_agente').insert({ conversa_id: d.conversaId, cliente_id: d.clienteId, etapa: d.etapa,
        entrada: d.entrada as never, saida: d.saida as never, justificativa: d.justificativa ?? null, turno: d.turno ?? null }), 'registrarDecisao');
    },

    /** Chaves dos resumos de nota enviados ao cliente nesta conversa desde `desde` (a demanda só abre para um pedido conferido). */
    /** Resumos de pedido de nota que chegaram ao cliente nesta conversa (o pedido como foi resumido + a chave), do mais novo ao mais antigo. */
    async resumosEnviados(conversaId: string, desde: Date): Promise<{ entrada: unknown; conferencia: string }[]> {
      const linhas = checar(await db.from('decisoes_agente').select('entrada, saida').eq('conversa_id', conversaId)
        .eq('etapa', 'resumir_pedido_nota').gte('criado_em', desde.toISOString()).order('criado_em', { ascending: false }), 'resumosEnviados');
      return linhas.flatMap((l) => {
        const chave = (l.saida as { conferencia?: unknown } | null)?.conferencia;
        return typeof chave === 'string' ? [{ entrada: l.entrada, conferencia: chave }] : [];
      });
    },

    async registrarUsoIa(u: NovoUsoIa): Promise<void> {
      // Segunda trava (a primeira é o tipo): nada novo entra como nao_identificado nem sem funcionalidade.
      const f = u.funcionalidade as string | undefined;
      if (!f || f === 'nao_identificado' || !(FUNCIONALIDADES_IA as readonly string[]).includes(f)) {
        throw new Error(`registrarUsoIa: funcionalidade obrigatória (recebido ${String(f)})`);
      }
      checar(await db.from('uso_ia').insert({
        funcionalidade: u.funcionalidade, usuario_id: u.usuarioId, conversa_id: u.conversaId, cliente_id: u.clienteId,
        modelo: u.modelo, provedor: u.provedor ?? 'anthropic', tokens_entrada: u.tokensEntrada, tokens_saida: u.tokensSaida,
        tokens_cache_leitura: u.tokensCacheLeitura, tokens_cache_escrita: u.tokensCacheEscrita,
        segundos_audio: u.segundosAudio ?? null, custo_usd: u.custoUsd,
      }), 'registrarUsoIa');
    },

    async custoIaDoMes(mes: string): Promise<number> {
      // Soma no banco: a API devolve no máximo 1000 linhas por consulta.
      const total = checar(await db.rpc('custo_ia_periodo', { p_inicio: inicioDoMes(mes), p_fim: inicioDoMes(proximoMes(mes)) }), 'custoIaDoMes');
      return Number(total);
    },

    async obterConfiguracoes(): Promise<Configuracoes> {
      const c = checar(await db.from('configuracoes').select('*').eq('id', 1).single(), 'obterConfiguracoes');
      const f = checar(await db.from('feriados').select('data'), 'obterConfiguracoes');
      return {
        expediente: { inicio: c.horario_inicio.slice(0, 5), fim: c.horario_fim.slice(0, 5), diasUteis: c.dias_uteis, feriados: f.map((x) => x.data) },
        agentePausado: c.agente_pausado,
        tetoIaUsd: Number(c.teto_ia_usd),
        alertaIa80Mes: c.alerta_ia_80_mes,
        minutosAlertaFila: c.minutos_alerta_fila,
        telefoneDono: c.telefone_dono,
        emailAlertas: c.email_alertas,
        modeloConversa: c.modelo_conversa,
        precosModelos: c.precos_modelos as Record<string, PrecoModelo>,
        custoMinutoTranscricaoUsd: c.custo_minuto_transcricao_usd === null ? null : Number(c.custo_minuto_transcricao_usd),
        mensagens: c.mensagens as Record<string, string>,
      };
    },

    async marcarAlertaIa80(mes: string): Promise<void> {
      checar(await db.from('configuracoes').update({ alerta_ia_80_mes: mes }).eq('id', 1), 'marcarAlertaIa80');
    },

    async setoresAtivos(): Promise<{ id: string; nome: string; descricao_assuntos: string }[]> {
      return checar(await db.from('setores').select('id, nome, descricao_assuntos').eq('ativo', true).order('nome'), 'setoresAtivos');
    },

    async respostasProntas(): Promise<{ pergunta: string; resposta: string }[]> {
      return checar(await db.from('respostas_prontas').select('pergunta, resposta').eq('ativo', true), 'respostasProntas');
    },

    async responsaveisDoCliente(clienteId: string): Promise<{ setorId: string; usuarioId: string }[]> {
      // Pessoa arquivada não recebe demanda nova: sem responsável, o setor recebe e o alerta "sem responsável" avisa.
      const linhas = checar(await db.from('cliente_responsaveis').select('setor_id, usuario_id, usuarios!inner(ativo)')
        .eq('cliente_id', clienteId).eq('usuarios.ativo', true), 'responsaveisDoCliente');
      return linhas.map((l) => ({ setorId: l.setor_id, usuarioId: l.usuario_id }));
    },

    async servicosDoCliente(clienteId: string): Promise<string[]> {
      const linhas = checar(await db.from('cliente_servicos').select('servicos(nome)').eq('cliente_id', clienteId), 'servicosDoCliente');
      return linhas.map((l) => l.servicos?.nome).filter((n): n is string => Boolean(n));
    },

    async registrarAlerta(a: { nivel: 'critico' | 'operacional' | 'aviso'; mensagem: string; setorId?: string | null; usuarioId?: string | null }): Promise<void> {
      checar(await db.from('alertas').insert({ nivel: a.nivel, mensagem: a.mensagem, setor_id: a.setorId ?? null, usuario_id: a.usuarioId ?? null }), 'registrarAlerta');
    },

    async alertaRecente(mensagem: string, minutos: number): Promise<boolean> {
      const desde = new Date(Date.now() - minutos * 60_000).toISOString();
      const linhas = checar(await db.from('alertas').select('id').eq('mensagem', mensagem).gte('criado_em', desde).limit(1), 'alertaRecente');
      return linhas.length > 0;
    },

    async registrarSinalVida(componente: string): Promise<void> {
      checar(await db.from('sinais_vida').upsert({ componente, visto_em: new Date().toISOString() }), 'registrarSinalVida');
    },

    async sinaisVida(): Promise<Record<string, Date>> {
      const linhas = checar(await db.from('sinais_vida').select('*'), 'sinaisVida');
      return Object.fromEntries(linhas.map((l) => [l.componente, new Date(l.visto_em)]));
    },

    async chamadosSemResponsavelParaAlertar(minutos: number): Promise<Chamado[]> {
      const limite = new Date(Date.now() - minutos * 60_000).toISOString();
      return checar(await db.from('chamados').select('*').is('responsavel_id', null).neq('status', 'concluido')
        .is('alertado_fila_em', null).lt('criado_em', limite), 'chamadosSemResponsavelParaAlertar');
    },

    /** Ações do agente na conversa desde `desdeIso` (decide a nova tentativa). O aviso de orientações cortadas não é ação. */
    async contarDecisoesDesde(conversaId: string, desdeIso: string): Promise<number> {
      const r = await db.from('decisoes_agente').select('id', { count: 'exact', head: true })
        .eq('conversa_id', conversaId).gte('criado_em', desdeIso).neq('etapa', 'orientacoes_cortadas');
      if (r.error) throw new Error(`contarDecisoesDesde: ${r.error.message}`);
      return r.count ?? 0;
    },

    async respostasPendentesAntigas(minutos: number): Promise<string[]> {
      const limite = new Date(Date.now() - minutos * 60_000).toISOString();
      const linhas = checar(await db.from('mensagens').select('id').eq('autor', 'atendente').eq('status_envio', 'pendente')
        .lt('criado_em', limite), 'respostasPendentesAntigas');
      return linhas.map((l) => l.id);
    },

    async marcarAlertadoFila(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      checar(await db.from('chamados').update({ alertado_fila_em: new Date().toISOString() }).in('id', ids), 'marcarAlertadoFila');
    },

    /** Demandas que passaram do prazo e ainda não foram avisadas. Pausadas em "Com o cliente" não vencem (spec 6.5). */
    async demandasVencidasParaAlertar(agora: Date): Promise<{ id: string; numero: number; titulo: string; setorId: string | null; responsavelId: string | null }[]> {
      const linhas = checar(await db.from('chamados').select('id, numero, titulo, setor_id, responsavel_id, usuarios(ativo)')
        .neq('status', 'concluido').is('prazo_pausado_desde', null).is('alertado_vencimento_em', null)
        .lt('prazo_em', agora.toISOString()), 'demandasVencidasParaAlertar');
      // Responsável arquivado não entra mais no painel: o aviso vai para o setor.
      return linhas.map((c) => ({
        id: c.id, numero: Number(c.numero), titulo: c.titulo, setorId: c.setor_id,
        responsavelId: c.responsavel_id && c.usuarios?.ativo ? c.responsavel_id : null,
      }));
    },

    async marcarAlertadoVencimento(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      checar(await db.from('chamados').update({ alertado_vencimento_em: new Date().toISOString() }).in('id', ids), 'marcarAlertadoVencimento');
    },

    /** Com `incluirInativos`, traz também unidades e redes desativadas (para descrever um pedido que já as usa). */
    async unidadesDaEmpresa(clienteId: string, tipo: TipoParceiro, opcoes: { incluirInativos?: boolean } = {}): Promise<UnidadeParceiro[]> {
      let q = db.from('parceiros_unidades')
        .select('id, nome_unidade, razao_social, cnpj, inscricao_estadual, endereco, numero, complemento, cep, bairro, cidade, uf, palavras_chave, parceiros_grupos!inner(id, nome, tipo, palavras_chave, ativo)')
        .eq('cliente_id', clienteId).eq('parceiros_grupos.tipo', tipo);
      if (!opcoes.incluirInativos) q = q.eq('ativo', true).eq('parceiros_grupos.ativo', true);
      const linhas = checar(await q.order('nome_unidade'), 'unidadesDaEmpresa');
      return linhas.map((l) => ({
        id: l.id, grupoId: l.parceiros_grupos.id, tipo: l.parceiros_grupos.tipo, rede: l.parceiros_grupos.nome, unidade: l.nome_unidade,
        razaoSocial: l.razao_social, cnpj: l.cnpj, ie: l.inscricao_estadual, bairro: l.bairro, cidade: l.cidade, uf: l.uf,
        endereco: l.endereco, numero: l.numero, complemento: l.complemento, cep: l.cep,
        palavrasChave: [...l.parceiros_grupos.palavras_chave, ...l.palavras_chave],
      }));
    },

    /** Com `incluirInativos`, traz também os produtos desativados (para descrever um pedido que já os usa). */
    async produtosDaEmpresa(clienteId: string, opcoes: { incluirInativos?: boolean } = {}): Promise<ProdutoEmpresa[]> {
      let q = db.from('produtos').select('id, codigo, descricao, unidade, apelidos').eq('cliente_id', clienteId);
      if (!opcoes.incluirInativos) q = q.eq('ativo', true);
      const linhas = checar(await q.order('descricao'), 'produtosDaEmpresa');
      return linhas.map((p) => ({ id: p.id, codigo: p.codigo, descricao: p.descricao, unidade: p.unidade, apelidos: p.apelidos }));
    },

    async precosVigentes(clienteId: string, grupoId: string, produtoIds: string[]): Promise<Record<string, number>> {
      if (produtoIds.length === 0) return {};
      const linhas = checar(await db.from('precos').select('produto_id, valor').eq('cliente_id', clienteId)
        .eq('grupo_id', grupoId).in('produto_id', produtoIds).is('vigente_ate', null), 'precosVigentes');
      return Object.fromEntries(linhas.map((l) => [l.produto_id, Number(l.valor)]));
    },

    async documentosDaEmpresa(clienteId: string): Promise<DocumentoEmpresa[]> {
      const linhas = checar(await db.from('documentos_empresa').select('id, nome, arquivo_path, arquivo_nome, arquivo_mime, ia_pode_enviar')
        .eq('cliente_id', clienteId).order('nome'), 'documentosDaEmpresa');
      return linhas.map((d) => ({ id: d.id, nome: d.nome, arquivoPath: d.arquivo_path, arquivoNome: d.arquivo_nome, arquivoMime: d.arquivo_mime, iaPodeEnviar: d.ia_pode_enviar }));
    },

    async dadosDaEmpresa(clienteId: string): Promise<DadosEmpresa> {
      const c = checar(await db.from('clientes').select('razao_social, nome_fantasia, cnpj, inscricao_estadual, regime, endereco, uf, ativo')
        .eq('id', clienteId).single(), 'dadosDaEmpresa');
      return { razaoSocial: c.razao_social, nomeFantasia: c.nome_fantasia, cnpj: c.cnpj, inscricaoEstadual: c.inscricao_estadual,
        regime: c.regime, endereco: c.endereco, uf: c.uf, ativo: c.ativo };
    },

    /** Acesso do contato na empresa (Parte H2): lido a cada ferramenta, para a mudança no painel valer na hora. */
    async acessoDoContato(contatoId: string, clienteId: string): Promise<AcessoContato | null> {
      return paraAcesso(checar(await db.rpc('acesso_do_contato', { p_contato: contatoId, p_cliente: clienteId }), 'acessoDoContato'));
    },

    async documentosParaContato(contatoId: string, clienteId: string): Promise<DocumentoEmpresa[]> {
      const linhas = checar(await db.rpc('documentos_para_contato', { p_contato: contatoId, p_cliente: clienteId }), 'documentosParaContato');
      return (linhas ?? []).map((d) => ({ id: d.id, nome: d.nome, arquivoPath: d.arquivo_path, arquivoNome: d.arquivo_nome, arquivoMime: d.arquivo_mime, iaPodeEnviar: d.ia_pode_enviar }));
    },

    async demandasParaContato(contatoId: string, clienteId: string, conversaId: string): Promise<DemandaParaContato[]> {
      const linhas = checar(await db.rpc('demandas_para_contato', { p_contato: contatoId, p_cliente: clienteId, p_conversa: conversaId }), 'demandasParaContato');
      return (linhas ?? []).map((c) => ({ numero: Number(c.numero), titulo: c.titulo, status: c.status, setor_nome: c.setor_nome ?? null, criado_em: c.criado_em }));
    },

    async registrarPedidoForaDoAcesso(p: { contatoId: string; clienteId: string; setorId: string; dia: string }): Promise<{ id: string; novo: boolean; chamadoId: string | null }> {
      const r = checar(await db.rpc('registrar_pedido_fora_do_acesso', { p_contato: p.contatoId, p_cliente: p.clienteId, p_setor: p.setorId, p_dia: p.dia }),
        'registrarPedidoForaDoAcesso') as { id: string; novo: boolean; chamado_id: string | null };
      return { id: r.id, novo: r.novo, chamadoId: r.chamado_id };
    },

    /**
     * Liga a demanda recém-aberta ao registro do dia só se ninguém ligou antes (duas tentativas ao mesmo tempo).
     * Perdeu: devolve a demanda da outra tentativa, para a nota "Pediu de novo" ir para lá.
     */
    async vincularPedidoForaDoAcesso(id: string, chamadoId: string): Promise<{ vinculado: true } | { vinculado: false; chamadoId: string | null }> {
      const ligadas = checar(await db.from('pedidos_fora_do_acesso').update({ chamado_id: chamadoId }).eq('id', id).is('chamado_id', null).select('id'),
        'vincularPedidoForaDoAcesso');
      if (ligadas.length) return { vinculado: true };
      const atual = checar(await db.from('pedidos_fora_do_acesso').select('chamado_id').eq('id', id).maybeSingle(), 'vincularPedidoForaDoAcesso');
      return { vinculado: false, chamadoId: atual?.chamado_id ?? null };
    },

    /** Demanda aberta pelo agente que ficou repetida (outra tentativa ganhou): sai da fila com a nota do porquê. */
    async concluirChamadoRepetido(chamadoId: string, clienteId: string | null, texto: string): Promise<void> {
      checar(await db.from('chamado_eventos').insert({ chamado_id: chamadoId, cliente_id: clienteId, tipo: 'nota_interna', usuario_id: null, texto }), 'concluirChamadoRepetido');
      checar(await db.from('chamados').update({ status: 'concluido' }).eq('id', chamadoId), 'concluirChamadoRepetido');
    },

    async concluirPedidoForaDoAcesso(id: string, chamadoId: string, sociosAvisados: number): Promise<void> {
      checar(await db.from('pedidos_fora_do_acesso').update({ chamado_id: chamadoId, socios_avisados: sociosAvisados }).eq('id', id), 'concluirPedidoForaDoAcesso');
    },

    async sociosParaAlerta(clienteId: string, excetoContatoId: string): Promise<PessoaParaAviso[]> {
      const linhas = checar(await db.rpc('socios_para_alerta', { p_cliente: clienteId, p_exceto: excetoContatoId }), 'sociosParaAlerta');
      return (linhas ?? []).map((l) => ({ contatoId: l.contato_id, nome: l.nome, telefone: l.telefone }));
    },

    /** Base dos agentes ativos (Parte I): só quem pode ser procurado no setor (D17). Ninguém chama ainda. */
    async contatosProcuraveis(clienteId: string, setorId: string): Promise<PessoaParaAviso[]> {
      const linhas = checar(await db.rpc('contatos_procuraveis', { p_cliente: clienteId, p_setor: setorId }), 'contatosProcuraveis');
      return (linhas ?? []).map((l) => ({ contatoId: l.contato_id, nome: l.nome, telefone: l.telefone }));
    },

    /** Nota interna escrita pelo agente (sem pessoa): a explicação do pedido fora do acesso (D13). */
    async registrarNotaDoSistema(chamadoId: string, clienteId: string | null, texto: string): Promise<void> {
      checar(await db.from('chamado_eventos').insert({ chamado_id: chamadoId, cliente_id: clienteId, tipo: 'nota_interna', usuario_id: null, texto }), 'registrarNotaDoSistema');
    },

    /** Certificado digital perto de vencer vira demanda no Fiscal (Parte H1, D21). `hoje` = dia em São Paulo; devolve quantas criou. */
    async gerarDemandasCertificado(hoje: string): Promise<number> {
      return checar(await db.rpc('gerar_demandas_certificado', { p_hoje: hoje }), 'gerarDemandasCertificado');
    },

    /** Preço alterado pelo agente a pedido do contato; o banco exige "pode mudar preço" para a empresa. */
    async definirPrecoPeloAgente(grupoId: string, produtoId: string, valor: number, contatoId: string): Promise<void> {
      const r = await db.rpc('definir_preco_agente', { p_grupo: grupoId, p_produto: produtoId, p_valor: valor, p_contato: contatoId });
      if (r.error) throw new Error(r.error.message);
    },

    /** Produto cadastrado pelo agente a pedido do contato; o banco exige "pode mudar preço" para a empresa. */
    async cadastrarProdutoPeloAgente(clienteId: string, p: { codigo: string; descricao: string; unidade: string; apelidos: string[] }, contatoId: string): Promise<string> {
      const r = await db.rpc('cadastrar_produto_agente', {
        p_cliente: clienteId, p_codigo: p.codigo, p_descricao: p.descricao, p_unidade: p.unidade, p_apelidos: p.apelidos, p_contato: contatoId,
      });
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },

    /** Telefone de alguém da equipe com "Site e WhatsApp" (o mesmo critério de eh_telefone_do_assistente). */
    async usuarioDoAssistente(telefone: string): Promise<UsuarioAssistente | null> {
      const linhas = checar(await db.from('usuarios').select(COLUNAS_ASSISTENTE)
        .in('telefone', variantesTelefone(telefone)).eq('ativo', true), 'usuarioDoAssistente');
      return (linhas as LinhaAssistente[]).map(paraUsuarioAssistente).find((u) => u.niveis.assistente === 'site_whatsapp') ?? null;
    },

    async obterUsuarioAssistente(id: string): Promise<UsuarioAssistente | null> {
      const u = checar(await db.from('usuarios').select(COLUNAS_ASSISTENTE).eq('id', id).maybeSingle(), 'obterUsuarioAssistente');
      return u ? paraUsuarioAssistente(u as LinhaAssistente) : null;
    },

    /** Horário de acesso (Parte D): quem decide é o banco, com o mesmo critério do painel. */
    async horarioPermite(usuarioId: string, quando: Date): Promise<boolean> {
      const r = await db.rpc('horario_permite', { p_usuario: usuarioId, p_quando: quando.toISOString() });
      if (r.error) throw new Error(r.error.message);
      return r.data === true;
    },

    async registrarMensagemAssistente(m: { usuarioId: string; canal: CanalAssistente; conversaId: string | null; papel: 'usuario' | 'assistente'; conteudo: string; arquivo?: ArquivoAssistente | null; processada?: boolean }): Promise<string> {
      const r = checar(await db.from('assistente_mensagens').insert({
        usuario_id: m.usuarioId, canal: m.canal, conversa_id: m.conversaId, papel: m.papel, conteudo: m.conteudo,
        arquivo: (m.arquivo ?? null) as never, processada_em: m.processada ? new Date().toISOString() : null,
      }).select('id').single(), 'registrarMensagemAssistente');
      return r.id;
    },

    async historicoAssistente(usuarioId: string, canal: CanalAssistente, conversaId: string | null, limite: number): Promise<MensagemAssistente[]> {
      let q = db.from('assistente_mensagens').select('*').eq('usuario_id', usuarioId).eq('canal', canal);
      q = conversaId ? q.eq('conversa_id', conversaId) : q.is('conversa_id', null);
      const linhas = checar(await q.order('criado_em', { ascending: false }).limit(limite), 'historicoAssistente');
      return linhas.reverse();
    },

    async perguntasPendentes(usuarioId: string, canal: CanalAssistente, conversaId: string | null, limite?: number): Promise<MensagemAssistente[]> {
      let q = db.from('assistente_mensagens').select('*').eq('usuario_id', usuarioId).eq('canal', canal).eq('papel', 'usuario').is('processada_em', null);
      q = conversaId ? q.eq('conversa_id', conversaId) : q.is('conversa_id', null);
      const ordenada = q.order('criado_em');
      return checar(await (limite ? ordenada.limit(limite) : ordenada), 'perguntasPendentes');
    },

    /** Pessoas e contextos com pergunta ao assistente sem resposta há mais de `minutos` (o job se perdeu): um por pessoa, canal e conversa. */
    async perguntasAssistenteParadas(minutos: number): Promise<{ usuarioId: string; canal: CanalAssistente; conversaId: string | null; telefone: string | null }[]> {
      const corte = new Date(Date.now() - minutos * 60_000).toISOString();
      const linhas = checar(await db.from('assistente_mensagens').select('usuario_id, canal, conversa_id, usuarios(telefone)')
        .eq('papel', 'usuario').is('processada_em', null).lt('criado_em', corte).order('criado_em').limit(1000), 'perguntasAssistenteParadas');
      const unicos = new Map<string, { usuarioId: string; canal: CanalAssistente; conversaId: string | null; telefone: string | null }>();
      for (const l of linhas) {
        const chave = `${l.usuario_id}:${l.canal}:${l.conversa_id ?? '-'}`;
        if (!unicos.has(chave)) unicos.set(chave, { usuarioId: l.usuario_id, canal: l.canal as CanalAssistente, conversaId: l.conversa_id, telefone: l.usuarios?.telefone ?? null });
      }
      return [...unicos.values()];
    },

    async marcarPerguntasRespondidas(ids: string[]): Promise<void> {
      if (ids.length) checar(await db.from('assistente_mensagens').update({ processada_em: new Date().toISOString() }).in('id', ids), 'marcarPerguntasRespondidas');
    },

    async obterSugestao(id: string): Promise<SugestaoResposta | null> {
      return checar(await db.from('sugestoes_resposta').select('*').eq('id', id).maybeSingle(), 'obterSugestao');
    },

    /** Só sai de "pendente": uma nova tentativa da fila, ou um pedido que já expirou no painel, não sobrescreve. */
    async concluirSugestao(id: string, r: { status: 'pronta'; texto: string } | { status: 'falhou'; erro: string }): Promise<boolean> {
      const linhas = checar(await db.from('sugestoes_resposta').update({
        status: r.status, texto: r.status === 'pronta' ? r.texto : null, erro: r.status === 'falhou' ? r.erro : null,
        concluida_em: new Date().toISOString(),
      }).eq('id', id).eq('status', 'pendente').select('id'), 'concluirSugestao');
      return linhas.length > 0;
    },

    async chamadosRecentes(f: { status?: string; abertas?: boolean; de?: string; ate?: string; clienteIds?: string[]; soNotas?: boolean; comPedido?: boolean; setorId?: string | null; visivelPara?: { usuarioId: string; setorIds: string[] } | null; limite?: number }): Promise<ChamadoResumo[]> {
      const montar = () => {
        let q = db.from('chamados').select(SELECT_CHAMADO_RESUMO);
        if (f.status) q = q.eq('status', f.status as never);
        if (f.abertas) q = q.neq('status', 'concluido');
        if (f.de) q = q.gte('criado_em', f.de);
        if (f.ate) q = q.lte('criado_em', f.ate);
        if (f.clienteIds) q = q.in('cliente_id', f.clienteIds);
        if (f.soNotas) q = q.like('titulo', 'NF de %');
        if (f.comPedido) q = q.not('pedido_venda', 'is', null);
        if (f.setorId) q = q.eq('setor_id', f.setorId);
        if (f.visivelPara) {
          const { usuarioId, setorIds } = f.visivelPara;
          q = q.or([`responsavel_id.eq.${usuarioId}`, ...(setorIds.length ? [`setor_id.in.(${setorIds.join(',')})`] : [])].join(','));
        }
        // "id" desempata linhas com o mesmo horário, para a paginação não repetir nem pular.
        return q.order('criado_em', { ascending: false }).order('id');
      };
      if (f.limite !== undefined) return checar(await montar().limit(f.limite), 'chamadosRecentes').map(paraChamadoResumo);
      const todos: ChamadoResumo[] = [];
      for (let de = 0; ; de += PAGINA) {
        const pagina = checar(await montar().range(de, de + PAGINA - 1), 'chamadosRecentes');
        todos.push(...pagina.map(paraChamadoResumo));
        if (pagina.length < PAGINA) return todos;
      }
    },

    async chamadoPorNumero(numero: number): Promise<ChamadoResumo | null> {
      const c = checar(await db.from('chamados').select(SELECT_CHAMADO_RESUMO).eq('numero', numero).maybeSingle(), 'chamadoPorNumero');
      return c ? paraChamadoResumo(c) : null;
    },

    async eventosDoChamado(chamadoId: string, limite: number) {
      const linhas = checar(await db.from('chamado_eventos').select('tipo, texto, criado_em, usuarios(nome)').eq('chamado_id', chamadoId)
        .order('criado_em', { ascending: false }).limit(limite), 'eventosDoChamado');
      return linhas.map((e) => ({ tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario: e.usuarios?.nome ?? null }));
    },

    async atualizarPedidoVenda(chamadoId: string, p: { pedido: PedidoVendaSalvo; resumo: string; titulo?: string }): Promise<void> {
      checar(await db.from('chamados').update({ pedido_venda: p.pedido as never, resumo: p.resumo, ...(p.titulo ? { titulo: p.titulo } : {}), atualizado_em: new Date().toISOString() }).eq('id', chamadoId), 'atualizarPedidoVenda');
    },

    /**
     * A última chamada de alterar_pedido_venda desta pessoa para este pedido desde `desde`, qualquer que tenha sido o resultado
     * (prévia, confirmação, erro). A confirmação só vale se ela for uma prévia: gravar ou chamar de novo consome a prévia.
     * Com `ate`, só as chamadas anteriores a ele (a confirmação usa a pergunta mais nova: o que veio depois a pessoa não viu).
     * Recusas marcadas com `nao_consome` (ex.: a pessoa pediu outra mudança no "sim") não contam: não consomem a prévia nova.
     */
    async ultimaPreviaDoAssistente(usuarioId: string, numero: number, desde: Date, ate?: Date): Promise<{ entrada: unknown; saida: Record<string, unknown>; criadoEm: Date } | null> {
      let q = db.from('decisoes_agente').select('entrada, saida, criado_em').eq('etapa', 'assistente:alterar_pedido_venda')
        .eq('saida->>usuario', usuarioId).eq('entrada->>numero', String(numero)).gte('criado_em', desde.toISOString())
        .is('saida->>nao_consome', null);
      if (ate) q = q.lt('criado_em', ate.toISOString());
      const linhas = checar(await q.order('criado_em', { ascending: false }).limit(1), 'ultimaPreviaDoAssistente');
      const l = linhas[0];
      if (!l) return null;
      return { entrada: l.entrada, saida: (l.saida ?? {}) as Record<string, unknown>, criadoEm: new Date(l.criado_em) };
    },

    async registrarNotaInterna(chamadoId: string, clienteId: string | null, usuarioId: string, texto: string): Promise<void> {
      checar(await db.from('chamado_eventos').insert({ chamado_id: chamadoId, cliente_id: clienteId, tipo: 'nota_interna', usuario_id: usuarioId, texto }), 'registrarNotaInterna');
    },

    async registrarAuditoria(a: { usuarioId: string; acao: string; entidade: string; entidadeId: string; detalhes?: object }): Promise<void> {
      checar(await db.from('auditoria_acessos').insert({ usuario_id: a.usuarioId, acao: a.acao, entidade: a.entidade, entidade_id: a.entidadeId, detalhes: (a.detalhes ?? null) as never }), 'registrarAuditoria');
    },

    async buscarEmpresas(texto: string): Promise<{ id: string; nome: string; cnpj: string }[]> {
      const limpo = texto.replace(/[,()*%"\\]/g, ' ').trim();
      if (!limpo) return [];
      const digitos = limpo.replace(/\D/g, '');
      const filtros = [`razao_social.ilike.%${limpo}%`, `nome_fantasia.ilike.%${limpo}%`, ...(digitos.length >= 3 ? [`cnpj.like.%${digitos}%`] : [])];
      let linhas = checar(await db.from('clientes').select('id, razao_social, nome_fantasia, cnpj').or(filtros.join(',')).eq('ativo', true).order('razao_social').limit(10), 'buscarEmpresas');
      // Sem acento no texto digitado ("industria"): compara também sem acentos.
      if (linhas.length === 0) {
        const todos = checar(await db.from('clientes').select('id, razao_social, nome_fantasia, cnpj').eq('ativo', true).order('razao_social'), 'buscarEmpresas');
        const alvo = semAcento(limpo);
        linhas = todos.filter((c) => semAcento(`${c.razao_social} ${c.nome_fantasia ?? ''}`).includes(alvo)).slice(0, 10);
      }
      return linhas.map((c) => ({ id: c.id, nome: c.nome_fantasia ?? c.razao_social, cnpj: c.cnpj }));
    },

    async pedidosVendaParaBling(chamadoIds: string[]): Promise<PedidoVendaBling[]> {
      const bloco = <T,>(l: T[]) => Array.from({ length: Math.ceil(l.length / 100) }, (_, i) => l.slice(i * 100, i * 100 + 100));
      // Em blocos de 100: o filtro vai na URL e uma lista longa estoura o limite dela.
      const chamados: { numero: number | string; pedido_venda: unknown }[] = [];
      for (const ids of bloco([...new Set(chamadoIds)])) {
        chamados.push(...checar(await db.from('chamados').select('numero, pedido_venda').in('id', ids).not('pedido_venda', 'is', null), 'pedidosVendaParaBling'));
      }
      chamados.sort((x, y) => Number(x.numero) - Number(y.numero));
      const salvos = chamados.map((c) => ({ numero: Number(c.numero), salvo: c.pedido_venda as unknown as PedidoVendaSalvo }));
      const unidades: (NonNullable<Parameters<typeof pedidoVendaBling>[2]> & { id: string })[] = [];
      for (const ids of bloco([...new Set(salvos.flatMap((s) => (s.salvo.unidade_id ? [s.salvo.unidade_id] : [])))])) {
        unidades.push(...checar(await db.from('parceiros_unidades')
          .select('id, razao_social, nome_unidade, cnpj, endereco, numero, complemento, bairro, cidade, uf, cep, telefone').in('id', ids), 'pedidosVendaParaBling'));
      }
      const porId = new Map(unidades.map((u) => [u.id, u]));
      return salvos.map((s) => pedidoVendaBling(s.numero, s.salvo, s.salvo.unidade_id ? porId.get(s.salvo.unidade_id) ?? null : null));
    },

    async nomesDasRedes(unidadeIds: string[]): Promise<Record<string, string>> {
      const ids = [...new Set(unidadeIds)];
      const nomes: Record<string, string> = {};
      // Em blocos de 100: o filtro vai na URL e uma lista longa estoura o limite dela.
      for (let i = 0; i < ids.length; i += 100) {
        const linhas = checar(await db.from('parceiros_unidades').select('id, parceiros_grupos(nome)').in('id', ids.slice(i, i + 100)), 'nomesDasRedes');
        for (const l of linhas) nomes[l.id] = l.parceiros_grupos?.nome ?? '';
      }
      return nomes;
    },

    async setorPorNome(nome: string): Promise<string | null> {
      const s = checar(await db.from('setores').select('id').eq('nome', nome).eq('ativo', true).maybeSingle(), 'setorPorNome');
      return s?.id ?? null;
    },

    /** Orientações ligadas (Treinar o agente), das mais recentes para as mais antigas. Lidas com o cliente de serviço. */
    async orientacoesAtivas(): Promise<OrientacaoAgente[]> {
      const linhas = checar(await db.from('orientacoes_agente')
        .select('id, titulo, texto, tipo, cliente_id, setor_id, atualizado_em, setores(nome)')
        .eq('ativo', true).order('atualizado_em', { ascending: false }).order('id').limit(PAGINA), 'orientacoesAtivas');
      return linhas.map((o) => ({
        id: o.id, titulo: o.titulo, texto: o.texto, tipo: o.tipo as TipoOrientacao, clienteId: o.cliente_id, setorId: o.setor_id,
        setorNome: o.setores?.nome ?? null, atualizadoEm: new Date(o.atualizado_em),
      }));
    },

    /** Ids cortados no último registro `orientacoes_cortadas` da conversa (null se nunca houve corte). */
    async ultimasOrientacoesCortadas(conversaId: string): Promise<string[] | null> {
      const l = checar(await db.from('decisoes_agente').select('saida').eq('conversa_id', conversaId).eq('etapa', 'orientacoes_cortadas')
        .order('criado_em', { ascending: false }).limit(1).maybeSingle(), 'ultimasOrientacoesCortadas');
      const cortadas = (l?.saida as { cortadas?: unknown } | null)?.cortadas;
      return Array.isArray(cortadas) ? cortadas.filter((x): x is string => typeof x === 'string') : null;
    },

    async simulacaoPorId(id: string): Promise<SimulacaoAgente | null> {
      const s = checar(await db.from('simulacoes_agente').select('*').eq('id', id).maybeSingle(), 'simulacaoPorId');
      return s as SimulacaoAgente | null;
    },

    /** Grava o resultado de um teste ainda pendente. Devolve false se ele já tinha sido concluído (nova tentativa da fila). */
    async concluirSimulacao(id: string, d: { status: 'pronta' | 'erro'; respostas?: Json | null; erro?: string | null }): Promise<boolean> {
      const r = await db.from('simulacoes_agente').update({ status: d.status, respostas: d.respostas ?? null, erro: d.erro ?? null })
        .eq('id', id).eq('status', 'pendente').select('id');
      return checar(r, 'concluirSimulacao').length > 0;
    },

    async resumoDoDia(inicio: Date) {
      const abertos = checar(await db.from('chamados').select('responsavel_id, setores(nome)').neq('status', 'concluido'), 'resumoDoDia');
      const concluidos = checar(await db.from('chamados').select('id').eq('status', 'concluido')
        .gte('concluido_em', inicio.toISOString()), 'resumoDoDia');
      const porSetor = new Map<string, number>();
      for (const c of abertos) {
        const nome = c.setores?.nome ?? 'Triagem';
        porSetor.set(nome, (porSetor.get(nome) ?? 0) + 1);
      }
      return {
        abertosPorSetor: [...porSetor].map(([setor, total]) => ({ setor, total })),
        concluidosHoje: concluidos.length,
        semResponsavel: abertos.filter((c) => c.responsavel_id === null).length,
      };
    },
  };
}

export type Repos = ReturnType<typeof criarRepos>;
