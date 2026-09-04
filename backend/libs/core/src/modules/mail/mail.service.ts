import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Gửi email khôi phục mật khẩu cho người dùng.
   */

  async sendPasswordResetEmail(
    email: string,
    token: string,
    username?: string,
  ): Promise<boolean> {
    const frontendUrl = this.configService.get<string>(
      'app.frontendUrl',
      'http://localhost:3000',
    );
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #333;">Yêu cầu khôi phục mật khẩu</h2>
        <p>Xin chào ${username || 'bạn'},</p>
        <p>Chúng tôi đã nhận được yêu cầu khôi phục mật khẩu cho tài khoản liên kết với địa chỉ email này.</p>
        <p>Vui lòng nhấp vào nút bên dưới để đặt lại mật khẩu của bạn. Liên kết này có hiệu lực trong vòng <strong>15 phút</strong>:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #007bff; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Đặt lại mật khẩu</a>
        </div>
        <p>Hoặc bạn có thể sao chép và dán liên kết sau vào trình duyệt:</p>
        <p style="word-break: break-all; color: #555;"><a href="${resetLink}">${resetLink}</a></p>
        <p><strong>Mã token khôi phục:</strong> <code>${token}</code></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>
      </div>
    `;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Khôi phục mật khẩu - NestJS Blog',
        html,
      });
      this.logger.log(`Đã gửi email khôi phục mật khẩu tới: ${email}`);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Lỗi khi gửi email khôi phục tới ${email}: ${message}`);
      // Log ra link reset trong dev/test mode để dễ dàng debug khi chưa cấu hình SMTP thực tế
      this.logger.debug(
        `[DEBUG OPTION] Reset Link: ${resetLink} (Token: ${token})`,
      );
      return false;
    }
  }
}
