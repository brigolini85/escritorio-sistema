import { CircleAlert, CircleCheck } from 'lucide-react';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { HealthSignal } from '@/components/patterns/health-signal';
import { CardContent } from '@/components/ui/card';
import { TEXTO_DRIVE_ERRO_LEITURA, TEXTO_DRIVE_SEM_I3B, TEXTO_GUARDA_ERRO_LEITURA, TEXTO_GUARDA_SEM_I3B, avisoDoDrive, type SituacaoDrive } from '@/lib/drive-tela';
import { LIMITES_BATIMENTO } from '@/lib/inicio';
import { Cartao } from '../cartao';
import { GuardaTarefas } from './guarda-tarefas';

/** Último sinal de cada serviço (só o administrador, D20). Recarrega a cada minuto com a aba visível, só enquanto esta seção está aberta. */
export function SecaoIntegracoes({ sinal, drive, guarda, dono }: {
  sinal: (componente: string) => string | null;
  drive: { semI3b: boolean; erro: boolean; situacao: SituacaoDrive | null };
  guarda: { semI3b: boolean; erro: boolean; dias: number | null };
  dono: boolean;
}) {
  const aviso = avisoDoDrive(drive.situacao);
  return (
    <>
      <RecarregarPeriodico />
      <Cartao id="integracoes" titulo="Integrações" descricao="Último sinal de cada serviço. Sem sinal há mais de 5 minutos, algo parou.">
        <CardContent className="flex flex-col gap-2">
          <HealthSignal rotulo="WhatsApp (Z-API)" ultimoSinal={sinal('whatsapp')} limites={LIMITES_BATIMENTO} />
          {!sinal('whatsapp') && <p className="text-sm text-muted">Sem sinal do WhatsApp: verifique a Z-API.</p>}
          <HealthSignal rotulo="Trabalhador e fila de tarefas" ultimoSinal={sinal('fila')} limites={LIMITES_BATIMENTO} />
          {drive.erro ? <p role="alert" className="text-sm text-warning">{TEXTO_DRIVE_ERRO_LEITURA}</p> : drive.semI3b ? <p className="text-sm text-muted">{TEXTO_DRIVE_SEM_I3B}</p> : (
            <div className="flex items-start gap-2 text-sm">
              {aviso.tom === 'success'
                ? <CircleCheck aria-hidden size={16} className="mt-0.5 shrink-0 text-success" />
                : <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0 text-warning" />}
              <span><b>Google Drive (só leitura).</b> {aviso.texto}</span>
            </div>
          )}
        </CardContent>
      </Cartao>
      <Cartao id="guarda-tarefas" titulo="Guarda dos arquivos das tarefas"
        descricao="Arquivos enviados às tarefas e copiados do Drive. Anexos das conversas seguem a regra das conversas (1 ano).">
        {guarda.erro
          ? <CardContent><p role="alert" className="text-sm text-warning">{TEXTO_GUARDA_ERRO_LEITURA}</p></CardContent>
          : guarda.semI3b
          ? <CardContent><p className="text-sm text-muted">{TEXTO_GUARDA_SEM_I3B}</p></CardContent>
          : <GuardaTarefas key={String(guarda.dias)} dias={guarda.dias} dono={dono} />}
      </Cartao>
    </>
  );
}
