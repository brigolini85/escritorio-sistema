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

/** Recado na tela de entrada: aparado, pode ficar vazio (não mostra nada), até 200 caracteres. */
export const esquemaAvisoLogin = z.object({ aviso_login: z.string().trim().max(200, 'Até 200 caracteres.') });
