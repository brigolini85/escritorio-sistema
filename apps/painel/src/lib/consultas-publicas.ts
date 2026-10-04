import 'server-only';

/**
 * Busca pública pelo servidor do painel (spec 7D.1): BrasilAPI para CNPJ, ViaCEP para CEP. Só o número sai daqui;
 * demora (4 s) ou falha vira um motivo para a tela pedir o preenchimento à mão, sem travar nada (D15).
 */
export const LIMITE_BUSCA_MS = 4000;

export type DadosCnpj = {
  razao_social: string | null; nome_fantasia: string | null; cnae_principal: string | null; cep: string | null;
  logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null;
};
export type DadosCep = { logradouro: string | null; bairro: string | null; cidade: string | null; uf: string | null };
export type ResultadoBusca<T> = { ok: true; dados: T } | { ok: false; motivo: 'nao_encontrado' | 'indisponivel' };

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null);
const PEQUENAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** "RUA DAS FLORES" → "Rua das Flores" (endereço da Receita vem todo em maiúsculas). */
export function capitalizar(t: string | null | undefined): string | null {
  const s = texto(t);
  if (!s) return null;
  return s.toLowerCase().split(' ')
    .map((p, i) => (i > 0 && PEQUENAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/** 1091101 → "1091-1/01 · <descrição>". */
export function formatarCnae(codigo: unknown, descricao: unknown): string | null {
  const d = String(codigo ?? '').replace(/\D/g, '');
  if (d.length !== 7) return null;
  const desc = texto(descricao);
  return `${d.slice(0, 4)}-${d[4]}/${d.slice(5)}${desc ? ` · ${desc}` : ''}`;
}

async function pegar(url: string, buscar: typeof fetch): Promise<{ status: number; corpo: unknown } | null> {
  try {
    // redirect 'error': a busca nunca segue para outro endereço (o servidor do painel não vira ponte para a rede interna).
    const r = await buscar(url, {
      signal: AbortSignal.timeout(LIMITE_BUSCA_MS), cache: 'no-store', redirect: 'error', headers: { accept: 'application/json' },
    });
    return { status: r.status, corpo: r.ok ? await r.json() : null };
  } catch {
    // Tempo esgotado, rede fora ou resposta que não é JSON: a tela pede o preenchimento à mão.
    return null;
  }
}

export async function consultarCnpj(cnpj: string, buscar: typeof fetch = fetch): Promise<ResultadoBusca<DadosCnpj>> {
  const numero = cnpj.replace(/\D/g, '');
  if (numero.length !== 14) return { ok: false, motivo: 'nao_encontrado' };
  const base = process.env.CONSULTA_CNPJ_URL || 'https://brasilapi.com.br/api/cnpj/v1';
  const r = await pegar(`${base}/${numero}`, buscar);
  if (!r) return { ok: false, motivo: 'indisponivel' };
  if (r.status === 400 || r.status === 404) return { ok: false, motivo: 'nao_encontrado' };
  if (r.status !== 200 || !r.corpo || typeof r.corpo !== 'object') return { ok: false, motivo: 'indisponivel' };
  const c = r.corpo as Record<string, unknown>;
  const tipo = texto(c.descricao_tipo_de_logradouro);
  const rua = texto(c.logradouro);
  const logradouro = rua && tipo && !rua.toUpperCase().startsWith(tipo.toUpperCase()) ? `${tipo} ${rua}` : rua;
  const cep = String(c.cep ?? '').replace(/\D/g, '');
  return {
    ok: true,
    dados: {
      razao_social: texto(c.razao_social), nome_fantasia: texto(c.nome_fantasia),
      cnae_principal: formatarCnae(c.cnae_fiscal, c.cnae_fiscal_descricao),
      cep: cep.length === 8 ? cep : null, logradouro: capitalizar(logradouro), numero: texto(c.numero),
      complemento: capitalizar(texto(c.complemento)), bairro: capitalizar(texto(c.bairro)), cidade: capitalizar(texto(c.municipio)),
      uf: texto(c.uf)?.toUpperCase() ?? null,
    },
  };
}

export async function consultarCep(cep: string, buscar: typeof fetch = fetch): Promise<ResultadoBusca<DadosCep>> {
  const numero = cep.replace(/\D/g, '');
  if (numero.length !== 8) return { ok: false, motivo: 'nao_encontrado' };
  const base = process.env.CONSULTA_CEP_URL || 'https://viacep.com.br/ws';
  const r = await pegar(`${base}/${numero}/json/`, buscar);
  if (!r) return { ok: false, motivo: 'indisponivel' };
  if (r.status === 400 || r.status === 404) return { ok: false, motivo: 'nao_encontrado' };
  if (r.status !== 200 || !r.corpo || typeof r.corpo !== 'object') return { ok: false, motivo: 'indisponivel' };
  const c = r.corpo as Record<string, unknown>;
  if (c.erro === true || c.erro === 'true') return { ok: false, motivo: 'nao_encontrado' };
  return { ok: true, dados: { logradouro: texto(c.logradouro), bairro: texto(c.bairro), cidade: texto(c.localidade), uf: texto(c.uf)?.toUpperCase() ?? null } };
}
