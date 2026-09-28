-- Fiscal passa a cuidar também de certificado digital e da conta gov.br (decisão do dono, 2026-09-28).
-- Só troca o texto se ainda for o original: uma edição feita pelo painel é preservada.
update public.setores
set descricao_assuntos = 'Notas fiscais (emitir, repetir, corrigir ou cancelar), guias de impostos (DAS, DARF, ICMS, ISS), apurações, SPED, certidões negativas, certificado digital (renovação) e acesso ou senha da conta gov.br'
where nome = 'Fiscal'
  and descricao_assuntos = 'Notas fiscais, guias de impostos (DAS, DARF, ICMS, ISS), apurações, SPED, certidões negativas';
