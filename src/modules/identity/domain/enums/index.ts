// ============================================================================
// Enums y tipos consolidados
// ============================================================================

import { UserProfile } from '../user-profile.entity'

export enum UserRole {
  CLIENT = 'CLIENT',
  MERCHANT = 'MERCHANT',
  ADMIN = 'ADMIN',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  BANNED = 'BANNED',
}

export enum KycStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DocumentType {
  DNI = 'DNI',
  PASSPORT = 'PASSPORT',
  CUIT = 'CUIT',
}

/** Estado del ciclo de vida de una solicitud de comercio. */
export enum MerchantRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
/** Cache denormalizado en IUserProfile del estado de la última solicitud. */
export enum MerchantApplicationStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** Estado del perfil de comercio (una vez aprobada la solicitud). */
export enum MerchantProfileStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  BANNED = 'BANNED',
}

// ============================================================================
// Value objects
// ============================================================================

export interface IAddress {
  street: string
  city: string
  state: string
  postalCode: string
  /** ISO 3166-1 alpha-2, ej: "AR", "MX", "ES". */
  country: string
}

export interface IUserPreferences {
  /** BCP 47, ej: "es-AR", "en-US". */
  language: string
  receiveEmailNotifications: boolean
  receiveSmsNotifications: boolean
  /** ISO 4217, ej: "USD", "EUR", "ARS". */
  currency: string
}

export const DEFAULT_USER_PREFERENCES: IUserPreferences = {
  language: 'es-AR',
  receiveEmailNotifications: true,
  receiveSmsNotifications: false,
  currency: 'ARS',
}

export const DEFAULT_MERCHANT_FEE_BPS = 250 // 2.5%

/**
 * Campos modificables por el propio usuario. Se excluyen:
 * - ids y FKs
 * - estado de cuenta (vive en IAuthUser)
 * - estado de KYC (solo lo modifica un admin)
 * - estado de solicitud de comercio (solo lo modifica el flujo de aprobación)
 */
export type UpdatableProfileFields = Pick<
  UserProfile,
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'dateOfBirth'
  | 'documentType'
  | 'documentId'
  | 'address'
  | 'avatarUrl'
>

// ============================================================================
// Info - kycStatus implementar con wallet
// ============================================================================

// pending: 	El usuario subió documentos (DNI, selfie, comprobante) y espera revisión.
// approved: 	Un admin (o un proveedor tipo Onfido, Sumsub, Jumio) validó la identidad.
// rejected: 	Documentos inválidos, vencidos, ilegibles o no coincidentes.
// kycStatus !== "approved" no debería poder convertirse en merchant
