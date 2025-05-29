import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;
}

// このファイルは以下の理由で重要です：

// user.service.tsとuser.controller.tsでCreateUserDtoクラスをインポートして使用しています
// ユーザー作成APIで送信されるデータの構造を定義しています
// class-validatorデコレータを使って入力データのバリデーションを行っています
// このファイルが存在しない場合：

// TypeScriptのコンパイルエラーが発生します（インポートされているクラスが見つからない）
// ユーザー作成時のデータ検証が行われず、不正なデータを受け入れてしまう可能性があります
// 型の安全性が損なわれます