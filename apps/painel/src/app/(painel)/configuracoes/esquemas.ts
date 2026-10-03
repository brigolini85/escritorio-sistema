import { z } from 'zod';
import { normalizarTelefone } from '@escritorio/core';

const telefoneOpcional = z.preprocess((v) => (v ? normalizarTelefone(String(v)) : null), z.string().nullable());

export const GeraisForm = z.preprocess((v) => {
  const f = v as FormData;
  return {
    horario_inicio: f.get('horario_inicio'), horario_fim: f.get('horario_fim'), dias_uteis: f.getAll('dia').map(Number),
    teto_ia_usd: f.get('teto_ia_usd'), minutos_alerta_fila: f.get('minutos_alerta_fila'),
    email_alertas: f.get('email_alertas') || null, telefone_dono: f.get('telefone_dono') || null,
  };
}, z.object({
  horario_inicio: z.string().regex(/^\d{2}:\d{2}$/),
  horario_fim: z.string().regex(/^\d{2}:\d{2}$/),
  dias_uteis: z.array(z.number().int().min(0).max(6)),
  teto_ia_usd: z.coerce.number().positive(),
  minutos_alerta_fila: z.coerce.number().int().min(5),
  email_alertas: z.string().email().nullable(),
  telefone_dono: telefoneOpcional,
}).refine((g) => g.horario_fim > g.horario_inicio, { message: 'O fim do expediente precisa ser depois do início', path: ['horario_fim'] }));

/** Recado na tela de entrada: aparado, pode ficar vazio, até 200 caracteres; o CRLF do textarea vira LF antes de contar (senão 200 visíveis passariam do limite). */
export const esquemaAvisoLogin = z.object({
  aviso_login: z.string().transform((v) => v.replace(/\r\n/g, '\n')).pipe(z.string().trim().max(200, 'Até 200 caracteres.')),
});

const dias = z.coerce.number().int().min(0).max(30);
/** Dias úteis até o prazo de cada prioridade (spec 6.5). 0 = no mesmo dia, até o fim do expediente. */
export const PrazosForm = z.object({
  prazo_urgente_dias: z.string().min(1).pipe(dias),
  prazo_alta_dias: z.string().min(1).pipe(dias),
  prazo_normal_dias: z.string().min(1).pipe(dias),
  prazo_baixa_dias: z.string().min(1).pipe(dias),
});
