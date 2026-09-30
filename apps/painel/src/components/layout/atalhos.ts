/** Tecla digitada num campo, num menu ou numa janela aberta não é atalho (vale para J/K, A, N e ?). */
export function ignorarAtalho(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return true;
  const alvo = e.target as HTMLElement | null;
  if (alvo?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="menu"], [role="listbox"]')) return true;
  return Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'));
}

/** Evento que abre a lista de atalhos (tecla ? ou o item do menu da pessoa). */
export const EVENTO_ABRIR_ATALHOS = 'atalhos:abrir';

/** Lista mostrada na janela "Atalhos do teclado". Ao criar um atalho novo, acrescente aqui. */
export const ATALHOS: { teclas: string[][]; descricao: string; onde: string }[] = [
  { teclas: [['Ctrl', 'K'], ['⌘', 'K']], descricao: 'Abrir a busca (empresas, contatos, demandas)', onde: 'Qualquer tela' },
  { teclas: [['J'], ['K']], descricao: 'Próxima / anterior conversa da lista', onde: 'Atendimento' },
  { teclas: [['A']], descricao: 'Assumir a conversa aberta', onde: 'Atendimento' },
  { teclas: [['N']], descricao: 'Escrever nota interna', onde: 'Atendimento' },
  { teclas: [['/']], descricao: 'Respostas prontas (no campo de resposta)', onde: 'Atendimento' },
  { teclas: [['Ctrl', 'Enter']], descricao: 'Enviar a resposta ao cliente', onde: 'Atendimento' },
  { teclas: [['Esc']], descricao: 'Fechar a janela ou o painel lateral', onde: 'Qualquer tela' },
  { teclas: [['?']], descricao: 'Mostrar esta lista', onde: 'Qualquer tela' },
];
