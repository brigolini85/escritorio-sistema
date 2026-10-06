import type { Repos } from '@escritorio/db';
import { ErroDrive, type DriveLeitor } from './leitor';

export const ERRO_CONTA_DRIVE = 'O Google recusou a conta do Drive do escritório. Confira a chave e se a API do Drive está ligada.';
export const ERRO_DRIVE_SEM_RESPOSTA = 'O Drive não respondeu ao conferir a conta do escritório. Ele é conferido de novo na próxima leitura.';
let avisouSemI3b = false;

/** D9: ao ligar, grava o e-mail da conta (ou o erro curto) para o painel mostrar. Nunca derruba o trabalhador. */
export async function anunciarSituacaoDrive(
  repos: Pick<Repos, 'registrarSituacaoDrive'>, d: { leitor: DriveLeitor | null; erro: string | null },
): Promise<void> {
  try {
    let s: { email: string | null; erro: string | null } = { email: null, erro: d.erro };
    if (d.leitor) {
      try {
        await d.leitor.verificar();
        s = { email: d.leitor.email, erro: null };
      } catch (e) {
        // Só a mensagem (as do cliente REST são fixas e nunca trazem a chave).
        console.error('[drive] a conta não autenticou:', e instanceof Error ? e.message : 'erro desconhecido');
        // Rede fora ou tempo esgotado não é culpa da chave: texto próprio.
        s = { email: d.leitor.email, erro: e instanceof ErroDrive && e.codigo === 'falha' ? ERRO_DRIVE_SEM_RESPOSTA : ERRO_CONTA_DRIVE };
      }
    }
    if (!(await repos.registrarSituacaoDrive(s)) && !avisouSemI3b) {
      avisouSemI3b = true;
      console.warn('[drive] o banco ainda não tem a Parte I3b: a situação do Drive não foi gravada');
    }
  } catch (e) {
    console.error('[drive] situação não gravada:', e instanceof Error ? e.message : e);
  }
}
