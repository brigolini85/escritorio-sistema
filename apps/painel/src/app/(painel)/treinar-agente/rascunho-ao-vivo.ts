/** Editor e simulador do Treinar o agente (D11): o formulário tem este id e avisa por este evento a cada mudança. */
export const ID_FORM_ORIENTACAO = 'form-orientacao';
export const EVENTO_RASCUNHO = 'treinar:rascunho';

/** O simulador relê o formulário (empresa do teste e selo "usando o rascunho"). */
export function avisarRascunho(): void {
  window.dispatchEvent(new Event(EVENTO_RASCUNHO));
}
