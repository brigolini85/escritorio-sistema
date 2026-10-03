// "Por que o agente fez isso?": as decisões registradas pelo agente (decisoes_agente) em texto legível.

/** Ferramentas do agente (apps/trabalhador/src/agente/ferramentas.ts) em português de gente. */
const ETAPAS: Record<string, string> = {
  selecionar_empresa: 'Escolheu a empresa',
  abrir_chamado: 'Abriu uma demanda',
  consultar_chamados: 'Consultou as demandas',
  sinalizar_nao_entendido: 'Não entendeu a mensagem',
  passar_para_pessoa: 'Passou para uma pessoa',
  buscar_parceiros: 'Buscou clientes e fornecedores',
  buscar_produtos: 'Buscou produtos',
  resumir_pedido_nota: 'Resumiu o pedido de nota',
  abrir_pedido_nota: 'Abriu o pedido de nota',
  listar_documentos: 'Listou documentos',
  enviar_documento: 'Enviou um documento',
  consultar_cadastro: 'Consultou o cadastro',
  consultar_preco: 'Consultou um preço',
  alterar_preco: 'Alterou um preço',
  cadastrar_produto: 'Cadastrou um produto',
  responder: 'Respondeu ao cliente',
  orientacoes_cortadas: 'Orientações cortadas',
};

/** snake_case → "Snake case". */
function humanizar(chave: string): string {
  const t = chave.replace(/[_:]+/g, ' ').trim();
  return t ? t[0]!.toUpperCase() + t.slice(1) : chave;
}

export function rotuloEtapa(etapa: string): string {
  return ETAPAS[etapa] ?? humanizar(etapa);
}

export type CampoLegivel = { chave: string; valor: string; /** texto longo ou estrutura: mostrar em bloco */ bloco: boolean };

const LIMITE_LINHA = 80;

function valorEmTexto(v: unknown): { valor: string; bloco: boolean } {
  if (v === null || v === undefined || v === '') return { valor: '—', bloco: false };
  if (typeof v === 'boolean') return { valor: v ? 'sim' : 'não', bloco: false };
  if (typeof v === 'number') return { valor: String(v).replace('.', ','), bloco: false };
  if (typeof v === 'string') return { valor: v, bloco: v.length > LIMITE_LINHA || v.includes('\n') };
  if (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')) {
    const t = v.join(', ');
    return { valor: t || '—', bloco: t.length > LIMITE_LINHA };
  }
  return { valor: JSON.stringify(v, null, 2), bloco: true };
}

/** Um objeto (entrada ou saída da ferramenta) vira linhas "Chave: valor"; outro valor vira uma linha só. */
export function camposLegiveis(valor: unknown): CampoLegivel[] {
  if (valor === null || valor === undefined) return [];
  if (typeof valor !== 'object' || Array.isArray(valor)) return [{ chave: 'Valor', ...valorEmTexto(valor) }];
  return Object.entries(valor as Record<string, unknown>).map(([k, v]) => ({ chave: humanizar(k), ...valorEmTexto(v) }));
}
