/** Itens do menu lateral. Assistente depende da marcação da pessoa; Usuários e Configurações são do administrador. */
export function itensDoMenu(u: { papel: 'admin' | 'atendente'; permissoes: string[] }): { rotulo: string; href: string }[] {
  const itens = [
    { rotulo: 'Início', href: '/inicio' },
    { rotulo: 'Atendimento', href: '/atendimento' },
    { rotulo: 'Demandas', href: '/demandas' },
    { rotulo: 'Clientes', href: '/clientes' },
    { rotulo: 'Contatos', href: '/contatos' },
  ];
  if (u.permissoes.includes('assistente_site')) itens.push({ rotulo: 'Assistente', href: '/assistente' });
  if (u.papel === 'admin') itens.push({ rotulo: 'Usuários', href: '/usuarios' }, { rotulo: 'Configurações', href: '/configuracoes' });
  return itens;
}
