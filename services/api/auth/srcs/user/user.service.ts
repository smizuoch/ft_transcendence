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
