// presentation/users.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@infra/auth-infra/guards/jwt-auth.guard'
import { CurrentUser } from '@infra/auth-infra/decorators/current-user.decorator'
import { GetProfileUseCase } from '../application/use-cases/get-profile.use-case'
import { UserResponseDTO } from '../application/dto/response/user.response.dto'

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly getProfile: GetProfileUseCase) {}

  @Get('me')
  me(@CurrentUser('sub') authUserId: string): Promise<UserResponseDTO> {
    return this.getProfile.execute(authUserId)
  }
}
