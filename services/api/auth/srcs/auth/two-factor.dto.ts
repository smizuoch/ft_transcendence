import { IsString, IsNotEmpty, Length } from 'class-validator';

export class VerifyTwoFactorCodeDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'コードは6桁である必要があります' })
  code: string;
}

export class TwoFactorResponseDto {
  success: boolean;
  message: string;
  data?: any;
}
