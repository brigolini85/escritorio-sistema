import { MUITAS_TENTATIVAS } from '@/lib/textos-login';
/** Mensagens da tela de entrada: só códigos fixos viram texto; o resto (inclusive texto colado na URL) é genérico. */
const ERROS: Record<string, string> = {
  credenciais: 'E-mail ou senha incorretos.',
  inativo: 'Seu acesso está desativado. Fale com o administrador.',
  link: 'O link expirou ou já foi usado. Peça outro em "Esqueci a senha".',
  fora_do_horario: 'Fora do seu horário de acesso. Fale com o administrador se precisar entrar agora.',
  indisponivel: 'Não consegui conferir seu acesso agora. Tente de novo em instantes.',
  // Segurança do login (item 7): 12 h desde o login ou 1 h sem uso.
  sessao: 'Sua sessão expirou. Entre de novo.',
  // Auditoria 2.3: limite de tentativas de login.
  tentativas: MUITAS_TENTATIVAS,
};

export function mensagemDeErro(codigo: string): string {
  return Object.hasOwn(ERROS, codigo) ? ERROS[codigo]! : 'Não foi possível entrar.';
}
