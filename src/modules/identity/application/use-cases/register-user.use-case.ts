import { Inject, Injectable } from '@nestjs/common'

import { HashService } from '@infra/auth-infra/ports/hash.service'
import { AUTH_USER_REPOSITORY, HASH_SERVICE, USER_PROFILE_REPOSITORY } from '@infra/tokens'

import { EmailAlreadyUsedError } from '../../domain/errors/identity.errors'

import { IAuthUserRepository } from '../../domain/repositories/auth-user.respository'
import { IUserProfileRepository } from '../../domain/repositories/user-profile.repository'

import { AuthUser } from '../../domain/auth-user.entity'
import { UserProfile } from '../../domain/user-profile.entity'

import { randomUUID } from 'node:crypto'
import * as bcrypt from 'bcryptjs'

export interface RegisterUserDto {
  email: string
  password: string
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly repoAuthUser: IAuthUserRepository,

    @Inject(USER_PROFILE_REPOSITORY)
    private readonly repoUser: IUserProfileRepository,

    @Inject(HASH_SERVICE)
    private readonly hashService: HashService,
  ) {}

  async execute(dto: RegisterUserDto): Promise<AuthUser> {
    const existing = await this.repoAuthUser.findByEmail(dto.email)
    if (existing) throw new EmailAlreadyUsedError()

    const authUser = AuthUser.create({ id: randomUUID(), email: dto.email })
    const passwordHash = await this.hashService.hash(dto.password)
    authUser.updatePassword(passwordHash)
    await this.repoAuthUser.save(authUser)

    const profile = UserProfile.create({ id: randomUUID(), userId: authUser.id })
    await this.repoUser.save(profile)

    return authUser
  }
}
