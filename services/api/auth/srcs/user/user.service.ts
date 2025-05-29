import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcryptjs'; // bcrypt から bcryptjs に変更

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { username, email, password } = createUserDto;
    
    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // ユーザーを作成
    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        displayName: username, // デフォルトでユーザー名をディスプレイ名に設定
      },
    });
    
    // パスワードを除外して返す
    const { password: _, ...result } = user;
    return result;
  }

  async findAll() {
    const users = await this.prisma.user.findMany();
    return users.map(({ password: _, ...user }) => user);
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { username: `user${id}` }, // idをもとにユーザー名を検索する例
    });
    
    if (!user) {
      return null;
    }
    
    const { password: _, ...result } = user;
    return result;
  }
}





// データベース操作の抽象化：Prismaを使用してデータベースとのやり取りを行い、コントローラーからデータベース操作の詳細を隠蔽します

// ユーザー管理機能の提供：

// create: 新規ユーザー作成とパスワードハッシュ化
// findAll: 全ユーザー取得
// findOne: 特定IDのユーザー取得
// データセキュリティ：bcryptjsを使用してパスワードをハッシュ化し、レスポンスからパスワードを除外して返します

// このファイルはコントローラー(user.controller.ts)から呼び出され、実際のビジネスロジックを処理します。RESTエンドポイントとデータベース間の中間レイヤーとして機能し、アプリケーションのコア機能を提供するため、非常に重要なファイルです。