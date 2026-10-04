// Servidor falso das buscas públicas para os e2e (D32): o playwright.config.ts aponta CONSULTA_CNPJ_URL e CONSULTA_CEP_URL
// para cá. Nenhum teste chama BrasilAPI nem ViaCEP de verdade.
import { createServer } from 'node:http';

const PORTA = Number(process.env.CONSULTAS_FALSAS_PORTA ?? 3199);
const CNPJS = {
  '12345678000195': {
    razao_social: 'PADARIA SOL COMERCIO DE ALIMENTOS ME', nome_fantasia: 'PADARIA SOL', cnae_fiscal: 1091101,
    cnae_fiscal_descricao: 'Fabricação de produtos de panificação', cep: '36404450', descricao_tipo_de_logradouro: 'RUA',
    logradouro: 'ROSA FIGUEIREDO', numero: '430', complemento: '', bairro: 'SÃO MARCOS', municipio: 'CONSELHEIRO LAFAIETE', uf: 'MG',
  },
};
const CEPS = {
  '36404450': { cep: '36404-450', logradouro: 'Rua Rosa Figueiredo', complemento: '', bairro: 'São Marcos', localidade: 'Conselheiro Lafaiete', uf: 'MG' },
};
const json = (res, status, corpo) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(corpo));
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORTA}`);
  if (url.pathname === '/saude') return json(res, 200, { ok: true });
  const cnpj = url.pathname.match(/^\/api\/cnpj\/v1\/(\d{14})$/)?.[1];
  if (cnpj) {
    if (cnpj === '55566677000183') return json(res, 500, { message: 'fora do ar' });
    return CNPJS[cnpj] ? json(res, 200, CNPJS[cnpj]) : json(res, 404, { message: 'CNPJ não encontrado' });
  }
  const cep = url.pathname.match(/^\/ws\/(\d{8})\/json\/$/)?.[1];
  if (cep) {
    // CEP lento: passa do limite de 4 s do painel (a tela pede o preenchimento à mão).
    if (cep === '11111111') return void setTimeout(() => json(res, 200, CEPS['36404450']), 6000);
    return CEPS[cep] ? json(res, 200, CEPS[cep]) : json(res, 200, { erro: 'true' });
  }
  return json(res, 404, {});
}).listen(PORTA, '127.0.0.1', () => console.log(`[consultas falsas] ouvindo em ${PORTA}`));
