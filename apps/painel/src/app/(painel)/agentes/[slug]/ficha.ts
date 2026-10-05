/** Abas da ficha (spec 7E.3), cada uma uma rota (D20): o menu recolhido e os parâmetros de cada aba dependem do caminho. */
export const ABAS_AGENTE = [
  { segmento: '', rotulo: 'Visão geral' }, { segmento: 'skills', rotulo: 'Skills' }, { segmento: 'ferramentas', rotulo: 'Ferramentas' },
  { segmento: 'como-fala', rotulo: 'Como fala com o cliente' }, { segmento: 'orientacoes', rotulo: 'Orientações' },
  { segmento: 'testar', rotulo: 'Testar' }, { segmento: 'atividade', rotulo: 'Atividade e custo' },
] as const;

export const hrefAba = (slug: string, segmento: string) => `/agentes/${slug}${segmento ? `/${segmento}` : ''}`;

export function abaAtual(pathname: string, slug: string): string {
  const resto = pathname.slice(`/agentes/${slug}`.length).replace(/^\//, '').split('/')[0] ?? '';
  return ABAS_AGENTE.some((a) => a.segmento === resto) ? resto : '';
}
