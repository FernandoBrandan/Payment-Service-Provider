// presentation/auth.controller.ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common'

import { AuthResponseDTO } from '../application/dto/response/auth.response.dto'
import { LoginRequestDTO } from '../application/dto/request/login.request.dto'
import { RefreshRequestDTO } from '../application/dto/request/fresh.request.dto'
import { RegisterRequestDTO } from '../application/dto/request/register.request.dto'

import { RefreshUseCase } from '../application/use-cases/refresh.use-case'
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case'
import { AuthenticateUserUseCase } from '../application/use-cases/authenticate-user.use-case'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUC: RegisterUserUseCase,
    private readonly loginUC: AuthenticateUserUseCase,
    private readonly refreshUC: RefreshUseCase,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterRequestDTO) {
    const user = await this.registerUC.execute(dto)
    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      status: user.status,
    }
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginRequestDTO): Promise<AuthResponseDTO> {
    return this.loginUC.execute(dto)
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshRequestDTO): Promise<AuthResponseDTO> {
    return this.refreshUC.execute(dto.refreshToken)
  }
}
