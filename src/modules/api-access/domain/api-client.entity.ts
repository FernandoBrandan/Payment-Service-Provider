// comercio/cliente

// ApiClient (el comercio)
//   ├── ApiKey (×N, por entorno + rotación)
//   ├── WebhookEndpoint (×N)
//   └── Payment (×N, los pagos que procesa con vos)

// WebhookDelivery (intentos de entrega, ligado a WebhookEndpoint)

// modules/api-access/domain/api-client.entity.ts
// ============================================================================
// ApiClient — la "cuenta de desarrollador" del merchant dentro de S3
//
// Relación (portfolio):
//   IMerchantProfile  1 ──── 1  ApiClient
//                              ├── 0..N ApiCredential
//                              └── 0..N WebhookEndpoint
//
// El merchant NO es el ApiClient: el merchant es el comercio,
// el ApiClient es la identidad técnica que consume la API.
// En portfolio son 1:1, pero si mañana un merchant quiere una
// segunda integración (ej. una app móvil), agregás otro ApiClient
// sin tocar ApiCredential ni WebhookEndpoint.
// ============================================================================
import { EntityId } from '@common/domain/vo/entity-id.vo'

export enum ApiClientStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface IApiClient {
  readonly id: EntityId
  /** FK → IMerchantProfile.id */
  readonly merchantProfileId: EntityId

  readonly name: string // "Mi Ecommerce"
  readonly email: string // contacto técnico

  readonly status: ApiClientStatus
  readonly suspendedReason: string | null
  readonly suspendedAt: Date | null

  readonly createdAt: Date
  readonly updatedAt: Date

  isActive(): boolean
  suspend(reason: string): void
  reactivate(): void
}

export interface CreateApiClientProps {
  id: EntityId
  merchantProfileId: EntityId
  name: string
  email: string
  createdAt?: Date
}

export class ApiClient implements IApiClient {
  private constructor(
    public readonly id: EntityId,
    public readonly merchantProfileId: EntityId,
    public readonly name: string,
    public readonly email: string,
    private _status: ApiClientStatus,
    private _suspendedReason: string | null,
    private _suspendedAt: Date | null,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {
    if (!email?.trim()) throw new Error('ApiClient.email requerido')
    if (!name?.trim()) throw new Error('ApiClient.name requerido')
  }

  static create(props: CreateApiClientProps): ApiClient {
    const now = props.createdAt ?? new Date()
    return new ApiClient(
      props.id,
      props.merchantProfileId,
      props.name.trim(),
      props.email.trim().toLowerCase(),
      ApiClientStatus.ACTIVE, // nace activo: la verificación del merchant ya ocurrió
      null,
      null,
      now,
      now,
    )
  }

  static reconstitute(
    id: EntityId,
    merchantProfileId: EntityId,
    name: string,
    email: string,
    status: ApiClientStatus,
    suspendedReason: string | null,
    suspendedAt: Date | null,
    createdAt: Date,
    updatedAt: Date,
  ): ApiClient {
    return new ApiClient(
      id,
      merchantProfileId,
      name,
      email,
      status,
      suspendedReason,
      suspendedAt,
      createdAt,
      updatedAt,
    )
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  get status(): ApiClientStatus {
    return this._status
  }
  get suspendedReason(): string | null {
    return this._suspendedReason
  }
  get suspendedAt(): Date | null {
    return this._suspendedAt
  }
  get updatedAt(): Date {
    return this._updatedAt
  }

  // -------------------------------------------------------------------------
  // Predicados
  // -------------------------------------------------------------------------

  isActive(): boolean {
    return this._status === ApiClientStatus.ACTIVE
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  suspend(reason: string): void {
    if (this._status === ApiClientStatus.SUSPENDED) return // idempotente
    if (!reason?.trim()) throw new Error('suspend: reason requerido')
    this._status = ApiClientStatus.SUSPENDED
    this._suspendedReason = reason
    this._suspendedAt = new Date()
    this._updatedAt = this._suspendedAt
  }

  reactivate(): void {
    if (this._status === ApiClientStatus.ACTIVE) return // idempotente
    this._status = ApiClientStatus.ACTIVE
    this._suspendedReason = null
    this._suspendedAt = null
    this._updatedAt = new Date()
  }
}
