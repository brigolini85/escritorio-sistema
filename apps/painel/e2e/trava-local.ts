import { criarClienteServico, type Db } from '@escritorio/db';

// Trava dos testes e2e: eles criam e apagam pessoas e mudam configurações. Num terminal com as variáveis da
// homologação isso iria para a nuvem (já se perdeu dado assim em 29/09). Só o Supabase local passa.
const HOSTS_LOCAIS = new Set(['127.0.0.1', 'localhost']);

/** Lança se o endereço não for do banco local (127.0.0.1 ou localhost). `nome` é a variável, para a mensagem. */
export function exigirBancoLocal(endereco: string | undefined, nome: string): void {
  let host: string | null = null;
  try {
    host = endereco ? new URL(endereco).hostname : null;
  } catch {
    host = null;
  }
  if (!host || !HOSTS_LOCAIS.has(host)) {
    throw new Error(
      `Testes e2e recusados: ${nome} aponta para "${host ?? endereco ?? '(vazio)'}", e eles só rodam no Supabase local ` +
        '(127.0.0.1 ou localhost). Abra um terminal sem as variáveis da homologação e confira o .env.',
    );
  }
}

/** Cliente de serviço para os testes, só depois de conferir que tudo aponta para o banco local. */
export function clienteServicoLocal(): Db {
  exigirBancoLocal(process.env.SUPABASE_URL, 'SUPABASE_URL');
  // O painel dos testes também usa DATABASE_URL (fila): se estiver definida, precisa ser local também.
  if (process.env.DATABASE_URL !== undefined) exigirBancoLocal(process.env.DATABASE_URL, 'DATABASE_URL');
  return criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
