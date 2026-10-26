import { applyDecorators, UseGuards } from '@nestjs/common'
import { UserRole } from '../../../modules/identity/domain/enums'
import { AuthGuard } from '../guards/jwt-auth.guard'
import { RolesGuard } from '../guards/roles.guard'
import { Roles } from './roles.decorator'

export const Auth = (...roles: UserRole[]) => {
  return applyDecorators(Roles(...roles), UseGuards(AuthGuard, RolesGuard))
}
