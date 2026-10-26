import { Inject, Injectable } from '@nestjs/common'

import { AUTH_USER_REPOSITORY, USER_PROFILE_REPOSITORY } from '@infra/tokens'

import { AuthUserNotFoundError } from '../../domain/errors/identity.errors'
import { IAuthUserRepository } from '../../domain/repositories/auth-user.respository'
import { IUserProfileRepository } from '../../domain/repositories/user-profile.repository'

import { UserResponseDTO } from '../dto/response/user.response.dto'
import { UserMapper } from '../mappers/user.mapper'

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly repoAuth: IAuthUserRepository,

    @Inject(USER_PROFILE_REPOSITORY)
    private readonly repoProfile: IUserProfileRepository,
  ) {}

  async execute(authUserId: string): Promise<UserResponseDTO> {
    const authUser = await this.repoAuth.findById(authUserId)
    if (!authUser) throw new AuthUserNotFoundError()

    const profile = await this.repoProfile.findByUserId(authUserId)
    return UserMapper.toResponse(authUser, profile)
  }
}
