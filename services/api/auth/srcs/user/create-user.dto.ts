import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(16, { message: 'Username must be up to 16 characters' })
  @Matches(/^[a-zA-Z0-9]+$/, { message: 'Username must contain only uppercase and lowercase alphanumeric characters' })
  username: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(254, { message: 'Email must be at most 254 characters' }) // RFC 5321標準
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(64, { message: 'Password must be up to 64 characters' })
  password: string;
}
