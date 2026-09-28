import { z } from 'zod';
import { normalizarTelefone, somenteDigitos, validarCnpj } from '@escritorio/core';

const caixa = z.preprocess((v) => v === 'on' || v === true, z.boolean());
const opcional = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.string().trim().optional());

export const ClienteForm = z.object({
  razao_social: z.string().trim().min(2, 'Informe a razão social'),
  nome_fantasia: opcional,
  cnpj: z.string().transform(somenteDigitos).refine(validarCnpj, 'CNPJ inválido'),
  inscricao_estadual: opcional,
  regime: opcional,
  endereco: opcional,
  uf: z.preprocess((v) => (v === '' ? undefined : v), z.string().length(2).toUpperCase().optional()),
});

export const ContatoForm = z.object({
  nome: z.string().trim().min(2, 'Informe o nome'),
  telefone: z.string().transform((t, ctx) => {
    const n = normalizarTelefone(t);
    if (!n) { ctx.addIssue({ code: 'custom', message: 'Telefone inválido' }); return z.NEVER; }
    return n;
  }),
  pode_pedir_nota: caixa.default(false),
  pode_atualizar_preco: caixa.default(false),
});
