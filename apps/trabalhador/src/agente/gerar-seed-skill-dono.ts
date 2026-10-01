// Regrava supabase/dados/orientacoes-skill-dono.sql a partir de orientacoes-skill-dono.ts (fonte única).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sqlOrientacoesSkillDono } from './orientacoes-skill-dono';

const destino = fileURLToPath(new URL('../../../../supabase/dados/orientacoes-skill-dono.sql', import.meta.url));
writeFileSync(destino, sqlOrientacoesSkillDono());
console.log(`gravado ${destino}`);
