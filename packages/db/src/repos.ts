import { variantesTelefone, type ConfigExpediente, type PrecoModelo } from '@escritorio/core';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import type { Db } from './cliente';
import type { Database } from './tipos.gen';

type Linha<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Conversa = Linha<'conversas'>;
export type Mensagem = Linha<'mensagens'>;
export type Chamado = Linha<'chamados'>;
type TipoMensagem = Database['public']['Enums']['tipo_mensagem'];

export type EmpresaDoContato = { id: string; nome: string; podePedirNota: boolean; agentePausado: boolean };
export type ContatoEncontrado = { id: string; nome: string; empresas: EmpresaDoContato[] };
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
  mensagens: Record<string, string>;
};
export type NovaMensagemEntrada = {
  conversaId: string; clienteId: string | null; idProvedor: string; tipo: TipoMensagem;
  conteudo?: string | null; midiaUrlOrigem?: string | null; arquivoNome?: string | null; arquivoMime?: string | null;
};
export type NovoChamado = {
  clienteId: string | null; conversaId: string | null; setorId: string | null; responsavelId: string | null;
  titulo: string; resumo: string; foraDoContrato: boolean; origem: string;
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

export function criarRepos(db: Db) {
  return {
    async buscarContato(telefone: string): Promise<ContatoEncontrado | null> {
      const r = await db.from('contatos')
        .select('id, nome, contato_clientes(pode_pedir_nota, clientes(id, razao_social, nome_fantasia, ativo, agente_pausado))')
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
      return { id: c.id, nome: c.nome, empresas };
    },

    async ehTelefoneInterno(telefone: string): Promise<boolean> {
      const variantes = variantesTelefone(telefone);
      const u = checar(await db.from('usuarios').select('id').in('telefone', variantes).limit(1), 'ehTelefoneInterno');
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
      return checar(await db.from('conversas').insert({ telefone, contato_id: contatoId }).select().single(), 'conversa');
    },

    async obterConversa(id: string): Promise<Conversa> {
      return checar(await db.from('conversas').select('*').eq('id', id).single(), 'obterConversa');
    },

    async atualizarConversa(id: string, patch: Partial<Conversa>): Promise<void> {
      checar(await db.from('conversas').update({ ...patch, atualizado_em: new Date().toISOString() }).eq('id', id), 'atualizarConversa');
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

    async criarSaidaPendente(m: { conversaId: string; clienteId: string | null; autor: 'agente' | 'sistema'; conteudo: string }): Promise<string> {
      const r = await db.from('mensagens').insert({ conversa_id: m.conversaId, cliente_id: m.clienteId, direcao: 'saida',
        autor: m.autor, tipo: 'texto', conteudo: m.conteudo, status_envio: 'pendente' }).select('id').single();
      return checar(r, 'criarSaidaPendente').id;
    },

    async inserirSaidaExterna(m: { conversaId: string; clienteId: string | null; idProvedor: string; conteudo: string | null }): Promise<string> {
      const r = await db.from('mensagens').insert({ conversa_id: m.conversaId, cliente_id: m.clienteId, direcao: 'saida',
        autor: 'atendente', tipo: 'texto', conteudo: m.conteudo, id_provedor: m.idProvedor, status_envio: 'enviada' }).select('id').single();
      return checar(r, 'inserirSaidaExterna').id;
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
        titulo: c.titulo, resumo: c.resumo, fora_do_contrato: c.foraDoContrato, origem: c.origem,
      }).select('id, numero').single(), 'abrirChamado');
      checar(await db.from('chamado_eventos').insert({ chamado_id: novo.id, cliente_id: c.clienteId, tipo: 'criacao', texto: c.resumo }), 'abrirChamado');
      return { id: novo.id, numero: Number(novo.numero) };
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

    async registrarDecisao(d: { conversaId: string; clienteId: string | null; etapa: string; entrada: unknown; saida: unknown; justificativa?: string }): Promise<void> {
      checar(await db.from('decisoes_agente').insert({ conversa_id: d.conversaId, cliente_id: d.clienteId, etapa: d.etapa,
        entrada: d.entrada as never, saida: d.saida as never, justificativa: d.justificativa ?? null }), 'registrarDecisao');
    },

    async registrarUsoIa(u: { conversaId: string | null; modelo: string; tokensEntrada: number; tokensSaida: number;
      tokensCacheLeitura: number; tokensCacheEscrita: number; custoUsd: number }): Promise<void> {
      checar(await db.from('uso_ia').insert({ conversa_id: u.conversaId, modelo: u.modelo, tokens_entrada: u.tokensEntrada,
        tokens_saida: u.tokensSaida, tokens_cache_leitura: u.tokensCacheLeitura, tokens_cache_escrita: u.tokensCacheEscrita,
        custo_usd: u.custoUsd }), 'registrarUsoIa');
    },

    async custoIaDoMes(mes: string): Promise<number> {
      const linhas = checar(await db.from('uso_ia').select('custo_usd').gte('criado_em', inicioDoMes(mes))
        .lt('criado_em', inicioDoMes(proximoMes(mes))), 'custoIaDoMes');
      return linhas.reduce((s, l) => s + Number(l.custo_usd), 0);
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
      const linhas = checar(await db.from('cliente_responsaveis').select('setor_id, usuario_id').eq('cliente_id', clienteId), 'responsaveisDoCliente');
      return linhas.map((l) => ({ setorId: l.setor_id, usuarioId: l.usuario_id }));
    },

    async servicosDoCliente(clienteId: string): Promise<string[]> {
      const linhas = checar(await db.from('cliente_servicos').select('servicos(nome)').eq('cliente_id', clienteId), 'servicosDoCliente');
      return linhas.map((l) => l.servicos?.nome).filter((n): n is string => Boolean(n));
    },

    async registrarAlerta(a: { nivel: 'critico' | 'operacional' | 'aviso'; mensagem: string; setorId?: string | null }): Promise<void> {
      checar(await db.from('alertas').insert({ nivel: a.nivel, mensagem: a.mensagem, setor_id: a.setorId ?? null }), 'registrarAlerta');
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

    async contarDecisoesDesde(conversaId: string, desdeIso: string): Promise<number> {
      const r = await db.from('decisoes_agente').select('id', { count: 'exact', head: true })
        .eq('conversa_id', conversaId).gte('criado_em', desdeIso);
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
