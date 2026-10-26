// si es para usar jwt, usaremos el nativo de nestjs

import { AccountStatus, UserRole } from '../../../modules/identity/domain/enums'

export interface AccessTokenPayload {
  sub: string
  email: string
  roles: UserRole[]
  status: AccountStatus
}

export interface RefreshTokenPayload {
  sub: string
  type: 'refresh'
}

export interface TokenService {
  signAccess(payload: AccessTokenPayload): string
  signRefresh(payload: RefreshTokenPayload): string
  verifyAccess(token: string): Promise<AccessTokenPayload | null>
  verifyRefresh(token: string): Promise<RefreshTokenPayload | null>
}
