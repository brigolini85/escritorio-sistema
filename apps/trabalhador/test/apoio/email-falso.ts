import type { Email } from '../../src/email';

export class EmailFalso implements Email {
  enviados: { para: string; assunto: string; texto: string }[] = [];
  async enviar(para: string, assunto: string, texto: string) {
    this.enviados.push({ para, assunto, texto });
  }
}
