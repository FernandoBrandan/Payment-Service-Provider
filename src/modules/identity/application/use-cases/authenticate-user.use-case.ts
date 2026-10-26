import { Inject, Injectable } from '@nestjs/common'

import { AUTH_USER_REPOSITORY, HASH_SERVICE, TOKEN_SERVICE } from '@infra/tokens'
import { HashService } from '@infra/auth-infra/ports/hash.service'
import { TokenService } from '@infra/auth-infra/ports/token.service'

import {
  AccountLockedError,
  AccountNotActiveError,
  InvalidCredentialsError,
  NoPasswordHashError,
} from '../../domain/errors/identity.errors'
import { IAuthUserRepository } from '../../domain/repositories/auth-user.respository'
import { AccountStatus, UserRole } from '../../domain/enums'

export interface AuthenticateUserDto {
  email: string
  password: string
}

export interface AuthenticateUserResult {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string; roles: UserRole[]; status: AccountStatus }
}

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

@Injectable()
export class AuthenticateUserUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly repoAuthUser: IAuthUserRepository,

    @Inject(HASH_SERVICE)
    private readonly hashService: HashService,

    @Inject(TOKEN_SERVICE)
    private readonly tokens: TokenService,
  ) {}

  async execute(dto: AuthenticateUserDto): Promise<AuthenticateUserResult> {
    const user = await this.repoAuthUser.findByEmail(dto.email)
    if (!user) throw new InvalidCredentialsError()
    if (user.isLocked()) throw new AccountLockedError()
    if (!user.isAccountActive()) throw new AccountNotActiveError()
    if (!user.passwordHash) throw new NoPasswordHashError()

    const ok = await this.hashService.compare(dto.password, user.passwordHash)
    if (!ok) {
      user.recordFailedLogin(MAX_ATTEMPTS, LOCK_MINUTES)
      await this.repoAuthUser.save(user)
      throw new InvalidCredentialsError()
    }

    user.recordSuccessfulLogin()
    await this.repoAuthUser.save(user)

    const accessToken = this.tokens.signAccess({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      status: user.status,
    })
    const refreshToken = this.tokens.signRefresh({ sub: user.id, type: 'refresh' })

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        status: user.status,
      },
    }
  }
}
