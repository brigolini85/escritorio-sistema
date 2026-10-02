'use client';

import { Sidebar, type ItemMenu } from '@/components/layout/sidebar';

// Recorte do menu: itens fixos, sem dados ao vivo. Configurações fica ativa (a rota /_design vale para o filho "Mensagens")
// e, no modo gaveta (onNavegar), o submenu já vem aberto. O onNavegar precisa de componente client (função não passa do servidor).
const ITENS: ItemMenu[] = [
  { rotulo: 'Início', href: '/inicio' },
  { rotulo: 'Atendimento', href: '/atendimento' },
  { rotulo: 'Demandas', href: '/demandas' },
  { rotulo: 'Clientes', href: '/clientes' },
  {
    rotulo: 'Configurações',
    href: '/configuracoes',
    filhos: [
      { rotulo: 'Usuários e permissões', href: '/usuarios' },
      { rotulo: 'Setores', href: '/configuracoes#setores' },
      { rotulo: 'Mensagens', href: '/_design#menu' },
    ],
  },
];

export function MenuExemplo() {
  return <Sidebar itens={ITENS} contadores={{ atendimento: 3, demandas: 12 }} whatsapp="ok" onNavegar={() => undefined} />;
}
