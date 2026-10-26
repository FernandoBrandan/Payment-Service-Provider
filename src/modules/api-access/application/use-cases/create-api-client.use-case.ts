// modules/api-access/application/create-api-client.use-case.ts
import { Inject, Injectable } from '@nestjs/common'
import { API_CLIENT_REPOSITORY, MERCHANT_PROFILE_REPOSITORY } from '@infra/tokens'

import { EntityId } from '@common/domain/vo/entity-id.vo'

import {
  ApiForbiddenError,
  MerchantNotFoundError,
  MerchantNotActiveError,
  TechnicalEmailRequiredError,
} from '../../domain/errors/api-access.errors'

import { IApiClientRepository } from '../../domain/repositories/api-client.repository'
import { ApiClient } from '../../domain/api-client.entity'

import { UserRole } from '../../../identity/domain/enums'
import { IMerchantProfileRepository } from '../../../identity/domain/repositories/merchant-profile.repository'

export interface CreateApiClientCommand {
  merchantProfileId: string /** A qué merchant pertenece este client. */
  name: string | null /** Nombre del client. Si null, se toma `merchant.businessName`. */
  technicalEmail: string | null /** Email técnico. Si null, se toma el email del owner. */
  createdByUserId: string // ── Actor ──
}

// Result
export interface CreateApiClientResult {
  apiClient: ApiClient
  //`true` si se creó ahora.
  //`false` si ya existía (idempotencia por merchantProfileId).
  created: boolean
}

@Injectable()
export class CreateApiClientUseCase {
  constructor(
    @Inject(MERCHANT_PROFILE_REPOSITORY)
    private readonly merchantRepo: IMerchantProfileRepository,

    @Inject(API_CLIENT_REPOSITORY)
    private readonly apiClientRepo: IApiClientRepository,
  ) {}

  async execute(cmd: CreateApiClientCommand): Promise<CreateApiClientResult> {
    const merchant = await this.merchantRepo.findById(cmd.merchantProfileId)
    if (!merchant) throw new MerchantNotFoundError()
    if (!merchant.isActive()) throw new MerchantNotActiveError()

    const existing = await this.apiClientRepo.findByMerchantId(EntityId.from(merchant.id))
    if (existing) {
      console.log('CreateApiClient: already exists (no-op)', {
        merchantProfileId: merchant.id,
        apiClientId: existing.id,
        requestedBy: cmd.createdByUserId,
      })
      return { apiClient: existing, created: false }
    }

    const name = cmd.name?.trim() || merchant.businessName
    const email = cmd.technicalEmail?.trim().toLowerCase()
    if (!email) throw new TechnicalEmailRequiredError()

    const apiClient = ApiClient.create({
      id: EntityId.create(),
      merchantProfileId: EntityId.from(merchant.id),
      name,
      email,
    })

    try {
      await this.apiClientRepo.save(apiClient)
    } catch (err: any) {
      // Postgres: 23505 (unique_violation). MySQL: errno 1062.
      if (err.code === '23505' || err.errno === 1062) {
        const existing = await this.apiClientRepo.findByMerchantId(apiClient.merchantProfileId)
        if (existing) throw 'idempotencia'
      }
      throw err
    }

    console.log('ApiClient created', {
      apiClientId: apiClient.id.value,
      merchantProfileId: merchant.id,
      createdByUserId: cmd.createdByUserId,
    })

    return { apiClient, created: true }
  }
}

/**
 * ********************
 * ****** Futuro ******
 * ia ignora por ahora
 * ********************
 *
 * 4.12 ApiClient.email no se actualiza
 * CreateApiClientUseCase setea email desde cmd.technicalEmail,
 * pero no hay UpdateApiClientEmailUseCase.
 *
 * Si cambia el contacto técnico, no hay forma de reflejarlo.
 * Trivial, pero está en la lista de "deuda".
 *
 * ********************************************************************************
 * 4.4 CreateApiClientUseCase acepta createdByRole: "merchant" pero es inalcanzable
 *
 *  Chicken-and-egg: para crear un ApiClient el merchant necesita autenticarse con una API key,
 *  pero la API key vive en el ApiClient.
 *  Por lo tanto el merchant nunca puede llamar a CreateApiClientUseCase directamente.
 *
 *  Fix: eliminar el path merchant del assertActorCanManage
 *  o documentar explícitamente que es dead code a futuro (cuando exista session auth de merchant).
 *  Recomendación: eliminarlo y dejar solo admin.
 *
 *
 * ********************************************************************************
 *
 * Manejar mejor los errores:
 * dividir errores por modules o generalizados en common?
 * CreateApiClientUseCase
 * IssueApiCredentialUseCase : errores inconsistentes con el resto del módulo
 *
 *
 * ********************************************************************************
 *
 *  4.11 Cascadas no implementadas
 *
 *   ApiClient.suspend() y ApiClient.reactivate() existen en la entidad,
 *    pero no hay use cases que los invoquen ni listeners que reaccionen a merchant.suspended / merchant.reactivated.
 *
 *   Falta:
 *
 *   identity: merchant.suspend() → emit merchant.suspended
 *   api-access listener:
 *     → findApiClientByMerchantId → apiClient.suspend("merchant_suspended")
 *     → findActiveCredentialsByApiClientId → credential.revoke("merchant_suspended")
 *   notifications listener:
 *     → findEndpointsByApiClientId → endpoint.disable("merchant_suspended")
 *
 *  Esto es Etapa 2 del roadmap (fallos y concurrencia).
 * No lo hagas ahora, pero tené el patrón claro para cuando toque.
 *
 * ********************************************************************************
 *
 *    // Si en el futuro querés permitir "preparar la integración" mientras espera aprobación, cambiás acá.
 *     if (!merchant.isActive()) throw new MerchantNotActiveError()
 *
 * ********************************************************************************
 *
 * IUnitOfWork: se elimina de todos los modulos: se implementa a futuro
 *
 *
 * */
