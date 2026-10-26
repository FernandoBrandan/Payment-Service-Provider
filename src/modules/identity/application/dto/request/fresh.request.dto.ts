import { IsString, MinLength } from 'class-validator'

export class RefreshRequestDTO {
  @IsString()
  @MinLength(10)
  refreshToken: string
}
