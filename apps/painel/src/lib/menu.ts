export function itensDoMenu(papel: 'admin' | 'atendente'): { rotulo: string; href: string }[] {
  const itens = [
    { rotulo: 'Início', href: '/inicio' },
    { rotulo: 'Atendimento', href: '/atendimento' },
    { rotulo: 'Demandas', href: '/demandas' },
    { rotulo: 'Clientes', href: '/clientes' },
    { rotulo: 'Contatos', href: '/contatos' },
  ];
  return papel === 'admin' ? [...itens, { rotulo: 'Configurações', href: '/configuracoes' }] : itens;
}
