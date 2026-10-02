export type PassoTrilha = { rotulo: string; href?: string };

type Secao = { prefixo: string; trilha: PassoTrilha[]; detalhe?: string };

// Tabela por prefixo da rota; o mais longo vence. Serve a trilha da barra do topo (ícone › Seção › Tela).
const SECOES: Secao[] = [
  { prefixo: '/inicio', trilha: [{ rotulo: 'Início' }] },
  { prefixo: '/atendimento', trilha: [{ rotulo: 'Atendimento' }], detalhe: 'Conversa' },
  { prefixo: '/demandas', trilha: [{ rotulo: 'Demandas' }] },
  { prefixo: '/clientes', trilha: [{ rotulo: 'Cadastros' }, { rotulo: 'Clientes' }], detalhe: 'Empresa' },
  // Rota fixa mais longa que /clientes/[id]: sem esta linha, /clientes/novo viraria "Empresa".
  { prefixo: '/clientes/novo', trilha: [{ rotulo: 'Cadastros' }, { rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Novo cliente' }] },
  { prefixo: '/contatos', trilha: [{ rotulo: 'Cadastros' }, { rotulo: 'Contatos' }] },
  { prefixo: '/assistente', trilha: [{ rotulo: 'Assistente' }] },
  { prefixo: '/treinar-agente', trilha: [{ rotulo: 'Treinar o agente' }] },
  { prefixo: '/configuracoes', trilha: [{ rotulo: 'Configurações' }] },
  { prefixo: '/usuarios', trilha: [{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões' }] },
  { prefixo: '/_design', trilha: [{ rotulo: 'Catálogo do design' }] },
].sort((a, b) => b.prefixo.length - a.prefixo.length);

export function trilhaDaRota(pathname: string): PassoTrilha[] {
  const secao = SECOES.find((s) => pathname === s.prefixo || pathname.startsWith(`${s.prefixo}/`));
  if (!secao) return [];
  const trilha = secao.trilha.map((p) => ({ ...p }));
  const temSubcaminho = pathname !== secao.prefixo;
  if (temSubcaminho && secao.detalhe) {
    const ultimo = trilha[trilha.length - 1]!;
    ultimo.href = secao.prefixo;
    trilha.push({ rotulo: secao.detalhe });
  }
  return trilha;
}
