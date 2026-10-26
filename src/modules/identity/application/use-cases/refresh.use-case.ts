import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'

import { AUTH_USER_REPOSITORY, TOKEN_SERVICE } from '@infra/tokens'
import { TokenService } from '@infra/auth-infra/ports/token.service'

import {
  AccountLockedError,
  AccountNotActiveError,
  InvalidRefreshTokenError,
} from '../../domain/errors/identity.errors'
import { IAuthUserRepository } from '../../domain/repositories/auth-user.respository'

import { AuthResponseDTO } from '../dto/response/auth.response.dto'

@Injectable()
export class RefreshUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly repoAuthUser: IAuthUserRepository,

    @Inject(TOKEN_SERVICE)
    private readonly tokens: TokenService,
  ) {}

  async execute(refreshToken: string): Promise<AuthResponseDTO> {
    const payload = await this.tokens.verifyRefresh(refreshToken)
    if (!payload || payload.type !== 'refresh') {
      // 401 uniforme: no distinguimos "malformado" de "expirado" de "firmado con otro secret".
      throw new InvalidRefreshTokenError()
    }

    const user = await this.repoAuthUser.findById(payload.sub)
    if (!user) throw new InvalidRefreshTokenError()
    if (user.isLocked()) throw new AccountLockedError()
    if (!user.isAccountActive()) throw new AccountNotActiveError()

    const accessToken = this.tokens.signAccess({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      status: user.status,
    })
    const newRefreshToken = this.tokens.signRefresh({
      sub: user.id,
      type: 'refresh',
    })

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        status: user.status,
      },
    }
  }
}
