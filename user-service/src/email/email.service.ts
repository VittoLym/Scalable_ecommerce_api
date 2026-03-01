// user-service/src/modules/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendVerificationEmail(email: string, token: string, name?: string) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationLink = `${frontendUrl}/verify-email?token=${token}`;
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Verifica tu email - Bienvenido a nuestra plataforma',
        template: './verification',
        context: {
          name: name || 'user',
          verificationLink,
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Email de verificación enviado a: ${email}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error enviando email a ${email}:`, error);
      throw new Error('No se pudo enviar el email de verificación');
    }
  }

  async sendPasswordResetEmail(email: string, token: string, name?: string) {
    const resetLink = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Restablece tu contraseña',
        template: './reset-password',
        context: {
          name: name || 'usuario',
          resetLink,
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Email de reset enviado a: ${email}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error enviando reset password a ${email}:`, error);
      throw new Error('No se pudo enviar el email de restablecimiento');
    }
  }

  async sendWelcomeEmail(email: string, name?: string) {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: '¡Bienvenido a nuestra plataforma!',
        template: './welcome', // Podrías crear otro template
        context: {
          name: name || 'usuario',
          loginLink: `${this.configService.get('FRONTEND_URL')}/login`,
          year: new Date().getFullYear(),
        },
      });

      this.logger.log(`Email de bienvenida enviado a: ${email}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error enviando welcome email a ${email}:`, error);
      // No lanzamos error porque no es crítico
      return { success: false };
    }
  }
}
