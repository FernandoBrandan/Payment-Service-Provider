// src/common/domain/errors/domain.error.ts

/**
 * Base de toda la jerarquía de errores de dominio.
 * Cada clase concreta DEBE declarar `code` (string snake_case).
 * El `code` es contrato de wire; la clase es detalle interno.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

// ── Categorías (mapean 1:1 a HTTP status en el filtro) ─────────────────
export abstract class DomainValidationError extends DomainError {} // 400
export abstract class DomainAuthError extends DomainError {} // 401
export abstract class DomainForbiddenError extends DomainError {} // 403
export abstract class DomainNotFoundError extends DomainError {} // 404
export abstract class DomainConflictError extends DomainError {} // 409
export abstract class DomainRuleError extends DomainError {} // 422
