import type { AcessoContato } from '@escritorio/core';

/** Spec 7D.2: a resposta neutra ao pedido fora do acesso. Fixa: o modelo não escolhe as palavras (D13). */
export const TEXTO_FORA_DO_ACESSO = 'Esse assunto eu preciso tratar com o responsável da empresa.';

/** O que o modelo recebe depois da recusa (AVISOS e fora-do-acesso.ts usam esta; uma fonte só). */
export const INSTRUCAO_FORA_DO_ACESSO =
  'A resposta sobre este assunto já foi enviada ao cliente. Não fale mais dele: não diga se existe documento, valor, demanda ou setor ligado a ele e não fale em permissão, acesso ou cadastro. Se a mensagem tiver outro assunto, trate só o outro; senão, não responda mais nada.';

/** Assunto sensível precisa chegar à equipe; abrir demanda não revela nada (D10). A Triagem (setor nulo) também. */
export const SETORES_SEMPRE_ABERTOS: readonly string[] = ['Direção'];

export const ACESSO_BASICO: AcessoContato = {
  perfil: 'basico', setores: [], podePedirNota: false, podeAtualizarPreco: false, verValores: false, receberDocumentos: false,
  avisarDocumentoNovo: [], recebeAlertasAcesso: false,
};

/** Treinar o agente testa o jeito de atender, não o acesso: o contato fictício pode tudo (D9). */
export function acessoTotal(setores: readonly { id: string; nome: string }[]): AcessoContato {
  return {
    perfil: 'socio', setores: setores.map((s) => ({ id: s.id, nome: s.nome, podeSerProcurado: true })), podePedirNota: true, podeAtualizarPreco: true,
    verValores: true, receberDocumentos: true, avisarDocumentoNovo: [], recebeAlertasAcesso: false,
  };
}

export const ehBasico = (a: AcessoContato) => a.perfil === 'basico';
export const trataSetor = (a: AcessoContato, setorId: string) => !ehBasico(a) && a.setores.some((s) => s.id === setorId);
/** Nota, preço e cadastros dos parceiros: com "Pode pedir nota" ou com o Fiscal marcado (D10). */
export const podeFluxoNota = (a: AcessoContato, fiscalId: string | null) => a.podePedirNota || (fiscalId !== null && trataSetor(a, fiscalId));

/** Linhas que vão no resumo da demanda, para a equipe saber o que pode responder a este contato (D12, D16). */
export function observacoesDeAcesso(a: AcessoContato): string[] {
  if (ehBasico(a)) return ['Contato com acesso ainda não definido (Básico): confira com o responsável da empresa antes de mandar dados ou documentos.'];
  return a.verValores ? [] : ['Este contato não tem "Ver valores": não informe honorários, boletos nem salários a ele.'];
}

/**
 * Título de demanda para quem não tem "Ver valores": o assunto fica (o setor é dele), o valor em reais que a equipe
 * escreveu no título não (spec 7D.2, "valores só com Ver valores").
 */
export const tituloSemValores = (titulo: string) => titulo
  .replace(/R\$\s*\d[\d.,]*/gi, 'R$ …')
  // Sem "R$" também é valor: "15 mil", "300 reais", "2,5 mil reais" e "12.345,67" (revisão da Task 5).
  .replace(/\b\d+(?:[.,]\d+)*\s*(?:mil(?:\s+reais)?|reais)\b/gi, '…')
  .replace(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g, '…');
