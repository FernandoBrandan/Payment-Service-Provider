// src/modules/identity/domain/errors/identity.errors.ts
import {
  DomainAuthError,
  DomainConflictError,
  DomainNotFoundError,
} from '@common/domain/errors/domain.error'

// ── 401 — Autenticación ────────────────────────────────────────────────
export class InvalidCredentialsError extends DomainAuthError {
  readonly code = 'invalid_credentials'
  constructor() {
    super('Invalid credentials')
  }
}

export class InvalidRefreshTokenError extends DomainAuthError {
  readonly code = 'invalid_refresh_token'
  constructor() {
    super('Invalid refresh token')
  }
}

export class AccountLockedError extends DomainAuthError {
  readonly code = 'account_locked'
  constructor() {
    super('Account is locked')
  }
}

export class AccountNotActiveError extends DomainAuthError {
  readonly code = 'account_not_active'
  constructor() {
    super('Account is not active')
  }
}

export class NoPasswordHashError extends DomainAuthError {
  readonly code = 'no_password_hash'
  constructor() {
    super('Account has no password (OAuth-only)')
  }
}

// ── 404 — No encontrado ────────────────────────────────────────────────
export class UserNotFoundError extends DomainNotFoundError {
  readonly code = 'user_not_found'
  constructor(id?: string) {
    super(id ? `User not found: ${id}` : 'User not found')
  }
}

export class AuthUserNotFoundError extends DomainNotFoundError {
  readonly code = 'auth_user_not_found'
  constructor(id?: string) {
    super(id ? `Auth user not found: ${id}` : 'Auth user not found')
  }
}

export class MerchantNotFoundError extends DomainNotFoundError {
  readonly code = 'merchant_not_found'
  constructor(id?: string) {
    super(id ? `Merchant not found: ${id}` : 'Merchant not found')
  }
}

export class MerchantRequestNotFoundError extends DomainNotFoundError {
  readonly code = 'merchant_request_not_found'
  constructor(id?: string) {
    super(id ? `Merchant request not found: ${id}` : 'Merchant request not found')
  }
}

// ── 409 — Conflicto ────────────────────────────────────────────────────
export class EmailAlreadyUsedError extends DomainConflictError {
  readonly code = 'email_already_used'
  constructor() {
    super('Email already in use')
  }
}

export class MerchantRequestNotPendingError extends DomainConflictError {
  readonly code = 'merchant_request_not_pending'
  constructor() {
    super('Merchant request is not pending')
  }
}

export class MerchantRequestAlreadyPendingError extends DomainConflictError {
  readonly code = 'merchant_request_already_pending'
  constructor() {
    super('Merchant request already pending')
  }
}

export class MerchantRequestNotApprovedError extends DomainConflictError {
  readonly code = 'merchant_request_not_approved'
  constructor() {
    super('Merchant request is not approved')
  }
}

export class MerchantNotActiveError extends DomainConflictError {
  readonly code = 'merchant_not_active'
  constructor() {
    super('Merchant is not active')
  }
}

export class UserAlreadyMerchantError extends DomainConflictError {
  readonly code = 'user_already_merchant'
  constructor() {
    super('User is already a merchant')
  }
}
