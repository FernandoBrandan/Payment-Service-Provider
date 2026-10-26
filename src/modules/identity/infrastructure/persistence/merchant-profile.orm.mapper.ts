// merchant-profile.orm.mapper.ts
import { MerchantProfile } from '../../domain/merchant-profile.entity'
import { MerchantProfileOrmEntity } from './merchant-profile.orm.entity'

export class MerchantProfileMapper {
  static toDomain(orm: MerchantProfileOrmEntity): MerchantProfile {
    return new MerchantProfile(
      orm.id,
      orm.userId,
      orm.ownerId,
      orm.activeApiKeyCount,
      orm.businessName,
      orm.taxId,
      orm.category,
      orm.feeBasisPoints,
      orm.status,
      orm.createdAt,
      orm.updatedAt,
      orm.ledgerAccountId ?? undefined,
      orm.statusReason ?? undefined,
      orm.statusChangedAt ?? undefined,
      orm.approvedAt ?? undefined,
      orm.approvedByAdminId ?? undefined,
      orm.deactivatedAt ?? undefined,
      orm.deactivatedReason ?? undefined,
      orm.deactivatedByAdminId ?? undefined,
      orm.updatedByAdminId ?? undefined,
    )
  }

  static toPersistence(domain: MerchantProfile): Partial<MerchantProfileOrmEntity> {
    return {
      id: domain.id,
      userId: domain.userId,
      ownerId: domain.ownerId,
      ledgerAccountId: domain.ledgerAccountId ?? null,
      activeApiKeyCount: domain.activeApiKeyCount,
      businessName: domain.businessName,
      taxId: domain.taxId,
      category: domain.category,
      feeBasisPoints: domain.feeBasisPoints,
      status: domain.status,
      statusReason: domain.statusReason ?? null,
      statusChangedAt: domain.statusChangedAt ?? null,
      approvedAt: domain.approvedAt ?? null,
      approvedByAdminId: domain.approvedByAdminId ?? null,
      deactivatedAt: domain.deactivatedAt ?? null,
      deactivatedReason: domain.deactivatedReason ?? null,
      deactivatedByAdminId: domain.deactivatedByAdminId ?? null,
      updatedByAdminId: domain.updatedByAdminId ?? null,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    }
  }
}
