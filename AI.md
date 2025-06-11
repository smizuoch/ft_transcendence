NestJS + Fastifyの構成で2FA（Two-Factor Authentication）を実装してください。

**要件:**
- 最低限の実装で、メールに6桁の数字を送信
- ユーザーが入力した6桁の数字が正しければ認証完了
- フロントエンドは既存のTwoFactorAuth.tsxを使用
- JWTでユーザーを識別し、そのユーザーのメールアドレスをJWTから取得して送信

**技術スタック:**
- Backend: NestJS + Fastify
- Frontend: React/TypeScript
- Database: SQLite (Prisma)
- Email: Nodemailer

**2FA用データベーステーブル:**
- TwoFactorCode テーブルを追加
  - id: 主キー
  - email: ユーザーのメールアドレス（Userテーブルへの外部キー）
  - code: 6桁の認証コード
  - expiresAt: 有効期限（10分間）
  - isUsed: 使用済みフラグ
  - createdAt: 作成日時

**実装してほしいファイル:**

1. **Database Schema（Prisma）:**
   - schema.prismaにTwoFactorCodeモデルを追加

2. **Backend（NestJS）:**
   - 2FA用のService（コード生成・検証・メール送信）
   - 2FA用のController（エンドポイント）
   - 2FA用のDTO（リクエスト・レスポンス）
   - JWTガード対応

3. **Frontend更新:**
   - TwoFactorAuth.tsxの実装（APIコール追加）
   - API呼び出し用のservice更新

4. **環境変数:**
   - メール送信用の設定

**エンドポイント:**
- POST /api/auth/2fa/send - 2FAコード送信（JWT認証必須）
- POST /api/auth/2fa/verify - 2FAコード検証（JWT認証必須）

**実装フロー:**
1. ログイン成功後、クライアントは JWT Token を受け取る
2. 2FA画面で「コード送信」ボタンを押すと、JWT Token を使って /api/auth/2fa/send を呼び出し
3. サーバーは JWT から email を取得し、6桁のコードを生成してメール送信
4. ユーザーがコードを入力すると /api/auth/2fa/verify を呼び出し
5. コードが正しければ認証完了

現在のプロジェクト構造を考慮して、適切なディレクトリに配置してください。

**注意:**
- Google認証の時は2FA必要ない
- コードの有効期限は10分間
- 使用済みコードは再利用不可
- 同一ユーザーに対して新しいコードが生成された場合、古いコードは無効化