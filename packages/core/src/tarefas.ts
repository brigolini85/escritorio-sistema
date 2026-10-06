/** Parte I3a (spec 7E.4): tarefas de trabalho dos agentes — regras puras do painel e do trabalhador. */

const semAcento = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '');

export const ESTADOS_TAREFA = ['trabalhando', 'aguardando_pendencias', 'pausada', 'pronta', 'aprovada', 'descartada'] as const;
export type EstadoTarefa = (typeof ESTADOS_TAREFA)[number];
export const ROTULO_ESTADO_TAREFA: Record<EstadoTarefa, string> = {
  trabalhando: 'Trabalhando', aguardando_pendencias: 'Aguardando pendências', pausada: 'Pausada',
  pronta: 'Pronto para aprovar', aprovada: 'Aprovada', descartada: 'Descartada',
};
/** Ainda pode mudar: o banco aceita uma por demanda (D3). */
export const ESTADOS_TAREFA_ATIVA: readonly EstadoTarefa[] = ['trabalhando', 'aguardando_pendencias', 'pausada', 'pronta'];
export const tarefaAtiva = (e: EstadoTarefa): boolean => ESTADOS_TAREFA_ATIVA.includes(e);

export const MOTIVOS_PAUSA = ['pessoa', 'limite_custo', 'limite_tempo', 'teto', 'agente_desligado', 'falha', 'sem_resultado'] as const;
export type MotivoPausa = (typeof MOTIVOS_PAUSA)[number];
export const TEXTO_MOTIVO_PAUSA: Record<MotivoPausa, string> = {
  pessoa: 'Pausada por uma pessoa do setor.',
  limite_custo: 'Pausada: chegou ao limite de custo desta tarefa.',
  limite_tempo: 'Pausada: chegou ao limite de tempo desta tarefa.',
  teto: 'Pausada: o teto mensal de gasto com IA foi atingido.',
  agente_desligado: 'Pausada: o agente foi desligado.',
  falha: 'Pausada: o agente não conseguiu seguir.',
  sem_resultado: 'Pausada: o agente parou sem resultado nem pendência.',
};
/** Como uma vez do trabalhador termina (D6, D13): o banco decide o estado seguinte (finalizar_vez_tarefa). */
export const MOTIVOS_FIM_VEZ = ['fim', 'continuar', 'limite_custo', 'limite_tempo', 'teto', 'agente_desligado', 'falha', 'sem_resultado'] as const;
export type MotivoFimVez = (typeof MOTIVOS_FIM_VEZ)[number];

export const TIPOS_PENDENCIA = ['cliente', 'analista'] as const;
export type TipoPendencia = (typeof TIPOS_PENDENCIA)[number];
export const ROTULO_TIPO_PENDENCIA: Record<TipoPendencia, string> = { cliente: 'Do cliente', analista: 'Para o analista' };

/** Os mesmos números das regras do banco (20261016000100–300). */
export const LIMITES_TAREFA = {
  pedido: 2000, anotacoes: 8000, pendenciasAbertas: 20, opcoes: 4, opcao: 60, pergunta: 300, detalhe: 1000, mensagem: 1000,
  resposta: 2000, ajuste: 1000, resumo: 2000, destaques: 6, linhas: 500, descricaoLinha: 300, arquivos: 30,
  arquivoBytes: 10 * 1024 * 1024, blocoBytes: 4 * 1024 * 1024, parteTexto: 40_000, etapas: 8, nomeEtapa: 60, rodadasPorVez: 30,
} as const;

export type EtapaTarefa = { nome: string; concluida: boolean; resumo: string | null };
export const ETAPA_APROVACAO = 'Aprovação';
export const ETAPAS_PADRAO = ['Ler os documentos', 'Fazer o trabalho', 'Revisar pendências'] as const;

/** D5: a seção "## Etapas" do Procedimento (lista numerada ou com marcadores); "Aprovação" é sempre a última e é da pessoa. */
export function etapasDoProcedimento(corpo: string | null | undefined): string[] {
  const linhas = (corpo ?? '').replace(/\r\n?/g, '\n').split('\n');
  const inicio = linhas.findIndex((l) => /^#{2,3}\s*etapas\b/i.test(semAcento(l.trim())));
  const achadas: string[] = [];
  if (inicio >= 0) {
    for (const l of linhas.slice(inicio + 1)) {
      if (/^#{1,6}\s/.test(l.trim())) break;
      // Só item de primeiro nível (até 1 espaço): sub-itens e continuações são detalhe da etapa; a seção acaba no próximo título.
      const m = /^ {0,1}(?:\d+[.)]|[-*])\s+(.+)$/.exec(l);
      if (!m) continue;
      // "**Coletar documentos** — extratos…" e "Ler e lançar: partidas…" viram só o nome da etapa.
      const nome = m[1]!.replace(/\*\*|__|`/g, '').split(/\s[—–-]\s|:\s/)[0]!.trim().slice(0, LIMITES_TAREFA.nomeEtapa);
      if (nome && semAcento(nome).toLowerCase() !== 'aprovacao') achadas.push(nome);
      if (achadas.length === LIMITES_TAREFA.etapas) break;
    }
  }
  return [...(achadas.length ? achadas : ETAPAS_PADRAO), ETAPA_APROVACAO];
}

export type LeituraArquivoTarefa = 'pdf' | 'imagem' | 'texto';
const POR_EXTENSAO: Record<string, { leitura: LeituraArquivoTarefa; mime: string }> = {
  pdf: { leitura: 'pdf', mime: 'application/pdf' },
  jpg: { leitura: 'imagem', mime: 'image/jpeg' }, jpeg: { leitura: 'imagem', mime: 'image/jpeg' }, png: { leitura: 'imagem', mime: 'image/png' },
  xml: { leitura: 'texto', mime: 'application/xml' }, csv: { leitura: 'texto', mime: 'text/csv' },
  txt: { leitura: 'texto', mime: 'text/plain' }, ofx: { leitura: 'texto', mime: 'text/plain' },
};
/** D14: o que a tarefa aceita (a tela, o banco e o trabalhador usam a mesma lista). */
export const EXTENSOES_TAREFA = Object.keys(POR_EXTENSAO);
const extensao = (nome: string) => /\.([a-z0-9]{1,5})$/i.exec(nome.trim())?.[1]?.toLowerCase() ?? '';
/** Pela extensão: o tipo que o navegador manda varia (.ofx chega como application/octet-stream). */
export function leituraDoArquivo(nome: string): LeituraArquivoTarefa | null {
  return POR_EXTENSAO[extensao(nome)]?.leitura ?? null;
}
export function mimeDoArquivo(nome: string): string {
  return POR_EXTENSAO[extensao(nome)]?.mime ?? 'application/octet-stream';
}

export type DestaqueResultado = { rotulo: string; valor: string; detalhe: string | null };
export type LinhaResultado = { descricao: string; valor: number | null; texto: string | null; fonte: string; provisoria: boolean };
/** D10: o rascunho que a pessoa aprova. As linhas são a base do CSV (I3a) e da planilha do Domínio (I3b). */
export type ResultadoTarefa = { versao: 1; resumo: string; destaques: DestaqueResultado[]; linhas: LinhaResultado[]; observacoes: string | null };

const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehTextoOuNulo = (v: unknown) => v === null || typeof v === 'string';
/** O que vem do banco (jsonb) só é mostrado com o formato da versão 1. */
export function ehResultadoTarefa(x: unknown): x is ResultadoTarefa {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.versao !== 1 || !ehTexto(o.resumo) || !Array.isArray(o.destaques) || !Array.isArray(o.linhas) || !ehTextoOuNulo(o.observacoes)) return false;
  const destaquesOk = o.destaques.every((d) => !!d && typeof d === 'object'
    && ehTexto((d as DestaqueResultado).rotulo) && ehTexto((d as DestaqueResultado).valor) && ehTextoOuNulo((d as DestaqueResultado).detalhe));
  const linhasOk = o.linhas.every((l) => {
    if (!l || typeof l !== 'object') return false;
    const r = l as LinhaResultado;
    return ehTexto(r.descricao) && (r.valor === null || (typeof r.valor === 'number' && Number.isFinite(r.valor))) && ehTextoOuNulo(r.texto)
      && ehTexto(r.fonte) && typeof r.provisoria === 'boolean';
  });
  return destaquesOk && linhasOk;
}

/** "pendência 3", "Pendencia nº 12" → o número; o resto, null. */
export function numeroDaPendencia(fonte: string): number | null {
  const m = /^pend[eê]ncia\s*(?:n[ºo°.]?\s*)?(\d{1,3})$/i.exec(fonte.trim());
  return m ? Number(m[1]) : null;
}

// Nome de arquivo do macOS vem em NFD e o texto do modelo em NFC: normaliza antes de comparar.
const chaveDeArquivo = (n: string) => n.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
export type FontesDaTarefa = { arquivosLidos: readonly string[]; pendenciasRespondidas: readonly number[]; pendenciasAbertas: readonly number[] };
/** D9 ("nunca inventa valores"): cada linha cita um arquivo lido nesta tarefa ou uma pendência respondida (aberta, só se provisória). */
export function conferirFontes(r: ResultadoTarefa, f: FontesDaTarefa): string[] {
  const lidos = new Set(f.arquivosLidos.map(chaveDeArquivo));
  const problemas: string[] = [];
  r.linhas.forEach((l, i) => {
    const onde = `Linha ${i + 1} (${l.descricao.trim().slice(0, 60)})`;
    if (l.valor === null && !l.texto?.trim()) {
      problemas.push(`${onde}: sem valor nem texto.`);
      return;
    }
    const fonte = l.fonte.trim();
    if (!fonte) {
      problemas.push(`${onde}: sem fonte.`);
      return;
    }
    const n = numeroDaPendencia(fonte);
    if (n !== null) {
      if (f.pendenciasRespondidas.includes(n)) return;
      if (f.pendenciasAbertas.includes(n)) {
        if (!l.provisoria) problemas.push(`${onde}: a pendência ${n} ainda está aberta; marque a linha como provisória.`);
        return;
      }
      problemas.push(`${onde}: a pendência ${n} não existe nesta tarefa.`);
      return;
    }
    if (!lidos.has(chaveDeArquivo(fonte))) problemas.push(`${onde}: "${fonte}" não é um arquivo lido nesta tarefa.`);
  });
  return problemas;
}

// Célula de texto que começa com =, +, -, @ vira texto no Excel (sem fórmula escondida num arquivo do cliente).
const semFormula = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const celula = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const numeroBr = (v: number) => v.toFixed(2).replace(/^-(0\.00)$/, '$1').replace('.', ',');
/** D10: CSV das linhas para o Excel em português (";", vírgula decimal, BOM para os acentos). */
export function csvDoResultado(r: ResultadoTarefa): string {
  const cabecalho = ['Descrição', 'Valor', 'Texto', 'Fonte', 'Provisória'].join(';');
  const linhas = r.linhas.map((l) => [
    celula(semFormula(l.descricao)), l.valor === null ? '' : numeroBr(l.valor), celula(semFormula(l.texto ?? '')),
    celula(semFormula(l.fonte)), l.provisoria ? 'sim' : 'não',
  ].join(';'));
  return `\uFEFF${[cabecalho, ...linhas].join('\r\n')}\r\n`;
}

/** D11: APROVAR E CONCLUIR só com o rascunho pronto e nenhuma pendência aberta (o banco confere de novo). */
export const podeAprovarTarefa = (estado: EstadoTarefa, pendenciasAbertas: number): boolean => estado === 'pronta' && pendenciasAbertas === 0;

/** I3b (D15b): a Aprovação avisa quando o rascunho ainda tem linha provisória. */
export const contarProvisorias = (r: ResultadoTarefa | null): number => (r ? r.linhas.filter((l) => l.provisoria).length : 0);
