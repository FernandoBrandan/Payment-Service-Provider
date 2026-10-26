import { Inject, Injectable } from '@nestjs/common'
import { MERCHANT_REQUEST_REPOSITORY, USER_PROFILE_REPOSITORY } from '@infra/tokens'

import { UserNotFoundError } from '../../domain/errors/identity.errors'

import { IUserProfileRepository } from '../../domain/repositories/user-profile.repository'
import { IMerchantProfileRequestRepository } from '../../domain/repositories/merchant-profile-request.repository'

import { IMerchantRequestData, MerchantRequest } from '../../domain/merchant-request.entity'

@Injectable()
export class RequestMerchantRoleUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly repoUser: IUserProfileRepository,

    @Inject(MERCHANT_REQUEST_REPOSITORY)
    private readonly repoMerchantRequest: IMerchantProfileRequestRepository,
  ) {}

  async execute(dto: { userId: string; request: IMerchantRequestData }): Promise<MerchantRequest> {
    const user = await this.repoUser.findById(dto.userId)
    if (!user) throw new UserNotFoundError()

    const request = await user.requestMerchantRole(dto.request)
    await this.repoMerchantRequest.save(request)
    await this.repoUser.save(user)
    return request
  }
}
