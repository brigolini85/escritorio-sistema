import { LIMITES_RADAR, lerEnderecoFonte } from '@escritorio/core';

/** Regras puras das janelas do Radar. O banco confere tudo de novo; aqui só as frases ao lado dos campos. */

export function validarFonte(d: { nome: string; endereco: string }): string | null {
  const n = d.nome.trim().length;
  if (n < 2 || n > 60) return 'O nome da fonte tem de 2 a 60 letras.';
  const e = lerEnderecoFonte(d.endereco);
  return e.ok ? null : e.erro;
}

/** Uma página por linha; até 5 e cada uma com cara de endereço. */
export function validarPaginas(texto: string): { ok: true; paginas: string[] } | { ok: false; erro: string } {
  const paginas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  if (paginas.length > LIMITES_RADAR.paginasPorFonte) return { ok: false, erro: `No máximo ${LIMITES_RADAR.paginasPorFonte} páginas.` };
  for (const p of paginas) {
    const e = lerEnderecoFonte(p);
    if (!e.ok) return { ok: false, erro: `Página "${p}": ${e.erro}` };
  }
  return { ok: true, paginas };
}

export const DIAS = [
  { chave: 'dom', numero: 0, nome: 'Dom' }, { chave: 'seg', numero: 1, nome: 'Seg' }, { chave: 'ter', numero: 2, nome: 'Ter' },
  { chave: 'qua', numero: 3, nome: 'Qua' }, { chave: 'qui', numero: 4, nome: 'Qui' }, { chave: 'sex', numero: 5, nome: 'Sex' }, { chave: 'sab', numero: 6, nome: 'Sáb' },
] as const;
export type ChaveDia = (typeof DIAS)[number]['chave'];

export function diasMarcados(dias: number[]): Record<ChaveDia, boolean> {
  return Object.fromEntries(DIAS.map((d) => [d.chave, dias.includes(d.numero)])) as Record<ChaveDia, boolean>;
}
export const diasDosAtalhos = (atalho: 'todo' | 'uteis'): number[] => (atalho === 'todo' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]);

export function resumoEscolha(marcados: number, total: number): string {
  if (total === 1 && marcados === 1) return 'O único cliente';
  if (marcados === 0) return `Nenhum dos ${total} clientes`;
  return marcados === total ? `Todos os ${total} clientes` : `${marcados} de ${total} clientes`;
}

export function contatosDaEscolha(linhas: { id: string; contatos: number }[], marcados: Iterable<string>): number {
  const ids = new Set(marcados);
  return linhas.reduce((s, l) => s + (ids.has(l.id) ? l.contatos : 0), 0);
}

export function podeAprovar(d: { texto: string; clientes: number; contatos: number }): string | null {
  const t = d.texto.trim();
  if (!t) return 'Escreva a mensagem.';
  if (t.length > LIMITES_RADAR.mensagemCliente) return 'A mensagem tem no máximo 1.000 letras.';
  if (d.clientes === 0) return 'Escolha ao menos um cliente.';
  if (d.clientes > LIMITES_RADAR.clientesPorEnvio) return `Até ${LIMITES_RADAR.clientesPorEnvio} clientes por envio.`;
  if (d.contatos === 0) return 'Nenhum contato dos clientes escolhidos pode ser procurado.';
  if (d.contatos > LIMITES_RADAR.contatosPorEnvio) return `Até ${LIMITES_RADAR.contatosPorEnvio} contatos por envio.`;
  return null;
}

/** D11: aprova quem é do setor, o administrador e o dono. */
export const podeDecidir = (d: { dono: boolean; admin: boolean; meusSetores: string[]; setorId: string }): boolean =>
  d.dono || d.admin || d.meusSetores.includes(d.setorId);

export function limparAssuntos(lista: string[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const a of lista.map((x) => x.trim()).filter(Boolean)) {
    const k = a.toLowerCase();
    if (!vistos.has(k)) { vistos.add(k); saida.push(a); }
  }
  return saida;
}
export function validarAssuntos(lista: string[]): string | null {
  if (lista.length > 20) return 'No máximo 20 assuntos.';
  if (lista.some((a) => a.length < 2 || a.length > 60)) return 'Cada assunto tem de 2 a 60 letras.';
  return null;
}

const ERRO_LIMITE = 'O limite vai de US$ 0,05 a US$ 5,00.';
export function validarLimite(texto: string): { ok: true; valor: number } | { ok: false; erro: string } {
  const v = Number(texto.trim().replace(',', '.'));
  if (!texto.trim() || !Number.isFinite(v) || v < 0.05 || v > 5) return { ok: false, erro: ERRO_LIMITE };
  return { ok: true, valor: Math.round(v * 100) / 100 };
}

export const validarEtiqueta = (e: string): string | null => (/^[A-Za-z]{2,4}$/.test(e.trim()) ? null : 'A etiqueta tem de 2 a 4 letras (FED, MG, MUN).');

export const NOTA_LIMITE_ENVIO = 'As mensagens saem aos poucos: no máximo 3 por contato e 30 no escritório por dia; o que não couber espera até 3 dias.';
export const textoAprovado = (contatos: number): string =>
  `Aprovado: ${contatos} ${contatos === 1 ? 'contato recebe' : 'contatos recebem'} pelo WhatsApp do escritório, na voz do Thiago.`;
