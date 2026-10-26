import {
  KycStatus,
  MerchantApplicationStatus,
  DocumentType,
  IAddress,
  IUserPreferences,
  UpdatableProfileFields,
  DEFAULT_USER_PREFERENCES,
} from './enums'
import {
  MerchantRequestAlreadyPendingError,
  UserAlreadyMerchantError,
} from './errors/identity.errors'
import { MerchantRequest, IMerchantRequestData } from './merchant-request.entity'
import { InvalidStateTransitionError } from '@common/domain/errors'

// ============================================================================
// IUserProfile — datos personales, KYC y workflow de comercio
// ============================================================================

interface IUserProfile {
  id: string
  userId: string /** FK -> IAuthUser.id */

  firstName: string
  lastName: string
  phone?: string
  dateOfBirth?: Date

  //  Deben estar ambos en null o ambos seteados
  //  (invariante validada en el dominio, no en el tipo).
  documentType?: DocumentType
  documentId?: string

  address?: IAddress
  avatarUrl?: string

  preferences: IUserPreferences

  // --- KYC ---
  kycStatus: KycStatus
  kycReviewedAt?: Date
  kycReviewedByAdminId?: string

  /** Cuenta destino en el Ledger (no el saldo). */
  ledgerAccountId?: string

  // --- Comercio ---
  /** FK -> IMerchantProfile. `null` si el usuario nunca fue aprobado como comercio. */
  merchantProfileId?: string
  /** Cache denormalizado. Debe sincronizarse al aprobar/rechazar una IMerchantRequest. */
  merchantApplicationStatus: MerchantApplicationStatus
  /** FK -> IMerchantRequest de la última solicitud (pendiente o resuelta). */
  merchantRequestId?: string

  createdAt: Date
  updatedAt: Date
  deletedAt?: Date

  // --- Negocio ---
  getFullName(): string

  hasMerchantProfile(): boolean
  hasPendingMerchantRequest(): boolean
  isDeleted(): boolean

  // --- Lifecycle ---
  softDelete(): void /** Setea deletedAt = now(). No borra físicamente. */
  restore(): void /** Setea deletedAt = null. */

  // --- Updates ---
  updateProfile(updates: Partial<UpdatableProfileFields>): void
  updatePreferences(updates: Partial<IUserPreferences>): void

  // --- Workflow de comercio ---
  requestMerchantRole(requestData: IMerchantRequestData): Promise<MerchantRequest>
}

interface CreateUserProfileProps {
  id: string
  userId: string
  firstName?: string
  lastName?: string
  createdAt?: Date
  updatedAt?: Date
}

export class UserProfile implements IUserProfile {
  private static readonly TRANSITIONS: Record<
    MerchantApplicationStatus,
    MerchantApplicationStatus[]
  > = {
    [MerchantApplicationStatus.NONE]: [MerchantApplicationStatus.PENDING],
    [MerchantApplicationStatus.PENDING]: [
      MerchantApplicationStatus.APPROVED,
      MerchantApplicationStatus.REJECTED,
    ],
    [MerchantApplicationStatus.APPROVED]: [],
    [MerchantApplicationStatus.REJECTED]: [MerchantApplicationStatus.PENDING],
  }

  constructor(
    public id: string,
    public userId: string,
    public firstName: string,
    public lastName: string,
    public preferences: IUserPreferences,
    public kycStatus: KycStatus,
    private _merchantApplicationStatus: MerchantApplicationStatus,
    public createdAt: Date,
    public updatedAt: Date,
    public phone?: string,
    public dateOfBirth?: Date,
    public documentType?: DocumentType,
    public documentId?: string,
    public address?: IAddress,
    public avatarUrl?: string,
    public kycReviewedAt?: Date,
    public kycReviewedByAdminId?: string,
    public ledgerAccountId?: string,
    public merchantProfileId?: string,
    public merchantRequestId?: string,
    public deletedAt?: Date,
  ) {}

  static create(props: CreateUserProfileProps): UserProfile {
    const now = new Date()
    return new UserProfile(
      props.id,
      props.userId,
      props.firstName ?? '',
      props.lastName ?? '',
      { ...DEFAULT_USER_PREFERENCES },
      KycStatus.PENDING,
      MerchantApplicationStatus.NONE,
      props.createdAt ?? now,
      props.updatedAt ?? now,
    )
  }

  static reconstitute(
    id: string,
    userId: string,
    firstName: string,
    lastName: string,
    preferences: IUserPreferences,
    kycStatus: KycStatus,
    merchantApplicationStatus: MerchantApplicationStatus,
    createdAt: Date,
    updatedAt: Date,
    phone?: string,
    dateOfBirth?: Date,
    documentType?: DocumentType,
    documentId?: string,
    address?: IAddress,
    avatarUrl?: string,
    kycReviewedAt?: Date,
    kycReviewedByAdminId?: string,
    ledgerAccountId?: string,
    merchantProfileId?: string,
    merchantRequestId?: string,
    deletedAt?: Date,
  ) {
    return new UserProfile(
      id,
      userId,
      firstName,
      lastName,
      preferences,
      kycStatus,
      merchantApplicationStatus,
      createdAt,
      updatedAt,
      phone,
      dateOfBirth,
      documentType,
      documentId,
      address,
      avatarUrl,
      kycReviewedAt,
      kycReviewedByAdminId,
      ledgerAccountId,
      merchantProfileId,
      merchantRequestId,
      deletedAt,
    )
  }

  get merchantApplicationStatus(): MerchantApplicationStatus {
    return this._merchantApplicationStatus
  }

  private transitionTo(to: MerchantApplicationStatus): void {
    if (this._merchantApplicationStatus === to) return
    const allowed = UserProfile.TRANSITIONS[this._merchantApplicationStatus]
    if (!allowed.includes(to))
      throw new InvalidStateTransitionError('UserProfile', this._merchantApplicationStatus, to)
    this._merchantApplicationStatus = to
  }

  getFullName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ').trim()
  }
  hasMerchantProfile(): boolean {
    return Boolean(this.merchantProfileId)
  }
  hasPendingMerchantRequest(): boolean {
    return this.merchantApplicationStatus === MerchantApplicationStatus.PENDING
  }
  isDeleted(): boolean {
    return Boolean(this.deletedAt)
  }
  softDelete(): void {
    const now = new Date()
    this.deletedAt = now
    this.updatedAt = now
  }
  restore(): void {
    this.deletedAt = undefined
    this.updatedAt = new Date()
  }
  updateProfile(updates: Partial<UpdatableProfileFields>): void {
    Object.assign(this, updates)
    this.updatedAt = new Date()
  }
  updatePreferences(updates: Partial<IUserPreferences>): void {
    this.preferences = { ...this.preferences, ...updates }
    this.updatedAt = new Date()
  }

  // Crea una IMerchantRequest en estado `pending`, setea
  // merchantRequestId y merchantApplicationStatus = "pending".
  // @returns la solicitud creada para revisión del admin.
  requestMerchantRole(requestData: IMerchantRequestData): Promise<MerchantRequest> {
    if (this.hasPendingMerchantRequest()) throw new MerchantRequestAlreadyPendingError()
    if (this.hasMerchantProfile()) throw new UserAlreadyMerchantError()

    const request = MerchantRequest.create(requestData)
    this.merchantRequestId = request.id
    this.transitionTo(MerchantApplicationStatus.PENDING)
    this.updatedAt = new Date()

    return Promise.resolve(request)
  }

  /** Domain helper — lo usa ApproveMerchantUseCase */
  linkMerchantProfile(merchantProfileId: string, requestId: string): void {
    this.merchantProfileId = merchantProfileId
    this.merchantRequestId = requestId
    this.transitionTo(MerchantApplicationStatus.APPROVED)
    this.updatedAt = new Date()
  }

  markMerchantRequestRejected(requestId: string): void {
    this.merchantRequestId = requestId
    this.transitionTo(MerchantApplicationStatus.REJECTED)
    this.updatedAt = new Date()
  }
}
