// infrastructure/persistence/auth-user.orm.mapper.ts
import { AuthUser } from '../../domain/auth-user.entity'
import { AuthUserOrmEntity } from './auth-user.orm.entity'

export class AuthUserMapper {
  static toDomain(orm: AuthUserOrmEntity): AuthUser {
    return AuthUser.reconstitute(
      orm.id,
      orm.email,
      orm.emailVerified,
      [...orm.roles],
      orm.status,
      orm.twoFactorEnabled,
      orm.failedLoginAttempts,
      orm.createdAt,
      orm.updatedAt,
      orm.passwordHash ?? undefined,
      orm.emailVerifiedAt ?? undefined,
      orm.statusReason ?? undefined,
      orm.statusChangedAt ?? undefined,
      orm.bannedAt ?? undefined,
      orm.banReason ?? undefined,
      orm.bannedByAdminId ?? undefined,
      orm.lastLoginAt ?? undefined,
      orm.passwordChangedAt ?? undefined,
      orm.twoFactorSecret ?? undefined,
      orm.lockedUntil ?? undefined,
    )
  }

  static toPersistence(domain: AuthUser): Partial<AuthUserOrmEntity> {
    return {
      id: domain.id,
      email: domain.email,
      passwordHash: domain.passwordHash ?? null,
      emailVerified: domain.emailVerified,
      emailVerifiedAt: domain.emailVerifiedAt ?? null,
      roles: domain.roles,
      status: domain.status,
      statusReason: domain.statusReason ?? null,
      statusChangedAt: domain.statusChangedAt ?? null,
      bannedAt: domain.bannedAt ?? null,
      banReason: domain.banReason ?? null,
      bannedByAdminId: domain.bannedByAdminId ?? null,
      lastLoginAt: domain.lastLoginAt ?? null,
      passwordChangedAt: domain.passwordChangedAt ?? null,
      twoFactorEnabled: domain.twoFactorEnabled,
      twoFactorSecret: domain.twoFactorSecret ?? null,
      failedLoginAttempts: domain.failedLoginAttempts,
      lockedUntil: domain.lockedUntil ?? null,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    }
  }
}
