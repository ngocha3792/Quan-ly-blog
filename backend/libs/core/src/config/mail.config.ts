import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: (process.env.MAIL_HOST || 'smtp.gmail.com').replace(/[\r\n\s]+/g, '').trim(),
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  secure: process.env.MAIL_SECURE === 'true',
  user: (process.env.MAIL_USER || '').replace(/[\r\n\s]+/g, '').trim(),
  password: (process.env.MAIL_PASSWORD || '').replace(/[\r\n\s]+/g, '').trim(),
  from: (process.env.MAIL_FROM || 'NestJS Blog <noreply@example.com>').replace(/\\"/g, '"').replace(/[\r\n]+/g, '').trim(),
  ignoreTLS: process.env.MAIL_IGNORE_TLS === 'true',
}));

