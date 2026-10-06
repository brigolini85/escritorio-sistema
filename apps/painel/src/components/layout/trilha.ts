import { rotuloDaSecao } from '@/lib/configuracoes';

export type PassoTrilha = { rotulo: string; href?: string };

type Secao = { prefixo: string; trilha: PassoTrilha[]; detalhe?: string };

// Tabela por prefixo da rota; o mais longo vence. Serve a trilha da barra do topo (ícone › Seção › Tela).
const SECOES: Secao[] = [
  { prefixo: '/inicio', trilha: [{ rotulo: 'Início' }] },
  { prefixo: '/atendimento', trilha: [{ rotulo: 'Atendimento' }], detalhe: 'Conversa' },
  { prefixo: '/demandas', trilha: [{ rotulo: 'Gestão das demandas' }] },
  { prefixo: '/clientes', trilha: [{ rotulo: 'Cadastros' }, { rotulo: 'Clientes' }], detalhe: 'Empresa' },
  // Rota fixa mais longa que /clientes/[id]: sem esta linha, /clientes/novo viraria "Empresa".
  { prefixo: '/clientes/novo', trilha: [{ rotulo: 'Cadastros' }, { rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Novo cliente' }] },
  { prefixo: '/contatos', trilha: [{ rotulo: 'Cadastros' }, { rotulo: 'Contatos' }] },
  { prefixo: '/assistente', trilha: [{ rotulo: 'Assistente' }] },
  { prefixo: '/tarefas', trilha: [{ rotulo: 'Gestão das demandas', href: '/demandas' }, { rotulo: 'Tarefa do agente' }] },
  { prefixo: '/agentes', trilha: [{ rotulo: 'Administração' }, { rotulo: 'Agentes' }], detalhe: 'Agente' },
  { prefixo: '/treinar-agente', trilha: [{ rotulo: 'Treinar o agente' }] },
  { prefixo: '/gastos-ia', trilha: [{ rotulo: 'Administração' }, { rotulo: 'Gastos com IA' }] },
  { prefixo: '/usuarios', trilha: [{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões' }], detalhe: 'Pessoa' },
  // Rota fixa mais longa que /usuarios/[id]: sem esta linha, /usuarios/novo viraria "Pessoa".
  { prefixo: '/usuarios/novo', trilha: [{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões', href: '/usuarios' }, { rotulo: 'Nova pessoa' }] },
  { prefixo: '/_design', trilha: [{ rotulo: 'Catálogo do design' }] },
].sort((a, b) => b.prefixo.length - a.prefixo.length);

export function trilhaDaRota(pathname: string, secao?: string | null): PassoTrilha[] {
  // Configurações: uma seção por vez (?secao=, Parte G1); sem secao, a página abre no Expediente.
  if (pathname === '/configuracoes') {
    return [{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: rotuloDaSecao(secao ?? 'expediente') ?? 'Expediente' }];
  }
  const rota = SECOES.find((s) => pathname === s.prefixo || pathname.startsWith(`${s.prefixo}/`));
  if (!rota) return [];
  const trilha = rota.trilha.map((p) => ({ ...p }));
  const temSubcaminho = pathname !== rota.prefixo;
  if (temSubcaminho && rota.detalhe) {
    const ultimo = trilha[trilha.length - 1]!;
    ultimo.href = rota.prefixo;
    trilha.push({ rotulo: rota.detalhe });
  }
  return trilha;
}
