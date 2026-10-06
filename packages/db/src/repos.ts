import { lerNiveis, FUNCIONALIDADES_IA, type FuncionalidadeGravavel, type ProvedorIa, pedidoVendaBling, variantesTelefone, type Niveis, type PedidoVendaBling, type ConfigExpediente, type PrecoModelo, type PedidoVendaSalvo, PERFIS, type AcessoContato, type CanalAviso, type Perfil, type TipoSkill, MODOS_CONTATO, ehPreAnaliseNota, type CompradorCadastrado, type ModoContato, type MudancaPreco, type PreAnaliseNota, type RegraDoAgente, ehResultadoTarefa, type EstadoTarefa, type EtapaTarefa, type MotivoFimVez, type ResultadoTarefa, type TipoPendencia, type MotivoPausa } from '@escritorio/core';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import type { Db } from './cliente';
import type { Database, Json } from './tipos.gen';
export type { Json } from './tipos.gen';

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
  /** Agente que gastou (Parte I1, D16). Vazio: banco sem a Parte I ou gasto que não é de agente. */
  agenteId?: string | null;
  /** Tarefa de trabalho que gastou (Parte I3a, D12). Só existe com a I3 no banco. */
  tarefaId?: string | null;
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
/** Skill como o motor usa (Parte I1): a versão atual, com os nomes dos arquivos de apoio. */
export type SkillCarregada = {
  id: string; nome: string; tipo: TipoSkill; ativa: boolean; titulo: string; descricao: string; corpo: string; versao: number; arquivos: string[];
};
/** Agente como o motor usa (Parte I1). `id` null: o perfil do código (banco sem a Parte I). `skillEmTeste`: a skill que a simulação inclui. */
export type PerfilAgente = {
  id: string | null; slug: string; nome: string; modelo: string | null; ferramentas: string[]; skills: SkillCarregada[]; skillEmTeste: string | null;
};
/** Agente de um setor que atende este contato (Parte I2, D2): o perfil do motor + setor, estado, modo, regras e as orientações dele. */
export type AgenteSetor = PerfilAgente & {
  id: string; setorId: string; setor: string; estado: 'ligado' | 'teste'; modo: ModoContato; regras: RegraDoAgente[]; orientacoes: OrientacaoAgente[];
};
export type DemandaDoSetor = { id: string; numero: number; titulo: string; status: string; temPedido: boolean };
export type DadosPreAnalise = {
  numero: number; clienteId: string | null; pedido: PedidoVendaSalvo | null; comprador: CompradorCadastrado | null; mudancas: MudancaPreco[];
};
export type NovaSugestao = { chamadoId: string; agenteId: string; conversaId: string | null; tipo: 'nota_interna' | 'correcao'; conteudo: Record<string, unknown> };
export type PendenciaDaTarefa = {
  id: string; numero: number; tipo: TipoPendencia; pergunta: string; detalhe: string | null; opcoes: string[]; mensagem: string | null;
  estado: 'aberta' | 'respondida'; resposta: string | null; vista: boolean; pedidaAoCliente: boolean;
};
export type ArquivoDaTarefa = { id: string; nome: string; mime: string; tamanho: number; bucket: 'tarefas' | 'anexos'; caminho: string; lido: boolean; detalhe: string | null };
export type TarefaParaTrabalho = {
  id: string; numero: number; agenteId: string; agenteSlug: string; agenteNome: string; agenteEstado: 'desligado' | 'teste' | 'ligado'; agenteTipos: string[];
  setorId: string | null; setor: string | null; chamadoId: string; chamadoNumero: number; chamadoTitulo: string;
  clienteId: string | null; empresa: string | null; pedidaPor: string | null; pedidaPorNome: string | null; criadoEm: string;
  pedido: string; skillNome: string | null; estado: EstadoTarefa; etapas: EtapaTarefa[]; etapaAtual: number; anotacoes: string;
  resultado: ResultadoTarefa | null; ajustes: { texto: string; por: string | null; em: string }[]; ajustePendente: boolean;
  custoUsd: number; segundosTrabalhando: number; limiteUsd: number; limiteMinutos: number;
  pendencias: PendenciaDaTarefa[]; arquivos: ArquivoDaTarefa[];
};
export type SituacaoTarefa = { estado: EstadoTarefa; custoUsd: number; segundosTrabalhando: number; limiteUsd: number; limiteMinutos: number };
export type NovaPendencia = { tarefaId: string; tipo: TipoPendencia; pergunta: string; detalhe: string | null; opcoes: string[]; mensagem: string | null };
export type PendenciaParaEnvio = { id: string; tarefaId: string; numero: number; clienteId: string | null; contatoId: string; contatoNome: string; telefone: string; texto: string };
export type PedidoAoContato = { pendenciaId: string; numero: number; pergunta: string; setor: string | null; chamadoNumero: number; empresa: string | null };
const COLUNAS_COMPRADOR = 'razao_social, nome_unidade, cnpj, endereco, numero, complemento, bairro, cidade, uf, cep, telefone, grupo_id';
const ehModo = (v: unknown): v is ModoContato => (MODOS_CONTATO as readonly unknown[]).includes(v);
type LinhaSkill = { id: string; nome: string; tipo: string; ativo: boolean; titulo: string; descricao: string; corpo: string; versao: number; arquivos: string[] | null };
const paraSkill = (k: LinhaSkill): SkillCarregada => ({
  id: k.id, nome: k.nome, tipo: k.tipo as TipoSkill, ativa: k.ativo, titulo: k.titulo, descricao: k.descricao, corpo: k.corpo,
  versao: k.versao, arquivos: k.arquivos ?? [],
});
/** Banco sem as migrações da Parte I (homologação, D23): tabela, coluna ou função que não existem. */
const SEM_PARTE_I = new Set(['42P01', '42703', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205']);
/** Parte I3b (D17): o banco ainda não tem as migrações da I3b (a função ou a tabela não existe). */
export class SemI3b extends Error {
  constructor() { super('O banco ainda não tem a Parte I3b.'); }
}
/** Parte I4: o banco ainda não tem as migrações da I4 (a função ou a coluna não existe). */
export class SemI4 extends Error {
  constructor() { super('O banco ainda não tem a Parte I4.'); }
}
/** P0001 do banco: a frase vai para a pessoa como está. */
export class RecusaDoBanco extends Error {}
export type AgenteParaPedir = {
  id: string; slug: string; nome: string; descricao: string; setorId: string; setor: string; estado: 'teste' | 'ligado';
  destino: 'esta_demanda' | 'nova'; procedimentos: { nome: string; titulo: string; descricao: string }[];
  custo: { n: number; min: number | null; max: number | null; limite: number };
};
export type PedidoCriado = { tarefaId: string; tarefaNumero: number; chamadoId: string; chamadoNumero: number; demandaNova: boolean;
  /** A mesma chave já tinha criado esta tarefa (nova tentativa do job do Assistente). */
  jaCriada?: boolean };
export type PendenciaRepassada = {
  tarefaId: string; tarefaNumero: number; agente: string; empresa: string | null; numero: number; pergunta: string; detalhe: string | null; opcoes: string[];
};
export type OpcoesDoPedido = { prazoDesejado: string | null; lerDrive: boolean; subpasta: string | null; avisarPainel: boolean; avisarWhatsapp: boolean };
export type AvisoReservado = {
  id: string; tarefaId: string; tipo: 'pendencias' | 'pronta' | 'pausada'; pendencias: number[]; usuarioId: string; nome: string; telefone: string;
  responsavel: string | null; pedeNoSetor: boolean; motivoPausa: MotivoPausa | null;
};
export type PastaDaTarefa = {
  estado: EstadoTarefa; clienteId: string | null; pasta: string | null; outras: string[];
  importados: { driveId: string; modificadoEm: string | null }[]; total: number;
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

    /** Revisão geral I1: a vez de uma chave (conversa, pergunta do assistente) por `segundos`; o mesmo dono renova. */
    async pegarTrava(chave: string, dono: string, segundos: number): Promise<boolean> {
      return Boolean(checar(await db.rpc('pegar_trava', { p_chave: chave, p_dono: dono, p_segundos: segundos }), 'pegarTrava'));
    },

    async soltarTrava(chave: string, dono: string): Promise<void> {
      checar(await db.rpc('soltar_trava', { p_chave: chave, p_dono: dono }), 'soltarTrava');
    },

    /** Revisão geral C1: conversas com o agente com mensagem de cliente não processada entre `deMin` e `ateMin` minutos (sem vez em andamento). */
    async conversasComMensagemParada(deMin: number, ateMin: number): Promise<{ conversaId: string; desde: string; reenvios: number; ultimoReenvio: string | null }[]> {
      const linhas = checar(await db.rpc('conversas_com_mensagem_parada', { p_de_min: deMin, p_ate_min: ateMin }), 'conversasComMensagemParada') ?? [];
      return linhas.map((l) => ({ conversaId: l.conversa_id, desde: l.desde, reenvios: l.reenvios, ultimoReenvio: l.ultimo_reenvio }));
    },

    async marcarReenfileirada(conversaId: string): Promise<void> {
      checar(await db.rpc('marcar_reenfileirada', { p_conversa: conversaId }), 'marcarReenfileirada');
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

    async registrarDecisao(d: { conversaId: string | null; clienteId: string | null; etapa: string; entrada: unknown; saida: unknown; justificativa?: string; turno?: string | null; agenteId?: string | null }): Promise<void> {
      checar(await db.from('decisoes_agente').insert({ conversa_id: d.conversaId, cliente_id: d.clienteId, etapa: d.etapa,
        entrada: d.entrada as never, saida: d.saida as never, justificativa: d.justificativa ?? null, turno: d.turno ?? null,
        ...(d.agenteId ? { agente_id: d.agenteId } : {}) }), 'registrarDecisao');
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
        ...(u.agenteId ? { agente_id: u.agenteId } : {}),
        ...(u.tarefaId ? { tarefa_id: u.tarefaId } : {}),
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

    /** Orientações ligadas (Treinar o agente), das mais recentes para as mais antigas. Com o agente (Parte I1), só as dele; sem, todas, como antes. Lidas com o cliente de serviço. */
    async orientacoesAtivas(agenteId: string | null = null): Promise<OrientacaoAgente[]> {
      let consulta = db.from('orientacoes_agente')
        .select('id, titulo, texto, tipo, cliente_id, setor_id, atualizado_em, setores(nome)')
        .eq('ativo', true);
      if (agenteId) consulta = consulta.eq('agente_id', agenteId);
      const linhas = checar(await consulta.order('atualizado_em', { ascending: false }).order('id').limit(PAGINA), 'orientacoesAtivas');
      return linhas.map((o) => ({
        id: o.id, titulo: o.titulo, texto: o.texto, tipo: o.tipo as TipoOrientacao, clienteId: o.cliente_id, setorId: o.setor_id,
        setorNome: o.setores?.nome ?? null, atualizadoEm: new Date(o.atualizado_em),
      }));
    },

    /** Agente pelo endereço, com as skills ligadas (e a em teste). null: não existe ou o banco ainda não tem a Parte I (D23). */
    async perfilDoAgente(slug: string, skillEmTeste: string | null = null): Promise<PerfilAgente | null> {
      const r = await db.from('agentes').select('id, slug, nome, modelo, ferramentas').eq('slug', slug).maybeSingle();
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      const a = checar(r, 'perfilDoAgente');
      if (!a) return null;
      const skills = checar(await db.rpc('skills_do_agente', { p_agente: a.id, ...(skillEmTeste ? { p_incluir: skillEmTeste } : {}) }),
        'perfilDoAgente.skills');
      return {
        id: a.id, slug: a.slug, nome: a.nome, modelo: a.modelo, ferramentas: a.ferramentas, skillEmTeste,
        skills: skills.map(paraSkill),
      };
    },

    /** Arquivo de apoio de uma skill ligada do agente (ou da em teste). null: não é dele, está desligada ou não existe (D5). */
    async referenciaDaSkill(agenteId: string, nome: string, caminho: string, skillEmTeste: string | null = null): Promise<string | null> {
      const texto = checar(await db.rpc('referencia_da_skill', {
        p_agente: agenteId, p_nome: nome, p_caminho: caminho, ...(skillEmTeste ? { p_incluir: skillEmTeste } : {}),
      }), 'referenciaDaSkill');
      return texto ?? null;
    },

    /** Agentes dos setores que atendem este contato (D2). null: o banco ainda não tem a Parte I2 (D15). */
    async agentesParaContato(contatoId: string): Promise<AgenteSetor[] | null> {
      const r = await db.rpc('agentes_para_contato', { p_contato: contatoId });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      const agentes: AgenteSetor[] = [];
      for (const a of checar(r, 'agentesParaContato') ?? []) {
        if (!ehModo(a.modo_contato) || (a.estado !== 'ligado' && a.estado !== 'teste') || !a.setor_id) continue;
        const skills = checar(await db.rpc('skills_do_agente', { p_agente: a.id }), 'agentesParaContato.skills');
        const regras = (Array.isArray(a.regras) ? a.regras : []) as { id: string; assunto: string; exemplo: string | null; modo: unknown }[];
        agentes.push({
          id: a.id, slug: a.slug, nome: a.nome, modelo: a.modelo, ferramentas: a.ferramentas ?? [], skillEmTeste: null,
          skills: (skills as LinhaSkill[]).map(paraSkill), setorId: a.setor_id, setor: a.setor, estado: a.estado, modo: a.modo_contato,
          regras: regras.flatMap((x) => (ehModo(x.modo) ? [{ id: x.id, assunto: x.assunto, exemplo: x.exemplo ?? '', modo: x.modo }] : [])),
          orientacoes: await this.orientacoesAtivas(a.id),
        });
      }
      return agentes;
    },

    /** D5: a pasta do cliente da tarefa, as pastas dos outros clientes e o que já foi copiado. Lança SemI3b sem a migração. */
    async pastaDriveDaTarefa(tarefaId: string): Promise<PastaDaTarefa | null> {
      const r = await db.rpc('pasta_drive_da_tarefa', { p_tarefa: tarefaId });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) throw new SemI3b();
      const j = checar(r, 'pastaDriveDaTarefa') as null | {
        estado: EstadoTarefa; cliente_id: string | null; pasta: string | null; outras: string[]; total: number;
        importados: { drive_id: string; modificado_em: string | null }[];
      };
      if (!j) return null;
      return {
        estado: j.estado, clienteId: j.cliente_id, pasta: j.pasta, outras: j.outras ?? [], total: Number(j.total),
        // F20: o PostgREST devolve "+00:00"; o repositório promete ISO com "Z" (a mesma forma que o Drive manda).
        importados: (j.importados ?? []).map((x) => ({
          driveId: x.drive_id, modificadoEm: x.modificado_em ? new Date(x.modificado_em).toISOString() : null,
        })),
      };
    },

    async registrarArquivoDrive(a: { tarefaId: string; caminho: string; nome: string; mime: string; tamanho: number; driveId: string; modificadoEm: string }):
      Promise<{ id: string; nome: string }> {
      const j = checar(await db.rpc('registrar_arquivo_drive', {
        p_tarefa: a.tarefaId, p_caminho: a.caminho, p_nome: a.nome, p_mime: a.mime, p_tamanho: a.tamanho, p_drive_id: a.driveId, p_modificado: a.modificadoEm,
      }), 'registrarArquivoDrive') as { id: string; nome: string };
      return { id: j.id, nome: j.nome };
    },

    /**
     * D9, F1: só erro de CONTA (token/401) entra em `erro`; `erro: null` limpa (leitura bem-sucedida); `email: null` mantém o que já estava.
     * `semLeitor`: o trabalhador está sem a chave (ou com ela inválida); o e-mail antigo some (o painel diz "Drive não configurado").
     * false = banco sem a I3b (o trabalhador avisa uma vez no log e segue).
     */
    async registrarSituacaoDrive(s: { email: string | null; erro: string | null; semLeitor?: boolean }): Promise<boolean> {
      const r = await db.rpc('registrar_situacao_drive', { p_email: s.email as string, p_erro: s.erro as string, ...(s.semLeitor ? { p_sem_leitor: true } : {}) });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return false;
      checar(r, 'registrarSituacaoDrive');
      return true;
    },

    /** D11: o agente do setor para o Testar (com a skill em teste, mesmo desligada). null: não existe, é o Thiago, sem setor ou sem Conversa. */
    async agenteSetorParaTeste(agenteId: string, skillEmTeste: string | null): Promise<AgenteSetor | null> {
      const a = checar(await db.from('agentes').select('id, slug, nome, modelo, ferramentas, tipos, estado, modo_contato, porta_de_entrada, setor_id, setores(nome)')
        .eq('id', agenteId).maybeSingle(), 'agenteSetorParaTeste') as null | {
        id: string; slug: string; nome: string; modelo: string | null; ferramentas: string[] | null; tipos: string[]; estado: string; modo_contato: unknown;
        porta_de_entrada: boolean; setor_id: string | null; setores: { nome: string } | null;
      };
      if (!a || a.porta_de_entrada || !a.setor_id || !a.tipos.includes('conversa') || !ehModo(a.modo_contato)) return null;
      const skills = checar(await db.rpc('skills_do_agente', { p_agente: a.id, ...(skillEmTeste ? { p_incluir: skillEmTeste } : {}) }), 'agenteSetorParaTeste.skills');
      const regras = checar(await db.from('agente_regras_assunto').select('id, assunto, exemplo, modo').eq('agente_id', a.id).order('criado_em'),
        'agenteSetorParaTeste.regras') as { id: string; assunto: string; exemplo: string | null; modo: unknown }[];
      return {
        id: a.id, slug: a.slug, nome: a.nome, modelo: a.modelo, ferramentas: a.ferramentas ?? [], skillEmTeste,
        skills: (skills as LinhaSkill[]).map(paraSkill), setorId: a.setor_id, setor: a.setores?.nome ?? '',
        // No teste o estado não importa (o dono testa antes de ligar); o tipo pede 'ligado' | 'teste'.
        estado: a.estado === 'teste' ? 'teste' : 'ligado', modo: a.modo_contato,
        regras: regras.flatMap((x) => (ehModo(x.modo) ? [{ id: x.id, assunto: x.assunto, exemplo: x.exemplo ?? '', modo: x.modo }] : [])),
        orientacoes: await this.orientacoesAtivas(a.id),
      };
    },

    /** D14: null = banco sem a I3b. */
    async arquivosVencidosDasTarefas(limite: number): Promise<{ id: string; caminho: string }[] | null> {
      const r = await db.rpc('arquivos_vencidos_das_tarefas', { p_limite: limite });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      return (checar(r, 'arquivosVencidosDasTarefas') ?? []).map((x: { id: string; caminho: string }) => ({ id: x.id, caminho: x.caminho }));
    },

    async marcarArquivosRemovidos(ids: string[]): Promise<number> {
      if (ids.length === 0) return 0;
      return Number(checar(await db.rpc('marcar_arquivos_removidos', { p_ids: ids }), 'marcarArquivosRemovidos') ?? 0);
    },

    async iniciarConducao(conversaId: string, agenteId: string): Promise<boolean> {
      return checar(await db.rpc('iniciar_conducao', { p_conversa: conversaId, p_agente: agenteId }), 'iniciarConducao') === true;
    },

    async encerrarConducao(conversaId: string, motivo: string): Promise<boolean> {
      return checar(await db.rpc('encerrar_conducao', { p_conversa: conversaId, p_motivo: motivo }), 'encerrarConducao') === true;
    },

    /** Demanda pelo número, só da empresa e do setor pedidos (o agente nunca vê demanda de outro setor ou empresa). */
    async demandaDoSetor(clienteId: string, setorId: string, numero: number): Promise<DemandaDoSetor | null> {
      const c = checar(await db.from('chamados').select('id, numero, titulo, status, pedido_venda').eq('cliente_id', clienteId)
        .eq('setor_id', setorId).eq('numero', numero).maybeSingle(), 'demandaDoSetor');
      return c ? { id: c.id, numero: Number(c.numero), titulo: c.titulo, status: c.status, temPedido: c.pedido_venda !== null } : null;
    },

    /** Pedido de venda da demanda, comprador do cadastro e preços que mudaram nos 30 dias antes de `agora` (D9). */
    async dadosParaPreAnalise(chamadoId: string, agora: Date): Promise<DadosPreAnalise | null> {
      const c = checar(await db.from('chamados').select('numero, cliente_id, pedido_venda').eq('id', chamadoId).maybeSingle(), 'dadosParaPreAnalise');
      if (!c) return null;
      const pedido = (c.pedido_venda ?? null) as PedidoVendaSalvo | null;
      const base: DadosPreAnalise = { numero: Number(c.numero), clienteId: c.cliente_id, pedido, comprador: null, mudancas: [] };
      if (!pedido?.unidade_id || !c.cliente_id) return base;
      const u = checar(await db.from('parceiros_unidades').select(COLUNAS_COMPRADOR).eq('id', pedido.unidade_id).eq('cliente_id', c.cliente_id)
        .maybeSingle(), 'dadosParaPreAnalise.comprador');
      if (!u) return base;
      const { grupo_id: grupoId, ...comprador } = u;
      const desde = new Date(agora.getTime() - 30 * 24 * 3600_000).toISOString();
      const atuais = checar(await db.from('precos').select('produto_id, valor, vigente_desde, produtos(codigo)').eq('cliente_id', c.cliente_id)
        .eq('grupo_id', grupoId).is('vigente_ate', null).gte('vigente_desde', desde), 'dadosParaPreAnalise.precos');
      const mudancas: MudancaPreco[] = [];
      for (const p of atuais) {
        const antes = checar(await db.from('precos').select('valor').eq('grupo_id', grupoId).eq('produto_id', p.produto_id)
          .not('vigente_ate', 'is', null).order('vigente_ate', { ascending: false }).limit(1).maybeSingle(), 'dadosParaPreAnalise.anterior');
        if (antes && p.produtos?.codigo) mudancas.push({ sku: p.produtos.codigo, anterior: Number(antes.valor), desde: p.vigente_desde });
      }
      return { ...base, comprador: comprador as CompradorCadastrado, mudancas };
    },

    async salvarPreAnalise(chamadoId: string, agenteId: string, resultado: PreAnaliseNota): Promise<void> {
      checar(await db.rpc('salvar_pre_analise', { p_chamado: chamadoId, p_agente: agenteId, p_resultado: resultado as unknown as Json }), 'salvarPreAnalise');
    },

    async preAnaliseDaDemanda(chamadoId: string): Promise<PreAnaliseNota | null> {
      const r = await db.from('pre_analises_nota').select('resultado').eq('chamado_id', chamadoId).maybeSingle();
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      const l = checar(r, 'preAnaliseDaDemanda');
      return l && ehPreAnaliseNota(l.resultado) ? l.resultado : null;
    },

    /** Sugestão do agente que uma pessoa do setor aprova na demanda (D8, D19). As recusas do banco chegam como erro com a frase. */
    async criarSugestao(s: NovaSugestao): Promise<string> {
      return checar(await db.rpc('criar_sugestao_agente', { p_chamado: s.chamadoId, p_agente: s.agenteId, p_conversa: s.conversaId as string,
        p_tipo: s.tipo, p_conteudo: s.conteudo as Json }), 'criarSugestao') as string;
    },

    /** Ids cortados no último registro `orientacoes_cortadas` da conversa (null se nunca houve corte). */
    async ultimasOrientacoesCortadas(conversaId: string): Promise<string[] | null> {
      const l = checar(await db.from('decisoes_agente').select('saida').eq('conversa_id', conversaId).eq('etapa', 'orientacoes_cortadas')
        .order('criado_em', { ascending: false }).limit(1).maybeSingle(), 'ultimasOrientacoesCortadas');
      const cortadas = (l?.saida as { cortadas?: unknown } | null)?.cortadas;
      return Array.isArray(cortadas) ? cortadas.filter((x): x is string => typeof x === 'string') : null;
    },

    // ---------- Parte I3a: tarefas de trabalho (só o trabalhador; as funções do banco conferem o estado) ----------
    /** D6/F6: a marca desta vez (executando_desde, ISO) quando pegou a tarefa; null = não está trabalhando, outra vez está rodando, ou banco sem a I3 (D22).
     *  Quem pega a vez devolve a marca em finalizarVezTarefa (p_desde): vez zumbi não apaga a marca da nova. */
    async iniciarExecucaoTarefa(id: string): Promise<string | null> {
      const r = await db.rpc('iniciar_execucao_tarefa', { p_id: id });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      return (checar(r, 'iniciarExecucaoTarefa') as string | null) ?? null;
    },

    async tarefaParaTrabalho(id: string): Promise<TarefaParaTrabalho | null> {
      const t = checar(await db.from('agente_tarefas').select(`id, numero, agente_id, chamado_id, cliente_id, setor_id, pedida_por, criado_em, pedido,
        skill_nome, estado, etapas, etapa_atual, anotacoes, resultado, ajustes, ajuste_pendente, custo_usd, segundos_trabalhando, limite_usd, limite_minutos,
        agentes(slug, nome, estado, tipos), chamados(numero, titulo), clientes(razao_social, nome_fantasia), setores(nome),
        pedidor:usuarios!agente_tarefas_pedida_por_fkey(nome)`).eq('id', id).maybeSingle(), 'tarefaParaTrabalho');
      if (!t) return null;
      const [pend, arq] = await Promise.all([
        db.from('agente_pendencias').select('id, numero, tipo, pergunta, detalhe, opcoes, mensagem, estado, resposta, vista_em, pedido_em')
          .eq('tarefa_id', id).order('numero'),
        db.from('agente_tarefa_arquivos').select('id, nome, mime, tamanho, bucket, caminho, lido_em, detalhe').eq('tarefa_id', id).order('criado_em'),
      ]);
      const l = t as unknown as {
        id: string; numero: number; agente_id: string; chamado_id: string; cliente_id: string | null; setor_id: string | null; pedida_por: string | null;
        criado_em: string; pedido: string; skill_nome: string | null; estado: EstadoTarefa; etapas: EtapaTarefa[]; etapa_atual: number; anotacoes: string;
        resultado: unknown; ajustes: { texto: string; por: string | null; em: string }[]; ajuste_pendente: boolean; custo_usd: number;
        segundos_trabalhando: number; limite_usd: number; limite_minutos: number;
        agentes: { slug: string; nome: string; estado: 'desligado' | 'teste' | 'ligado'; tipos: string[] };
        chamados: { numero: number; titulo: string }; clientes: { razao_social: string; nome_fantasia: string | null } | null;
        setores: { nome: string } | null; pedidor: { nome: string } | null;
      };
      return {
        id: l.id, numero: Number(l.numero), agenteId: l.agente_id, agenteSlug: l.agentes.slug, agenteNome: l.agentes.nome, agenteEstado: l.agentes.estado,
        agenteTipos: l.agentes.tipos, setorId: l.setor_id, setor: l.setores?.nome ?? null, chamadoId: l.chamado_id, chamadoNumero: Number(l.chamados.numero),
        chamadoTitulo: l.chamados.titulo, clienteId: l.cliente_id, empresa: l.clientes ? l.clientes.nome_fantasia ?? l.clientes.razao_social : null,
        pedidaPor: l.pedida_por, pedidaPorNome: l.pedidor?.nome ?? null, criadoEm: l.criado_em, pedido: l.pedido, skillNome: l.skill_nome,
        estado: l.estado, etapas: l.etapas ?? [], etapaAtual: l.etapa_atual, anotacoes: l.anotacoes, resultado: ehResultadoTarefa(l.resultado) ? l.resultado : null,
        ajustes: l.ajustes ?? [], ajustePendente: l.ajuste_pendente, custoUsd: Number(l.custo_usd), segundosTrabalhando: l.segundos_trabalhando,
        limiteUsd: Number(l.limite_usd), limiteMinutos: l.limite_minutos,
        pendencias: checar(pend, 'tarefaParaTrabalho.pendencias').map((p) => ({
          id: p.id, numero: p.numero, tipo: p.tipo as TipoPendencia, pergunta: p.pergunta, detalhe: p.detalhe, opcoes: p.opcoes ?? [], mensagem: p.mensagem,
          estado: p.estado as 'aberta' | 'respondida', resposta: p.resposta, vista: p.vista_em !== null, pedidaAoCliente: p.pedido_em !== null,
        })),
        arquivos: checar(arq, 'tarefaParaTrabalho.arquivos').map((a) => ({
          id: a.id, nome: a.nome, mime: a.mime, tamanho: a.tamanho, bucket: a.bucket as 'tarefas' | 'anexos', caminho: a.caminho, lido: a.lido_em !== null, detalhe: a.detalhe,
        })),
      };
    },

    async situacaoTarefa(id: string): Promise<SituacaoTarefa | null> {
      const s = checar(await db.from('agente_tarefas').select('estado, custo_usd, segundos_trabalhando, limite_usd, limite_minutos').eq('id', id).maybeSingle(),
        'situacaoTarefa');
      return s ? { estado: s.estado as EstadoTarefa, custoUsd: Number(s.custo_usd), segundosTrabalhando: s.segundos_trabalhando,
        limiteUsd: Number(s.limite_usd), limiteMinutos: s.limite_minutos } : null;
    },
    async definirEtapasTarefa(id: string, nomes: string[]): Promise<void> {
      checar(await db.rpc('definir_etapas_tarefa', { p_id: id, p_nomes: nomes }), 'definirEtapasTarefa');
    },
    async concluirEtapaTarefa(id: string, etapa: number, resumo: string): Promise<void> {
      checar(await db.rpc('concluir_etapa_tarefa', { p_id: id, p_etapa: etapa, p_resumo: resumo }), 'concluirEtapaTarefa');
    },
    async anotarTarefa(id: string, texto: string): Promise<void> {
      checar(await db.rpc('anotar_tarefa', { p_id: id, p_texto: texto }), 'anotarTarefa');
    },
    async somarCustoTarefa(id: string, custoUsd: number): Promise<void> {
      checar(await db.rpc('somar_custo_tarefa', { p_id: id, p_custo: custoUsd }), 'somarCustoTarefa');
    },
    async abrirPendenciaTarefa(p: NovaPendencia): Promise<number> {
      return checar(await db.rpc('abrir_pendencia_tarefa', { p_tarefa: p.tarefaId, p_tipo: p.tipo, p_pergunta: p.pergunta,
        p_detalhe: p.detalhe as string, p_opcoes: p.opcoes, p_mensagem: p.mensagem as string }), 'abrirPendenciaTarefa') as number;
    },
    async entregarResultadoTarefa(id: string, r: ResultadoTarefa): Promise<void> {
      checar(await db.rpc('entregar_resultado_tarefa', { p_id: id, p_resultado: r as unknown as Json }), 'entregarResultadoTarefa');
    },
    async marcarArquivoLido(arquivoId: string, detalhe: string | null): Promise<void> {
      checar(await db.rpc('marcar_arquivo_lido', { p_arquivo: arquivoId, p_detalhe: detalhe as string }), 'marcarArquivoLido');
    },
    async marcarPendenciasVistas(tarefaId: string): Promise<void> {
      checar(await db.rpc('marcar_pendencias_vistas', { p_tarefa: tarefaId }), 'marcarPendenciasVistas');
    },
    async eventoTarefa(tarefaId: string, texto: string): Promise<void> {
      checar(await db.rpc('evento_tarefa_agente', { p_tarefa: tarefaId, p_texto: texto }), 'eventoTarefa');
    },
    /** desde: a marca devolvida por iniciarExecucaoTarefa (F6). Se a marca da tarefa já é outra, o banco só soma os segundos e devolve o estado. */
    async finalizarVezTarefa(id: string, segundos: number, motivo: MotivoFimVez, desde: string | null = null): Promise<EstadoTarefa> {
      return checar(await db.rpc('finalizar_vez_tarefa', { p_id: id, p_segundos: Math.max(0, Math.round(segundos)), p_motivo: motivo,
        ...(desde ? { p_desde: desde } : {}) }),
        'finalizarVezTarefa') as EstadoTarefa;
    },
    /** D8: batimento. Banco sem a I3 → nenhuma (o batimento roda a cada minuto e não pode falhar por isso, D22). */
    async tarefasParadas(minutos: number): Promise<string[]> {
      const r = await db.rpc('tarefas_paradas', { p_minutos: minutos });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return [];
      return (checar(r, 'tarefasParadas') ?? []) as string[];
    },
    /** F5: batimento. Solta reservas velhas (10 min) e devolve os pedidos ao cliente que nunca saíram (2 min a 24 h). Banco sem a I3 → nenhum. */
    async pedidosAoClienteParados(minutos: number): Promise<string[]> {
      const r = await db.rpc('pedidos_ao_cliente_parados', { p_minutos: minutos });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return [];
      return (checar(r, 'pedidosAoClienteParados') ?? []) as string[];
    },
    async reservarEnvioPendencia(id: string): Promise<PendenciaParaEnvio | null> {
      const [p] = checar(await db.rpc('reservar_envio_pendencia', { p_id: id }), 'reservarEnvioPendencia') ?? [];
      return p ? { id: p.id, tarefaId: p.tarefa_id, numero: p.numero, clienteId: p.cliente_id, contatoId: p.contato_id, contatoNome: p.contato_nome,
        telefone: p.telefone, texto: p.texto } : null;
    },
    async liberarEnvioPendencia(id: string): Promise<void> {
      checar(await db.rpc('liberar_envio_pendencia', { p_id: id }), 'liberarEnvioPendencia');
    },
    async marcarPendenciaEnviada(id: string, mensagemId: string): Promise<void> {
      checar(await db.rpc('marcar_pendencia_enviada', { p_id: id, p_mensagem: mensagemId }), 'marcarPendenciaEnviada');
    },
    /** D26: null = banco sem a I3 (o Thiago segue como na I2). */
    async pendenciasPedidasAoContato(contatoId: string): Promise<PedidoAoContato[] | null> {
      const r = await db.rpc('pendencias_pedidas_ao_contato', { p_contato: contatoId });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      return (checar(r, 'pendenciasPedidasAoContato') ?? []).map((p) => ({ pendenciaId: p.pendencia_id, numero: p.numero, pergunta: p.pergunta,
        setor: p.setor, chamadoNumero: Number(p.chamado_numero), empresa: p.empresa }));
    },
    async contatoRespondeuPendencias(contatoId: string): Promise<number> {
      return checar(await db.rpc('contato_respondeu_pendencias', { p_contato: contatoId }), 'contatoRespondeuPendencias') as number;
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

    // ---------- Parte I4: pedir ao agente, opções da tarefa e avisos ----------
    async agentesParaPedir(usuarioId: string, chamadoId: string | null = null): Promise<AgenteParaPedir[] | null> {
      const r = await db.rpc('agentes_para_pedir_de', { p_usuario: usuarioId, p_chamado: chamadoId ?? undefined });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      return (checar(r, 'agentesParaPedir') ?? []).map((a) => ({
        id: a.id, slug: a.slug, nome: a.nome, descricao: a.descricao ?? '', setorId: a.setor_id, setor: a.setor, estado: a.estado as 'teste' | 'ligado',
        destino: a.destino as 'esta_demanda' | 'nova',
        procedimentos: Array.isArray(a.procedimentos) ? (a.procedimentos as AgenteParaPedir['procedimentos']) : [],
        custo: {
          n: Number(a.custo_n ?? 0), min: a.custo_min === null ? null : Number(a.custo_min), max: a.custo_max === null ? null : Number(a.custo_max),
          limite: Number(a.limite_usd),
        },
      }));
    },

    async pedirAoAgenteDe(p: { usuarioId: string; origem: 'assistente' | 'whatsapp'; agenteId: string; pedido: string; clienteId: string | null;
      chamadoNumero: number | null; prazo: string | null; chave?: string | null }): Promise<PedidoCriado> {
      const r = await db.rpc('pedir_ao_agente_de', { p_usuario: p.usuarioId, p_origem: p.origem, p_agente: p.agenteId, p_pedido: p.pedido,
        p_cliente: p.clienteId ?? undefined, p_chamado_numero: p.chamadoNumero ?? undefined, p_prazo: p.prazo ?? undefined, p_chave: p.chave ?? undefined });
      if (r.error?.code === 'P0001') throw new RecusaDoBanco(r.error.message);
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) throw new SemI4();
      const j = checar(r, 'pedirAoAgenteDe') as { tarefa_id: string; tarefa_numero: number; chamado_id: string; chamado_numero: number; demanda_nova: boolean;
        ja_criada?: boolean };
      return { tarefaId: j.tarefa_id, tarefaNumero: Number(j.tarefa_numero), chamadoId: j.chamado_id, chamadoNumero: Number(j.chamado_numero),
        demandaNova: j.demanda_nova === true, jaCriada: j.ja_criada === true };
    },

    async pendenciasRepassadas(usuarioId: string): Promise<PendenciaRepassada[] | null> {
      const r = await db.rpc('pendencias_repassadas_de', { p_usuario: usuarioId });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      return (checar(r, 'pendenciasRepassadas') ?? []).map((x) => ({
        tarefaId: x.tarefa_id, tarefaNumero: Number(x.tarefa_numero), agente: x.agente, empresa: x.empresa ?? null, numero: Number(x.numero),
        pergunta: x.pergunta, detalhe: x.detalhe ?? null, opcoes: x.opcoes ?? [],
      }));
    },

    async responderPendenciaDe(p: { usuarioId: string; tarefaNumero: number; pendencia: number; resposta: string }): Promise<{ tarefaId: string; retomou: boolean }> {
      const r = await db.rpc('responder_pendencia_de', { p_usuario: p.usuarioId, p_tarefa_numero: p.tarefaNumero, p_pendencia: p.pendencia, p_resposta: p.resposta });
      if (r.error?.code === 'P0001') throw new RecusaDoBanco(r.error.message);
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) throw new SemI4();
      const j = checar(r, 'responderPendenciaDe') as { tarefa_id: string; retomou: boolean };
      return { tarefaId: j.tarefa_id, retomou: j.retomou === true };
    },

    async opcoesDoPedido(tarefaId: string): Promise<OpcoesDoPedido | null> {
      const r = await db.from('agente_tarefas').select('prazo_desejado, ler_drive, drive_subpasta, avisar_painel, avisar_whatsapp').eq('id', tarefaId).maybeSingle();
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      const t = checar(r, 'opcoesDoPedido');
      if (!t) return null;
      return {
        prazoDesejado: t.prazo_desejado ? new Date(t.prazo_desejado).toISOString() : null, lerDrive: t.ler_drive, subpasta: t.drive_subpasta,
        avisarPainel: t.avisar_painel, avisarWhatsapp: t.avisar_whatsapp,
      };
    },

    async registrarAvisosDaTarefa(tarefaId: string): Promise<string[] | null> {
      const r = await db.rpc('registrar_avisos_da_tarefa', { p_tarefa: tarefaId });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      return (checar(r, 'registrarAvisosDaTarefa') ?? []).map(String);
    },

    async reservarAvisoTarefa(id: string): Promise<AvisoReservado | null> {
      const j = checar(await db.rpc('reservar_aviso_tarefa', { p_id: id }), 'reservarAvisoTarefa') as null | {
        id: string; tarefa_id: string; tipo: AvisoReservado['tipo']; pendencias: number[] | null; usuario_id: string; nome: string; telefone: string;
        responsavel: string | null; pede_no_setor: boolean; motivo_pausa: MotivoPausa | null;
      };
      if (!j) return null;
      return {
        id: j.id, tarefaId: j.tarefa_id, tipo: j.tipo, pendencias: (j.pendencias ?? []).map(Number), usuarioId: j.usuario_id, nome: j.nome,
        telefone: j.telefone, responsavel: j.responsavel, pedeNoSetor: j.pede_no_setor === true, motivoPausa: j.motivo_pausa ?? null,
      };
    },

    async marcarAvisoTarefa(id: string, ok: boolean): Promise<void> {
      checar(await db.rpc('marcar_aviso_tarefa', { p_id: id, p_ok: ok }), 'marcarAvisoTarefa');
    },

    async avisosTarefaParados(): Promise<string[]> {
      const r = await db.rpc('avisos_tarefa_parados');
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return [];
      return (checar(r, 'avisosTarefaParados') ?? []).map(String);
    },
  };
}

export type Repos = ReturnType<typeof criarRepos>;
