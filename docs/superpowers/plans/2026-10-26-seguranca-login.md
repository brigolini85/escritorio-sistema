# Segurança do login e da sessão — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (execução nativa, sem subagentes). Passos com `- [ ]`.

**Goal:** Endurecer a porta de entrada do painel (login, sessão, links do e-mail, cabeçalhos, segundo fator) sem trocar Supabase Auth, RLS nem o middleware.

**Architecture:** Regras puras e testáveis em `apps/painel/src/lib/*` (rotas públicas, tipos de link, limites de sessão, ambiente, CSP); o middleware só as aplica. O banco ganha uma migração nova com um ajudante de segundo fator usado **só** nas funções sensíveis (nunca em `usuario_liberado`), e um gatilho que encerra as sessões de quem é arquivado.

**Tech Stack:** Next 15 (App Router, middleware), @supabase/ssr 0.12, supabase-js 2 (MFA TOTP), Postgres/pgTAP, Vitest, Playwright.

**Spec:** `C:\Users\Thiago\Desktop\ARQUITETURA-SEGURANCA\01-login-e-sessao.md` + itens 1–10 aprovados pelo dono (pedido de 07/10).

## Global Constraints

- Não reescrever o que funciona; não trocar Supabase Auth, RLS ou o middleware (só acrescentar).
- Migrações antigas intocadas; nova migração depois de `20261028000100`.
- `supabase/tests/22_regressao_visibilidade.test.sql` 100/100 e sem edição; testes de partes anteriores sem edição.
- Senha mínima: 10 caracteres (painel e `config.toml`).
- Sessão: no máximo 12 h; inatividade 1 h; mensagem "Sua sessão expirou. Entre de novo." em `/entrar?erro=sessao`.
- Segundo fator TOTP obrigatório para administrador e para quem tem `usuarios.ver_acessos_portais`.
- Chave de serviço só no servidor. Sem `undefined` em URLs.
- Commits em português, um por item, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Pessoa com segundo fator perde o celular: o dono precisa do SQL de recuperação (documentado) e nunca fica trancado sem aviso; o primeiro login do dono cai no cadastro do fator.
2. CSP quebrando a hidratação ou o tempo real (wss do Supabase): conferir com e2e de atendimento (tempo real) e login.
3. Token de teste sem a marca `aal` (pgTAP antigos): o ajudante só recusa quando a marca existe e é `aal1` — tokens reais do Supabase Auth sempre trazem `aal`.
4. Cookie de atividade apagado à mão: sem cookie, a atividade conta a partir do login (amr), então apagar o cookie não renova a sessão.
5. Link de recuperação de quem tem segundo fator: trocar a senha pode pedir aal2; o fluxo manda conferir o código e volta para definir a senha.

---

### Task 1: Rotas públicas por lista exata
**Files:** Create `apps/painel/src/lib/rotas-publicas.ts` (+ `.test.ts`); Modify `src/middleware.ts`.
- [ ] RED: `ehRotaPublica('/entrar-x')` e `'/entrarx'` → false; `'/entrar'`, `'/auth/confirm'`, `'/definir-senha'`, `'/esqueci-senha'` → true.
- [ ] GREEN: `Set` exato; middleware usa `ehRotaPublica`. Teste do middleware: `/entrar-x` sem sessão → `/entrar`.
- [ ] Commit `fix(painel): rotas públicas por lista exata`.

### Task 2: `/auth/confirm` só `invite` e `recovery`
**Files:** Create `src/lib/link-email.ts` (+ teste); Modify `app/auth/confirm/route.ts` (+ `route.test.ts`).
- [ ] RED: `type=email_change|signup|magiclink|x` → `/entrar?erro=link` sem chamar `verifyOtp`.
- [ ] GREEN: `tipoDoLink(bruto): 'invite'|'recovery'|null`. Modelos do repo só usam `invite` e `recovery` (conferido).
- [ ] Commit.

### Task 3: Senha mínima 10 também no Supabase
**Files:** Modify `supabase/config.toml` (`minimum_password_length = 10`); Create `src/lib/senha.ts` (+ teste); Create `src/config-supabase.test.ts` (lê o `config.toml` e confere os valores de auth).
- [ ] RED/GREEN; commit.

### Task 4: `redirectTo` pelo `PAINEL_URL` validado
**Files:** Create `src/lib/ambiente-servidor.ts` (`painelUrl()`), Modify `app/esqueci-senha/acoes.ts`, `app/(painel)/usuarios/acoes.ts`; testes com o cabeçalho `Origin` de outro site.
- [ ] RED: `pedirNovaSenha` com `Origin: https://malicioso.example` usa `http://painel.teste/auth/confirm`.
- [ ] GREEN; commit.

### Task 5: Variáveis validadas na partida
**Files:** `src/lib/ambiente-publico.ts` (URL e chave pública), `src/lib/ambiente-servidor.ts` (`server-only`: chave de serviço, `PAINEL_URL`, `validarAmbienteServidor`), `src/instrumentation.ts` (falha explícita na partida), clientes Supabase e middleware usam os leitores.
- [ ] RED: faltando cada variável → erro com o nome; `PAINEL_URL` sem http(s), com caminho, ou http fora de localhost em produção → erro.
- [ ] GREEN; commit.

### Task 6: Cabeçalhos de segurança
**Files:** `src/lib/cabecalhos-seguranca.ts` (+ teste), `next.config.ts` (`headers()`), middleware (CSP com nonce por pedido, `x-nonce`).
- CSP: `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'` (+`'unsafe-eval'` só em dev); `style-src 'self' 'unsafe-inline'` (documentado: Next/Radix usam style inline); `img-src 'self' data: blob: <supabase>`; `font-src 'self'` (next/font hospeda a Jakarta); `connect-src 'self' <supabase> <wss supabase>` (+ws do HMR em dev); `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`.
- Demais: `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, HSTS só em produção com `PAINEL_URL` https.
- [ ] RED/GREEN unit; e2e login + atendimento (tempo real); commit.

### Task 7: Limite de sessão (12 h) e inatividade (1 h)
**Files:** `src/lib/sessao-limites.ts` (+ teste): `momentoDoLogin(claims)` (menor `amr[].timestamp`), `assinarAtividade/lerAtividade` (HMAC-SHA256, chave derivada da chave de serviço, cookie `painel_atividade` httpOnly, sameSite lax, secure em produção, preso ao `session_id`), `avaliarSessao()`. Middleware: vencida → `signOut({scope:'local'})` e `/entrar?erro=sessao` (401 em /api). `config.toml` `[auth.sessions] timebox="12h"`, `inactivity_timeout="1h"`. Mensagem nova em `/entrar`.
- [ ] RED/GREEN; commit.

### Task 8: Segundo fator (TOTP) obrigatório
**Files:** migração `supabase/migrations/20261029000100_seguranca_segundo_fator.sql`: `exige_segundo_fator()` (bool, authenticated), `exigir_segundo_fator()` (recusa quando `aal` presente e ≠ `aal2` e a pessoa exige), aplicada em `revelar_acesso`, `salvar_acesso`, `remover_acesso`, `definir_ver_acessos`, `salvar_usuario`, `exigir_arquivar`. Teste novo `supabase/tests/98_seguranca_segundo_fator.test.sql`. `config.toml` `[auth.mfa.totp]` ligado. Painel: `/segundo-fator` (cadastro com QR + código; conferência do código), middleware manda para lá quem exige e está em aal1; e2e `apoio-mfa.ts` (TOTP em node:crypto) usado por `entrar()` e `sessaoDe()`.
- [ ] RED/GREEN pgTAP + unit + e2e; commit.

### Task 9: Arquivar encerra as sessões
**Files:** mesma migração ou `20261029000200_seguranca_arquivar_encerra_sessoes.sql`: gatilho `after update of ativo on usuarios` que apaga `auth.sessions` da pessoa quando `ativo` vira false. pgTAP novo + e2e (pessoa logada é arquivada e restaurada → precisa entrar de novo).
- [ ] RED/GREEN; commit.

### Task 10: Testes que faltavam
**Files:** e2e `seguranca-login.spec.ts`: horário muda com a pessoa logada; administrador fora do horário entra; `?erro=` desconhecido → genérico; arquivado chamando API → banco recusa; token inválido → recusado; sem cadastro → recusado; Voltar depois de Sair não mostra página protegida (`Cache-Control: no-store` nas páginas protegidas pelo middleware).
- [ ] RED/GREEN; commit.

### Fechamento
- [ ] `supabase db reset` + pgTAP completo; vitest + typecheck (painel, db, core); e2e em lotes; documento para o dono `01-login-e-sessao-CORRECOES.md`; limpeza.
