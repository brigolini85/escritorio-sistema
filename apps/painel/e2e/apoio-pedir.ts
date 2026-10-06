import { configurarAgenteTeste, marcarDonoTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste } from './apoio';
import { SENHA } from './apoio-agentes';
import { demandaE2e, empresaE2e } from './apoio-demandas';

export const EMAIL_CLAUDIA = 'claudia@i4.local';
export const EMAIL_DONO = 'dono@i4.local';
export { SENHA };

/** Parte I4: Padaria Sol, uma demanda do Contábil e uma do Fiscal, Contábil (trabalho) e Fiscal (conversa e trabalho) ligados, Cláudia (Contábil, sem telefone) e o dono. */
export async function cenarioPedir() {
  const empresa = await empresaE2e('I4 Padaria Sol', '21448390000190');
  const contabil = await demandaE2e({ titulo: 'I4 Fechamento de outubro', setor: 'Contábil', clienteId: empresa });
  const fiscal = await demandaE2e({ titulo: 'I4 Conferência das notas', setor: 'Fiscal', clienteId: empresa });
  await configurarAgenteTeste('contabil', { estado: 'ligado', tipos: ['trabalho'] });
  await configurarAgenteTeste('fiscal', { estado: 'ligado', tipos: ['conversa', 'trabalho'] });
  const claudia = await criarUsuarioTeste({ email: EMAIL_CLAUDIA, senha: SENHA, nome: 'Cláudia I4', papel: 'atendente', setores: ['Contábil'], permissoes: ['assistente_site'] });
  const dono = await criarUsuarioTeste({ email: EMAIL_DONO, senha: SENHA, nome: 'Thiago Dono I4', papel: 'admin' });
  await marcarDonoTeste(dono);
  return { empresa, contabil, fiscal, claudia, dono };
}
