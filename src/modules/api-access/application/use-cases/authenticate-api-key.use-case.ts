// modules/api-access/application/authenticate-api-key.use-case.ts
import { Inject, Injectable } from '@nestjs/common'

import {
  API_CLIENT_REPOSITORY,
  API_CREDENTIAL_REPOSITORY,
  MERCHANT_PROFILE_REPOSITORY,
} from '../../../../infra/tokens'

import {
  MissingTokenError,
  InvalidTokenError,
  RevokedTokenError,
  ClientSuspendedAuthError,
  MerchantInactiveAuthError,
} from '../../domain/errors/api-access.errors'

import { IApiClientRepository } from '../../domain/repositories/api-client.repository'
import { IApiCredentialRepository } from '../../domain/repositories/api-credential.repository'
import { IMerchantProfileRepository } from '../../../identity/domain/repositories/merchant-profile.repository'

import { ApiClient } from '../../domain/api-client.entity'
import { ApiCredential } from '../../domain/api-credential.entity' // ajustá el import

import { MerchantProfile } from '../../../identity/domain/merchant-profile.entity'

// ============================================================================
// Command / Result
// ============================================================================
export interface AuthenticateApiKeyCommand {
  // La key tal cual vino en `Authorization: Bearer <rawApiKey>`.
  // El guard la extrae, este use case la valida.
  rawApiKey: string | null | undefined
}

//  Contexto autenticado que el guard adjunta al request.
//  Contiene todo lo que los endpoints privados necesitan sin volver a tocar repositorios.
export interface ApiAuthContext {
  credential: ApiCredential
  apiClient: ApiClient
  merchant: MerchantProfile
}

@Injectable()
export class AuthenticateApiKeyUseCase {
  constructor(
    @Inject(MERCHANT_PROFILE_REPOSITORY)
    private readonly merchantRepo: IMerchantProfileRepository,

    @Inject(API_CLIENT_REPOSITORY)
    private readonly apiClientRepo: IApiClientRepository,

    @Inject(API_CREDENTIAL_REPOSITORY)
    private readonly credentialRepo: IApiCredentialRepository,
  ) {}

  async execute(cmd: AuthenticateApiKeyCommand): Promise<ApiAuthContext> {
    const raw = cmd.rawApiKey?.trim()
    if (!raw) throw new MissingTokenError()

    if (raw.length < 20 || !raw.startsWith('sk_')) throw new InvalidTokenError()

    const prefix = raw.slice(0, 12)
    const credential = await this.credentialRepo.findByPrefix(prefix)
    if (!credential) throw new InvalidTokenError()
    if (!credential.isActive()) throw new RevokedTokenError()
    if (!credential.verify(raw)) throw new InvalidTokenError()

    const apiClient = await this.apiClientRepo.findById(credential.apiClientId)
    if (!apiClient || !apiClient.isActive()) throw new ClientSuspendedAuthError()

    const merchant = await this.merchantRepo.findById(apiClient.merchantProfileId.value)
    if (!merchant || !merchant.isActive()) throw new MerchantInactiveAuthError()

    credential.touch()
    void this.credentialRepo.save(credential).catch((err: unknown) => {
      console.log('warn', 'Failed to update lastUsedAt', {
        credentialId: credential.id,
        error: err instanceof Error ? err.message : String(err),
      })
    })

    return { credential, apiClient, merchant } // corregir por los id, comentario abajo
    // return { credentialId, apiClientId, merchantId }; + apiClient + merchant si los endpoints necesitan esos datos
  }
}

/**
 * Notas
 *
 *  ── 5. Merchant activo ────────────────────────────────────────────────
 *  Fail-closed: si el merchant está suspendido/pending/banned,
 *  la key no puede operar, aunque la credencial y el client estén OK.
 *  const merchant = await this.merchantRepo.findById(apiClient.merchantProfileId)
 *  if (!merchant || !merchant.isActive()) throw new ApiAuthenticationError('merchant_inactive')
 *
 *
 * ── 6. Fire & forget: registrar uso ───────────────────────────────────
 * No bloqueamos el request esperando el save. Si falla, se loguea.
 * credential.touch()
 * void this.credentialRepo.save(credential).catch((err: unknown) => {
 */
