import { Inject, Injectable } from '@nestjs/common'
import {
  AUTH_USER_REPOSITORY,
  MERCHANT_PROFILE_REPOSITORY,
  MERCHANT_REQUEST_REPOSITORY,
  USER_PROFILE_REPOSITORY,
} from '@infra/tokens'

import { UserRole } from '../../domain/enums'
import {
  AuthUserNotFoundError,
  MerchantRequestNotFoundError,
  UserNotFoundError,
} from '../../domain/errors/identity.errors'

import { IAuthUserRepository } from '../../domain/repositories/auth-user.respository'
import { IUserProfileRepository } from '../../domain/repositories/user-profile.repository'
import { IMerchantProfileRepository } from '../../domain/repositories/merchant-profile.repository'
import { IMerchantProfileRequestRepository } from '../../domain/repositories/merchant-profile-request.repository'

import { MerchantProfile } from '../../domain/merchant-profile.entity'

import { CreateApiClientUseCase } from '../../../api-access/application/use-cases/create-api-client.use-case'

@Injectable()
export class ApproveMerchantUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly repoAuthUser: IAuthUserRepository,

    @Inject(USER_PROFILE_REPOSITORY)
    private readonly repoUser: IUserProfileRepository,

    @Inject(MERCHANT_PROFILE_REPOSITORY)
    private readonly repoMerchant: IMerchantProfileRepository,

    @Inject(MERCHANT_REQUEST_REPOSITORY)
    private readonly repoMerchantRequest: IMerchantProfileRequestRepository,

    private readonly createApiClientUseCase: CreateApiClientUseCase,
  ) {}

  async approveMerchant(requestId: string, adminId: string): Promise<MerchantProfile> {
    const request = await this.repoMerchantRequest.findById(requestId)
    if (!request) throw new MerchantRequestNotFoundError()
    request.approve(adminId)

    const profile = MerchantProfile.createFromRequest(request, { adminId })
    await this.repoMerchant.save(profile)

    const user = await this.repoUser.findById(request.ownerId)
    if (!user) throw new UserNotFoundError()
    user.linkMerchantProfile(profile.id, request.id)
    await this.repoUser.save(user)

    const authUser = await this.repoAuthUser.findById(request.userId)
    if (!authUser) throw new AuthUserNotFoundError()
    authUser.grantRole(UserRole.MERCHANT)
    await this.repoAuthUser.save(authUser)
    await this.repoMerchantRequest.save(request)

    //  6. Auto-create del ApiClient (fuera del agregado; falla acá ⇒ request ya aprobada)
    await this.createApiClientUseCase.execute({
      merchantProfileId: profile.id,
      name: profile.businessName,
      technicalEmail: authUser.email,
      createdByUserId: adminId,
    })

    // 🔎 Ojo: los pasos 2–5 deberían ir dentro de una transacción.
    // Con TypeORM, el repo necesita soportar manager.transaction(...) o usar @Transactional() (typeorm-transactional).
    // Y el paso 6 idealmente va después del commit — patrón afterCommit / outbox.
    // Actualmente si falla el ApiClient, merchant queda aprobada
    // pero sin credenciales → necesitás un job de reconciliación o hacerlo por outbox desde el principio.

    // TODO v2: emitir MerchantApproved por outbox para provisioning S4 async
    // Crear cuenta business en S4

    return profile
  }
}
