/**
 * "Digite o nome para confirmar" do ConfirmDialog: espaços extras e maiúsculas/minúsculas não importam,
 * acentos importam (o nome tem que ser o mesmo). Texto esperado vazio nunca confirma.
 */
export function textoConfere(digitado: string, esperado: string): boolean {
  const normal = (t: string) => t.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
  const alvo = normal(esperado);
  return alvo.length > 0 && normal(digitado) === alvo;
}

export type TipoConfirmacao = 'arquivar' | 'excluir' | 'concluir' | 'perigo' | 'neutro';

// Cada tipo de confirmação tem anel, ícone e botão próprios (spec 4.5): quem arquiva é champanhe, quem exclui é grafite.
export const APARENCIA_CONFIRMACAO: Record<TipoConfirmacao, { anel: string; icone: string; botao: 'primary' | 'grafite' | 'success' | 'danger' }> = {
  arquivar: { anel: 'border-champagne', icone: 'text-champagne-text', botao: 'primary' },
  excluir: { anel: 'border-grafite', icone: 'text-foreground', botao: 'grafite' },
  concluir: { anel: 'border-success', icone: 'text-success', botao: 'success' },
  perigo: { anel: 'border-danger', icone: 'text-danger', botao: 'danger' },
  neutro: { anel: 'border-brand', icone: 'text-brand', botao: 'primary' },
};

// Sem tipo explícito vale a variante antiga: danger (e o padrão do ConfirmDialog) é perigo, o resto é neutro.
export function tipoPadrao(variante: 'primary' | 'danger' | undefined): TipoConfirmacao {
  return variante === 'primary' ? 'neutro' : 'perigo';
}
