import { IsString, IsInt, Min, Max, IsDateString } from 'class-validator';

export class CreatePong42ResultDto {
  @IsString()
  username: string;

  @IsInt()
  @Min(1)
  @Max(42)
  rank: number;

  @IsDateString()
  gameDate: string;
}
