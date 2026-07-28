import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

describe('MailService', () => {
  let service: MailService;
  let mailerService: MailerService;

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:3000'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mockMailerService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get<MailerService>(MailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send password reset email successfully', async () => {
    mockMailerService.sendMail.mockResolvedValueOnce(true);

    const result = await service.sendPasswordResetEmail(
      'test@example.com',
      'token-123',
      'tester',
    );

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Khôi phục mật khẩu - NestJS Blog',
      }),
    );
    expect(result).toBe(true);
  });

  it('should handle error when sending email fails and return false', async () => {
    mockMailerService.sendMail.mockRejectedValueOnce(new Error('SMTP Error'));

    const result = await service.sendPasswordResetEmail(
      'test@example.com',
      'token-123',
    );

    expect(result).toBe(false);
  });
});
