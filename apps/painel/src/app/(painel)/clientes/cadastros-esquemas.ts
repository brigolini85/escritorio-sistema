import { z } from 'zod';
import { somenteDigitos, validarCnpj } from '@escritorio/core';

/** Palavras-chave e apelidos são digitados separados por vírgula. */
export function listaDeTexto(v: unknown): string[] {
  return String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

const lista = z.preprocess(listaDeTexto, z.array(z.string()));
const caixa = z.preprocess((v) => v === 'on' || v === true, z.boolean());
const opcional = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : String(v).trim()), z.string().nullable());

export const GrupoForm = z.object({
  nome: z.string().trim().min(2, 'Informe o nome'),
  palavras_chave: lista,
  ativo: caixa,
});

export const UnidadeForm = z.object({
  nome_unidade: z.string().trim().min(1, 'Informe o nome da unidade'),
  razao_social: opcional,
  cnpj: z.preprocess((v) => (v ? somenteDigitos(String(v)) : null),
    z.string().nullable().refine((c) => c === null || validarCnpj(c), 'CNPJ inválido')),
  inscricao_estadual: opcional,
  endereco: opcional,
  bairro: opcional,
  cidade: opcional,
  uf: z.preprocess((v) => (v ? String(v).trim().toUpperCase() : null), z.string().length(2).nullable()),
  palavras_chave: lista,
  ativo: caixa,
});

export const ProdutoForm = z.object({
  codigo: z.string().trim().min(1, 'Informe o código'),
  descricao: z.string().trim().min(2, 'Informe a descrição'),
  unidade: z.preprocess((v) => String(v ?? 'UN').trim().toUpperCase() || 'UN', z.string().max(10)),
  apelidos: lista,
  ativo: caixa,
});

export const PrecoForm = z.object({
  valor: z.preprocess((v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')), z.number().positive('Informe um valor maior que zero')),
});
