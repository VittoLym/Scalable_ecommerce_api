// user-service/src/modules/email/email.module.ts
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { EmailService } from './email.service';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { join } from 'path';

const configModule = ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: '.env',
});
@Module({
  imports: [
    configModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Log para debug
        console.log('📧 Configurando email con:', {
          host: configService.get('EMAIL_HOST'),
          port: configService.get('EMAIL_PORT'),
          user: configService.get('EMAIL_USER'),
          from: configService.get('EMAIL_FROM'),
        });

        return {
          transport: {
            host: configService.get('EMAIL_HOST'),
            port: configService.get('EMAIL_PORT'),
            secure: configService.get('EMAIL_SECURE') === 'true',
            auth: {
              user: configService.get('EMAIL_USER'),
              pass: configService.get('EMAIL_PASS'),
            },
            // Para Gmail, a veces necesitas esto
            tls: {
              rejectUnauthorized: false,
            },
          },
          defaults: {
            from: configService.get('EMAIL_FROM'),
          },
          template: {
            dir:
              process.env.NODE_ENV === 'production'
                ? join(__dirname, 'templates') // En Docker: /app/dist/email/templates
                : join(process.cwd(), 'src/email/templates'), // En local: ./src/email/templates
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
