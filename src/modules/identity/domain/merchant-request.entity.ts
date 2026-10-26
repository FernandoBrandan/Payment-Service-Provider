import { DEFAULT_MERCHANT_FEE_BPS, MerchantRequestStatus } from './enums'

import { InvalidStateTransitionError } from '@common/domain/errors'
import { MerchantRequestNotPendingError } from './errors/identity.errors'

// ============================================================================
// IMerchantRequest — solicitud para ser comercio
// ============================================================================

interface IMerchantRequest {
  id: string
  userId: string /** FK -> IAuthUser.id. Quien envía la solicitud. */
  ownerId: string /** FK -> IUserProfile.id. Representante legal del negocio. */

  businessName: string
  taxId: string
  category: string

  // Cuenta business creada en S4 al aprobar la solicitud.
  // `null` mientras está `pending`.
  // Se copia a `IMerchantProfile.ledgerAccountId` al aprobar.
  provisionedLedgerAccountId?: string

  expectedMonthlyVolume?: number
  businessCurrency: string /** ISO 4217. */
  additionalNotes?: string

  //  Comisión propuesta al momento de la solicitud.
  //  Se copia a IMerchantProfile.feeBasisPoints al aprobar.
  requestedFeeBasisPoints: number

  status: MerchantRequestStatus

  requestedAt: Date
  reviewedAt?: Date
  reviewedByAdminId?: string
  reviewNotes?: string

  createdAt: Date
  updatedAt: Date

  // --- Predicados ---
  isPending(): boolean
  isApproved(): boolean
  isRejected(): boolean
  isCancelled(): boolean

  // --- Transiciones ---
  // Setea status="approved", reviewedAt=now(), reviewedByAdminId,
  // reviewNotes. El llamador (servicio de dominio) debe además:
  //  - crear IMerchantProfile a partir de estos datos
  //  - setear IUserProfile.merchantProfileId
  //  - setear IUserProfile.merchantApplicationStatus="approved"
  //  - grantRole("merchant") en IAuthUser
  approve(adminId: string, notes?: string): void

  // Setea status="rejected", reviewedAt=now(), reviewedByAdminId,
  // reviewNotes=reason.
  // El llamador debe setear IUserProfile.merchantApplicationStatus="rejected".
  reject(adminId: string, reason: string): void

  cancel(): void /** Solo si isPending(). Setea status="cancelled". */
}

// IMerchantRequestData es en realidad un MerchantRequestProps ????
export interface IMerchantRequestData {
  id: string
  userId: string
  ownerId: string
  businessName: string
  /** CUIT, RUT, RFC, NIF, etc. */
  taxId: string
  /** Rubro del negocio. */
  category: string
  requestedFeeBasisPoints: number
  /** Opcional: para evaluación de riesgo. */
  expectedMonthlyVolume?: number
  /** ISO 4217. Default: moneda del perfil al crear. */
  businessCurrency?: string
  additionalNotes?: string
  createdAt?: Date
  updatedAt?: Date
  requestedAt?: Date
}

export class MerchantRequest implements IMerchantRequest {
  constructor(
    public id: string,
    public userId: string,
    public ownerId: string,
    public status: MerchantRequestStatus,
    public businessName: string,
    public businessCurrency: string,
    public taxId: string,
    public category: string,
    public requestedFeeBasisPoints: number,
    public createdAt: Date,
    public updatedAt: Date,
    public requestedAt: Date,
    public provisionedLedgerAccountId?: string,
    public expectedMonthlyVolume?: number,
    public additionalNotes?: string,
    public reviewedAt?: Date,
    public reviewedByAdminId?: string,
    public reviewNotes?: string,
  ) {}

  static create(props: IMerchantRequestData): MerchantRequest {
    const now = new Date()
    return new MerchantRequest(
      props.id,
      props.userId,
      props.ownerId,
      MerchantRequestStatus.PENDING,
      props.businessName,
      props.businessCurrency ?? 'ARS',
      props.taxId,
      props.category,
      props.requestedFeeBasisPoints ?? DEFAULT_MERCHANT_FEE_BPS,
      props.createdAt ?? now,
      props.updatedAt ?? now,
      props.requestedAt ?? now,
      undefined,
      props.expectedMonthlyVolume,
      props.additionalNotes,
    )
  }

  isPending(): boolean {
    return this.status === MerchantRequestStatus.PENDING
  }
  isApproved(): boolean {
    return this.status === MerchantRequestStatus.APPROVED
  }
  isRejected(): boolean {
    return this.status === MerchantRequestStatus.REJECTED
  }
  isCancelled(): boolean {
    return this.status === MerchantRequestStatus.CANCELLED
  }
  approve(adminId: string, notes?: string): void {
    if (!this.isPending()) throw new MerchantRequestNotPendingError()
    const now = new Date()
    this.status = MerchantRequestStatus.APPROVED
    this.reviewedAt = now
    this.reviewedByAdminId = adminId
    this.reviewNotes = notes
    this.updatedAt = now
  }
  reject(adminId: string, reason: string): void {
    if (!this.isPending()) throw new MerchantRequestNotPendingError()
    const now = new Date()
    this.status = MerchantRequestStatus.REJECTED
    this.reviewedAt = now
    this.reviewedByAdminId = adminId
    this.reviewNotes = reason
    this.updatedAt = now
  }
  cancel(): void {
    if (!this.isPending()) throw new MerchantRequestNotPendingError()
    this.status = MerchantRequestStatus.CANCELLED
    this.updatedAt = new Date()
  }
}
