// merchant-request.orm.mapper.ts
import { MerchantRequest } from '../../domain/merchant-request.entity'
import { MerchantRequestOrmEntity } from './merchant-request.orm.entity'

export class MerchantRequestMapper {
  static toDomain(orm: MerchantRequestOrmEntity): MerchantRequest {
    return new MerchantRequest(
      orm.id,
      orm.userId,
      orm.ownerId,
      orm.status,
      orm.businessName,
      orm.businessCurrency,
      orm.taxId,
      orm.category,
      orm.requestedFeeBasisPoints,
      orm.createdAt,
      orm.updatedAt,
      orm.requestedAt,
      orm.provisionedLedgerAccountId ?? undefined,
      orm.expectedMonthlyVolume != null ? Number(orm.expectedMonthlyVolume) : undefined,
      orm.additionalNotes ?? undefined,
      orm.reviewedAt ?? undefined,
      orm.reviewedByAdminId ?? undefined,
      orm.reviewNotes ?? undefined,
    )
  }

  static toPersistence(domain: MerchantRequest): Partial<MerchantRequestOrmEntity> {
    return {
      id: domain.id,
      userId: domain.userId,
      ownerId: domain.ownerId,
      businessName: domain.businessName,
      taxId: domain.taxId,
      category: domain.category,
      provisionedLedgerAccountId: domain.provisionedLedgerAccountId ?? null,
      expectedMonthlyVolume:
        domain.expectedMonthlyVolume != null ? domain.expectedMonthlyVolume.toFixed(2) : null,
      businessCurrency: domain.businessCurrency,
      additionalNotes: domain.additionalNotes ?? null,
      requestedFeeBasisPoints: domain.requestedFeeBasisPoints,
      status: domain.status,
      requestedAt: domain.requestedAt,
      reviewedAt: domain.reviewedAt ?? null,
      reviewedByAdminId: domain.reviewedByAdminId ?? null,
      reviewNotes: domain.reviewNotes ?? null,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    }
  }
}
