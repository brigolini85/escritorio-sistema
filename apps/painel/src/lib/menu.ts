export type ItemMenu = { rotulo: string; href: string; filhos?: ItemMenu[] };

// Submenu de Configurações: "Prazos" entra na Parte C do painel v2, por isso ainda não aparece aqui.
const SUBMENU_CONFIGURACOES: ItemMenu[] = [
  { rotulo: 'Usuários e permissões', href: '/usuarios' },
  { rotulo: 'Setores', href: '/configuracoes#setores' },
  { rotulo: 'Expediente e IA', href: '/configuracoes#expediente' },
  { rotulo: 'Mensagens', href: '/configuracoes#mensagens' },
  { rotulo: 'Respostas prontas', href: '/configuracoes#respostas' },
  { rotulo: 'Feriados', href: '/configuracoes#feriados' },
];

/**
 * Itens do menu lateral. Assistente depende da marcação da pessoa; Treinar o agente, da marcação "Treinar o agente"
 * (o administrador sempre vê); Configurações (com Usuários e permissões dentro) é do administrador.
 */
export function itensDoMenu(u: { papel: 'admin' | 'atendente'; permissoes: string[] }): ItemMenu[] {
  const itens: ItemMenu[] = [
    { rotulo: 'Início', href: '/inicio' },
    { rotulo: 'Atendimento', href: '/atendimento' },
    { rotulo: 'Demandas', href: '/demandas' },
    { rotulo: 'Clientes', href: '/clientes' },
    { rotulo: 'Contatos', href: '/contatos' },
  ];
  if (u.permissoes.includes('assistente_site')) itens.push({ rotulo: 'Assistente', href: '/assistente' });
  if (u.papel === 'admin' || u.permissoes.includes('treinar_agente')) itens.push({ rotulo: 'Treinar o agente', href: '/treinar-agente' });
  if (u.papel === 'admin') itens.push({ rotulo: 'Configurações', href: '/configuracoes', filhos: SUBMENU_CONFIGURACOES });
  return itens;
}
