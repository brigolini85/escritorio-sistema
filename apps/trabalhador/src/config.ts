import { normalizarTelefone } from '@escritorio/core';
import { z } from 'zod';

export const Config = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ZAPI_INSTANCIA: z.string().min(1),
  ZAPI_TOKEN: z.string().min(1),
  ZAPI_CLIENT_TOKEN: z.string().min(1),
  WEBHOOK_SEGREDO: z.string().min(16),
  TRANSCRICAO_BASE_URL: z.string().url(),
  TRANSCRICAO_API_KEY: z.string().min(1),
  TRANSCRICAO_MODELO: z.string().min(1),
  // Vazio no .env conta como não informado; o transcritor usa o vocabulário padrão.
  TRANSCRICAO_VOCABULARIO: z.string().optional().transform((v) => v || undefined),
  // Parte I3b (D3): a chave da conta de serviço do Drive (JSON ou base64). Vazio = Drive não configurado.
  GOOGLE_DRIVE_CONTA_SERVICO: z.string().optional().transform((v) => v?.trim() || undefined),
  SMTP_HOST: z.string().min(1),
  SMTP_PORTA: z.coerce.number().default(587),
  SMTP_USUARIO: z.string().min(1),
  SMTP_SENHA: z.string().min(1),
  SMTP_REMETENTE: z.string().email(),
  // Plano de prontidão (D2, revisão P2-1): obrigatório, sem padrão — sem ele a produção ficaria muda (ou o teste mandaria a cliente real).
  AMBIENTE: z.enum(['producao', 'homologacao', 'local']),
  // Fora da produção, só estes telefones recebem mensagem (separados por vírgula).
  TELEFONES_PERMITIDOS: z.string().optional().transform((v) =>
    (v ?? '').split(',').map((t) => normalizarTelefone(t.trim())).filter((t): t is string => Boolean(t))),
  PORTA: z.coerce.number().default(3001),
});
export type Config = z.infer<typeof Config>;

export function lerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const r = Config.safeParse(env);
  if (!r.success) {
    const faltando = r.error.issues.map((i) => i.path.join('.')).join(', ');
    // D2: a variável nova é a que mais vai faltar na subida; a mensagem diz o que pôr.
    const dica = r.error.issues.some((i) => i.path[0] === 'AMBIENTE')
      ? '. AMBIENTE deve ser producao, homologacao ou local (fora da produção, só os TELEFONES_PERMITIDOS recebem mensagem)'
      : '';
    throw new Error(`Configuração inválida ou faltando: ${faltando}${dica}`);
  }
  return r.data;
}
