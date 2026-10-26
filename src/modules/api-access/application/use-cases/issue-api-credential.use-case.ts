// modules/api-access/application/issue-api-credential.use-case.ts
import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common'
import {
  API_CLIENT_REPOSITORY,
  API_CREDENTIAL_REPOSITORY,
  MERCHANT_PROFILE_REPOSITORY,
  USER_PROFILE_REPOSITORY,
} from '@infra/tokens'

import {
  MerchantNotFoundError,
  MerchantNotActiveError,
  KycRequiredError,
  ApiClientMissingError,
  ApiClientNotActiveError,
  CredentialAlreadyExistsError,
} from '../../domain/errors/api-access.errors'

import { EntityId } from '@common/domain/vo/entity-id.vo'

import { KycStatus } from '../../../identity/domain/enums'

import { IApiClientRepository } from '../../domain/repositories/api-client.repository'
import { IApiCredentialRepository } from '../../domain/repositories/api-credential.repository'

import { ApiCredential, ApiEnvironment } from '../../domain/api-credential.entity'

import { IMerchantProfileRepository } from '../../../identity/domain/repositories/merchant-profile.repository'
import { IUserProfileRepository } from '../../../identity/domain/repositories/user-profile.repository'

export interface IssueApiCredentialCommand {
  merchantProfileId: string
  environment: ApiEnvironment
  requestedByUserId: string // auditoría
}

export interface IssueApiCredentialResult {
  apiCredentialId: string
  rawKey: string // Se muestra UNA sola vez. El caller debe devolverlo al cliente y descartarlo
  prefix: string
  environment: ApiEnvironment
  createdAt: Date
}

interface IUnitOfWork {}

@Injectable()
export class IssueApiCredentialUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userRepo: IUserProfileRepository,

    @Inject(MERCHANT_PROFILE_REPOSITORY)
    private readonly merchantRepo: IMerchantProfileRepository,

    @Inject(API_CLIENT_REPOSITORY)
    private readonly apiClientRepo: IApiClientRepository,

    @Inject(API_CREDENTIAL_REPOSITORY)
    private readonly credentialRepo: IApiCredentialRepository,
  ) {}

  async execute(cmd: IssueApiCredentialCommand): Promise<IssueApiCredentialResult> {
    const merchant = await this.merchantRepo.findById(cmd.merchantProfileId)
    if (!merchant) throw new MerchantNotFoundError()
    if (!merchant.isActive()) throw new MerchantNotActiveError()

    // LIVE keys requieren KYC aprobado del dueño.
    if (cmd.environment === ApiEnvironment.LIVE) {
      const ownerProfile = await this.userRepo.findById(merchant.ownerId)
      if (ownerProfile?.kycStatus !== KycStatus.APPROVED) throw new KycRequiredError()
    }

    let apiClient = await this.apiClientRepo.findByMerchantId(EntityId.from(merchant.id))
    if (!apiClient) throw new ApiClientMissingError()
    if (!apiClient.isActive()) throw new ApiClientNotActiveError()

    // Política: 1 activa por (apiClientId, environment). Rotación = revocar + emitir.
    const existingActive = await this.credentialRepo.findActiveByApiClientAndEnv(
      apiClient.id,
      cmd.environment,
    )
    if (existingActive) throw new CredentialAlreadyExistsError()

    const { credential, rawKey } = ApiCredential.issue({
      id: EntityId.create(),
      apiClientId: apiClient.id,
      environment: cmd.environment,
    })

    await this.credentialRepo.save(credential)

    return {
      apiCredentialId: credential.id.value,
      rawKey,
      prefix: credential.prefix,
      environment: credential.environment,
      createdAt: credential.createdAt,
    }
  }
}

/**
 * ---------------------------------------------------------------------------
 * 3) Get or create ApiClient (1:1 con merchant) create-api-client.use-case.ts
 *     let apiClient = await this.apiClientRepo.findByMerchantId(merchant.id)
 *
 *
 * ---------------------------------------------------------------------------
 *
 *
 * 4) Emitir credencial ->     const apiClientCredential = this.credentialRepo.findByApiClientId(apiClient.id)
 * IssueApiCredentialUseCase no chequea si ya existe una credencial active para (apiClientId, environment).
 * Hoy podés emitir N test keys y N live keys sin restricción.
 * Por ahora solo valida que no tenga ninguna.
 * Decisión a tomar:
 * Si querés N activas por entorno: no hay cambio, es correcto (útil para rotación con overlap).
 * Si querés 1 activa por entorno: agregar findActiveByApiClientAndEnv en el repo + chequeo en el use case
 * (o unique partial index WHERE status='active').
 * Recomendación: 1 activa por entorno (más simple de razonar, forzás rotación explícita).
 * El merchant que quiere rotar sin downtime usa 2 keys activas temporalmente → en ese caso sí N. Elegí y documentá.
 * `IssueApiCredentialUseCase`: `findActiveByApiClientAndEnv` (no `findByApiClientId`)
 *
 *
 * Si en el futuro querés rotación sin downtime (2 activas temporalmente),
 * cambiás el findActiveByApiClientAndEnv por un count < 2.
 * Por ahora 1 activa es lo correcto porque RevokeApiKeyUseCase ya existe.
 *
 * ---------------------------------------------------------------------------
 *
 *
 * private readonly unitOfWork: IUnitOfWork,
 */
