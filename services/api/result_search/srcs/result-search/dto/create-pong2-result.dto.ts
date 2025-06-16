import { IsString, IsIn, IsDateString } from 'class-validator';

export class CreatePong2ResultDto {
  @IsString()
  username: string;

  @IsString()
  opponentUsername: string;

  @IsIn(['win', 'lose'])
  result: 'win' | 'lose';

  @IsDateString()
  gameDate: string;
}
