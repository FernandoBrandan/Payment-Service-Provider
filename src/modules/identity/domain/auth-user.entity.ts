import { AccountStatus, UserRole } from './enums'
import { InvalidStateTransitionError } from '@common/domain/errors'

interface IAuthUser {
  id: string
  email: string

  passwordHash?: string /** `null` para cuentas 100% OAuth (Google, Apple, etc.). */

  emailVerified: boolean
  emailVerifiedAt?: Date

  roles: UserRole[] //Fuente única de verdad de roles. Un usuario puede ser simultáneamente `client` y `merchant`.

  status: AccountStatus
  statusReason?: string
  statusChangedAt?: Date

  // --- Ban ---
  bannedAt?: Date
  banReason?: string
  bannedByAdminId?: string

  // --- Sesión / seguridad ---
  lastLoginAt?: Date
  passwordChangedAt?: Date
  twoFactorEnabled: boolean
  twoFactorSecret?: string
  failedLoginAttempts: number
  lockedUntil?: Date

  createdAt: Date
  updatedAt: Date

  // --- Password ---
  // Compara `candidatePassword` con `passwordHash`.
  // Lanza `Error("NO_PASSWORD_HASH")` si la cuenta es OAuth-only
  // (passwordHash === null).

  updatePassword(newPasswordHash: string): void

  // --- Roles ---
  hasRole(role: UserRole): boolean
  hasAnyRole(roles: UserRole[]): boolean
  grantRole(role: UserRole): void
  revokeRole(role: UserRole): void

  // --- Estado ---
  isAccountActive(): boolean
  /** `true` si `lockedUntil > now()` (bloqueo por intentos fallidos). */
  isLocked(): boolean

  // --- Lifecycle ---
  /** Idempotente: setea emailVerified=true y emailVerifiedAt=now(). */
  markEmailAsVerified(): void

  // Registra login exitoso:
  // - lastLoginAt = now()
  // - failedLoginAttempts = 0
  // - lockedUntil = null
  recordSuccessfulLogin(): void

  // Incrementa failedLoginAttempts. Si alcanza `maxAttempts`,
  // setea lockedUntil = now() + lockDurationMinutes.
  recordFailedLogin(maxAttempts: number, lockDurationMinutes: number): void

  ban(reason: string, adminId: string): void
  unban(adminId: string): void
  suspend(reason: string, adminId: string): void
  reactivate(): void
}

interface CreateAuthUserProps {
  id: string
  email: string
  createdAt?: Date
  updatedAt?: Date
}

export class AuthUser implements IAuthUser {
  private static readonly TRANSITIONS: Record<AccountStatus, AccountStatus[]> = {
    [AccountStatus.ACTIVE]: [
      AccountStatus.SUSPENDED,
      AccountStatus.PENDING_VERIFICATION,
      AccountStatus.BANNED,
    ],
    [AccountStatus.SUSPENDED]: [AccountStatus.ACTIVE, AccountStatus.BANNED],
    [AccountStatus.PENDING_VERIFICATION]: [AccountStatus.ACTIVE, AccountStatus.BANNED],
    [AccountStatus.BANNED]: [AccountStatus.ACTIVE],
  }

  constructor(
    public id: string,
    public email: string,
    public emailVerified: boolean,
    public roles: UserRole[],
    private _status: AccountStatus,
    public twoFactorEnabled: boolean,
    public failedLoginAttempts: number,
    public createdAt: Date,
    public updatedAt: Date,

    public passwordHash?: string,
    public emailVerifiedAt?: Date,
    public statusReason?: string,
    public statusChangedAt?: Date,
    public bannedAt?: Date,
    public banReason?: string,
    public bannedByAdminId?: string,
    public lastLoginAt?: Date,
    public passwordChangedAt?: Date,
    public twoFactorSecret?: string,
    public lockedUntil?: Date,
  ) {}
  static create(props: CreateAuthUserProps): AuthUser {
    return new AuthUser(
      props.id,
      props.email,
      false,
      [UserRole.CLIENT],
      AccountStatus.ACTIVE,
      false,
      0,
      props.createdAt ?? new Date(),
      props.updatedAt ?? new Date(),
    )
  }
  static reconstitute(
    id: string,
    email: string,
    emailVerified: boolean,
    roles: UserRole[],
    status: AccountStatus,
    twoFactorEnabled: boolean,
    failedLoginAttempts: number,
    createdAt: Date,
    updatedAt: Date,
    passwordHash?: string,
    emailVerifiedAt?: Date,
    statusReason?: string,
    statusChangedAt?: Date,
    bannedAt?: Date,
    banReason?: string,
    bannedByAdminId?: string,
    lastLoginAt?: Date,
    passwordChangedAt?: Date,
    twoFactorSecret?: string,
    lockedUntil?: Date,
  ) {
    return new AuthUser(
      id,
      email,
      emailVerified,
      [...roles],
      status,
      twoFactorEnabled,
      failedLoginAttempts,
      createdAt,
      updatedAt,
      passwordHash ?? undefined,
      emailVerifiedAt ?? undefined,
      statusReason ?? undefined,
      statusChangedAt ?? undefined,
      bannedAt ?? undefined,
      banReason ?? undefined,
      bannedByAdminId ?? undefined,
      lastLoginAt ?? undefined,
      passwordChangedAt ?? undefined,
      twoFactorSecret ?? undefined,
      lockedUntil ?? undefined,
    )
  }

  get status(): AccountStatus {
    return this._status
  }

  private transitionTo(to: AccountStatus): void {
    if (this._status === to) return
    const allowed = AuthUser.TRANSITIONS[this._status]
    if (!allowed.includes(to)) throw new InvalidStateTransitionError('AuthUser', this._status, to)
    this._status = to
  }

  updatePassword(newPasswordHash: string): void {
    const now = new Date()
    this.passwordHash = newPasswordHash
    this.passwordChangedAt = now
    this.updatedAt = now
  }
  hasRole(role: UserRole): boolean {
    return this.roles.includes(role)
  }
  hasAnyRole(roles: UserRole[]): boolean {
    return roles.some((r) => this.roles.includes(r))
  }
  grantRole(role: UserRole): void {
    if (this.hasRole(role)) return
    this.roles.push(role)
    this.updatedAt = new Date()
  }
  revokeRole(role: UserRole): void {
    const next = this.roles.filter((r) => r !== role)
    if (next.length === this.roles.length) return
    this.roles = next
    this.updatedAt = new Date()
  }
  isAccountActive(): boolean {
    return this.status === AccountStatus.ACTIVE
  }
  isLocked(): boolean {
    return Boolean(this.lockedUntil && this.lockedUntil.getTime() > Date.now())
  }
  markEmailAsVerified(): void {
    if (this.emailVerified && this.emailVerifiedAt) return
    const now = new Date()
    this.emailVerified = true
    this.emailVerifiedAt = this.emailVerifiedAt ?? now
    this.updatedAt = now
  }
  recordSuccessfulLogin(): void {
    const now = new Date()
    this.lastLoginAt = now
    this.failedLoginAttempts = 0
    this.lockedUntil = undefined
    this.updatedAt = now
  }
  recordFailedLogin(maxAttempts: number, lockDurationMinutes: number): void {
    const now = new Date()
    this.failedLoginAttempts += 1
    if (this.failedLoginAttempts >= maxAttempts) {
      this.lockedUntil = new Date(now.getTime() + lockDurationMinutes * 60_000)
    }
    this.updatedAt = now
  }
  ban(reason: string, adminId: string): void {
    this.transitionTo(AccountStatus.BANNED)
    const now = new Date()
    this.statusReason = reason
    this.statusChangedAt = now
    this.bannedAt = now
    this.banReason = reason
    this.bannedByAdminId = adminId
    this.updatedAt = now
  }
  unban(_adminId: string): void {
    this.transitionTo(AccountStatus.ACTIVE)
    const now = new Date()
    this.statusReason = undefined
    this.statusChangedAt = now
    this.bannedAt = undefined
    this.banReason = undefined
    this.bannedByAdminId = undefined
    this.updatedAt = now
  }
  suspend(reason: string, _adminId: string): void {
    this.transitionTo(AccountStatus.SUSPENDED)
    const now = new Date()
    this.statusReason = reason
    this.statusChangedAt = now
    this.updatedAt = now
  }
  reactivate(): void {
    this.transitionTo(AccountStatus.ACTIVE)
    const now = new Date()
    this.statusReason = undefined
    this.statusChangedAt = now
    this.updatedAt = now
  }
}
