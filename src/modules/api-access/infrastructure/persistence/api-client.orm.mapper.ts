import { EntityId } from '@common/domain/vo/entity-id.vo'
import { ApiClient } from '../../domain/api-client.entity'
import { ApiClientOrmEntity } from './api-client.orm.entity'

export class ApiClientMapper {
  static toDomain(orm: ApiClientOrmEntity): ApiClient {
    return ApiClient.reconstitute(
      EntityId.from(orm.id),
      EntityId.from(orm.merchantProfileId),
      orm.name,
      orm.email,
      orm.status,
      orm.suspendedReason,
      orm.suspendedAt,
      orm.createdAt,
      orm.updatedAt,
    )
  }

  static toPersistence(domain: ApiClient): Partial<ApiClientOrmEntity> {
    return {
      id: domain.id.value,
      merchantProfileId: domain.merchantProfileId.value,
      name: domain.name,
      email: domain.email,
      status: domain.status,
      suspendedReason: domain.suspendedReason,
      suspendedAt: domain.suspendedAt,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    }
  }
}
