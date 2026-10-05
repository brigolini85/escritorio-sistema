import {
  marcasDoPerfil, perfilDasMarcas, previaDoAgente, type CanalAviso, type MarcasAcesso, type Perfil, type Previa, type SetorDisponivel,
} from '@escritorio/core';

/** Nome da prévia (D26): o primeiro nome; quando o contato foi cadastrado com o número como nome, o número inteiro. */
export function nomeDaPrevia(nome: string): string {
  const limpo = nome.trim().replace(/\s+/g, ' ');
  const primeiro = limpo.split(' ')[0] ?? limpo;
  return /\p{L}/u.test(primeiro) ? primeiro : limpo;
}

/** Estado do bloco de acesso (D3): só as marcações; o perfil mostrado é sempre o que elas dão. */
export type EstadoBloco = { marcas: MarcasAcesso };
type Chave = 'podePedirNota' | 'podeAtualizarPreco' | 'verValores' | 'receberDocumentos' | 'recebeAlertasAcesso';
export type AcaoBloco =
  | { tipo: 'perfil'; perfil: Perfil }
  | { tipo: 'setor'; setorId: string; marcado: boolean }
  | { tipo: 'procurado'; setorId: string; marcado: boolean }
  | { tipo: 'chave'; campo: Chave; valor: boolean }
  | { tipo: 'avisar'; ligado: boolean }
  | { tipo: 'canal'; canal: CanalAviso; marcado: boolean }
  | { tipo: 'voltar'; marcas: MarcasAcesso };

export function reduzirBloco(e: EstadoBloco, a: AcaoBloco, disponiveis: readonly SetorDisponivel[]): EstadoBloco {
  const m = e.marcas;
  switch (a.tipo) {
    case 'perfil':
      return a.perfil === 'personalizado' ? e : { marcas: marcasDoPerfil(a.perfil, disponiveis) };
    case 'setor': {
      const sem = m.setores.filter((s) => s.setorId !== a.setorId);
      // Desmarcar apaga o "procurado" do setor (D30); marcar de novo começa sem ele.
      return { marcas: { ...m, setores: a.marcado ? [...sem, { setorId: a.setorId, podeSerProcurado: false }] : sem } };
    }
    case 'procurado':
      return { marcas: { ...m, setores: m.setores.map((s) => (s.setorId === a.setorId ? { ...s, podeSerProcurado: a.marcado } : s)) } };
    case 'chave':
      return { marcas: { ...m, [a.campo]: a.valor } };
    case 'avisar':
      return { marcas: { ...m, avisarDocumentoNovo: a.ligado ? (m.avisarDocumentoNovo.length ? m.avisarDocumentoNovo : ['whatsapp']) : [] } };
    case 'canal': {
      const outros = m.avisarDocumentoNovo.filter((c) => c !== a.canal);
      return { marcas: { ...m, avisarDocumentoNovo: a.marcado ? [...outros, a.canal].sort((x, y) => (x === 'whatsapp' ? -1 : y === 'whatsapp' ? 1 : 0)) : outros } };
    }
    case 'voltar':
      return { marcas: a.marcas };
  }
}

export const perfilDoBloco = (e: EstadoBloco, disponiveis: readonly SetorDisponivel[]) => perfilDasMarcas(e.marcas, disponiveis);

/**
 * A prévia do core e, para quem recebe documentos sem "Ver valores", o lembrete "(sem valores)": boleto e folha não vão
 * para ele (D11). Sem "Ver valores" o envio de documentos é sempre a última parte da frase do core.
 */
export function previaDoBloco(marcas: MarcasAcesso, disponiveis: readonly SetorDisponivel[], socios: readonly string[]): Previa {
  const previa = previaDoAgente({ marcas, disponiveis, socios });
  if (!marcas.receberDocumentos || marcas.verValores || !/envia (os )?documentos[^.]*\.$/.test(previa.pode)) return previa;
  return { ...previa, pode: previa.pode.replace(/\.$/, ' (sem valores).') };
}
