// src/common/domain/errors/index.ts
export * from './domain.error'

import { DomainConflictError, DomainRuleError, DomainValidationError } from './domain.error'

// ── VO: Currency ───────────────────────────────────────────────────────
export class InvalidCurrencyCodeError extends DomainValidationError {
  readonly code = 'invalid_currency_code'
  constructor(code: string) {
    super(`Invalid ISO 4217 currency code: ${code}`)
  }
}

// ── VO: Money ──────────────────────────────────────────────────────────
export class CurrencyMismatchError extends DomainRuleError {
  readonly code = 'currency_mismatch'
  constructor() {
    super('Cannot operate on Money values with different currencies')
  }
}

export class InvalidMoneyPrecisionError extends DomainValidationError {
  readonly code = 'invalid_money_precision'
  constructor(msg: string) {
    super(msg)
  }
}

// ── VO: EntityId ───────────────────────────────────────────────────────
export class InvalidEntityIdError extends DomainValidationError {
  readonly code = 'invalid_entity_id'
  constructor(value?: string) {
    super(`Invalid entity ID${value ? `: "${value}"` : ''}`)
  }
}

// ── Ciclo de vida (compartido: AuthUser, MerchantProfile, Payment, ...) ─
export class InvalidStateTransitionError extends DomainConflictError {
  readonly code = 'invalid_state_transition'
  constructor(
    public readonly entity: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`${entity}: invalid state transition ${from} → ${to}`)
  }
}
