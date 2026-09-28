import nodemailer from 'nodemailer';

export interface Email {
  enviar(para: string, assunto: string, texto: string): Promise<void>;
}

export function criarEmail(cfg: { host: string; porta: number; usuario: string; senha: string; remetente: string }): Email {
  const transporte = nodemailer.createTransport({
    host: cfg.host, port: cfg.porta, secure: cfg.porta === 465, auth: { user: cfg.usuario, pass: cfg.senha },
  });
  return {
    async enviar(para, assunto, texto) {
      await transporte.sendMail({ from: cfg.remetente, to: para, subject: assunto, text: texto });
    },
  };
}
