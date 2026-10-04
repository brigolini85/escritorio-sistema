import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, db, repos } from '../apoio/cenario';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

// Parte H1 (spec 7D.1): "O agente continua lendo só o que já lê (consultar_cadastro); honorários, contrato e acessos
// não entram nas ferramentas do agente". O assistente usa o mesmo repos.dadosDaEmpresa.
const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
const FORA_DO_AGENTE = ['1234.56', 'financeiro@padariasol.com.br', '2022-03-01', '2031-10-25', 'e_cnpj_a1', 'IM-998877', '1091-1/01'];
let canal: CanalFalso;
let estado: EstadoExecucao;

const d = () => ({ repos, ia: new IaRoteirizada([]), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const usar = async (nome: string, entrada: object) => JSON.parse((await executarFerramenta(d(), estado, nome, entrada)).resultado);

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : p.endsWith('.ts') ? [p] : [];
  });
}

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  const { empresas, conversa } = await contatoComEmpresas(['Padaria Sol']);
  const { error } = await db.from('clientes').update({
    honorario_mensal: 1234.56, contrato_inicio: '2022-03-01', email_cobranca: 'financeiro@padariasol.com.br',
    certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2031-10-25', inscricao_municipal: 'IM-998877',
    cnae_principal: '1091-1/01 · Fabricação de produtos de panificação',
    cep: '36404450', logradouro: 'Rua Rosa Figueiredo', numero: '430', complemento: 'loja 2', bairro: 'São Marcos',
    cidade: 'Conselheiro Lafaiete', uf: 'MG',
  }).eq('id', empresas[0]!.id);
  expect(error).toBeNull();
  const contato = await repos.buscarContato(conversa.telefone);
  estado = { ctx: await carregarContexto(repos, conversa, contato, await repos.obterConfiguracoes(), SEGUNDA_10H), respondeu: false };
});

describe('ficha nova do cliente fora do agente', () => {
  it('consultar_cadastro devolve as mesmas 7 informações de antes, com o endereço por extenso', async () => {
    const r = await usar('consultar_cadastro', {});
    expect(Object.keys(r.empresa).sort()).toEqual(['cnpj', 'endereco', 'inscricao_estadual', 'nome_fantasia', 'razao_social', 'regime', 'uf']);
    expect(r.empresa.endereco).toBe('Rua Rosa Figueiredo, 430, loja 2 - São Marcos, Conselheiro Lafaiete/MG, CEP 36404-450');
    const texto = JSON.stringify(r);
    for (const x of FORA_DO_AGENTE) expect(texto).not.toContain(x);
  });

  it('o contexto do agente não carrega contrato, honorários, certificado nem cobrança', () => {
    const texto = JSON.stringify(estado.ctx);
    for (const x of FORA_DO_AGENTE) expect(texto).not.toContain(x);
  });

  it('nenhum código do trabalhador nem dos repositórios toca acessos de portais, contrato ou honorários', () => {
    const arquivos = [
      ...listar(fileURLToPath(new URL('../../src', import.meta.url))),
      fileURLToPath(new URL('../../../../packages/db/src/repos.ts', import.meta.url)),
    ];
    const proibido = /cliente_acessos|senha_cifrada|revelar_acesso|ACESSOS_PORTAIS_CHAVE|honorario_mensal|contrato_inicio|email_cobranca/;
    expect(arquivos.filter((f) => proibido.test(readFileSync(f, 'utf8')))).toEqual([]);
  });

  // Revisão da Task 2 (minor adiado para a Task 4): nem portal e usuário dos acessos chegam ao trabalhador. Nenhum código do
  // trabalhador nem dos pacotes compartilhados (packages/db e packages/core) cita a tabela ou as funções dos acessos.
  // tipos.gen.ts fica de fora: é gerado do catálogo e só descreve tipos, não lê nada.
  it('nenhum código do trabalhador nem dos pacotes lê cliente_acessos, nem portal e usuário', () => {
    const raiz = (p: string) => fileURLToPath(new URL(p, import.meta.url));
    const arquivos = [
      ...listar(raiz('../../src')),
      ...listar(raiz('../../../../packages/db/src')).filter((f) => !f.endsWith('tipos.gen.ts')),
      ...listar(raiz('../../../../packages/core/src')),
    ];
    expect(arquivos.length).toBeGreaterThan(10);
    expect(arquivos.some((f) => f.endsWith('repos.ts'))).toBe(true);
    const acessos = /cliente_acessos|salvar_acesso|remover_acesso|revelar_acesso|pode_ver_acessos|ver_acessos_portais/;
    expect(arquivos.filter((f) => acessos.test(readFileSync(f, 'utf8')))).toEqual([]);
  });
});
