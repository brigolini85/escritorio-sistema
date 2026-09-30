'use client';

import type { ComponentProps } from 'react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';

/*
 * Conferências no navegador para os casos comuns que o servidor recusaria com a tela de erro (as ações de
 * Configurações não devolvem ?erro=). A regra de verdade continua no servidor; aqui só se avisa antes.
 */

const Email = z.string().email();

/** E-mail opcional com a mesma regra do esquema (o type=email do navegador aceita "a@b", o servidor não). */
export function CampoEmail(props: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <Input
      type="email"
      {...props}
      onInput={(e) => {
        const el = e.currentTarget;
        const v = el.value.trim();
        el.setCustomValidity(v && !Email.safeParse(v).success ? 'Confira o e-mail: falta o domínio completo (ex.: nome@escritorio.com.br).' : '');
      }}
    />
  );
}

/**
 * Nome que o banco exige único (setor, serviço): avisa quando já existe outro com o mesmo nome na lista carregada.
 * `outros`: os nomes dos demais (sem o do próprio item). `mensagem`: ex. "Já existe um setor com este nome."
 */
export function CampoNomeUnico({ outros, mensagem, ...props }: ComponentProps<'input'> & { outros: string[]; mensagem: string }) {
  return (
    <Input
      {...props}
      onInput={(e) => {
        const el = e.currentTarget;
        el.setCustomValidity(outros.includes(el.value.trim()) ? mensagem : '');
      }}
    />
  );
}
