// modules/api-access/domain/api-credential.entity.ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { EntityId } from '@common/domain/vo/entity-id.vo'

// ============================================================================
// ApiCredential — la API key concreta (revocable, rotable)
//
// Relación: 1 `ApiClient` → N `ApiKey` (una por entorno, más rotaciones).
//
// Formato del rawKey:  sk_{env}_{32 bytes base64url}
//                       ↑    ↑    ↑
//                    "sk" "live"  aleatorio
//
// Persistencia:
//   - prefix   : primeros 12 chars (público, índice para lookup)1|
//   - keyHash  : SHA-256 hex del rawKey completo
//   - rawKey   : NUNCA se persiste. Solo se devuelve al emitir.
// ============================================================================

export enum ApiEnvironment {
  LIVE = 'LIVE',
  TEST = 'TEST',
}
export enum ApiCredentialStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

const KEY_PREFIX = 'sk'
const PREFIX_LOOKUP_LENGTH = 12 // "sk_live_abc1"
const RAW_KEY_BYTES = 32 // 256 bits de entropía

export interface IApiCredential {
  readonly id: EntityId
  readonly apiClientId: EntityId

  readonly environment: ApiEnvironment
  readonly prefix: string // "sk_live_abc1" — público
  readonly keyHash: string // SHA-256 hex

  readonly status: ApiCredentialStatus
  readonly createdAt: Date
  readonly lastUsedAt: Date | null
  readonly revokedAt: Date | null
  readonly revokedReason: string | null

  isActive(): boolean
  verify(rawApiKey: string): boolean
  touch(): void
  revoke(reason: string): void
}

// ---------------------------------------------------------------------------
// Props de emisión
// ---------------------------------------------------------------------------

export interface IssueApiCredentialProps {
  id: EntityId
  apiClientId: EntityId
  environment: ApiEnvironment
  createdAt?: Date
}

/**
 * Resultado de emitir una credencial.
 * `rawKey` SOLO existe acá y se devuelve al caller una única vez.
 * Después solo podés hacer `verify(rawKey)`, nunca recuperarlo.
 */
export interface IssuedApiCredential {
  credential: ApiCredential
  rawKey: string
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export class ApiCredential implements IApiCredential {
  private constructor(
    public readonly id: EntityId,
    public readonly apiClientId: EntityId,
    public readonly environment: ApiEnvironment,
    public readonly prefix: string,
    public readonly keyHash: string,
    private _status: ApiCredentialStatus,
    public readonly createdAt: Date,
    private _lastUsedAt: Date | null,
    private _revokedAt: Date | null,
    private _revokedReason: string | null,
  ) {}

  // -------------------------------------------------------------------------
  // Factories
  // -------------------------------------------------------------------------

  /**
   * Único punto donde se genera el rawKey.
   * La entidad se crea YA con el hash calculado — el rawKey no vive dentro.
   */
  static issue(props: IssueApiCredentialProps): IssuedApiCredential {
    const rawKey = ApiCredential.generateRawKey(props.environment)
    const prefix = rawKey.slice(0, PREFIX_LOOKUP_LENGTH)
    const keyHash = ApiCredential.hash(rawKey)

    const credential = new ApiCredential(
      props.id,
      props.apiClientId,
      props.environment,
      prefix,
      keyHash,
      ApiCredentialStatus.ACTIVE,
      props.createdAt ?? new Date(),
      null, // lastUsedAt
      null, // revokedAt
      null, // revokedReason
    )

    return { credential, rawKey }
  }

  static reconstitute(
    id: EntityId,
    apiClientId: EntityId,
    environment: ApiEnvironment,
    prefix: string,
    keyHash: string,
    status: ApiCredentialStatus,
    createdAt: Date,
    lastUsedAt: Date | null,
    revokedAt: Date | null,
    revokedReason: string | null,
  ): ApiCredential {
    return new ApiCredential(
      id,
      apiClientId,
      environment,
      prefix,
      keyHash,
      status,
      createdAt,
      lastUsedAt,
      revokedAt,
      revokedReason,
    )
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  get status(): ApiCredentialStatus {
    return this._status
  }
  get lastUsedAt(): Date | null {
    return this._lastUsedAt
  }
  get revokedAt(): Date | null {
    return this._revokedAt
  }
  get revokedReason(): string | null {
    return this._revokedReason
  }

  // -------------------------------------------------------------------------
  // Predicados + verificación
  // -------------------------------------------------------------------------

  isActive(): boolean {
    return this._status === ApiCredentialStatus.ACTIVE
  }

  /**
   * Compara `rawApiKey` contra el hash persistido.
   * - retorna false si la credencial no está activa
   * - retorna false si `rawApiKey` no matchea
   * - usa `timingSafeEqual` para evitar timing attacks
   */
  verify(rawApiKey: string): boolean {
    if (!this.isActive()) return false
    if (!rawApiKey || typeof rawApiKey !== 'string') return false

    const candidateHash = ApiCredential.hash(rawApiKey)
    const storedBuf = Buffer.from(this.keyHash, 'hex')
    const candidateBuf = Buffer.from(candidateHash, 'hex')

    if (storedBuf.length !== candidateBuf.length) return false
    return timingSafeEqual(storedBuf, candidateBuf)
  }

  /**
   * Registra uso. El guard llama a esto en fire & forget.
   * Es idempotente: si la credencial está revoked, no actualiza.
   */
  touch(at: Date = new Date()): void {
    if (this._status !== ApiCredentialStatus.ACTIVE) return
    this._lastUsedAt = at
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  revoke(reason: string): void {
    if (this._status === ApiCredentialStatus.REVOKED) return // idempotente
    if (!reason?.trim()) throw new Error('revoke: reason requerido')
    this._status = ApiCredentialStatus.REVOKED
    this._revokedAt = new Date()
    this._revokedReason = reason
  }

  // -------------------------------------------------------------------------
  // Key material (privado)
  // -------------------------------------------------------------------------

  private static generateRawKey(env: ApiEnvironment): string {
    const random = randomBytes(RAW_KEY_BYTES).toString('base64url')
    return `${KEY_PREFIX}_${env}_${random}`
  }

  private static hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex')
  }
}
