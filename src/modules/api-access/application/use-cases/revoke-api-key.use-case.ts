// modules/api-access/application/revoke-api-key.use-case.ts
import { Inject, Injectable } from '@nestjs/common'
import {
  API_CLIENT_REPOSITORY,
  API_CREDENTIAL_REPOSITORY,
  MERCHANT_PROFILE_REPOSITORY,
} from '@infra/tokens'
import { EntityId } from '@common/domain/vo/entity-id.vo'

import {
  ApiCredentialNotFoundError,
  ApiClientNotFoundError,
  ApiForbiddenError,
} from '../../domain/errors/api-access.errors'
import type { IApiClientRepository } from '../../domain/repositories/api-client.repository'
import type { IApiCredentialRepository } from '../../domain/repositories/api-credential.repository'

import { ApiEnvironment } from '../../domain/api-credential.entity'

import type { IMerchantProfileRepository } from '../../../identity/domain/repositories/merchant-profile.repository'

// ============================================================================
// Command / Result
// ============================================================================
export enum RevokeActorRole {
  ADMIN = 'ADMIN',
  MERCHANT = 'MERCHANT',
}
export interface RevokeApiKeyCommand {
  credentialId: string
  reason: string
  revokedByUserId: string /** Quién ejecuta la acción (auditoría + autorización). */
  revokedByRole: RevokeActorRole
}

export interface RevokeApiKeyResult {
  credentialId: string
  apiClientId: string
  environment: ApiEnvironment
  revokedAt: Date
  wasAlreadyRevoked: boolean /** true si ya estaba revoked antes de esta llamada (idempotencia). */
}

@Injectable()
export class RevokeApiKeyUseCase {
  constructor(
    @Inject(API_CREDENTIAL_REPOSITORY)
    private readonly credentialRepo: IApiCredentialRepository,

    @Inject(API_CLIENT_REPOSITORY)
    private readonly apiClientRepo: IApiClientRepository,

    @Inject(MERCHANT_PROFILE_REPOSITORY)
    private readonly merchantRepo: IMerchantProfileRepository,
  ) {}

  async execute(cmd: RevokeApiKeyCommand): Promise<RevokeApiKeyResult> {
    // ── 1. Cargar credencial ──────────────────────────────────────────────
    const credential = await this.credentialRepo.findById(EntityId.from(cmd.credentialId))
    if (!credential) throw new ApiCredentialNotFoundError()

    // 4.10 RevokeApiKeyUseCase no valida environment vs actor
    // Un merchant con solo keys test no debería poder revocar la key live del owner (si hay multi-user por merchant).
    // Hoy revokedByUserId === merchant.userId es el único check.
    // Para portfolio está OK (1 user por merchant), pero documentá la limitación.

    // ── 2. Cargar ApiClient (para verificar ownership) ────────────────────
    const apiClient = await this.apiClientRepo.findById(credential.apiClientId)
    if (!apiClient) {
      // Estado inconsistente: la credential apunta a un client que no existe.
      // No es "forbidden", es un bug de datos. Falla ruidosa.
      throw new ApiClientNotFoundError()
    }

    // ── 3. Autorización ───────────────────────────────────────────────────
    await this.assertActorCanRevoke(cmd, apiClient.merchantProfileId)

    // ── 4. Idempotencia: si ya estaba revoked, retorno sin tocar nada ─────
    if (!credential.isActive()) {
      console.log('Revoke API key: already revoked (no-op)', {
        credentialId: credential.id.value,
        revokedBy: cmd.revokedByUserId,
      })
      return {
        credentialId: credential.id.value,
        apiClientId: credential.apiClientId.value,
        environment: credential.environment,
        revokedAt: credential.revokedAt!,
        wasAlreadyRevoked: true,
      }
    }

    // ── 5. Revocar (con razón) ────────────────────────────────────────────
    credential.revoke(cmd.reason)
    await this.credentialRepo.save(credential)

    console.log('API key revoked', {
      credentialId: credential.id,
      apiClientId: credential.apiClientId,
      environment: credential.environment,
      revokedByUserId: cmd.revokedByUserId,
      revokedByRole: cmd.revokedByRole,
      reason: cmd.reason,
    })

    return {
      credentialId: credential.id.value,
      apiClientId: credential.apiClientId.value,
      environment: credential.environment,
      revokedAt: credential.revokedAt!,
      wasAlreadyRevoked: false,
    }
  }

  // -------------------------------------------------------------------------
  // Autorización
  // -------------------------------------------------------------------------

  private async assertActorCanRevoke(
    cmd: RevokeApiKeyCommand,
    merchantProfileId: EntityId,
  ): Promise<void> {
    // Admin puede revocar cualquier key.
    if (cmd.revokedByRole === RevokeActorRole.ADMIN) return

    // Merchant solo puede revocar keys de SU propio ApiClient.
    // Resolvemos el merchant y comparamos userId (dueño de la cuenta).
    if (cmd.revokedByRole === RevokeActorRole.MERCHANT) {
      const merchant = await this.merchantRepo.findById(merchantProfileId.value)
      if (!merchant) throw new ApiForbiddenError()
      if (merchant.userId !== cmd.revokedByUserId) throw new ApiForbiddenError()
      return
    }

    // Rol desconocido → fail closed.
    throw new ApiForbiddenError()
  }
}
