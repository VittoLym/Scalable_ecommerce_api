// user-service/src/modules/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendVerificationEmail(email: string, token: string, name?: string) {
    const frontendUrl =
      process.env.FRONTEND_URL_PROD || 'http://localhost:3000';
    const verificationLink = `${frontendUrl}/auth/verify-email?token=${token}`;
    const iwi =
      process.env.NODE_ENV === 'production'
        ? join(__dirname, 'templates')
        : join(process.cwd(), 'src/email/templates');
    console.log(iwi);
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
  async changePassword(email: string, name?: string) {
    console.log('hola');
  }
  async sendPasswordChangedEmail(
    email: string,
    name?: string,
    metadata?: {
      ip?: string;
      device?: string;
      location?: string;
    },
  ): Promise<{ success: boolean }> {
    try {
      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3001';
      const loginLink = `${frontendUrl}/login`;
      const supportEmail = this.configService.get('SUPPORT_EMAIL') || 'vitto.jsx@gmail.com';

      await this.mailerService.sendMail({
        to: email,
        subject: 'Tu contraseña ha sido cambiada - Notificación de seguridad',
        template: './password-changed',
        context: {
          name: name || 'usuario',
          loginLink,
          frontendUrl,
          year: new Date().getFullYear(),
          supportEmail,
          currentDateTime: new Date(),
          device: metadata?.device,
          ip: metadata?.ip,
          location: metadata?.location,
        },
      });
      this.logger.log(
        `✅ Email de confirmación de cambio de contraseña enviado a: ${email}`,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(
        `❌ Error enviando email de cambio de contraseña a ${email}:`,
        error,
      );
      return { success: false };
    }
  }
}
