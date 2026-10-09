import { formatarData, formatarHora } from '../../../lib/formatos';
import { LIMITE_ORIENTACOES, type Medidor, type TipoOrientacao } from '../../../lib/orientacoes';
import { ehUuid, OrientacaoForm } from './esquemas';
import { rascunhoDoFormulario, type RascunhoTeste } from './simulacao';
import { mesmoConteudo, resumoVersao, type Versao } from './versoes';

/** Treinar o agente, Opção B "Editor com simulador" (spec 7C.5): regras puras da tela de três colunas. */

const numero = (n: number) => n.toLocaleString('pt-BR');

/** Faixa de cor de cada tipo na lista (cores da imagem em tokens existentes; a legenda escreve o nome). D16 */
export const FAIXA_TIPO: Record<TipoOrientacao, string> = { jeito: 'bg-warning', regra: 'bg-brand', situacao: 'bg-info' };
export const ROTULO_CURTO_TIPO: Record<TipoOrientacao, string> = { jeito: 'Jeito', regra: 'Regra', situacao: 'Situação' };

/** Criada pelo "Ensinar o agente": o texto nasce "Situação: …\nO que fazer: …" ou "O que fazer: …" (comporTexto). D8 */
export function ehEnsinada(textoDaCriacao: string): boolean {
  const t = textoDaCriacao.replace(/\r\n?/g, '\n');
  return t.startsWith('O que fazer: ') || /^Situação: [\s\S]*\nO que fazer: /.test(t);
}

/** Quantos "(a preencher)" o texto ainda tem (orientações da skill do dono). D17 */
export function camposAPreencher(texto: string): number {
  return texto.match(/\(a preencher\)/gi)?.length ?? 0;
}

export function contarSituacao(linhas: readonly { ativo: boolean }[]) {
  const ligadas = linhas.filter((l) => l.ativo).length;
  return { todas: linhas.length, ligadas, desligadas: linhas.length - ligadas };
}

/** Medidor compacto: "9.940 / 12.000", "83%", a frase para leitor de tela e o aviso de uma linha (a partir de 80%). */
export function textoMedidor(
  m: Pick<Medidor, 'total' | 'nivel'> & { cortadas?: { titulo: string; empresas?: (string | null)[] }[] }, empresa: string | null, limite = LIMITE_ORIENTACOES,
) {
  const conta = empresa ? ` (conta com ${empresa})` : '';
  // Auditoria 5.9: o corte é parcial; o aviso nomeia as que ficam de fora (as mesmas que o trabalhador corta).
  const cortadas = m.cortadas ?? [];
  // Revisão da Task 16: cada corte diz em que conversas acontece (nome da empresa; null = conversa sem empresa).
  const onde = (empresas: (string | null)[] = []) => {
    if (!empresas.length) return '';
    const nomes = empresas.map((e) => e ?? 'sem empresa');
    const juntos = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0]!;
    return ` (${empresas[0] === null ? '' : 'com '}${juntos})`;
  };
  const titulos = cortadas.slice(0, 5).map((c) => `"${c.titulo}"${onde(c.empresas)}`);
  if (cortadas.length > 5) titulos.push(`mais ${cortadas.length - 5}`);
  const lista = titulos.length > 1 ? `${titulos.slice(0, -1).join(', ')} e ${titulos.at(-1)}` : titulos.join('');
  return {
    valor: `${numero(m.total)} / ${numero(limite)}`,
    percentual: `${Math.round((m.total / limite) * 100)}%`,
    descricao: `${numero(m.total)} de ${numero(limite)} caracteres`,
    aviso: m.nivel === 'excesso'
      ? cortadas.length
        ? `Passou do limite${conta}: ${cortadas.length > 1 ? 'ficam' : 'fica'} de fora ${lista}.`
        : `No limite${conta}: a próxima orientação ligada pode ficar de fora.`
      : m.nivel === 'aviso' ? `Perto do limite${conta}` : null,
  };
}

/** "hoje 15:10" ou "29/09 15:10" (Brasília): coluna de quando, no histórico. */
export function quandoHistorico(iso: string, agora: Date = new Date()): string {
  const dia = formatarData(iso);
  if (!dia) return '';
  return dia === formatarData(agora) ? `hoje ${formatarHora(iso)}` : `${dia.slice(0, 5)} ${formatarHora(iso)}`;
}

export type LinhaHistorico = { id: string; quando: string; resumo: string; por: string; atual: boolean; podeRestaurar: boolean };
type Conteudo = Pick<Versao, 'titulo' | 'texto' | 'tipo' | 'clienteId' | 'setorId'>;

/** Linhas do histórico (a mais nova primeiro). Restaurar só onde o conteúdo difere do atual, como hoje. D15 */
export function linhasHistorico(versoes: readonly Versao[], atual: Conteudo, ensinada: boolean, agora: Date = new Date()): LinhaHistorico[] {
  return versoes.map((v, i) => ({
    id: v.id,
    quando: quandoHistorico(v.criadoEm, agora),
    resumo: `${resumoVersao(versoes, i)}${ensinada && v.acao === 'criar' ? ' no Atendimento' : ''}`,
    por: `por ${v.usuario ?? 'pessoa removida'}`,
    atual: i === 0,
    podeRestaurar: !mesmoConteudo(v, atual),
  }));
}

/** Cada linha com a versão do mesmo id (nunca pela posição): Restaurar leva sempre a versão que a linha mostra. */
export function paresHistorico<V extends { id: string }>(linhas: readonly LinhaHistorico[], versoes: readonly V[]): { linha: LinhaHistorico; versao: V }[] {
  const porId = new Map(versoes.map((v) => [v.id, v]));
  return linhas.flatMap((linha) => {
    const versao = porId.get(linha.id);
    return versao ? [{ linha, versao }] : [];
  });
}

/** Linha embaixo do título: "Criada por Ana no Atendimento", "Criada por Ana" ou "Criada no Atendimento". D8 */
export function textoCriacao(criadoPor: string | null, ensinada: boolean): string {
  return `Criada${criadoPor ? ` por ${criadoPor}` : ''}${ensinada ? ' no Atendimento' : ''}`;
}

/** Selo do simulador: o que entra no teste. D10 */
export function rotuloSimulador(e: { aberta: 'nova' | 'salva' | null; alterado: boolean }): string {
  if (e.aberta === null) return 'orientações ligadas, sem rascunho';
  if (e.aberta === 'nova' || e.alterado) return 'usando o rascunho, ligado';
  return 'usando esta orientação, ligada';
}

export type ConteudoSalvo = Conteudo & { ativo: boolean };

/** "Sem o rascunho" só quando o teste usou algo diferente do que o agente já lê (nova, desligada ou alterada). D4 */
export function podeCompararSemRascunho(rascunho: RascunhoTeste | null, salva: ConteudoSalvo | null): boolean {
  if (!rascunho) return false;
  if (!salva || !salva.ativo) return true;
  return !mesmoConteudo(
    { titulo: rascunho.titulo, texto: rascunho.texto, tipo: rascunho.tipo, clienteId: rascunho.cliente_id, setorId: rascunho.setor_id },
    salva,
  );
}

export type EscolhaEmpresa = { manual: false } | { manual: true; id: string | null };

/** Empresa do teste: a do rascunho (se ativa) até a pessoa escolher no simulador. D11 */
export function empresaDoTeste(escolha: EscolhaEmpresa, doRascunho: string | null, ativas: ReadonlySet<string>): string | null {
  const id = escolha.manual ? escolha.id : doRascunho;
  return id && ativas.has(id) ? id : null;
}

/** A empresa do "vale para" do formulário, mesmo com outros campos incompletos. */
export function empresaDoFormulario(dados: FormData): string | null {
  const id = dados.get('cliente_id');
  return dados.get('vale') === 'empresa' && typeof id === 'string' && ehUuid(id) ? id : null;
}

export type CampoRascunho = 'titulo' | 'texto' | 'empresa' | 'setor';
export type LeituraRascunho =
  | { ok: true; rascunho: RascunhoTeste; clienteId: string | null }
  | { ok: false; erro: string; campo: CampoRascunho | null };

const CAMPO_DO_ERRO: [RegExp, CampoRascunho][] = [[/título/i, 'titulo'], [/texto/i, 'texto'], [/empresa/i, 'empresa'], [/setor/i, 'setor']];

/** O formulário do meio, como está, vira o rascunho do teste (sem salvar). Incompleto: o motivo e o campo. D9 */
export function lerRascunho(dados: FormData, id: string | null): LeituraRascunho {
  const d = OrientacaoForm.safeParse(dados);
  if (!d.success) {
    const erro = d.error.issues[0]?.message ?? 'Confira os campos da orientação.';
    return { ok: false, erro, campo: CAMPO_DO_ERRO.find(([r]) => r.test(erro))?.[1] ?? null };
  }
  return { ok: true, rascunho: rascunhoDoFormulario(d.data, id), clienteId: d.data.clienteId };
}
