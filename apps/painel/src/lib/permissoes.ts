import { nivelAtinge, type Modulo, type Niveis, type NivelDe } from '@escritorio/core';

export const ROTULO_MODULO: Record<Modulo, string> = {
  atendimento: 'Atendimento', demandas: 'Demandas', clientes: 'Clientes e contatos', precos: 'Preços',
  notas: 'Pedidos de nota e CSV Bling', assistente: 'Assistente', treinar: 'Treinar o agente',
  prazos: 'Alterar prazos de demandas', configuracoes: 'Configurações',
};

export const ROTULO_NIVEL: { [M in Modulo]: Record<NivelDe<M>, string> } = {
  atendimento: { sem_acesso: 'Sem acesso', meus_setores: 'Conversas dos meus setores', todas: 'Todas as conversas' },
  demandas: { minhas: 'Só as minhas', meu_setor: 'Do meu setor', todas: 'Todas' },
  clientes: { ver: 'Só ver', editar: 'Ver e editar', arquivar: 'Editar e arquivar' },
  precos: { ver: 'Só ver', mudar: 'Mudar preços' },
  notas: { sem_acesso: 'Sem acesso', ver: 'Ver', corrigir: 'Corrigir e gerar' },
  assistente: { sem_acesso: 'Sem acesso', site: 'Site', site_whatsapp: 'Site e WhatsApp' },
  treinar: { nao: 'Sem acesso', sim: 'Sim' },
  prazos: { nao: 'Não', sim: 'Sim' },
  configuracoes: { nao: 'Sem acesso', sim: 'Sim' },
};

/** Linha embaixo de cada campo da ficha: os níveis, do menor ao maior, e o que precisa saber (imagem 06). */
export const AJUDA_MODULO: Record<Modulo, string> = {
  atendimento: 'Sem acesso · Conversas dos meus setores · Todas as conversas',
  demandas: 'Só as minhas · Do meu setor · Todas',
  clientes: 'Só ver · Ver e editar · Editar e arquivar. Produtos entram em "Ver e editar".',
  precos: 'Só ver · Mudar preços. Produtos seguem em Clientes e contatos.',
  notas: 'Sem acesso · Ver · Corrigir e gerar. "Sem acesso" esconde o pedido na tela e no assistente.',
  assistente: 'Sem acesso · Site · Site e WhatsApp (exige telefone).',
  treinar: 'Escreve e liga as orientações que o agente segue.',
  prazos: 'Escolher o prazo à mão. Mudar a prioridade recalcula o prazo para todos.',
  configuracoes: 'Expediente, mensagens, prazos, setores, respostas e feriados. Teto de IA e usuários ficam com o administrador.',
};

export function rotuloNivel<M extends Modulo>(m: M, n: NivelDe<M>): string {
  return ROTULO_NIVEL[m][n];
}

/** O administrador passa em tudo; os demais, pelo nível do módulo. */
export function temNivel<M extends Modulo>(u: { papel: 'admin' | 'atendente'; niveis: Niveis }, modulo: M, minimo: NivelDe<M>): boolean {
  return u.papel === 'admin' || nivelAtinge(modulo, u.niveis[modulo], minimo);
}

/** Assistente é canal: precisa do nível até para o administrador, como antes (P3). */
export function usaAssistente(u: { niveis: Niveis }, canal: 'site' | 'whatsapp' = 'site'): boolean {
  return nivelAtinge('assistente', u.niveis.assistente, canal === 'site' ? 'site' : 'site_whatsapp');
}
