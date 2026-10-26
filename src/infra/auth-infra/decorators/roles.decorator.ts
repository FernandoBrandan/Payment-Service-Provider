import { SetMetadata } from '@nestjs/common'
import { UserRole } from '../../../modules/identity/domain/enums'
import { ROLES_KEY } from '../guards/roles.guard'

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)
