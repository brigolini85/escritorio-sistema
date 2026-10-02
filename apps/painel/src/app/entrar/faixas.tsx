/** Faixas vinho e champagne das telas públicas: laterais a partir de 900px, barras no topo abaixo disso. */
export function FaixasLogin() {
  return (
    <>
      <div aria-hidden className="login:hidden">
        <div className="h-2 bg-sidebar-active" />
        <div className="h-1 bg-champagne" />
      </div>
      <div aria-hidden className="fixed inset-y-0 left-0 hidden w-7 bg-sidebar-active login:block" />
      <div aria-hidden className="fixed inset-y-0 left-7 hidden w-2.5 bg-champagne login:block" />
    </>
  );
}

/** Classes dos campos sublinhados do login: a borda vinho de 2px é o foco visível. */
export const classeCampoSublinhado =
  'rounded-none border-0 border-b-2 border-grafite bg-transparent px-0 shadow-none focus-visible:border-brand focus-visible:outline-none';

/** Rótulo pequeno e espaçado dos campos do login (caixa alta e negrito vêm do Label). */
export const classeRotuloLogin = 'text-xs tracking-widest text-muted';
