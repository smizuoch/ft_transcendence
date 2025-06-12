import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.initializeEmailTransporter();
  }

  private initializeEmailTransporter(): void {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    // SMTP設定の存在確認
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      this.logger.warn('SMTP設定が不完全です。コンソールにコードを出力します。');
      return;
    }

    // 開発用デフォルト値の確認
    if (smtpUser === 'your-email@gmail.com' || smtpPass === 'your-app-password') {
      this.logger.warn('開発用デフォルト値が検出されました。コンソールにコードを出力します。');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      
      // SMTP接続をテスト
      this.transporter.verify((error, success) => {
        if (error) {
          this.logger.error('SMTP接続テストに失敗しました:', error);
          this.transporter = null;
        } else {
          this.logger.log('SMTPサーバーへの接続が確認されました');
        }
      });
      
      this.logger.log('SMTPトランスポーターが初期化されました');
    } catch (error) {
      this.logger.error('SMTPトランスポーターの初期化に失敗しました:', error);
      this.transporter = null;
    }
  }

  /**
   * 6桁のランダムな認証コードを生成
   */
  private generateSixDigitCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 2FAコードを送信
   */
  async sendTwoFactorCode(email: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`2FAコード送信開始 - Email: ${email}`);
      
      // ユーザーの存在確認
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      this.logger.log(`ユーザー検索結果 - Email: ${email}, Found: ${!!user}`);
      if (user) {
        this.logger.log(`ユーザー詳細 - Username: ${user.username}, Email: ${user.email}`);
      }

      if (!user) {
        this.logger.error(`ユーザーが見つかりません - Email: ${email}`);
        throw new BadRequestException('ユーザーが見つかりません');
      }

      // 新しい認証コードを生成
      const code = this.generateSixDigitCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分後

      // Userテーブルの2FA情報を直接更新
      await this.prisma.user.update({
        where: { email },
        data: {
          twoFactorCode: code,
          twoFactorExpiresAt: expiresAt,
          twoFactorIsUsed: false,
        },
      });

      // メール送信
      await this.sendEmailWithCode(email, code);

      this.logger.log(`2FAコードが ${email} に送信されました`);

      return {
        success: true,
        message: '認証コードを送信しました',
      };
    } catch (error) {
      this.logger.error('2FAコード送信エラー:', error);
      throw new BadRequestException('認証コードの送信に失敗しました');
    }
  }

  /**
   * 2FAコードを検証
   */
  async verifyTwoFactorCode(
    email: string,
    code: string,
  ): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      // ユーザーの存在確認
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new BadRequestException('ユーザーが見つかりません');
      }

      // 2FA情報の確認
      const currentTime = new Date();
      
      // コードが一致しない場合
      if (user.twoFactorCode !== code) {
        throw new BadRequestException('無効な認証コードです');
      }

      // 期限切れチェック
      if (!user.twoFactorExpiresAt || user.twoFactorExpiresAt <= currentTime) {
        throw new BadRequestException('認証コードの期限が切れています');
      }

      // 使用済みチェック
      if (user.twoFactorIsUsed) {
        throw new BadRequestException('認証コードは既に使用されています');
      }

      // コードを使用済みとしてマーク
      await this.prisma.user.update({
        where: { email },
        data: {
          twoFactorIsUsed: true,
        },
      });

      this.logger.log(`ユーザー ${user.username} の2FA認証が完了しました`);

      return {
        success: true,
        message: '認証が完了しました',
        user: {
          username: user.username,
          email: user.email,
        },
      };
    } catch (error) {
      this.logger.error('2FAコード検証エラー:', error);
      throw new BadRequestException(error.message || '認証コードの検証に失敗しました');
    }
  }

  /**
   * メール送信（実際の実装またはコンソール出力）
   */
  private async sendEmailWithCode(email: string, code: string): Promise<void> {
    const subject = 'ft_transcendence - 認証コード';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">ft_transcendence</h1>
        <h2 style="color: #666;">認証コード</h2>
        <p>あなたの6桁認証コードは以下の通りです：</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #666;">このコードは10分間有効です。</p>
        <p style="color: #666;">このメールに覚えがない場合は、無視してください。</p>
      </div>
    `;

    // SMTPが設定されている場合はメール送信、そうでなければコンソール出力
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: this.configService.get<string>('SMTP_FROM'),
          to: email,
          subject,
          html,
        });
        this.logger.log(`メールが正常に送信されました: ${email}`);
        this.logger.log(`Message ID: ${info.messageId}`);
      } catch (error) {
        this.logger.error('メール送信エラー:', error);
        // メール送信失敗時もコンソール出力で対応
        this.outputCodeToConsole(email, code);
      }
    } else {
      // 開発環境用：コンソールに出力
      this.outputCodeToConsole(email, code);
    }
  }

  /**
   * 開発環境用：コンソールに認証コードを出力
   */
  private outputCodeToConsole(email: string, code: string): void {
    this.logger.log(`
=================================
🔐 2FA認証コード（開発モード）
=================================
宛先: ${email}
認証コード: ${code}
有効期限: 10分
=================================
    `);
  }
}