import { z } from 'zod';
import { normalizarTelefone } from '@escritorio/core';

const telefoneOpcional = z.preprocess((v) => (v ? normalizarTelefone(String(v)) : null), z.string().nullable());

/** Expediente (Configurações: Sim). */
export const ExpedienteForm = z.preprocess((v) => {
  const f = v as FormData;
  return { horario_inicio: f.get('horario_inicio'), horario_fim: f.get('horario_fim'), dias_uteis: f.getAll('dia').map(Number) };
}, z.object({
  horario_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Informe o horário (hh:mm).'),
  horario_fim: z.string().regex(/^\d{2}:\d{2}$/, 'Informe o horário (hh:mm).'),
  dias_uteis: z.array(z.number().int().min(0).max(6)),
}).refine((g) => g.horario_fim > g.horario_inicio, { message: 'O fim do expediente precisa ser depois do início', path: ['horario_fim'] }));

/** Feriado novo (Configurações: Sim). */
export const FeriadoForm = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data do feriado.'),
  descricao: z.string().trim().min(1, 'Escreva o nome do feriado.').max(80, 'Até 80 letras.'),
});

/** Decimal opcional digitado com vírgula ou ponto: vazio vira null (Gastos com IA mostra só US$ / transcrição sem custo). */
const decimalOpcional = (msg: string, minimoExclusivo: boolean) => z.preprocess(
  (v) => (v === null || v === undefined || String(v).trim() === '' ? null : Number(String(v).trim().replace(',', '.'))),
  z.number({ invalid_type_error: msg }).refine((n) => Number.isFinite(n) && (minimoExclusivo ? n > 0 : n >= 0), msg).nullable(),
);

/** Teto de IA e alertas: só o administrador (P12 da Parte D; o banco também segura essas colunas). */
export const TetoAlertasForm = z.preprocess((v) => {
  const f = v as FormData;
  return {
    teto_ia_usd: f.get('teto_ia_usd'), minutos_alerta_fila: f.get('minutos_alerta_fila'),
    email_alertas: f.get('email_alertas') || null, telefone_dono: f.get('telefone_dono') || null,
  };
}, z.object({
  teto_ia_usd: z.coerce.number().positive('O teto precisa ser maior que zero.'),
  minutos_alerta_fila: z.coerce.number().int().min(5, 'No mínimo 5 minutos.'),
  email_alertas: z.string().email('Confira o e-mail.').nullable(),
  telefone_dono: telefoneOpcional,
}));

/** Cotação para mostrar R$ e custo por minuto da transcrição (só o administrador; spec 7B e seção 9). */
export const CotacaoForm = z.preprocess((v) => {
  const f = v as FormData;
  return { cotacao_usd_brl: f.get('cotacao_usd_brl') || null, custo_minuto_transcricao_usd: f.get('custo_minuto_transcricao_usd') || null };
}, z.object({
  cotacao_usd_brl: decimalOpcional('A cotação precisa ser maior que zero.', true),
  custo_minuto_transcricao_usd: decimalOpcional('O custo por minuto não pode ser negativo.', false),
}));

/** Modelos de IA: só os que têm preço em precos_modelos (D11), senão o gasto fica zerado. */
export const modelosForm = (chaves: string[]) => z.preprocess((v) => {
  const f = v as FormData;
  return { modelo_conversa: f.get('modelo_conversa'), modelo_rapido: f.get('modelo_rapido') };
}, z.object({
  modelo_conversa: z.string().refine((m) => chaves.includes(m), 'Escolha um modelo da lista de preços.'),
  modelo_rapido: z.string().refine((m) => chaves.includes(m), 'Escolha um modelo da lista de preços.'),
}));

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

/** Limites do cronômetro do Atendimento (spec 7A.1): verde até X minutos, âmbar até Y; depois, vermelho. */
export const EsperaForm = z.object({
  espera_verde_min: z.coerce.number().int().min(1, 'De 1 a 240 minutos.').max(240, 'De 1 a 240 minutos.'),
  espera_ambar_min: z.coerce.number().int().max(480, 'Até 480 minutos.'),
}).refine((v) => v.espera_ambar_min > v.espera_verde_min, { message: 'O âmbar precisa ser maior que o verde.', path: ['espera_ambar_min'] });
