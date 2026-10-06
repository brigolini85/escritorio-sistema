import { describe, expect, it } from 'vitest';
import { OPCOES_GUARDA, TEXTO_DRIVE_NAO_CONFIGURADO, avisoDoDrive, textoGuarda } from './drive-tela';

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
