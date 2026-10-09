import { NextResponse } from 'next/server';

/** Auditoria 2.10: download sem rastro não sai. A rota registra antes de assinar o link (ou montar o arquivo). */
export const AUDITORIA_FORA = 'Não deu para registrar o download agora. Tente de novo em instantes.';

export function respostaAuditoriaFora(erro: unknown): NextResponse {
  console.error('[download] recusado: auditoria não gravada', erro instanceof Error ? erro.message : erro);
  return new NextResponse(AUDITORIA_FORA, { status: 503, headers: { 'Retry-After': '30' } });
}
