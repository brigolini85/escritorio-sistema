/** Parte I3b (D8, D9, D14): textos do Drive e da guarda dos arquivos das tarefas. */
export type SituacaoDrive = { email: string | null; erro: string | null; verificadoEm: string | null };
export const TEXTO_DRIVE_SEM_I3B = 'A pasta no Drive aparece quando a atualização do banco da Parte I3b for aplicada.';
export const TEXTO_GUARDA_SEM_I3B = 'A guarda dos arquivos das tarefas aparece quando a atualização do banco da Parte I3b for aplicada.';
export const TEXTO_PASTA_ERRO_LEITURA = 'Não consegui ler a pasta agora. Recarregue a página.';
export const TEXTO_DRIVE_ERRO_LEITURA = 'Não consegui ler a situação do Drive.';
export const TEXTO_GUARDA_ERRO_LEITURA = 'Não consegui ler a guarda dos arquivos agora. Recarregue a página.';
export const TEXTO_DRIVE_NAO_CONFIGURADO = 'Drive não configurado: o agente lê só os arquivos enviados.';

export function avisoDoDrive(s: SituacaoDrive | null): { tom: 'success' | 'warning'; texto: string } {
  if (s?.erro) return { tom: 'warning', texto: `O Drive não está respondendo: ${s.erro}` };
  if (!s?.email) return { tom: 'warning', texto: TEXTO_DRIVE_NAO_CONFIGURADO };
  return { tom: 'success', texto: `Drive ligado, só leitura. Compartilhe a pasta de cada cliente com ${s.email}, como Leitor.` };
}

export const OPCOES_GUARDA: { valor: number | null; rotulo: string }[] = [
  { valor: null, rotulo: 'Nunca apagar' }, { valor: 90, rotulo: '90 dias' }, { valor: 180, rotulo: '180 dias' },
  { valor: 365, rotulo: '365 dias (sugerido)' }, { valor: 730, rotulo: '730 dias' },
];
export function textoGuarda(dias: number | null): string {
  return dias === null ? 'Os arquivos das tarefas ficam guardados até alguém apagar.'
    : `Os arquivos das tarefas são apagados ${dias} dias depois que a tarefa é aprovada ou descartada. O resultado, o CSV e a planilha continuam.`;
}
