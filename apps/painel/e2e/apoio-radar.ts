import { contatoProcuravelTeste, giroRadarTeste, ligarRadarTeste, novidadeRadarTeste } from '@escritorio/db/teste';
import { db } from './apoio';
import { criarDono } from './apoio-agentes';

export { SENHA } from './apoio-agentes';

export type Radar = { dono: string; giro: string; alta: string; media: string; baixa: string };

export const TITULO_ALTA = 'eSocial publica novo leiaute do evento S-1200';
export const TITULO_MEDIA = 'Receita altera o prazo da DCTF Web';
export const TITULO_BAIXA = 'Site de notícias fala em mudança no limite do MEI';
export const MENSAGEM_MEDIA = 'Olá! O prazo da DCTF Web mudou. Fale com a gente se tiver dúvida.';

/** Dono, Radar ligado, um giro concluído (CONFAZ fora do ar) e 3 novidades: alta, média (com rascunho) e baixa a confirmar. */
export async function prepararRadar(): Promise<Radar> {
  const dono = await criarDono();
  await ligarRadarTeste('ligado');
  const giro = await giroRadarTeste({ origem: 'agenda', estado: 'concluido', novidades: 3,
    fontesFora: [{ fonte_id: null, nome: 'CONFAZ', motivo: 'não respondeu' }] });
  const alta = await novidadeRadarTeste({ titulo: TITULO_ALTA, url: 'https://www.gov.br/esocial/leiaute-s1200', impacto: 'alto', setores: ['Pessoal', 'Contábil'],
    criterios: { com_funcionarios: true }, giroId: giro, achadoEm: new Date(Date.now() - 1000).toISOString() });
  const media = await novidadeRadarTeste({ titulo: TITULO_MEDIA, url: 'https://www.gov.br/receitafederal/dctf-web-prazo', impacto: 'medio', setores: ['Fiscal'],
    mensagem: MENSAGEM_MEDIA, giroId: giro, fonteNome: 'Receita Federal', achadoEm: new Date(Date.now() - 2000).toISOString() });
  const baixa = await novidadeRadarTeste({ titulo: TITULO_BAIXA, url: 'https://www.contabeis.com.br/noticias/mei-limite', impacto: 'baixo', setores: ['Fiscal'],
    selo: 'confirmar', giroId: giro, fonteNome: 'Contábeis', achadoEm: new Date(Date.now() - 3000).toISOString() });
  return { dono, giro, alta, media, baixa };
}

/** Padaria Sol (2 contatos que o Fiscal procura, mais um básico e um sem "pode ser procurado", que ficam de fora) e Mercado Lua (1 contato). Devolve os ids. */
export async function clientesComContatos(): Promise<{ padaria: string; lua: string }> {
  const novo = async (razao: string, cnpj: string) => (await db.from('clientes').insert({ razao_social: razao, cnpj }).select('id').single()).data!.id as string;
  const padaria = await novo('Padaria Sol ME', '41000000000101');
  const lua = await novo('Mercado Lua Ltda', '41000000000202');
  await contatoProcuravelTeste({ clienteId: padaria, nome: 'Dona Sol', telefone: '5531988880001', setor: 'Fiscal' });
  await contatoProcuravelTeste({ clienteId: padaria, nome: 'Seu Jose', telefone: '5531988880005', setor: 'Fiscal' });
  await contatoProcuravelTeste({ clienteId: padaria, nome: 'Seu Basico', telefone: '5531988880002', setor: 'Fiscal', perfil: 'basico' });
  await contatoProcuravelTeste({ clienteId: padaria, nome: 'Sem Permissao', telefone: '5531988880003', setor: 'Fiscal', procurado: false });
  await contatoProcuravelTeste({ clienteId: lua, nome: 'Dona Lua', telefone: '5531988880004', setor: 'Fiscal' });
  return { padaria, lua };
}

