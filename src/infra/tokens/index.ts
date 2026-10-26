// ============================================================================
// DI Tokens — Identity module
// ============================================================================
// Interfaces de TypeScript se borran en runtime. NestJS necesita un valor
// runtime como token de inyección → usamos Symbol() por repo / puerto de
// salida. Convención: <CONCEPTO>_REPOSITORY (no el nombre de la interface).
// ============================================================================

// --- Repositories (puertos de salida hacia persistencia) ---
export const AUTH_USER_REPOSITORY = Symbol('AUTH_USER_REPOSITORY')
export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY')
export const MERCHANT_PROFILE_REPOSITORY = Symbol('MERCHANT_PROFILE_REPOSITORY')
export const MERCHANT_REQUEST_REPOSITORY = Symbol('MERCHANT_REQUEST_REPOSITORY')

// --- Repositories de api-access ---
export const API_CLIENT_REPOSITORY = Symbol('API_CLIENT_REPOSITORY')
export const API_CREDENTIAL_REPOSITORY = Symbol('API_CREDENTIAL_REPOSITORY')

// --- Puertos de salida a otros servicios (futuro, cuando los extraigas) ---
// export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER')
// export const TOKEN_SIGNER = Symbol('TOKEN_SIGNER')
// export const OUTBOX_PUBLISHER = Symbol('OUTBOX_PUBLISHER')

// --- Cross-module use cases (si los exportás a otros módulos) ---
// export const CREATE_API_CLIENT_USE_CASE = Symbol('CREATE_API_CLIENT_USE_CASE')

// --- auth-infra ---
export const HASH_SERVICE = Symbol('HASH_SERVICE')
export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE')
