import { randomUUID } from 'crypto'
import { MerchantProfileStatus, MerchantRequestStatus } from './enums'
import { MerchantRequest } from './merchant-request.entity'
import { MerchantRequestNotApprovedError } from './errors/identity.errors'

// ============================================================================
// IMerchantProfile — perfil del comercio (post-aprobación)
// ============================================================================

interface IMerchantProfile {
  id: string
  /** FK -> IAuthUser.id. Usuario dueño de la cuenta. */
  userId: string
  /** FK -> IUserProfile.id. Representante legal (puede diferir de userId). */
  ownerId: string

  /** Cuenta destino en el Ledger (no el saldo). */
  ledgerAccountId?: string

  activeApiKeyCount: number

  businessName: string
  /** CUIT, RUT, RFC, NIF, etc. */
  taxId: string
  /** Rubro del negocio. */
  category: string

  /**
   * Comisión de la plataforma en basis points.
   * Rango válido: [0, 10000]. 250 = 2.5%.
   */
  feeBasisPoints: number

  status: MerchantProfileStatus
  /** Motivo del último cambio de estado. */
  statusReason?: string
  statusChangedAt?: Date

  approvedAt?: Date
  approvedByAdminId?: string

  deactivatedAt?: Date
  deactivatedReason?: string
  deactivatedByAdminId?: string

  /** Último admin que modificó el perfil (fee, status, etc.). */
  updatedByAdminId?: string

  createdAt: Date
  updatedAt: Date

  // --- Negocio ---
  isActive(): boolean

  /**
   * Actualiza la comisión. `bps` debe estar en [0, 10000].
   * Lanza `RangeError` si está fuera de rango.
   */
  updateFeeBasisPoints(bps: number, adminId: string): void

  /** Setea status="suspended", deactivatedAt, deactivatedReason, deactivatedByAdminId. */
  deactivate(reason: string, adminId: string): void

  /** Setea status="active", limpia campos de deactivated*. */
  reactivate(adminId: string): void
}

export class MerchantProfile implements IMerchantProfile {
  private static readonly TRANSITIONS: Record<MerchantProfileStatus, MerchantProfileStatus[]> = {
    [MerchantProfileStatus.ACTIVE]: [],
    [MerchantProfileStatus.PENDING_VERIFICATION]: [],
    [MerchantProfileStatus.SUSPENDED]: [],
    [MerchantProfileStatus.BANNED]: [],
  }

  constructor(
    public id: string,
    public userId: string,
    public ownerId: string,
    public activeApiKeyCount: number,
    public businessName: string,
    public taxId: string,
    public category: string,
    public feeBasisPoints: number,
    public status: MerchantProfileStatus,
    public createdAt: Date,
    public updatedAt: Date,
    public ledgerAccountId?: string,
    public statusReason?: string,
    public statusChangedAt?: Date,
    public approvedAt?: Date,
    public approvedByAdminId?: string,
    public deactivatedAt?: Date,
    public deactivatedReason?: string,
    public deactivatedByAdminId?: string,
    public updatedByAdminId?: string,
  ) {}

  static createFromRequest(
    request: MerchantRequest,
    opts: { id?: string; ledgerAccountId?: string; adminId?: string } = {},
  ): MerchantProfile {
    if (!request.isApproved()) throw new MerchantRequestNotApprovedError()

    const now = new Date()
    return new MerchantProfile(
      opts.id ?? randomUUID(),
      request.userId,
      request.ownerId,
      0,
      request.businessName,
      request.taxId,
      request.category,
      request.requestedFeeBasisPoints,
      MerchantProfileStatus.ACTIVE,
      now,
      now,
      opts.ledgerAccountId ?? request.provisionedLedgerAccountId,
      undefined,
      now,
      now,
      opts.adminId ?? request.reviewedByAdminId,
    )
  }

  isActive(): boolean {
    return this.status === MerchantProfileStatus.ACTIVE
  }
  updateFeeBasisPoints(bps: number, adminId: string): void {
    if (bps < 0 || bps > 10_000) throw new RangeError('feeBasisPoints out of range [0,10000]')
    this.feeBasisPoints = bps
    this.updatedByAdminId = adminId
    this.updatedAt = new Date()
  }
  deactivate(reason: string, adminId: string): void {
    const now = new Date()
    this.status = MerchantProfileStatus.SUSPENDED
    this.statusReason = reason
    this.statusChangedAt = now
    this.deactivatedAt = now
    this.deactivatedReason = reason
    this.deactivatedByAdminId = adminId
    this.updatedAt = now
  }

  reactivate(adminId: string): void {
    const now = new Date()
    this.status = MerchantProfileStatus.ACTIVE
    this.statusReason = undefined
    this.statusChangedAt = now
    this.deactivatedAt = undefined
    this.deactivatedReason = undefined
    this.deactivatedByAdminId = undefined
    this.updatedByAdminId = adminId
    this.updatedAt = now
  }
}
