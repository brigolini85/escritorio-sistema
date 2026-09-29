import type { CanalAssistente, Configuracoes, Repos, UsuarioAssistente } from '@escritorio/db';
import { podeVerChamado } from './visibilidade';

export type ConversaDoContexto = {
  telefone: string; contato: string | null; empresa: { id: string; nome: string } | null;
  demandas: { numero: number; titulo: string; status: string }[]; mensagens: string[];
};
export type ContextoAssistente = {
  usuario: UsuarioAssistente; canal: CanalAssistente; conversaId: string | null; agora: Date; config: Configuracoes;
  setores: { id: string; nome: string }[]; conversa: ConversaDoContexto | null;
};

export async function carregarContextoAssistente(
  repos: Repos, usuario: UsuarioAssistente, canal: CanalAssistente, conversaId: string | null, agora: Date,
): Promise<ContextoAssistente> {
  const [config, setores] = await Promise.all([repos.obterConfiguracoes(), repos.setoresAtivos()]);
  let conversa: ConversaDoContexto | null = null;
  if (conversaId) {
    const c = await repos.obterConversa(conversaId);
    const contato = await repos.buscarContato(c.telefone);
    const empresa = contato?.empresas.find((e) => e.id === c.cliente_em_foco) ?? contato?.empresas[0] ?? null;
    const abertas = (await repos.chamadosAbertosDaConversa(conversaId)).filter((x) => podeVerChamado(usuario, x));
    const mensagens = (await repos.historico(conversaId, 20)).map((m) => `${m.autor === 'cliente' ? 'Cliente' : 'Escritório'}: ${m.conteudo ?? m.transcricao ?? `[${m.tipo}]`}`);
    conversa = {
      telefone: c.telefone, contato: contato?.nome ?? null, empresa: empresa ? { id: empresa.id, nome: empresa.nome } : null,
      demandas: abertas.map((x) => ({ numero: Number(x.numero), titulo: x.titulo, status: x.status })), mensagens,
    };
  }
  return { usuario, canal, conversaId, agora, config, setores: setores.map((s) => ({ id: s.id, nome: s.nome })), conversa };
}
