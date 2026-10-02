/** Para onde a tela de "Esqueci a senha" volta: o Supabase responde igual para e-mail desconhecido, então só falha de envio (limite, rede, SMTP) vira erro. */
export function destinoDoPedido(falhou: boolean): string {
  return falhou ? '/esqueci-senha?erro=envio' : '/esqueci-senha?enviado=1';
}
