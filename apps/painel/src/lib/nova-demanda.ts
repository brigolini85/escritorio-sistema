// Nova demanda (spec 6.4): conferência antes de ir ao banco e o campo de cada erro do banco, para o aviso ficar no lugar certo.

export type CampoNova = 'cliente' | 'setor' | 'titulo' | 'descricao' | 'prazo' | 'responsavel' | 'contato';

export function validarNovaDemanda(d: { cliente: string; setor: string; titulo: string; descricao: string }):
  { ok: true } | { ok: false; erro: string; campo: CampoNova } {
  if (!d.cliente) return { ok: false, erro: 'Escolha a empresa.', campo: 'cliente' };
  if (!d.setor) return { ok: false, erro: 'Escolha o setor.', campo: 'setor' };
  const titulo = d.titulo.trim();
  if (titulo.length < 3 || titulo.length > 120) return { ok: false, erro: 'O título precisa ter de 3 a 120 caracteres.', campo: 'titulo' };
  if (d.descricao.trim().length > 4000) return { ok: false, erro: 'A descrição pode ter até 4000 caracteres.', campo: 'descricao' };
  return { ok: true };
}

// Ordem importa: "pessoa ativa do setor" fala de setor, mas é do Responsável.
const PISTAS: [string, CampoNova][] = [
  ['pessoa ativa', 'responsavel'], ['contato', 'contato'], ['empresa', 'cliente'], ['título', 'titulo'],
  ['descrição', 'descricao'], ['prazo', 'prazo'], ['setor', 'setor'],
];

export function campoDoErro(mensagem: string): CampoNova | undefined {
  const m = mensagem.toLocaleLowerCase('pt-BR');
  return PISTAS.find(([pista]) => m.includes(pista))?.[1];
}
