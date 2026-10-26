// src/modules/api-access/domain/errors/api-access.errors.ts
import {
  DomainAuthError,
  DomainConflictError,
  DomainForbiddenError,
  DomainNotFoundError,
  DomainValidationError,
} from '@common/domain/errors/domain.error'

// ── 401 — Autenticación ────────────────────────────────────────────────
export class MissingTokenError extends DomainAuthError {
  readonly code = 'missing_token'
  constructor() {
    super('Missing API key')
  }
}

export class InvalidTokenError extends DomainAuthError {
  readonly code = 'invalid_token'
  constructor() {
    super('Invalid API key')
  }
}

export class RevokedTokenError extends DomainAuthError {
  readonly code = 'revoked_token'
  constructor() {
    super('API key revoked')
  }
}

export class ClientSuspendedAuthError extends DomainAuthError {
  readonly code = 'client_suspended'
  constructor() {
    super('API client suspended')
  }
}

export class MerchantInactiveAuthError extends DomainAuthError {
  readonly code = 'merchant_inactive'
  constructor() {
    super('Merchant inactive')
  }
}

// ── 403 — Autorización ─────────────────────────────────────────────────
export class ApiForbiddenError extends DomainForbiddenError {
  readonly code = 'forbidden'
  constructor(message = 'Forbidden') {
    super(message)
  }
}

// ── 404 — No encontrado ────────────────────────────────────────────────
export class MerchantNotFoundError extends DomainNotFoundError {
  readonly code = 'merchant_not_found'
  constructor(id?: string) {
    super(id ? `Merchant not found: ${id}` : 'Merchant not found')
  }
}

export class ApiCredentialNotFoundError extends DomainNotFoundError {
  readonly code = 'credential_not_found'
  constructor(id?: string) {
    super(id ? `Credential not found: ${id}` : 'Credential not found')
  }
}

export class ApiClientNotFoundError extends DomainNotFoundError {
  readonly code = 'client_not_found'
  constructor(id?: string) {
    super(id ? `Client not found: ${id}` : 'Client not found')
  }
}

// ── 409 — Conflicto de estado ──────────────────────────────────────────
export class MerchantNotActiveError extends DomainConflictError {
  readonly code = 'merchant_not_active'
  constructor() {
    super('Merchant is not active')
  }
}

export class ApiClientMissingError extends DomainConflictError {
  readonly code = 'api_client_not_found'
  constructor() {
    super('API client not found for this merchant')
  }
}

export class ApiClientNotActiveError extends DomainConflictError {
  readonly code = 'api_client_suspended'
  constructor() {
    super('API client is suspended')
  }
}

export class CredentialAlreadyExistsError extends DomainConflictError {
  readonly code = 'credential_already_exists_for_environment'
  constructor() {
    super('Credential already exists for this environment')
  }
}

// ── 400 — Validación ───────────────────────────────────────────────────
export class TechnicalEmailRequiredError extends DomainValidationError {
  readonly code = 'technical_email_required'
  constructor() {
    super('Technical email is required')
  }
}

export class KycRequiredError extends DomainValidationError {
  readonly code = 'kyc_required'
  constructor() {
    super('KYC approval required for live keys')
  }
}
