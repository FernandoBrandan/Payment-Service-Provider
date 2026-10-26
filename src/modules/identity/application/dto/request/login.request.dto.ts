// application/dto/request/login.request.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator'

export class LoginRequestDTO {
  @IsEmail() email: string
  @IsString() @MinLength(1) password: string
}
