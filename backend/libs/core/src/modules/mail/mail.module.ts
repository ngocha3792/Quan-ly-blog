import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const rawHost = configService
          .get<string>('mail.host', 'smtp.gmail.com')
          .replace(/[\r\n\s]+/g, '')
          .trim();
        const isGmail = rawHost.toLowerCase().includes('gmail');

        const user = configService
          .get<string>('mail.user', '')
          .replace(/[\r\n\s]+/g, '')
          .trim();
        const pass = configService
          .get<string>('mail.password', '')
          .replace(/[\r\n\s]+/g, '')
          .trim();
        const rawFrom = configService.get<string>(
          'mail.from',
          'NestJS Blog <noreply@example.com>',
        );
        const from = rawFrom
          .replace(/\\"/g, '"')
          .replace(/[\r\n]+/g, '')
          .trim();

        return {
          transport: isGmail
            ? {
                service: 'gmail',
                auth: user ? { user, pass } : undefined,
              }
            : {
                host: rawHost,
                port: configService.get<number>('mail.port', 587),
                secure: configService.get<boolean>('mail.secure', false),
                auth: user ? { user, pass } : undefined,
                ignoreTLS: configService.get<boolean>('mail.ignoreTLS', false),
                tls: {
                  rejectUnauthorized: false,
                },
              },
          defaults: {
            from,
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
