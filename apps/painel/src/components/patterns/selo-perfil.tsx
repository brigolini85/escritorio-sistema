import { ROTULO_PERFIL, type Perfil } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';

/** Perfil de acesso do contato numa empresa (D27): Sócio em grafite, Básico em âmbar, Personalizado contornado, os outros em azul. */
export function SeloPerfil({ perfil }: { perfil: Perfil }) {
  if (perfil === 'basico') return <Badge variant="warning">Básico · definir</Badge>;
  if (perfil === 'personalizado') return <Badge variant="outline">Personalizado</Badge>;
  if (perfil === 'socio') return <Badge className="bg-foreground text-surface">Sócio</Badge>;
  return <Badge variant="info">{ROTULO_PERFIL[perfil]}</Badge>;
}
