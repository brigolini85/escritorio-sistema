import { describe, expect, it } from 'vitest';
import {
  OPCOES_GUARDA, TEXTO_DRIVE_ERRO_LEITURA, TEXTO_DRIVE_NAO_CONFIGURADO, TEXTO_DRIVE_TAREFA_ERRO_LEITURA, TEXTO_TAREFA_SEM_CLIENTE, TEXTO_TAREFA_SEM_PASTA, avisoDoDrive, driveNaTarefa,
  textoGuarda,
} from './drive-tela';

describe('avisoDoDrive (D9)', () => {
  it('sem linha ou sem e-mail: não configurado; com erro: o erro; ligado: com quem compartilhar', () => {
    expect(avisoDoDrive(null)).toEqual({ tom: 'warning', texto: TEXTO_DRIVE_NAO_CONFIGURADO });
    expect(avisoDoDrive({ email: null, erro: null, verificadoEm: null })).toEqual({ tom: 'warning', texto: TEXTO_DRIVE_NAO_CONFIGURADO });
    expect(avisoDoDrive({ email: 'd@x.iam.gserviceaccount.com', erro: 'O Google recusou a conta.', verificadoEm: null }))
      .toEqual({ tom: 'warning', texto: 'O Drive não está respondendo: O Google recusou a conta.' });
    expect(avisoDoDrive({ email: 'd@x.iam.gserviceaccount.com', erro: null, verificadoEm: null }))
      .toEqual({ tom: 'success', texto: 'Drive ligado, só leitura. Compartilhe a pasta de cada cliente com d@x.iam.gserviceaccount.com, como Leitor.' });
  });
});

describe('guarda (D14)', () => {
  it('nunca apagar é o padrão; os prazos do banco', () => {
    expect(OPCOES_GUARDA.map((o) => o.valor)).toEqual([null, 90, 180, 365, 730]);
    expect(textoGuarda(null)).toBe('Os arquivos das tarefas ficam guardados até alguém apagar.');
    expect(textoGuarda(365)).toBe('Os arquivos das tarefas são apagados 365 dias depois que a tarefa é aprovada ou descartada. O resultado, o CSV e a planilha continuam.');
  });
});

describe('avisoDoDrive com erro de leitura (revisão final, minor 1)', () => {
  it('falha ao ler a situação não vira "Drive não configurado"', () => {
    expect(avisoDoDrive(null, true)).toEqual({ tom: 'warning', texto: TEXTO_DRIVE_ERRO_LEITURA });
  });
});

describe('driveNaTarefa (revisão final, Important 1 e minors 1–2)', () => {
  const ligado = { email: 'd@x.iam.gserviceaccount.com', erro: null, verificadoEm: null };
  it('sem a chave (e-mail limpo pelo trabalhador): sem LER A PASTA DE NOVO e com "Drive não configurado"', () => {
    expect(driveNaTarefa({ pasta: 'P', situacao: { email: null, erro: null, verificadoEm: null } }, true))
      .toEqual({ lerDeNovo: false, aviso: { tom: 'warning', texto: TEXTO_DRIVE_NAO_CONFIGURADO } });
    expect(driveNaTarefa({ pasta: 'P', situacao: null }, true)).toEqual({ lerDeNovo: false, aviso: { tom: 'warning', texto: TEXTO_DRIVE_NAO_CONFIGURADO } });
  });
  it('ligado: o botão, sem aviso; conta recusada: o botão e o erro (F1)', () => {
    expect(driveNaTarefa({ pasta: 'P', situacao: ligado }, true)).toEqual({ lerDeNovo: true, aviso: null });
    expect(driveNaTarefa({ pasta: 'P', situacao: { ...ligado, erro: 'recusada' } }, true))
      .toEqual({ lerDeNovo: true, aviso: { tom: 'warning', texto: 'O Drive não está respondendo: recusada' } });
  });
  it('sem pasta orienta para a ficha; sem cliente diz que não há pasta; erro de leitura não vira "sem pasta"', () => {
    expect(driveNaTarefa({ pasta: null, situacao: ligado }, true)).toEqual({ lerDeNovo: false, aviso: { tom: 'muted', texto: TEXTO_TAREFA_SEM_PASTA, ficha: true } });
    expect(TEXTO_TAREFA_SEM_PASTA).toBe('Sem pasta no Drive: preencha na ficha do cliente, em Arquivos.');
    expect(driveNaTarefa({ pasta: null, situacao: ligado }, false)).toEqual({ lerDeNovo: false, aviso: { tom: 'muted', texto: TEXTO_TAREFA_SEM_CLIENTE } });
    expect(TEXTO_TAREFA_SEM_CLIENTE).toBe('Tarefa sem cliente: não há pasta no Drive para ler. O agente lê só os arquivos enviados.');
    expect(driveNaTarefa({ pasta: null, situacao: ligado, erro: true }, true)).toEqual({ lerDeNovo: false, aviso: { tom: 'warning', texto: TEXTO_DRIVE_TAREFA_ERRO_LEITURA } });
    expect(TEXTO_DRIVE_TAREFA_ERRO_LEITURA).toBe('Não consegui ler a pasta ou a situação do Drive agora. Recarregue a página.');
  });
});
