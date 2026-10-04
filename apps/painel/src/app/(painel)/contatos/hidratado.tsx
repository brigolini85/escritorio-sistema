'use client';

import { useEffect, useState } from 'react';

/** Marca que o navegador assumiu a página (os e2e esperam por ela antes de digitar ou clicar). */
export function Hidratado() {
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return <span hidden data-contatos-hidratado={pronto ? '' : undefined} />;
}
