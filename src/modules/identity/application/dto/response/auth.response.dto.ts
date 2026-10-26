// application/dto/response/auth.response.dto.ts
import { AccountStatus, UserRole } from '../../../../../modules/identity/domain/enums'

export class AuthUserDTO {
  id: string
  email: string
  roles: UserRole[]
  status: AccountStatus
}

export class AuthResponseDTO {
  accessToken: string
  refreshToken: string
  user: AuthUserDTO
}
