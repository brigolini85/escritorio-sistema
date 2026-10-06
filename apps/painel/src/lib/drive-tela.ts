/** Parte I3b (D8, D9, D14): textos do Drive e da guarda dos arquivos das tarefas. */
export type SituacaoDrive = { email: string | null; erro: string | null; verificadoEm: string | null };
export const TEXTO_DRIVE_SEM_I3B = 'A pasta no Drive aparece quando a atualização do banco da Parte I3b for aplicada.';
export const TEXTO_GUARDA_SEM_I3B = 'A guarda dos arquivos das tarefas aparece quando a atualização do banco da Parte I3b for aplicada.';
export const TEXTO_PASTA_ERRO_LEITURA = 'Não consegui ler a pasta agora. Recarregue a página.';
export const TEXTO_DRIVE_ERRO_LEITURA = 'Não consegui ler a situação do Drive.';
export const TEXTO_GUARDA_ERRO_LEITURA = 'Não consegui ler a guarda dos arquivos agora. Recarregue a página.';
export const TEXTO_DRIVE_NAO_CONFIGURADO = 'Drive não configurado: o agente lê só os arquivos enviados.';

export const TEXTO_DRIVE_TAREFA_ERRO_LEITURA = 'Não consegui ler a pasta ou a situação do Drive agora. Recarregue a página.';
export const TEXTO_TAREFA_SEM_PASTA = 'Sem pasta no Drive: preencha na ficha do cliente, em Arquivos.';
export const TEXTO_TAREFA_SEM_CLIENTE = 'Tarefa sem cliente: não há pasta no Drive para ler. O agente lê só os arquivos enviados.';

/** erroLeitura: o painel não conseguiu ler a situação; isso não é "Drive não configurado". */
export function avisoDoDrive(s: SituacaoDrive | null, erroLeitura = false): { tom: 'success' | 'warning'; texto: string } {
  if (erroLeitura) return { tom: 'warning', texto: TEXTO_DRIVE_ERRO_LEITURA };
  if (s?.erro) return { tom: 'warning', texto: `O Drive não está respondendo: ${s.erro}` };
  // Sem e-mail: sem a chave no trabalhador (ele limpa o e-mail antigo ao ligar sem ela).
  if (!s?.email) return { tom: 'warning', texto: TEXTO_DRIVE_NAO_CONFIGURADO };
  return { tom: 'success', texto: `Drive ligado, só leitura. Compartilhe a pasta de cada cliente com ${s.email}, como Leitor.` };
}

export type DriveDaTarefa = { pasta: string | null; situacao: SituacaoDrive | null; erro?: boolean };
/**
 * A faixa do Drive na tarefa. LER A PASTA DE NOVO só com pasta e e-mail da conta (o e-mail some quando a chave sai);
 * F1: um erro antigo da conta não esconde o botão.
 */
export function driveNaTarefa(d: DriveDaTarefa, temCliente: boolean):
  { lerDeNovo: boolean; aviso: { tom: 'muted' | 'warning'; texto: string; ficha?: true } | null } {
  if (!temCliente) return { lerDeNovo: false, aviso: { tom: 'muted', texto: TEXTO_TAREFA_SEM_CLIENTE } };
  if (d.erro) return { lerDeNovo: false, aviso: { tom: 'warning', texto: TEXTO_DRIVE_TAREFA_ERRO_LEITURA } };
  if (!d.pasta) return { lerDeNovo: false, aviso: { tom: 'muted', texto: TEXTO_TAREFA_SEM_PASTA, ficha: true } };
  const a = avisoDoDrive(d.situacao);
  return { lerDeNovo: !!d.situacao?.email, aviso: a.tom === 'warning' ? { tom: 'warning', texto: a.texto } : null };
}

export const OPCOES_GUARDA: { valor: number | null; rotulo: string }[] = [
  { valor: null, rotulo: 'Nunca apagar' }, { valor: 90, rotulo: '90 dias' }, { valor: 180, rotulo: '180 dias' },
  { valor: 365, rotulo: '365 dias (sugerido)' }, { valor: 730, rotulo: '730 dias' },
];
export function textoGuarda(dias: number | null): string {
  return dias === null ? 'Os arquivos das tarefas ficam guardados até alguém apagar.'
    : `Os arquivos das tarefas são apagados ${dias} dias depois que a tarefa é aprovada ou descartada. O resultado, o CSV e a planilha continuam.`;
}
