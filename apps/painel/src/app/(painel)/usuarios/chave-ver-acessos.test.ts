import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// O painel não tem testes de componente: a guarda lê o código da chave (D4) e confere o tratamento da falha.
const codigo = readFileSync(new URL('./chave-ver-acessos.tsx', import.meta.url), 'utf8');

describe('chave "Ver acessos de portais": falha da ação vira aviso fixo', () => {
  it('a chamada fica num try/catch que devolve o redirect do Next e mostra o aviso fixo', () => {
    expect(codigo).toMatch(/try\s*\{\s*r = await definirVerAcessos\(id, v\);\s*\}\s*catch \(err\) \{\s*unstable_rethrow\(err\);\s*toast\.error\('Não consegui gravar agora\. Tente de novo\.'\);/);
  });

  it('o erro capturado nunca entra no texto', () => {
    const bloco = codigo.slice(codigo.indexOf('catch (err)') + 'catch (err)'.length,codigo.indexOf('return;', codigo.indexOf('catch (err)')));
    expect(bloco.replace('unstable_rethrow(err)', '')).not.toMatch(/\berr\b/);
  });
});
