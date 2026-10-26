// auth-user.orm.entity.ts
import { UserProfile } from '../../domain/user-profile.entity'
import { UserOrmEntity } from './user.orm.entity'

export class UserMapper {
  static toDomain(orm: UserOrmEntity): UserProfile {
    return UserProfile.reconstitute(
      orm.id,
      orm.userId,
      orm.firstName,
      orm.lastName,
      orm.preferences,
      orm.kycStatus,
      orm.merchantApplicationStatus,
      orm.createdAt,
      orm.updatedAt,
      orm.phone ?? undefined,
      orm.dateOfBirth ?? undefined,
      orm.documentType ?? undefined,
      orm.documentId ?? undefined,
      orm.address ?? undefined,
      orm.avatarUrl ?? undefined,
      orm.kycReviewedAt ?? undefined,
      orm.kycReviewedByAdminId ?? undefined,
      orm.ledgerAccountId ?? undefined,
      orm.merchantProfileId ?? undefined,
      orm.merchantRequestId ?? undefined,
      orm.deletedAt ?? undefined,
    )
  }

  static toPersistence(domain: UserProfile): Partial<UserOrmEntity> {
    return {
      id: domain.id,
      userId: domain.userId,
      firstName: domain.firstName,
      lastName: domain.lastName,
      preferences: domain.preferences,
      kycStatus: domain.kycStatus,
      merchantApplicationStatus: domain.merchantApplicationStatus,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
      phone: domain.phone ?? null,
      dateOfBirth: domain.dateOfBirth ?? null,
      documentType: domain.documentType ?? null,
      documentId: domain.documentId ?? null,
      address: domain.address ?? null,
      avatarUrl: domain.avatarUrl ?? null,
      kycReviewedAt: domain.kycReviewedAt ?? null,
      kycReviewedByAdminId: domain.kycReviewedByAdminId ?? null,
      ledgerAccountId: domain.ledgerAccountId ?? null,
      merchantProfileId: domain.merchantProfileId ?? null,
      merchantRequestId: domain.merchantRequestId ?? null,
      deletedAt: domain.deletedAt ?? null,
    }
  }
}
