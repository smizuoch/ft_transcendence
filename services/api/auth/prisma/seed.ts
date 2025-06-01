// seed.tsはデータベースに初期データを投入（シード）するためのスクリプトです。
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs'; // bcrypt から bcryptjs に変更

const prisma = new PrismaClient();

async function main() {
  // デフォルトユーザーを作成
  const password = await bcrypt.hash('password123', 10);
  
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      password: password,
    },
  });

  // テスト用ユーザーを作成
  await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      username: 'testuser',
      email: 'test@example.com',
      password: await bcrypt.hash('testpass', 10),
    },
  });

  console.log('データベースのシードが完了しました');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // データベース接続を閉じる
    await prisma.$disconnect();
  });
