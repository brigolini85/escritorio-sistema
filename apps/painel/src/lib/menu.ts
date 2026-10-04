import { nivelAtinge, type Niveis } from '@escritorio/core';
import { hrefSecao } from './configuracoes';

export type ItemMenu = { rotulo: string; href: string; filhos?: ItemMenu[] };

const SUBMENU_CONFIGURACOES: ItemMenu[] = [
  { rotulo: 'Usuários e permissões', href: '/usuarios' },
  { rotulo: 'Expediente', href: hrefSecao('expediente') },
  { rotulo: 'Prazos', href: hrefSecao('prazos') },
  { rotulo: 'Mensagens', href: hrefSecao('mensagens') },
  { rotulo: 'Respostas prontas', href: hrefSecao('respostas') },
  { rotulo: 'Setores', href: hrefSecao('setores') },
  { rotulo: 'Teto e modelos de IA', href: hrefSecao('ia') },
];
// "Configurações: Sim" sem ser administrador (P12): sem Usuários e permissões e sem a seção de IA.
const SUBMENU_SEM_USUARIOS = SUBMENU_CONFIGURACOES.filter((i) => i.href !== '/usuarios' && i.href !== hrefSecao('ia'));

/** Itens do menu lateral pelos níveis da pessoa (Parte D). O administrador vê tudo, menos o Assistente sem a marcação. */
export function itensDoMenu(u: { papel: 'admin' | 'atendente'; niveis: Niveis }): ItemMenu[] {
  const admin = u.papel === 'admin';
  const itens: ItemMenu[] = [{ rotulo: 'Início', href: '/inicio' }];
  if (admin || u.niveis.atendimento !== 'sem_acesso') itens.push({ rotulo: 'Atendimento', href: '/atendimento' });
  itens.push({ rotulo: 'Demandas', href: '/demandas' }, { rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Contatos', href: '/contatos' });
  if (nivelAtinge('assistente', u.niveis.assistente, 'site')) itens.push({ rotulo: 'Assistente', href: '/assistente' });
  if (admin || u.niveis.treinar === 'sim') itens.push({ rotulo: 'Treinar o agente', href: '/treinar-agente' });
  if (admin) itens.push({ rotulo: 'Gastos com IA', href: '/gastos-ia' });
  if (admin) itens.push({ rotulo: 'Configurações', href: '/configuracoes', filhos: SUBMENU_CONFIGURACOES });
  else if (u.niveis.configuracoes === 'sim') itens.push({ rotulo: 'Configurações', href: '/configuracoes', filhos: SUBMENU_SEM_USUARIOS });
  return itens;
}
